import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { membersQO } from "@/lib/queries";
import { AppShell, PageHeader, cardCls } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { addMember, updateMember } from "@/lib/data.functions";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/accounts/members")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(membersQO(params.accountId)),
  component: MembersPage,
});

function MembersPage() {
  const { accountId } = Route.useParams();
  const { data: members } = useSuspenseQuery(membersQO(accountId));
  const qc = useQueryClient();
  const add = useServerFn(addMember);
  const upd = useServerFn(updateMember);

  const addM = useMutation({
    mutationFn: (d: Parameters<typeof addMember>[0]["data"]) => add({ data: d }),
    onSuccess: () => { toast.success("Member added"); qc.invalidateQueries({ queryKey: ["members", accountId] }); qc.invalidateQueries({ queryKey: ["account", accountId] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const updM = useMutation({
    mutationFn: (d: Parameters<typeof updateMember>[0]["data"]) => upd({ data: d }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["members", accountId] }); qc.invalidateQueries({ queryKey: ["account", accountId] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <AppShell accountId={accountId}>
      <PageHeader title="Members" action={<AddMemberDialog onSubmit={(d) => addM.mutate({ ...d, accountId })} />} />
      <ul className="grid gap-2">
        {members.map((m) => (
          <li key={m.id} className={cardCls("flex items-center justify-between")}>
            <div>
              <div className="font-medium">{m.name} {m.archived_at && <Badge variant="outline" className="ml-2">Archived</Badge>}</div>
              <div className="text-xs text-muted-foreground">{m.email || "No email"} · {m.user_id ? "Linked" : "Unlinked"}</div>
            </div>
            <div className="flex items-center gap-2">
              <Select value={m.role} onValueChange={(v) => updM.mutate({ id: m.id, role: v as "owner" | "member" })}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => updM.mutate({ id: m.id, archived: !m.archived_at })}>
                {m.archived_at ? "Restore" : "Archive"}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}

function AddMemberDialog({ onSubmit }: { onSubmit: (d: { name: string; email?: string; role: "owner" | "member" }) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"owner" | "member">("member");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Add member</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add member</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit({ name: name.trim(), email: email.trim() || undefined, role }); setOpen(false); setName(""); setEmail(""); setRole("member"); }} className="space-y-4">
          <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} /></div>
          <div className="space-y-2"><Label>Email (optional)</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} /></div>
          <div className="space-y-2"><Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "owner" | "member")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="owner">Owner</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter><Button type="submit">Add</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
