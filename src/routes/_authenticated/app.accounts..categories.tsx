import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { categoriesQO } from "@/lib/queries";
import { AppShell, PageHeader, cardCls } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { addCategory } from "@/lib/data.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/accounts/categories")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(categoriesQO(params.accountId)),
  component: CategoriesPage,
});

function CategoriesPage() {
  const { accountId } = Route.useParams();
  const { data: cats } = useSuspenseQuery(categoriesQO(accountId));
  const qc = useQueryClient();
  const add = useServerFn(addCategory);
  const [name, setName] = useState("");
  const m = useMutation({
    mutationFn: () => add({ data: { accountId, name: name.trim() } }),
    onSuccess: () => { toast.success("Category added"); setName(""); qc.invalidateQueries({ queryKey: ["categories", accountId] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  return (
    <AppShell accountId={accountId}>
      <PageHeader title="Categories" />
      <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) m.mutate(); }} className="mb-4 flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category name" maxLength={50} />
        <Button type="submit" disabled={!name.trim() || m.isPending}>Add</Button>
      </form>
      <ul className="grid gap-2 sm:grid-cols-2">
        {cats.map((c) => (
          <li key={c.id} className={cardCls("flex items-center justify-between")}>
            <span>{c.name}</span>
            {c.is_default ? <Badge variant="outline">Default</Badge> : <Badge>Custom</Badge>}
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
