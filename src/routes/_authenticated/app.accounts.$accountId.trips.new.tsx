import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell, PageHeader, cardCls } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createTrip } from "@/lib/data.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/accounts/trips/new")({
  component: NewTripPage,
});

function NewTripPage() {
  const { accountId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const create = useServerFn(createTrip);
  const [name, setName] = useState("");
  const [startDate, setStart] = useState("");
  const [endDate, setEnd] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"planning" | "active" | "closed">("planning");
  const m = useMutation({
    mutationFn: () => create({ data: { accountId, name: name.trim(), startDate, endDate, notes, status } }),
    onSuccess: (row) => {
      toast.success("Trip created");
      qc.invalidateQueries({ queryKey: ["trips", accountId] });
      qc.invalidateQueries({ queryKey: ["account", accountId] });
      if (row?.id) navigate({ to: "/app/accounts/$accountId/trips/$tripId", params: { accountId, tripId: row.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  return (
    <AppShell accountId={accountId}>
      <PageHeader title="New trip" />
      <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className={cardCls("space-y-4")}>
        <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} placeholder="July Coastal Trip" /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label>Start date</Label><Input type="date" value={startDate} onChange={(e) => setStart(e.target.value)} /></div>
          <div className="space-y-2"><Label>End date</Label><Input type="date" value={endDate} onChange={(e) => setEnd(e.target.value)} /></div>
        </div>
        <div className="space-y-2"><Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="planning">Planning</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} /></div>
        <Button type="submit" disabled={m.isPending}>{m.isPending ? "Creating…" : "Create trip"}</Button>
      </form>
    </AppShell>
  );
}
