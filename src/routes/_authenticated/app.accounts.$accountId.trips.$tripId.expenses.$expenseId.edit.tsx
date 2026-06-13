import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { categoriesQO, membersQO, expenseQO } from "@/lib/queries";
import { AppShell, PageHeader } from "@/components/AppShell";
import { ExpenseForm } from "@/components/ExpenseForm";
import { saveExpense } from "@/lib/data.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/accounts/trips/expenses/edit")({
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(membersQO(params.accountId)),
      context.queryClient.ensureQueryData(categoriesQO(params.accountId)),
      context.queryClient.ensureQueryData(expenseQO(params.expenseId)),
    ]),
  component: EditExpense,
});

function EditExpense() {
  const { accountId, tripId, expenseId } = Route.useParams();
  const { data: members } = useSuspenseQuery(membersQO(accountId));
  const { data: cats } = useSuspenseQuery(categoriesQO(accountId));
  const { data: ex } = useSuspenseQuery(expenseQO(expenseId));
  const navigate = useNavigate();
  const qc = useQueryClient();
  const save = useServerFn(saveExpense);

  const contributions: Record<string, number> = {};
  for (const c of ex.contributions) contributions[c.member_id] = Number(c.amount);
  const shareIncluded: Record<string, boolean> = {};
  const sharePct: Record<string, number> = {};
  for (const s of ex.shares) { shareIncluded[s.member_id] = true; if (s.percentage != null) sharePct[s.member_id] = Number(s.percentage); }

  const m = useMutation({
    mutationFn: save,
    onSuccess: () => {
      toast.success("Expense updated");
      qc.invalidateQueries({ queryKey: ["trip", tripId] });
      qc.invalidateQueries({ queryKey: ["account", accountId] });
      qc.invalidateQueries({ queryKey: ["expense", expenseId] });
      navigate({ to: "/app/accounts/$accountId/trips/$tripId", params: { accountId, tripId } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <AppShell accountId={accountId}>
      <PageHeader title="Edit expense" />
      <ExpenseForm
        members={members}
        categories={cats}
        submitting={m.isPending}
        initial={{
          date: ex.expense.date,
          description: ex.expense.description,
          categoryId: ex.expense.category_id,
          totalAmount: Number(ex.expense.total_amount),
          notes: ex.expense.notes ?? "",
          splitMethod: ex.expense.split_method,
          contributions,
          shareIncluded,
          sharePct,
        }}
        onSubmit={(v) => m.mutate({ data: {
          id: expenseId,
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
