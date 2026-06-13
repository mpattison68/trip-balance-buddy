import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { accountDataQO } from "@/lib/queries";
import { AppShell, PageHeader, cardCls } from "@/components/AppShell";
import { computeNetBalances, minimizeSettlements } from "@/lib/calc";
import { formatDate, formatZAR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/accounts/$accountId/history")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(accountDataQO(params.accountId)),
  component: HistoryPage,
});

type Row = { date: string; description: string; effect: string; tone?: "pos" | "neg" };

function HistoryPage() {
  const { accountId } = Route.useParams();
  const { data } = useSuspenseQuery(accountDataQO(accountId));
  const { trips, expenses, contributions, shares, settlements, members } = data;
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? "—";

  const rows: Row[] = [];

  // Per-trip net summary (using min-settlement to express in plain English)
  for (const t of trips) {
    const tripExpenses = expenses.filter((e) => e.trip_id === t.id);
    if (!tripExpenses.length) continue;
    const expRows = tripExpenses.map((e) => ({
      id: e.id,
      total_amount: Number(e.total_amount),
      split_method: e.split_method,
      contributions: contributions.filter((c) => c.expense_id === e.id).map((c) => ({ member_id: c.member_id, amount: Number(c.amount) })),
      shares: shares.filter((s) => s.expense_id === e.id).map((s) => ({ member_id: s.member_id, percentage: s.percentage })),
    }));
    const memberIds = members.filter((m) => !m.archived_at).map((m) => m.id);
    const net = computeNetBalances(expRows, [], memberIds);
    const plan = minimizeSettlements(net);
    for (const p of plan) {
      rows.push({
        date: t.end_date || t.start_date || "",
        description: `${t.name} trip`,
        effect: `${name(p.from)} owes ${name(p.to)} ${formatZAR(p.amount)}`,
        tone: "neg",
      });
    }
  }
  for (const s of settlements) {
    rows.push({
      date: s.date,
      description: "Settlement",
      effect: `${name(s.from_member_id)} paid ${name(s.to_member_id)} ${formatZAR(Number(s.amount))}`,
      tone: "pos",
    });
  }
  rows.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  // Final current position
  const memberIds = members.filter((m) => !m.archived_at).map((m) => m.id);
  const expAll = expenses.map((e) => ({
    id: e.id,
    total_amount: Number(e.total_amount),
    split_method: e.split_method,
    contributions: contributions.filter((c) => c.expense_id === e.id).map((c) => ({ member_id: c.member_id, amount: Number(c.amount) })),
    shares: shares.filter((s) => s.expense_id === e.id).map((s) => ({ member_id: s.member_id, percentage: s.percentage })),
  }));
  const netNow = computeNetBalances(
    expAll,
    settlements.map((s) => ({ from_member_id: s.from_member_id, to_member_id: s.to_member_id, amount: Number(s.amount) })),
    memberIds,
  );
  const planNow = minimizeSettlements(netNow);

  return (
    <AppShell accountId={accountId}>
      <PageHeader title="Balance history" />
      <div className={cardCls("mb-6")}>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Current balance</div>
        {planNow.length === 0 ? (
          <div className="mt-2 text-lg font-semibold text-emerald-600">All settled up</div>
        ) : (
          <ul className="mt-2 space-y-1">
            {planNow.map((p, i) => (
              <li key={i} className="font-semibold">{name(p.from)} owes {name(p.to)} <span className="tabular-nums">{formatZAR(p.amount)}</span></li>
            ))}
          </ul>
        )}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-muted-foreground">
            <th className="py-2">Date</th>
            <th className="py-2">Description</th>
            <th className="py-2">Effect</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t">
              <td className="py-2">{r.date ? formatDate(r.date) : "—"}</td>
              <td className="py-2">{r.description}</td>
              <td className={`py-2 ${r.tone === "neg" ? "text-foreground" : "text-emerald-700"}`}>{r.effect}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </AppShell>
  );
}
