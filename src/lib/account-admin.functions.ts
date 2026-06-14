import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Delete the currently signed-in user's account entirely:
//   - hard-deletes every account they own (cascades to trips, expenses, members, settlements)
//   - unlinks them from any other accounts (account_members.user_id -> NULL via ON DELETE SET NULL)
//   - deletes their auth identity (sign-in email / password / OAuth link)
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Remove accounts owned by this user — cascades to members/trips/expenses/settlements.
    const { error: accErr } = await supabaseAdmin
      .from("accounts")
      .delete()
      .eq("created_by", userId);
    if (accErr) throw new Error(`Failed to remove owned accounts: ${accErr.message}`);

    // 2. Delete the auth identity. Remaining FKs (account_members.user_id,
    //    trips/expenses/settlements.created_by) are ON DELETE SET NULL, so history is preserved.
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (delErr) throw new Error(`Failed to delete auth user: ${delErr.message}`);

    return { ok: true };
  });

// Owner-only: hard-remove a member from an account.
// Refuses if the member has any history (contributions, shares, or settlements);
// owners should Archive in that case to preserve historical balances.
export const removeMemberCompletely = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { memberId: string; accountId: string }) =>
    z.object({ memberId: z.string().uuid(), accountId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    // Authorize: caller must be an owner of this account.
    const { data: isOwner, error: ownerErr } = await context.supabase.rpc("is_account_owner", {
      _account_id: data.accountId,
    });
    if (ownerErr) throw new Error(ownerErr.message);
    if (!isOwner) throw new Error("Only account owners can permanently remove members.");

    // Verify the member belongs to this account.
    const { data: member, error: memErr } = await context.supabase
      .from("account_members")
      .select("id, account_id, role, user_id")
      .eq("id", data.memberId)
      .single();
    if (memErr) throw new Error(memErr.message);
    if (member.account_id !== data.accountId) throw new Error("Member not in this account.");

    // Refuse to remove the last owner.
    if (member.role === "owner") {
      const { count, error: cntErr } = await context.supabase
        .from("account_members")
        .select("id", { count: "exact", head: true })
        .eq("account_id", data.accountId)
        .eq("role", "owner")
        .is("archived_at", null);
      if (cntErr) throw new Error(cntErr.message);
      if ((count ?? 0) <= 1) throw new Error("Cannot remove the last owner of an account.");
    }

    // Check for any history that would be broken by a hard delete.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [contribs, shares, fromS, toS] = await Promise.all([
      supabaseAdmin.from("expense_contributions").select("id", { count: "exact", head: true }).eq("member_id", data.memberId),
      supabaseAdmin.from("expense_shares").select("id", { count: "exact", head: true }).eq("member_id", data.memberId),
      supabaseAdmin.from("settlements").select("id", { count: "exact", head: true }).eq("from_member_id", data.memberId),
      supabaseAdmin.from("settlements").select("id", { count: "exact", head: true }).eq("to_member_id", data.memberId),
    ]);
    const total =
      (contribs.count ?? 0) + (shares.count ?? 0) + (fromS.count ?? 0) + (toS.count ?? 0);
    if (total > 0) {
      throw new Error(
        "This member has expense or settlement history. Archive them instead to preserve historical balances.",
      );
    }

    // Remove trip_participants rows (ON DELETE CASCADE on member_id) — covered automatically.
    const { error: delErr } = await supabaseAdmin
      .from("account_members")
      .delete()
      .eq("id", data.memberId);
    if (delErr) throw new Error(delErr.message);

    return { ok: true };
  });