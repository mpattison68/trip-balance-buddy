import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { listAccounts, createAccount } from "@/lib/data.functions";
import { AppShell, PageHeader, cardCls } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const navigate = useNavigate();
  const qc = useQueryClient();
  const create = useServerFn(createAccount);
  const [name, setName] = useState("");

  // If the user already has an account, the dashboard is home — go straight there.
  useEffect(() => {
    if (accounts.length > 0) {
      navigate({
        to: "/app/accounts/$accountId",
        params: { accountId: accounts[0].id },
        replace: true,
      });
    }
  }, [accounts, navigate]);

  const m = useMutation({
    mutationFn: (data: { name: string }) => create({ data }),
    onSuccess: (row) => {
      toast.success("Account created");
      qc.invalidateQueries({ queryKey: ["accounts"] });
      if (row?.id) {
        navigate({
          to: "/app/accounts/$accountId",
          params: { accountId: row.id },
          replace: true,
        });
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (accounts.length > 0) {
    return (
      <AppShell>
        <div className={cardCls("text-center text-muted-foreground")}>Loading your dashboard…</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title="Set up your account" />
      <div className={cardCls()}>
        <p className="mb-4 text-sm text-muted-foreground">
          Welcome to Trip Balance. Give your account a name to get started — for example
          "Mark &amp; Sharon" or "The Smiths". You can add fellow travellers next.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) m.mutate({ name: name.trim() });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="acc-name">Account name</Label>
            <Input
              id="acc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mark & Sharon"
              maxLength={100}
              required
              autoFocus
            />
          </div>
          <Button type="submit" disabled={m.isPending}>
            {m.isPending ? "Creating…" : "Create account"}
          </Button>
        </form>
      </div>
    </AppShell>
  );
}