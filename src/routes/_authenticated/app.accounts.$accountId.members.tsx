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
import { removeMemberCompletely } from "@/lib/account-admin.functions";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/app/accounts/$accountId/members")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(membersQO(params.accountId)),
  component: MembersPage,
});

function MembersPage() {
  const { accountId } = Route.useParams();
  const { data: members } = useSuspenseQuery(membersQO(accountId));
  const qc = useQueryClient();
  const add = useServerFn(addMember);
  const upd = useServerFn(updateMember);
  const rem = useServerFn(removeMemberCompletely);

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
  const remM = useMutation({
    mutationFn: (memberId: string) => rem({ data: { memberId, accountId } }),
    onSuccess: () => {
      toast.success("Member removed");
      qc.invalidateQueries({ queryKey: ["members", accountId] });
      qc.invalidateQueries({ queryKey: ["account", accountId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to remove member"),
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
              <EditMemberDialog
                member={m}
                onSubmit={(d) => updM.mutate({ id: m.id, ...d })}
              />
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
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Remove member permanently" title="Remove permanently">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove {m.name} permanently?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This deletes the member from this account. It only works if they have
                      no expense or settlement history — otherwise archive them instead so
                      historical balances stay intact. Their sign-in identity (if any) is
                      not affected.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => { e.preventDefault(); remM.mutate(m.id); }}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Remove
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}

function EditMemberDialog({
  member,
  onSubmit,
}: {
  member: { name: string; email: string | null };
  onSubmit: (d: { name: string; email: string | null }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(member.name);
  const [email, setEmail] = useState(member.email ?? "");
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setName(member.name);
          setEmail(member.email ?? "");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Edit member">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit member</DialogTitle></DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({ name: name.trim(), email: email.trim() ? email.trim() : null });
            setOpen(false);
          }}
          className="space-y-4"
        >
          <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} /></div>
          <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} placeholder="name@example.com" /></div>
          <DialogFooter><Button type="submit">Save</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
