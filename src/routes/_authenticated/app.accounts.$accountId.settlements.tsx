import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { accountDataQO, settlementsQO, tripsQO } from "@/lib/queries";
import { AppShell, PageHeader, cardCls } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { createSettlement } from "@/lib/data.functions";
import { formatDate, formatZAR } from "@/lib/format";
import { computeNetBalances, minimizeSettlements, type ExpenseRow } from "@/lib/calc";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/accounts/$accountId/settlements")({
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(settlementsQO(params.accountId)),
      context.queryClient.ensureQueryData(accountDataQO(params.accountId)),
      context.queryClient.ensureQueryData(tripsQO(params.accountId)),
    ]),
  component: SettlementsPage,
});

function SettlementsPage() {
  const { accountId } = Route.useParams();
  const { data: settlements } = useSuspenseQuery(settlementsQO(accountId));
  const { data: account } = useSuspenseQuery(accountDataQO(accountId));
  const { data: trips } = useSuspenseQuery(tripsQO(accountId));
  const name = (id: string) => account.members.find((m) => m.id === id)?.name ?? "—";
  const tripName = (id: string | null) => trips.find((t) => t.id === id)?.name ?? "All-account";

  return (
    <AppShell accountId={accountId}>
      <PageHeader title="Settlements" action={<RecordDialog accountId={accountId} account={account} trips={trips} />} />
      {settlements.length === 0 ? (
        <div className={cardCls("text-center text-muted-foreground")}>No settlements recorded.</div>
      ) : (
        <ul className="grid gap-2">
          {settlements.map((s) => (
            <li key={s.id} className={cardCls("flex flex-wrap items-center justify-between gap-3")}>
              <div>
                <div className="font-medium">{name(s.from_member_id)} → {name(s.to_member_id)}</div>
                <div className="text-xs text-muted-foreground">{formatDate(s.date)} · {tripName(s.trip_id)}</div>
                {s.notes && <div className="mt-1 text-sm text-muted-foreground">{s.notes}</div>}
              </div>
              <div className="font-semibold tabular-nums">{formatZAR(Number(s.amount))}</div>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}

type AccountData = ReturnType<typeof useSuspenseQuery<typeof accountDataQO extends (id: string) => infer Q ? Q : never>>["data"];

function RecordDialog({ accountId, account, trips }: {
  accountId: string;
  account: { members: { id: string; name: string; archived_at: string | null }[]; expenses: any[]; contributions: any[]; shares: any[]; settlements: any[] };
  trips: { id: string; name: string }[];
}) {
  const members = account.members;
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState(0);
  const [tripId, setTripId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);

  const activeMemberIds = useMemo(() => members.filter((m) => !m.archived_at).map((m) => m.id), [members]);

  const buildExpenseRows = (filterTripId?: string): ExpenseRow[] =>
    account.expenses
      .filter((e: any) => !filterTripId || e.trip_id === filterTripId)
      .map((e: any) => ({
        id: e.id,
        total_amount: Number(e.total_amount),
        split_method: e.split_method,
        contributions: account.contributions
          .filter((c: any) => c.expense_id === e.id)
          .map((c: any) => ({ member_id: c.member_id, amount: Number(c.amount) })),
        shares: account.shares
          .filter((s: any) => s.expense_id === e.id)
          .map((s: any) => ({ member_id: s.member_id, percentage: s.percentage })),
      }));

  // Suggested plan based on current trip selection
  const suggestedPlan = useMemo(() => {
    if (tripId) {
      const rows = buildExpenseRows(tripId);
      const tripSettlements = account.settlements
        .filter((s: any) => s.trip_id === tripId)
        .map((s: any) => ({ from_member_id: s.from_member_id, to_member_id: s.to_member_id, amount: Number(s.amount) }));
      const net = computeNetBalances(rows, tripSettlements, activeMemberIds);
      return minimizeSettlements(net);
    }
    const rows = buildExpenseRows();
    const allSettlements = account.settlements.map((s: any) => ({ from_member_id: s.from_member_id, to_member_id: s.to_member_id, amount: Number(s.amount) }));
    const net = computeNetBalances(rows, allSettlements, activeMemberIds);
    return minimizeSettlements(net);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, account, activeMemberIds]);

  // Auto-default from/to/amount when trip changes (or on open), unless user has touched amount
  useEffect(() => {
    if (!open) return;
    setDate(new Date().toISOString().slice(0, 10));
    if (suggestedPlan.length > 0) {
      const top = suggestedPlan[0];
      if (!from) setFrom(top.from);
      if (!to) setTo(top.to);
      if (!amountTouched) setAmount(top.amount);
    } else if (!amountTouched) {
      setAmount(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, open]);

  // When from/to change, update amount suggestion from plan (unless touched)
  useEffect(() => {
    if (!open || amountTouched || !from || !to) return;
    const match = suggestedPlan.find((p) => p.from === from && p.to === to);
    if (match) setAmount(match.amount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, suggestedPlan]);

  const qc = useQueryClient();
  const create = useServerFn(createSettlement);
  const m = useMutation({
    mutationFn: () => create({ data: { accountId, date, fromMemberId: from, toMemberId: to, amount, tripId: tripId || undefined, notes } }),
    onSuccess: () => {
      toast.success("Settlement recorded");
      qc.invalidateQueries({ queryKey: ["settlements", accountId] });
      qc.invalidateQueries({ queryKey: ["account", accountId] });
      setOpen(false); setFrom(""); setTo(""); setAmount(0); setTripId(""); setNotes(""); setAmountTouched(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const active = members.filter((m) => !m.archived_at);
  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setAmountTouched(false); setFrom(""); setTo(""); setTripId(""); } }}>
      <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Record settlement</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Record settlement</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); if (from && to && from !== to && amount > 0) m.mutate(); }} className="space-y-4">
          <div className="space-y-2"><Label>Trip</Label>
            <Select value={tripId || "none"} onValueChange={(v) => { setTripId(v === "none" ? "" : v); setAmountTouched(false); setFrom(""); setTo(""); }}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Account-wide —</SelectItem>
                {trips.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>From</Label>
              <Select value={from} onValueChange={(v) => { setFrom(v); setAmountTouched(false); }}>
                <SelectTrigger><SelectValue placeholder="Payer" /></SelectTrigger>
                <SelectContent>{active.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>To</Label>
              <Select value={to} onValueChange={(v) => { setTo(v); setAmountTouched(false); }}>
                <SelectTrigger><SelectValue placeholder="Recipient" /></SelectTrigger>
                <SelectContent>{active.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
            <div className="space-y-2"><Label>Amount</Label><Input type="number" inputMode="decimal" step="0.01" min="0.01" value={amount} onFocus={(e) => e.target.select()} onChange={(e) => { setAmount(Number(e.target.value)); setAmountTouched(true); }} required /></div>
          </div>
          <div className="space-y-2"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} /></div>
          <DialogFooter><Button type="submit" disabled={m.isPending}>{m.isPending ? "Saving…" : "Record"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
