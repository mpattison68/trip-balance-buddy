import { cardCls } from "./AppShell";
import { formatZAR } from "@/lib/format";
import { cn } from "@/lib/utils";

export function BalanceCard({
  label,
  value,
  tone = "default",
  sub,
}: {
  label: string;
  value: number;
  tone?: "default" | "positive" | "negative";
  sub?: string;
}) {
  return (
    <div className={cardCls()}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          tone === "positive" && "text-[color:oklch(0.55_0.15_160)]",
          tone === "negative" && "text-destructive",
        )}
      >
        {formatZAR(value)}
      </div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function SettlementSummary({
  plan,
  memberName,
}: {
  plan: { from: string; to: string; amount: number }[];
  memberName: (id: string) => string;
}) {
  if (plan.length === 0) {
    return (
      <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
        All settled up ✨
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {plan.map((p, i) => (
        <li
          key={i}
          className="flex items-center justify-between rounded-lg border bg-card p-3 text-sm"
        >
          <span>
            <strong>{memberName(p.from)}</strong> owes{" "}
            <strong>{memberName(p.to)}</strong>
          </span>
          <span className="font-semibold tabular-nums">{formatZAR(p.amount)}</span>
        </li>
      ))}
    </ul>
  );
}
