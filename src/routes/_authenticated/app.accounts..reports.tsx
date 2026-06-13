import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { accountDataQO } from "@/lib/queries";
import { AppShell, PageHeader, cardCls } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { formatDate, formatZAR } from "@/lib/format";
import { computeNetBalances, minimizeSettlements } from "@/lib/calc";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/accounts/reports")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(accountDataQO(params.accountId)),
  component: ReportsPage,
});

function csvDownload(rows: (string | number)[][], filename: string) {
  const csv = rows.map((r) => r.map((c) => {
    const s = String(c ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function ReportsPage() {
  const { accountId } = Route.useParams();
  const { data } = useSuspenseQuery(accountDataQO(accountId));
  const { trips, expenses, contributions, shares, settlements, members } = data;
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? "—";
  const memberIds = members.filter((m) => !m.archived_at).map((m) => m.id);
  const year = new Date().getFullYear();

  const expRows = expenses.map((e) => ({
    id: e.id,
    total_amount: Number(e.total_amount),
    split_method: e.split_method,
    contributions: contributions.filter((c) => c.expense_id === e.id).map((c) => ({ member_id: c.member_id, amount: Number(c.amount) })),
    shares: shares.filter((s) => s.expense_id === e.id).map((s) => ({ member_id: s.member_id, percentage: s.percentage })),
  }));

  const netAll = computeNetBalances(
    expRows,
    settlements.map((s) => ({ from_member_id: s.from_member_id, to_member_id: s.to_member_id, amount: Number(s.amount) })),
    memberIds,
  );

  // Participant summary
  const participantRows = members.filter((m) => !m.archived_at).map((m) => {
    const paid = contributions.filter((c) => c.member_id === m.id).reduce((s, c) => s + Number(c.amount), 0);
    const share = expRows.reduce((sum, e) => {
      const incl = e.shares.find((s) => s.member_id === m.id);
      if (!incl) return sum;
      if (e.split_method === "equal") return sum + e.total_amount / e.shares.length;
      return sum + (e.total_amount * Number(incl.percentage ?? 0)) / 100;
    }, 0);
    const net = netAll.get(m.id) ?? 0;
    return { name: m.name, paid, share, net };
  });

  function exportTripSummary() {
    const rows: (string | number)[][] = [["Trip", "Date", "Description", "Category id", "Total"]];
    for (const t of trips) {
      for (const e of expenses.filter((x) => x.trip_id === t.id)) {
        rows.push([t.name, e.date, e.description, e.category_id ?? "", Number(e.total_amount)]);
      }
    }
    csvDownload(rows, "trip-summary.csv");
  }
  function exportParticipants() {
    const rows: (string | number)[][] = [["Member", "Paid", "Fair share", "Net"]];
    for (const r of participantRows) rows.push([r.name, r.paid, r.share, r.net]);
    csvDownload(rows, "participant-summary.csv");
  }
  function exportYTD() {
    const rows: (string | number)[][] = [["Section", "Detail", "Amount"]];
    const ytdTripIds = new Set(trips.filter((t) => t.end_date && new Date(t.end_date).getFullYear() === year).map((t) => t.id));
    const ytdExpenses = expenses.filter((e) => ytdTripIds.has(e.trip_id));
    rows.push(["YTD spend", `${year}`, ytdExpenses.reduce((s, e) => s + Number(e.total_amount), 0)]);
    const ytdNet = computeNetBalances(
      expRows.filter((e) => ytdExpenses.some((x) => x.id === e.id)),
      settlements.filter((s) => s.trip_id && ytdTripIds.has(s.trip_id)).map((s) => ({ from_member_id: s.from_member_id, to_member_id: s.to_member_id, amount: Number(s.amount) })),
      memberIds,
    );
    for (const p of minimizeSettlements(ytdNet)) rows.push(["Open balance", `${name(p.from)} → ${name(p.to)}`, p.amount]);
    for (const s of settlements.filter((s) => new Date(s.date).getFullYear() === year)) {
      rows.push(["Settlement", `${name(s.from_member_id)} → ${name(s.to_member_id)} (${formatDate(s.date)})`, Number(s.amount)]);
    }
    csvDownload(rows, `ytd-${year}.csv`);
  }

  return (
    <AppShell accountId={accountId}>
      <PageHeader title="Reports" />
      <section className="grid gap-4 sm:grid-cols-3">
        <div className={cardCls()}>
          <h3 className="font-semibold">Trip summary</h3>
          <p className="mt-1 text-sm text-muted-foreground">All trips with expenses and totals.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={exportTripSummary}><Download className="mr-2 h-4 w-4" /> CSV</Button>
        </div>
        <div className={cardCls()}>
          <h3 className="font-semibold">Participant summary</h3>
          <p className="mt-1 text-sm text-muted-foreground">Total paid, share owed, net position per member.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={exportParticipants}><Download className="mr-2 h-4 w-4" /> CSV</Button>
        </div>
        <div className={cardCls()}>
          <h3 className="font-semibold">Year-to-date ({year})</h3>
          <p className="mt-1 text-sm text-muted-foreground">Spend, open balances and settlements this year.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={exportYTD}><Download className="mr-2 h-4 w-4" /> CSV</Button>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Participant summary</h2>
        <div className={cardCls()}>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-muted-foreground"><th className="py-1">Member</th><th className="py-1 text-right">Paid</th><th className="py-1 text-right">Fair share</th><th className="py-1 text-right">Net</th></tr></thead>
            <tbody>
              {participantRows.map((r) => (
                <tr key={r.name} className="border-t">
                  <td className="py-2">{r.name}</td>
                  <td className="py-2 text-right tabular-nums">{formatZAR(r.paid)}</td>
                  <td className="py-2 text-right tabular-nums">{formatZAR(r.share)}</td>
                  <td className={`py-2 text-right tabular-nums ${r.net > 0 ? "text-emerald-600" : r.net < 0 ? "text-destructive" : ""}`}>{formatZAR(r.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
