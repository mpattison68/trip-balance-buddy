import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { accountDataQO } from "@/lib/queries";
import { AppShell, PageHeader, cardCls } from "@/components/AppShell";
import { BalanceCard, SettlementSummary } from "@/components/BalanceCard";
import { Button } from "@/components/ui/button";
import { computeNetBalances, minimizeSettlements, type ExpenseRow, type SettlementRow } from "@/lib/calc";
import { formatDate, formatZAR } from "@/lib/format";
import { Plus, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/accounts/$accountId")({
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

  const now = new Date();
  const year = now.getFullYear();

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
  const lifetimeOpen = lifetimePlan.reduce((s, p) => s + p.amount, 0);

  // YTD
  const ytdTripIds = new Set(
    trips.filter((t) => t.end_date && new Date(t.end_date).getFullYear() === year).map((t) => t.id),
  );
  const ytdExpenseIds = new Set(expenses.filter((e) => ytdTripIds.has(e.trip_id)).map((e) => e.id));
  const ytdSpend = expenses
    .filter((e) => ytdExpenseIds.has(e.id))
    .reduce((s, e) => s + Number(e.total_amount), 0);
  const ytdSettlements: SettlementRow[] = settlements
    .filter((s) => s.trip_id && ytdTripIds.has(s.trip_id))
    .map((s) => ({
      from_member_id: s.from_member_id,
      to_member_id: s.to_member_id,
      amount: Number(s.amount),
    }));
  const ytdNet = computeNetBalances(buildExpenseRows(ytdExpenseIds), ytdSettlements, activeMemberIds);
  const ytdOpen = minimizeSettlements(ytdNet).reduce((s, p) => s + p.amount, 0);

  const openTrips = trips.filter((t) => t.status !== "closed");
  const recentClosed = trips
    .filter((t) => t.status === "closed")
    .sort((a, b) => (b.end_date ?? "").localeCompare(a.end_date ?? ""))
    .slice(0, 5);

  return (
    <AppShell accountId={accountId}>
      <PageHeader
        title={account.name}
        action={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/app/accounts/$accountId/settlements" params={{ accountId }}>Record settlement</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/app/accounts/$accountId/trips/new" params={{ accountId }}>
                <Plus className="mr-1 h-4 w-4" /> New trip
              </Link>
            </Button>
          </div>
        }
      />

      <section className="mb-6">
        <div className={cardCls("border-primary/30 bg-primary/5")}>
          <div className="text-sm uppercase tracking-wide text-primary">Current position</div>
          <div className="mt-2 space-y-1">
            <SettlementSummary plan={lifetimePlan} memberName={memberName} />
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <BalanceCard label="Open balance" value={lifetimeOpen} tone={lifetimeOpen > 0 ? "negative" : "default"} sub="Outstanding across all trips" />
        <BalanceCard label={`YTD spend (${year})`} value={ytdSpend} sub={`${ytdTripIds.size} trip${ytdTripIds.size === 1 ? "" : "s"} this year`} />
        <BalanceCard label="YTD balance" value={ytdOpen} sub="Open for trips ending this year" />
        <BalanceCard label="Lifetime balance" value={lifetimeOpen} sub="Total open since account start" />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Open trips</h2>
            <Link to="/app/accounts/$accountId/trips" params={{ accountId }} className="text-sm text-primary hover:underline">
              View all <ArrowRight className="ml-1 inline h-3 w-3" />
            </Link>
          </div>
          {openTrips.length === 0 ? (
            <div className={cardCls("text-sm text-muted-foreground")}>No open trips.</div>
          ) : (
            <ul className="space-y-2">
              {openTrips.slice(0, 6).map((t) => (
                <li key={t.id}>
                  <Link
                    to="/app/accounts/$accountId/trips/$tripId"
                    params={{ accountId, tripId: t.id }}
                    className={cardCls("flex items-center justify-between transition hover:border-primary/40")}
                  >
                    <div>
                      <div className="font-medium">{t.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {t.start_date ? formatDate(t.start_date) : "—"} → {t.end_date ? formatDate(t.end_date) : "—"}
                      </div>
                    </div>
                    <span className="rounded-full bg-secondary px-2 py-1 text-xs capitalize">{t.status}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-lg font-semibold">Recently closed</h2>
          {recentClosed.length === 0 ? (
            <div className={cardCls("text-sm text-muted-foreground")}>No closed trips yet.</div>
          ) : (
            <ul className="space-y-2">
              {recentClosed.map((t) => {
                const totalSpent = expenses
                  .filter((e) => e.trip_id === t.id)
                  .reduce((s, e) => s + Number(e.total_amount), 0);
                return (
                  <li key={t.id}>
                    <Link
                      to="/app/accounts/$accountId/trips/$tripId"
                      params={{ accountId, tripId: t.id }}
                      className={cardCls("flex items-center justify-between transition hover:border-primary/40")}
                    >
                      <div>
                        <div className="font-medium">{t.name}</div>
                        <div className="text-xs text-muted-foreground">Ended {formatDate(t.end_date)}</div>
                      </div>
                      <span className="text-sm tabular-nums">{formatZAR(totalSpent)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </AppShell>
  );
}
