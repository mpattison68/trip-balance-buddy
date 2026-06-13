import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { membersQO, tripDetailQO, categoriesQO } from "@/lib/queries";
import { AppShell, PageHeader, cardCls } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BalanceCard, SettlementSummary } from "@/components/BalanceCard";
import { computeNetBalances, minimizeSettlements } from "@/lib/calc";
import { archiveExpense, updateTrip } from "@/lib/data.functions";
import { formatDate, formatZAR } from "@/lib/format";
import { Plus, Pencil, Archive } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/accounts/trips/")({
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(tripDetailQO(params.tripId)),
      context.queryClient.ensureQueryData(membersQO(params.accountId)),
      context.queryClient.ensureQueryData(categoriesQO(params.accountId)),
    ]),
  component: TripPage,
});

function TripPage() {
  const { accountId, tripId } = Route.useParams();
  const { data: detail } = useSuspenseQuery(tripDetailQO(tripId));
  const { data: members } = useSuspenseQuery(membersQO(accountId));
  const { data: cats } = useSuspenseQuery(categoriesQO(accountId));
  const qc = useQueryClient();
  const updT = useServerFn(updateTrip);
  const arc = useServerFn(archiveExpense);

  const { trip, expenses, contributions, shares, settlements } = detail;
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const catById = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats]);
  const memberName = (id: string) => memberById.get(id)?.name ?? "—";
  const activeIds = members.filter((m) => !m.archived_at).map((m) => m.id);

  const expRows = expenses.map((e) => ({
    id: e.id,
    total_amount: Number(e.total_amount),
    split_method: e.split_method,
    contributions: contributions.filter((c) => c.expense_id === e.id).map((c) => ({ member_id: c.member_id, amount: Number(c.amount) })),
    shares: shares.filter((s) => s.expense_id === e.id).map((s) => ({ member_id: s.member_id, percentage: s.percentage })),
  }));
  const setRows = settlements.map((s) => ({ from_member_id: s.from_member_id, to_member_id: s.to_member_id, amount: Number(s.amount) }));

  const totalCost = expRows.reduce((s, e) => s + e.total_amount, 0);
  const contributionsByMember = new Map<string, number>();
  const sharesByMember = new Map<string, number>();
  for (const e of expRows) {
    for (const c of e.contributions) contributionsByMember.set(c.member_id, (contributionsByMember.get(c.member_id) ?? 0) + c.amount);
    if (e.shares.length) {
      if (e.split_method === "equal") {
        const share = e.total_amount / e.shares.length;
        for (const s of e.shares) sharesByMember.set(s.member_id, (sharesByMember.get(s.member_id) ?? 0) + share);
      } else {
        for (const s of e.shares) sharesByMember.set(s.member_id, (sharesByMember.get(s.member_id) ?? 0) + (e.total_amount * Number(s.percentage ?? 0)) / 100);
      }
    }
  }
  const net = computeNetBalances(expRows, setRows, activeIds);
  const plan = minimizeSettlements(net);
  const outstanding = plan.reduce((s, p) => s + p.amount, 0);
  const totalPos = Array.from(net.values()).filter((v) => v > 0).reduce((s, v) => s + v, 0);
  const financial = outstanding < 0.01 ? "Fully Settled" : outstanding < totalPos ? "Partially Settled" : "Open";

  const updateStatus = useMutation({
    mutationFn: (status: "planning" | "active" | "closed") => updT({ data: { id: tripId, status } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["trip", tripId] }); qc.invalidateQueries({ queryKey: ["account", accountId] }); qc.invalidateQueries({ queryKey: ["trips", accountId] }); toast.success("Status updated"); },
  });
  const archiveExp = useMutation({
    mutationFn: (id: string) => arc({ data: { id, archived: true } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["trip", tripId] }); qc.invalidateQueries({ queryKey: ["account", accountId] }); toast.success("Expense archived"); },
  });

  return (
    <AppShell accountId={accountId}>
      <PageHeader
        title={trip.name}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={trip.status} onValueChange={(v) => updateStatus.mutate(v as any)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="planning">Planning</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Button asChild>
              <Link to="/app/accounts/$accountId/trips/$tripId/expenses/new" params={{ accountId, tripId }}>
                <Plus className="mr-2 h-4 w-4" /> Add expense
              </Link>
            </Button>
          </div>
        }
      />

      <div className="mb-2 text-sm text-muted-foreground">
        {trip.start_date ? formatDate(trip.start_date) : "—"} → {trip.end_date ? formatDate(trip.end_date) : "—"} · <span className="font-medium text-foreground">{financial}</span>
      </div>

      <section className="my-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <BalanceCard label="Total cost" value={totalCost} />
        <BalanceCard label="Outstanding" value={outstanding} tone={outstanding > 0 ? "negative" : "default"} />
        <BalanceCard label="Contributions" value={Array.from(contributionsByMember.values()).reduce((s, v) => s + v, 0)} />
        <BalanceCard label="Members involved" value={activeIds.length} sub="active in account" />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className={cardCls()}>
          <h3 className="mb-3 font-semibold">Settlement plan</h3>
          <SettlementSummary plan={plan} memberName={memberName} />
        </div>
        <div className={cardCls()}>
          <h3 className="mb-3 font-semibold">By participant</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="py-1">Member</th>
                <th className="py-1 text-right">Paid</th>
                <th className="py-1 text-right">Fair share</th>
                <th className="py-1 text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {members.filter((m) => !m.archived_at).map((m) => {
                const paid = contributionsByMember.get(m.id) ?? 0;
                const share = sharesByMember.get(m.id) ?? 0;
                const n = net.get(m.id) ?? 0;
                return (
                  <tr key={m.id} className="border-t">
                    <td className="py-2">{m.name}</td>
                    <td className="py-2 text-right tabular-nums">{formatZAR(paid)}</td>
                    <td className="py-2 text-right tabular-nums">{formatZAR(share)}</td>
                    <td className={`py-2 text-right tabular-nums ${n > 0 ? "text-emerald-600" : n < 0 ? "text-destructive" : ""}`}>{formatZAR(n)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Expenses</h2>
        {expenses.length === 0 ? (
          <div className={cardCls("text-sm text-muted-foreground")}>No expenses yet. Add the first one to get started.</div>
        ) : (
          <ul className="grid gap-2">
            {expenses.map((e) => (
              <li key={e.id} className={cardCls("flex flex-wrap items-center justify-between gap-3")}>
                <div className="min-w-0">
                  <div className="font-medium">{e.description}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(e.date)} · {catById.get(e.category_id ?? "")?.name ?? "Uncategorised"} · {e.split_method === "equal" ? "Equal split" : "Percentage split"}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right font-semibold tabular-nums">{formatZAR(Number(e.total_amount))}</div>
                  <Button asChild variant="ghost" size="icon">
                    <Link to="/app/accounts/$accountId/trips/$tripId/expenses/$expenseId/edit" params={{ accountId, tripId, expenseId: e.id }}>
                      <Pencil className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm("Archive this expense?")) archiveExp.mutate(e.id); }}>
                    <Archive className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
