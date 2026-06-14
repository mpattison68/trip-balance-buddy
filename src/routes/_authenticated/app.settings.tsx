import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader, cardCls } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteMyAccount } from "@/lib/account-admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/settings")({
  head: () => ({ meta: [{ title: "Account settings — Trip Balance" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const del = useServerFn(deleteMyAccount);
  const [confirm, setConfirm] = useState("");
  const [open, setOpen] = useState(false);

  const mutate = useMutation({
    mutationFn: () => del(),
    onSuccess: async () => {
      await qc.cancelQueries();
      qc.clear();
      await supabase.auth.signOut();
      toast.success("Your account has been deleted.");
      navigate({ to: "/auth", replace: true });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to delete account"),
  });

  return (
    <AppShell>
      <PageHeader title="Account settings" />
      <div className={cardCls("space-y-3 border-destructive/40")}>
        <h2 className="text-lg font-semibold text-destructive">Delete my account</h2>
        <p className="text-sm text-muted-foreground">
          Permanently delete your sign-in identity and every account you own. All trips,
          expenses, members, and settlements inside accounts you own will be removed. You
          will be unlinked from any accounts owned by someone else, but their historical
          records will be preserved. <strong>This cannot be undone.</strong>
        </p>
        <AlertDialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setConfirm("");
          }}
        >
          <AlertDialogTrigger asChild>
            <Button variant="destructive">Delete my account…</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes your sign-in and every account you own, including
                all trips and expenses. Type <strong>DELETE</strong> below to confirm.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <Label htmlFor="confirm">Type DELETE to confirm</Label>
              <Input
                id="confirm"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="off"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={confirm !== "DELETE" || mutate.isPending}
                onClick={(e) => {
                  e.preventDefault();
                  mutate.mutate();
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {mutate.isPending ? "Deleting…" : "Delete forever"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppShell>
  );
}