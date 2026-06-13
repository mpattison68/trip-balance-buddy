import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { categoriesQO, membersQO } from "@/lib/queries";
import { AppShell, PageHeader } from "@/components/AppShell";
import { ExpenseForm } from "@/components/ExpenseForm";
import { saveExpense } from "@/lib/data.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/accounts/trips/expenses/new")({
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(membersQO(params.accountId)),
      context.queryClient.ensureQueryData(categoriesQO(params.accountId)),
    ]),
  component: NewExpense,
});

function NewExpense() {
  const { accountId, tripId } = Route.useParams();
  const { data: members } = useSuspenseQuery(membersQO(accountId));
  const { data: cats } = useSuspenseQuery(categoriesQO(accountId));
  const navigate = useNavigate();
  const qc = useQueryClient();
  const save = useServerFn(saveExpense);
  const m = useMutation({
    mutationFn: save,
    onSuccess: () => {
      toast.success("Expense saved");
      qc.invalidateQueries({ queryKey: ["trip", tripId] });
      qc.invalidateQueries({ queryKey: ["account", accountId] });
      navigate({ to: "/app/accounts/$accountId/trips/$tripId", params: { accountId, tripId } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  return (
    <AppShell accountId={accountId}>
      <PageHeader title="Add expense" />
      <ExpenseForm
        members={members}
        categories={cats}
        submitting={m.isPending}
        onSubmit={(v) => m.mutate({ data: {
          tripId,
          accountId,
          date: v.date,
          description: v.description,
          categoryId: v.categoryId,
          totalAmount: v.totalAmount,
          notes: v.notes,
          splitMethod: v.splitMethod,
          contributions: Object.entries(v.contributions).filter(([, a]) => Number(a) > 0).map(([member_id, amount]) => ({ member_id, amount: Number(amount) })),
          shares: Object.entries(v.shareIncluded).filter(([, on]) => on).map(([member_id]) => ({ member_id, percentage: v.splitMethod === "percentage" ? Number(v.sharePct[member_id] ?? 0) : null })),
        }})}
      />
    </AppShell>
  );
}
