import { round2 } from "./format";

export type ExpenseRow = {
  id: string;
  total_amount: number;
  split_method: "equal" | "percentage";
  contributions: { member_id: string; amount: number }[];
  shares: { member_id: string; percentage: number | null }[];
};

export type SettlementRow = {
  from_member_id: string;
  to_member_id: string;
  amount: number;
};

/** Per-member net position. Positive = is owed; negative = owes. */
export function computeNetBalances(
  expenses: ExpenseRow[],
  settlements: SettlementRow[] = [],
  memberIds: string[] = [],
): Map<string, number> {
  const net = new Map<string, number>();
  const bump = (id: string, delta: number) => net.set(id, (net.get(id) ?? 0) + delta);
  for (const id of memberIds) net.set(id, 0);

  for (const e of expenses) {
    const total = Number(e.total_amount);
    for (const c of e.contributions) bump(c.member_id, Number(c.amount));
    const included = e.shares;
    if (included.length === 0) continue;
    if (e.split_method === "equal") {
      const share = total / included.length;
      for (const s of included) bump(s.member_id, -share);
    } else {
      for (const s of included) {
        const pct = Number(s.percentage ?? 0);
        bump(s.member_id, -(total * pct) / 100);
      }
    }
  }

  // Settlements: money moves from `from` to `to`. From has paid (reduces what they owe / increases credit),
  // To has been paid (reduces what they're owed).
  for (const s of settlements) {
    bump(s.from_member_id, Number(s.amount));
    bump(s.to_member_id, -Number(s.amount));
  }

  for (const [k, v] of net) net.set(k, round2(v));
  return net;
}

/** Greedy minimum-transaction settlement plan. */
export function minimizeSettlements(
  net: Map<string, number>,
): { from: string; to: string; amount: number }[] {
  const creditors: { id: string; v: number }[] = [];
  const debtors: { id: string; v: number }[] = [];
  for (const [id, v] of net) {
    if (v > 0.005) creditors.push({ id, v });
    else if (v < -0.005) debtors.push({ id, v: -v });
  }
  creditors.sort((a, b) => b.v - a.v);
  debtors.sort((a, b) => b.v - a.v);

  const plan: { from: string; to: string; amount: number }[] = [];
  let i = 0,
    j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].v, creditors[j].v);
    plan.push({ from: debtors[i].id, to: creditors[j].id, amount: round2(pay) });
    debtors[i].v -= pay;
    creditors[j].v -= pay;
    if (debtors[i].v < 0.005) i++;
    if (creditors[j].v < 0.005) j++;
  }
  return plan;
}