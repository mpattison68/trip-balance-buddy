import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { accountDataQO, tripsQO } from "@/lib/queries";
import { AppShell, PageHeader, cardCls } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, formatZAR } from "@/lib/format";
import { computeNetBalances, minimizeSettlements } from "@/lib/calc";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/accounts/$accountId/trips/")({
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(tripsQO(params.accountId)),
      context.queryClient.ensureQueryData(accountDataQO(params.accountId)),
    ]),
  component: TripsList,
});

function TripsList() {
  const { accountId } = Route.useParams();
  const { data: trips } = useSuspenseQuery(tripsQO(accountId));
  const { data: account } = useSuspenseQuery(accountDataQO(accountId));
  const { expenses, contributions, shares, settlements, members } = account;

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [year, setYear] = useState<string>("all");

  const years = useMemo(() => {
    const s = new Set<string>();
    trips.forEach((t) => t.start_date && s.add(String(new Date(t.start_date).getFullYear())));
    return Array.from(s).sort().reverse();
  }, [trips]);

  const memberIds = members.filter((m) => !m.archived_at).map((m) => m.id);

  const tripFinancial = (tripId: string) => {
    const tripExpenses = expenses
      .filter((e) => e.trip_id === tripId)
      .map((e) => ({
        id: e.id,
        total_amount: Number(e.total_amount),
        split_method: e.split_method,
        contributions: contributions
          .filter((c) => c.expense_id === e.id)
          .map((c) => ({ member_id: c.member_id, amount: Number(c.amount) })),
        shares: shares
          .filter((s) => s.expense_id === e.id)
          .map((s) => ({ member_id: s.member_id, percentage: s.percentage })),
      }));
    const totalCost = tripExpenses.reduce((s, e) => s + e.total_amount, 0);
    const net = computeNetBalances(
      tripExpenses,
      settlements
        .filter((s) => s.trip_id === tripId)
        .map((s) => ({ from_member_id: s.from_member_id, to_member_id: s.to_member_id, amount: Number(s.amount) })),
      memberIds,
    );
    const plan = minimizeSettlements(net);
    const outstanding = plan.reduce((s, p) => s + p.amount, 0);
    const totalPositive = Array.from(net.values()).filter((v) => v > 0).reduce((s, v) => s + v, 0);
    const financial: "open" | "partial" | "fully" = outstanding < 0.01 ? "fully" : outstanding < totalPositive ? "partial" : "open";
    return { totalCost, outstanding, financial };
  };

  const filtered = trips.filter((t) => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (status !== "all" && t.status !== status) return false;
    if (year !== "all" && (!t.start_date || String(new Date(t.start_date).getFullYear()) !== year)) return false;
    return true;
  });

  return (
    <AppShell accountId={accountId}>
      <PageHeader
        title="Trips"
        action={
          <Button asChild>
            <Link to="/app/accounts/$accountId/trips/new" params={{ accountId }}>
              <Plus className="mr-2 h-4 w-4" /> New trip
            </Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search trips…" className="max-w-xs" />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="planning">Planning</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="closed">Past</SelectItem>
          </SelectContent>
        </Select>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Year" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All years</SelectItem>
            {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className={cardCls("text-center text-muted-foreground")}>No trips match.</div>
      ) : (
        <ul className="grid gap-2">
          {filtered.map((t) => {
            const f = tripFinancial(t.id);
            return (
              <li key={t.id}>
                <Link to="/app/accounts/$accountId/trips/$tripId" params={{ accountId, tripId: t.id }} className={cardCls("grid grid-cols-12 items-center gap-2 transition hover:border-primary/40")}>
                  <div className="col-span-12 sm:col-span-5">
                    <div className="font-medium">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.start_date ? formatDate(t.start_date) : "—"} → {t.end_date ? formatDate(t.end_date) : "—"}</div>
                  </div>
                  <div className="col-span-4 sm:col-span-2 text-xs uppercase tracking-wide text-muted-foreground">{t.status}</div>
                  <div className="col-span-4 sm:col-span-2 text-sm tabular-nums">{formatZAR(f.totalCost)}</div>
                  <div className="col-span-4 sm:col-span-2 text-sm tabular-nums">{formatZAR(f.outstanding)}</div>
                  <div className="col-span-12 sm:col-span-1 text-right text-xs">
                    <span className={
                      f.financial === "fully" ? "rounded-full bg-emerald-100 px-2 py-1 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" :
                      f.financial === "partial" ? "rounded-full bg-amber-100 px-2 py-1 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" :
                      "rounded-full bg-muted px-2 py-1"
                    }>{f.financial === "fully" ? "Settled" : f.financial === "partial" ? "Partial" : "Open"}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
