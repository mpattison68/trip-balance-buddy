import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listAccounts, createAccount } from "@/lib/data.functions";
import { AppShell, PageHeader, cardCls } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import { Plus, Plane } from "lucide-react";
import { toast } from "sonner";

const accountsQO = queryOptions({
  queryKey: ["accounts"],
  queryFn: () => listAccounts(),
});

export const Route = createFileRoute("/_authenticated/app/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(accountsQO),
  component: AccountsPage,
});

function AccountsPage() {
  const { data: accounts } = useSuspenseQuery(accountsQO);
  return (
    <AppShell>
      <PageHeader title="Your accounts" action={<NewAccountDialog />} />
      {accounts.length === 0 ? (
        <div className={cardCls("text-center text-muted-foreground")}>
          <p className="mb-3">You don't have any accounts yet.</p>
          <p className="text-sm">Create an account for each shared travel group — like "Mark & Sharon" or "Family Holiday".</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {accounts.map((a) => (
            <li key={a.id}>
              <Link
                to="/app/accounts/$accountId"
                params={{ accountId: a.id }}
                className={cardCls("flex items-center gap-4 transition hover:border-primary/50 hover:shadow")}
              >
                <div className="rounded-lg bg-primary/10 p-3 text-primary">
                  <Plane className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium">{a.name}</div>
                  <div className="text-xs text-muted-foreground">Created {formatDate(a.created_at)}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}

function NewAccountDialog() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const create = useServerFn(createAccount);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const m = useMutation({
    mutationFn: (data: { name: string }) => create({ data }),
    onSuccess: (row) => {
      toast.success("Account created");
      qc.invalidateQueries({ queryKey: ["accounts"] });
      setOpen(false);
      setName("");
      if (row?.id) navigate({ to: "/app/accounts/$accountId", params: { accountId: row.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> New account</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create account</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) m.mutate({ name: name.trim() }); }} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="acc-name">Account name</Label>
            <Input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Mark & Sharon" maxLength={100} required />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={m.isPending}>{m.isPending ? "Creating…" : "Create"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}