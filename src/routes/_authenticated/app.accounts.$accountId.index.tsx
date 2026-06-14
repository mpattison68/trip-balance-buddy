import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { accountDataQO } from "@/lib/queries";
import { AppShell, PageHeader, cardCls } from "@/components/AppShell";
import { SettlementSummary } from "@/components/BalanceCard";
import { Button } from "@/components/ui/button";
import { computeNetBalances, minimizeSettlements, type ExpenseRow } from "@/lib/calc";
import { formatDate, formatZAR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/accounts/$accountId/")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(accountDataQO(params.accountId)),
  component: AccountDashboard,
});

function AccountDashboard() {
  const { accountId } = Route.useParams();
  const { data } = useSuspenseQuery(accountDataQO(accountId));
  const { account, members, trips, expenses, contributions, shares, settlements } = data;
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const memberName = (id: string) => memberById.get(id)?.name ?? "Unknown";
  const activeMemberIds = members.filter((m) => !m.archived_at).map((m) => m.id);

  const buildExpenseRows = (filterIds?: Set<string>): ExpenseRow[] =>
    expenses
      .filter((e) => !filterIds || filterIds.has(e.id))
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

  // Lifetime net
  const lifetimeNet = computeNetBalances(
    buildExpenseRows(),
    settlements.map((s) => ({
      from_member_id: s.from_member_id,
      to_member_id: s.to_member_id,
      amount: Number(s.amount),
    })),
    activeMemberIds,
  );
  const lifetimePlan = minimizeSettlements(lifetimeNet);

  // Per-trip summaries, oldest -> newest by start_date (fallback created_at)
  const sortKey = (t: (typeof trips)[number]) => t.start_date ?? t.end_date ?? "";
  const sortedTrips = [...trips].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

  const tripSummaries = sortedTrips.map((t) => {
    const tripExpenseRows = buildExpenseRows(
      new Set(expenses.filter((e) => e.trip_id === t.id).map((e) => e.id)),
    );
    const totalSpend = tripExpenseRows.reduce((s, e) => s + e.total_amount, 0);

    // Per-member spend (contributions)
    const spendBy = new Map<string, number>();
    for (const e of tripExpenseRows) {
      for (const c of e.contributions) {
        spendBy.set(c.member_id, (spendBy.get(c.member_id) ?? 0) + c.amount);
      }
    }

    const tripSettlements = settlements
      .filter((s) => s.trip_id === t.id)
      .map((s) => ({
        from_member_id: s.from_member_id,
        to_member_id: s.to_member_id,
        amount: Number(s.amount),
      }));
    const net = computeNetBalances(tripExpenseRows, tripSettlements, activeMemberIds);
    const plan = minimizeSettlements(net);
    return { trip: t, totalSpend, spendBy, plan };
  });

  return (
    <AppShell accountId={accountId}>
      <PageHeader
        title={account.name}
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/app/accounts/$accountId/settlements" params={{ accountId }}>
              Record settlement
            </Link>
          </Button>
        }
      />

      {members.filter((m) => !m.archived_at).length <= 1 && (
        <section className="mb-6">
          <div className={cardCls("flex flex-wrap items-center justify-between gap-3 border-amber-500/40 bg-amber-500/5")}>
            <div>
              <div className="font-semibold">Add your fellow travellers</div>
              <div className="text-sm text-muted-foreground">Add everyone who shares trip costs before creating a trip.</div>
            </div>
            <Button asChild size="sm">
              <Link to="/app/accounts/$accountId/members" params={{ accountId }}>Manage members</Link>
            </Button>
          </div>
        </section>
      )}

      <section className="mb-6">
        <div className={cardCls("border-primary/30 bg-primary/5")}>
          <div className="text-sm uppercase tracking-wide text-primary">Total owed</div>
          <div className="mt-2 space-y-1">
            <SettlementSummary plan={lifetimePlan} memberName={memberName} />
          </div>
        </div>
      </section>

      <section className="mt-2">
        <h2 className="mb-3 text-lg font-semibold">Trips</h2>
        {tripSummaries.length === 0 ? (
          <div className={cardCls("text-sm text-muted-foreground")}>
            No trips yet. Use “New trip” at the top to add one.
          </div>
        ) : (
          <ul className="space-y-3">
            {tripSummaries.map(({ trip: t, totalSpend, spendBy, plan }) => {
              const spendEntries = Array.from(spendBy.entries())
                .filter(([, v]) => v > 0)
                .sort((a, b) => b[1] - a[1]);
              return (
                <li key={t.id}>
                  <Link
                    to="/app/accounts/$accountId/trips/$tripId"
                    params={{ accountId, tripId: t.id }}
                    className={cardCls("block transition hover:border-primary/40")}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{t.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {t.start_date ? formatDate(t.start_date) : "—"} →{" "}
                          {t.end_date ? formatDate(t.end_date) : "—"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">
                          Total spend
                        </div>
                        <div className="text-base font-semibold tabular-nums">
                          {formatZAR(totalSpend)}
                        </div>
                      </div>
                    </div>

                    {spendEntries.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">
                          Spent by member
                        </div>
                        <ul className="mt-1 grid gap-1 sm:grid-cols-2">
                          {spendEntries.map(([id, v]) => (
                            <li key={id} className="flex justify-between text-sm">
                              <span>{memberName(id)}</span>
                              <span className="tabular-nums">{formatZAR(v)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="mt-3">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        Who owes whom
                      </div>
                      {plan.length === 0 ? (
                        <div className="mt-1 text-sm text-emerald-600">All settled up</div>
                      ) : (
                        <ul className="mt-1 space-y-0.5 text-sm">
                          {plan.map((p, i) => (
                            <li key={i}>
                              <span className="font-medium">{memberName(p.from)}</span> owes{" "}
                              <span className="font-medium">{memberName(p.to)}</span>{" "}
                              <span className="tabular-nums">{formatZAR(p.amount)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
