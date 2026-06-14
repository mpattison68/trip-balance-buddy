import { useState, useEffect, useMemo } from "react";
import { format, parse, isValid } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cardCls } from "./AppShell";
import { formatZAR } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ExpenseFormValue = {
  date: string;
  description: string;
  categoryId: string | null;
  totalAmount: number;
  notes: string;
  splitMethod: "equal" | "percentage";
  contributions: Record<string, number>;
  shareIncluded: Record<string, boolean>;
  sharePct: Record<string, number>;
};

export function ExpenseForm({
  members,
  categories,
  initial,
  onSubmit,
  submitting,
}: {
  members: { id: string; name: string; archived_at: string | null }[];
  categories: { id: string; name: string }[];
  initial?: Partial<ExpenseFormValue>;
  onSubmit: (v: ExpenseFormValue) => void;
  submitting?: boolean;
}) {
  const activeMembers = useMemo(() => members.filter((m) => !m.archived_at), [members]);

  const [date, setDate] = useState(initial?.date ?? new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState(initial?.description ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(initial?.categoryId ?? null);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [splitMethod, setSplitMethod] = useState<"equal" | "percentage">(initial?.splitMethod ?? "equal");
  const [contributions, setContributions] = useState<Record<string, number>>(initial?.contributions ?? {});
  const [shareIncluded, setShareIncluded] = useState<Record<string, boolean>>(
    initial?.shareIncluded ?? Object.fromEntries(activeMembers.map((m) => [m.id, true])),
  );
  const [sharePct, setSharePct] = useState<Record<string, number>>(initial?.sharePct ?? {});

  useEffect(() => {
    if (!initial) {
      setShareIncluded((prev) => {
        const next = { ...prev };
        for (const m of activeMembers) if (!(m.id in next)) next[m.id] = true;
        return next;
      });
    }
  }, [activeMembers, initial]);

  const contribTotal = Object.values(contributions).reduce((s, v) => s + Number(v || 0), 0);
  const totalAmount = Math.round(contribTotal * 100) / 100;
  const pctTotal = Object.entries(sharePct).filter(([id]) => shareIncluded[id]).reduce((s, [, v]) => s + Number(v || 0), 0);

  const dateObj = date ? parse(date, "yyyy-MM-dd", new Date()) : undefined;
  const dateValid = dateObj && isValid(dateObj);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      date,
      description,
      categoryId,
      totalAmount,
      notes,
      splitMethod,
      contributions,
      shareIncluded,
      sharePct,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className={cardCls("space-y-4")}>
        <div className="space-y-2">
          <Label>Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className={cn("w-full justify-start text-left font-normal", !dateValid && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateValid ? format(dateObj!, "dd/MM/yyyy") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateValid ? dateObj : undefined}
                onSelect={(d) => d && setDate(format(d, "yyyy-MM-dd"))}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2"><Label>Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} required maxLength={200} placeholder="Dinner at Cape Coast" /></div>
        <div className="space-y-2"><Label>Category</Label>
          <Select value={categoryId ?? "none"} onValueChange={(v) => setCategoryId(v === "none" ? null : v)}>
            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Uncategorised</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} /></div>
      </div>

      <div className={cardCls("space-y-3")}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Who paid?</h3>
          <div className="text-sm tabular-nums">
            <span className="text-muted-foreground">Total: </span>
            <span className="font-semibold">{formatZAR(totalAmount)}</span>
          </div>
        </div>
        <div className="grid gap-2">
          {activeMembers.map((m) => (
            <div key={m.id} className="flex items-center gap-3">
              <span className="w-32 shrink-0 text-sm">{m.name}</span>
              <Input type="number" inputMode="decimal" step="0.01" min="0" value={contributions[m.id] ?? 0}
                onChange={(e) => setContributions({ ...contributions, [m.id]: Number(e.target.value) })} />
            </div>
          ))}
        </div>
      </div>

      <div className={cardCls("space-y-3")}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">How is it split?</h3>
          <Select value={splitMethod} onValueChange={(v) => setSplitMethod(v as any)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="equal">Equal split</SelectItem>
              <SelectItem value="percentage">Percentage</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          {activeMembers.map((m) => (
            <div key={m.id} className="flex items-center gap-3">
              <Checkbox checked={!!shareIncluded[m.id]} onCheckedChange={(v) => setShareIncluded({ ...shareIncluded, [m.id]: !!v })} id={`s-${m.id}`} />
              <Label htmlFor={`s-${m.id}`} className="w-32 shrink-0">{m.name}</Label>
              {splitMethod === "percentage" && (
                <Input type="number" inputMode="decimal" step="0.01" min="0" max="100" value={sharePct[m.id] ?? 0}
                  disabled={!shareIncluded[m.id]}
                  onChange={(e) => setSharePct({ ...sharePct, [m.id]: Number(e.target.value) })}
                  placeholder="%" className="w-24" />
              )}
            </div>
          ))}
        </div>
        {splitMethod === "percentage" && (
          <div className={`text-sm tabular-nums ${Math.abs(pctTotal - 100) < 0.01 ? "text-emerald-600" : "text-destructive"}`}>
            Total: {pctTotal.toFixed(2)}% / 100%
          </div>
        )}
      </div>

      <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : "Save expense"}</Button>
    </form>
  );
}
