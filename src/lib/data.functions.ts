import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// =================== ACCOUNTS ===================

export const listAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("accounts")
      .select("id, name, created_at, archived_at, created_by")
      .is("archived_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const getAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { accountId: string }) => z.object({ accountId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("accounts")
      .select("*")
      .eq("id", data.accountId)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const createAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string }) =>
    z.object({ name: z.string().trim().min(1).max(100) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("accounts")
      .insert({ name: data.name, created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// =================== MEMBERS ===================

export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { accountId: string }) => z.object({ accountId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("account_members")
      .select("id, name, email, role, user_id, archived_at")
      .eq("account_id", data.accountId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows;
  });

export const addMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { accountId: string; name: string; email?: string; role: "owner" | "member" }) =>
    z
      .object({
        accountId: z.string().uuid(),
        name: z.string().trim().min(1).max(100),
        email: z.string().trim().email().max(255).optional().or(z.literal("")),
        role: z.enum(["owner", "member"]),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("account_members").insert({
      account_id: data.accountId,
      name: data.name,
      email: data.email || null,
      role: data.role,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { id: string; name?: string; role?: "owner" | "member"; archived?: boolean }) =>
      z
        .object({
          id: z.string().uuid(),
          name: z.string().trim().min(1).max(100).optional(),
          role: z.enum(["owner", "member"]).optional(),
          archived: z.boolean().optional(),
        })
        .parse(d),
  )
  .handler(async ({ context, data }) => {
    const patch = {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.role !== undefined ? { role: data.role } : {}),
      ...(data.archived !== undefined
        ? { archived_at: data.archived ? new Date().toISOString() : null }
        : {}),
    };
    const { error } = await context.supabase
      .from("account_members")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =================== CATEGORIES ===================

export const listCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { accountId: string }) => z.object({ accountId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("categories")
      .select("id, name, is_default, account_id, archived_at")
      .or(`account_id.is.null,account_id.eq.${data.accountId}`)
      .is("archived_at", null)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return rows;
  });

export const addCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { accountId: string; name: string }) =>
    z.object({ accountId: z.string().uuid(), name: z.string().trim().min(1).max(50) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("categories")
      .insert({ account_id: data.accountId, name: data.name });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =================== TRIPS ===================

export const listTrips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { accountId: string; includeArchived?: boolean }) =>
    z.object({ accountId: z.string().uuid(), includeArchived: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    let q = context.supabase
      .from("trips")
      .select("id, name, start_date, end_date, status, notes, archived_at, created_at")
      .eq("account_id", data.accountId)
      .order("start_date", { ascending: false, nullsFirst: false });
    if (!data.includeArchived) q = q.is("archived_at", null);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows;
  });

export const createTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      accountId: string;
      name: string;
      startDate?: string;
      endDate?: string;
      notes?: string;
      status: "planning" | "active" | "closed";
      memberIds?: string[];
    }) =>
      z
        .object({
          accountId: z.string().uuid(),
          name: z.string().trim().min(1).max(120),
          startDate: z.string().optional().or(z.literal("")),
          endDate: z.string().optional().or(z.literal("")),
          notes: z.string().max(2000).optional().or(z.literal("")),
          status: z.enum(["planning", "active", "closed"]),
          memberIds: z.array(z.string().uuid()).max(50).optional(),
        })
        .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("trips")
      .insert({
        account_id: data.accountId,
        name: data.name,
        start_date: data.startDate || null,
        end_date: data.endDate || null,
        notes: data.notes || null,
        status: data.status,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    let memberIds = data.memberIds;
    if (!memberIds || memberIds.length === 0) {
      const { data: ms } = await context.supabase
        .from("account_members")
        .select("id")
        .eq("account_id", data.accountId)
        .is("archived_at", null);
      memberIds = (ms ?? []).map((m) => m.id);
    }
    if (memberIds.length) {
      const { error: pErr } = await context.supabase
        .from("trip_participants")
        .insert(memberIds.map((id) => ({ trip_id: row.id, member_id: id, account_id: data.accountId })));
      if (pErr) throw new Error(pErr.message);
    }
    return row;
  });

export const setTripParticipants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tripId: string; accountId: string; memberIds: string[] }) =>
    z
      .object({
        tripId: z.string().uuid(),
        accountId: z.string().uuid(),
        memberIds: z.array(z.string().uuid()).min(1).max(50),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const del = await context.supabase.from("trip_participants").delete().eq("trip_id", data.tripId);
    if (del.error) throw new Error(del.error.message);
    const ins = await context.supabase.from("trip_participants").insert(
      data.memberIds.map((id) => ({ trip_id: data.tripId, member_id: id, account_id: data.accountId })),
    );
    if (ins.error) throw new Error(ins.error.message);
    return { ok: true };
  });

export const updateTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id: string;
      name?: string;
      startDate?: string | null;
      endDate?: string | null;
      notes?: string | null;
      status?: "planning" | "active" | "closed";
      archived?: boolean;
    }) =>
      z
        .object({
          id: z.string().uuid(),
          name: z.string().trim().min(1).max(120).optional(),
          startDate: z.string().nullable().optional(),
          endDate: z.string().nullable().optional(),
          notes: z.string().max(2000).nullable().optional(),
          status: z.enum(["planning", "active", "closed"]).optional(),
          archived: z.boolean().optional(),
        })
        .parse(d),
  )
  .handler(async ({ context, data }) => {
    const patch = {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.startDate !== undefined ? { start_date: data.startDate || null } : {}),
      ...(data.endDate !== undefined ? { end_date: data.endDate || null } : {}),
      ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.archived !== undefined
        ? { archived_at: data.archived ? new Date().toISOString() : null }
        : {}),
    };
    const { error } = await context.supabase.from("trips").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getTripDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tripId: string }) => z.object({ tripId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const [tripRes, expensesRes, contribsRes, sharesRes, settlementsRes, participantsRes] = await Promise.all([
      context.supabase.from("trips").select("*").eq("id", data.tripId).single(),
      context.supabase
        .from("expenses")
        .select("id, date, description, category_id, total_amount, notes, split_method, created_by, archived_at")
        .eq("trip_id", data.tripId)
        .is("archived_at", null)
        .order("date", { ascending: false }),
      context.supabase
        .from("expense_contributions")
        .select("id, expense_id, member_id, amount")
        .in(
          "expense_id",
          (
            await context.supabase
              .from("expenses")
              .select("id")
              .eq("trip_id", data.tripId)
              .is("archived_at", null)
          ).data?.map((e) => e.id) ?? [],
        ),
      context.supabase
        .from("expense_shares")
        .select("id, expense_id, member_id, percentage")
        .in(
          "expense_id",
          (
            await context.supabase
              .from("expenses")
              .select("id")
              .eq("trip_id", data.tripId)
              .is("archived_at", null)
          ).data?.map((e) => e.id) ?? [],
        ),
      context.supabase
        .from("settlements")
        .select("id, date, from_member_id, to_member_id, amount, notes")
        .eq("trip_id", data.tripId)
        .is("archived_at", null)
        .order("date", { ascending: false }),
      context.supabase
        .from("trip_participants")
        .select("member_id")
        .eq("trip_id", data.tripId),
    ]);
    if (tripRes.error) throw new Error(tripRes.error.message);
    if (expensesRes.error) throw new Error(expensesRes.error.message);
    if (contribsRes.error) throw new Error(contribsRes.error.message);
    if (sharesRes.error) throw new Error(sharesRes.error.message);
    if (settlementsRes.error) throw new Error(settlementsRes.error.message);
    if (participantsRes.error) throw new Error(participantsRes.error.message);
    return {
      trip: tripRes.data,
      expenses: expensesRes.data ?? [],
      contributions: contribsRes.data ?? [],
      shares: sharesRes.data ?? [],
      settlements: settlementsRes.data ?? [],
      participants: (participantsRes.data ?? []).map((p) => p.member_id),
    };
  });

// =================== EXPENSES ===================

const contributionSchema = z.object({
  member_id: z.string().uuid(),
  amount: z.number().min(0).max(99999999),
});
const shareSchema = z.object({
  member_id: z.string().uuid(),
  percentage: z.number().min(0).max(100).nullable(),
});

export const saveExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id?: string;
      tripId: string;
      accountId: string;
      date: string;
      description: string;
      categoryId: string | null;
      totalAmount: number;
      notes?: string;
      splitMethod: "equal" | "percentage";
      contributions: { member_id: string; amount: number }[];
      shares: { member_id: string; percentage: number | null }[];
    }) =>
      z
        .object({
          id: z.string().uuid().optional(),
          tripId: z.string().uuid(),
          accountId: z.string().uuid(),
          date: z.string().min(1),
          description: z.string().trim().min(1).max(200),
          categoryId: z.string().uuid().nullable(),
          totalAmount: z.number().min(0).max(99999999),
          notes: z.string().max(2000).optional().or(z.literal("")),
          splitMethod: z.enum(["equal", "percentage"]),
          contributions: z.array(contributionSchema).min(1).max(50),
          shares: z.array(shareSchema).min(1).max(50),
        })
        .parse(d),
  )
  .handler(async ({ context, data }) => {
    const contribSum =
      Math.round(data.contributions.reduce((s, c) => s + c.amount, 0) * 100) / 100;
    if (Math.abs(contribSum - data.totalAmount) > 0.01) {
      throw new Error(
        `Contributions (R${contribSum.toFixed(2)}) must equal total (R${data.totalAmount.toFixed(2)})`,
      );
    }
    if (data.splitMethod === "percentage") {
      const pctSum =
        Math.round(data.shares.reduce((s, x) => s + (x.percentage ?? 0), 0) * 1000) / 1000;
      if (Math.abs(pctSum - 100) > 0.01) {
        throw new Error(`Percentages must total 100% (got ${pctSum}%)`);
      }
    }

    let expenseId = data.id;
    if (expenseId) {
      const { error } = await context.supabase
        .from("expenses")
        .update({
          date: data.date,
          description: data.description,
          category_id: data.categoryId,
          total_amount: data.totalAmount,
          notes: data.notes || null,
          split_method: data.splitMethod,
        })
        .eq("id", expenseId);
      if (error) throw new Error(error.message);
      await context.supabase.from("expense_contributions").delete().eq("expense_id", expenseId);
      await context.supabase.from("expense_shares").delete().eq("expense_id", expenseId);
    } else {
      const { data: row, error } = await context.supabase
        .from("expenses")
        .insert({
          trip_id: data.tripId,
          account_id: data.accountId,
          date: data.date,
          description: data.description,
          category_id: data.categoryId,
          total_amount: data.totalAmount,
          notes: data.notes || null,
          split_method: data.splitMethod,
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      expenseId = row.id;
    }

    const cIns = await context.supabase
      .from("expense_contributions")
      .insert(data.contributions.map((c) => ({ ...c, expense_id: expenseId })));
    if (cIns.error) throw new Error(cIns.error.message);
    const sIns = await context.supabase
      .from("expense_shares")
      .insert(
        data.shares.map((s) => ({
          expense_id: expenseId,
          member_id: s.member_id,
          percentage: data.splitMethod === "percentage" ? s.percentage : null,
        })),
      );
    if (sIns.error) throw new Error(sIns.error.message);
    return { id: expenseId };
  });

export const archiveExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; archived: boolean }) =>
    z.object({ id: z.string().uuid(), archived: z.boolean() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("expenses")
      .update({ archived_at: data.archived ? new Date().toISOString() : null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getExpense = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const [e, c, s] = await Promise.all([
      context.supabase.from("expenses").select("*").eq("id", data.id).single(),
      context.supabase
        .from("expense_contributions")
        .select("member_id, amount")
        .eq("expense_id", data.id),
      context.supabase
        .from("expense_shares")
        .select("member_id, percentage")
        .eq("expense_id", data.id),
    ]);
    if (e.error) throw new Error(e.error.message);
    return { expense: e.data, contributions: c.data ?? [], shares: s.data ?? [] };
  });

// =================== SETTLEMENTS ===================

export const listSettlements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { accountId: string }) => z.object({ accountId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("settlements")
      .select("id, date, from_member_id, to_member_id, amount, notes, trip_id, archived_at")
      .eq("account_id", data.accountId)
      .is("archived_at", null)
      .order("date", { ascending: false });
    if (error) throw new Error(error.message);
    return rows;
  });

export const createSettlement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      accountId: string;
      tripId?: string;
      date: string;
      fromMemberId: string;
      toMemberId: string;
      amount: number;
      notes?: string;
    }) =>
      z
        .object({
          accountId: z.string().uuid(),
          tripId: z.string().uuid().optional().or(z.literal("")),
          date: z.string().min(1),
          fromMemberId: z.string().uuid(),
          toMemberId: z.string().uuid(),
          amount: z.number().positive().max(99999999),
          notes: z.string().max(2000).optional().or(z.literal("")),
        })
        .refine((d) => d.fromMemberId !== d.toMemberId, { message: "From and To must differ" })
        .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("settlements").insert({
      account_id: data.accountId,
      trip_id: data.tripId || null,
      date: data.date,
      from_member_id: data.fromMemberId,
      to_member_id: data.toMemberId,
      amount: data.amount,
      notes: data.notes || null,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =================== ACCOUNT-WIDE DATA (for dashboard / balances) ===================

export const getAccountData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { accountId: string }) => z.object({ accountId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const [account, members, trips, expensesRes, settlementsRes] = await Promise.all([
      context.supabase.from("accounts").select("*").eq("id", data.accountId).single(),
      context.supabase
        .from("account_members")
        .select("id, name, email, role, user_id, archived_at")
        .eq("account_id", data.accountId),
      context.supabase
        .from("trips")
        .select("id, name, start_date, end_date, status, archived_at")
        .eq("account_id", data.accountId)
        .is("archived_at", null),
      context.supabase
        .from("expenses")
        .select("id, trip_id, date, total_amount, split_method, description, category_id")
        .eq("account_id", data.accountId)
        .is("archived_at", null),
      context.supabase
        .from("settlements")
        .select("id, trip_id, date, from_member_id, to_member_id, amount, notes")
        .eq("account_id", data.accountId)
        .is("archived_at", null),
    ]);
    if (account.error) throw new Error(account.error.message);
    const expenses = expensesRes.data ?? [];
    const settlements = settlementsRes.data ?? [];
    const expenseIds = expenses.map((e) => e.id);
    const contribsRes = await context.supabase
      .from("expense_contributions")
      .select("expense_id, member_id, amount")
      .in("expense_id", expenseIds.length ? expenseIds : ["00000000-0000-0000-0000-000000000000"]);
    const sharesRes = await context.supabase
      .from("expense_shares")
      .select("expense_id, member_id, percentage")
      .in("expense_id", expenseIds.length ? expenseIds : ["00000000-0000-0000-0000-000000000000"]);
    return {
      account: account.data,
      members: members.data ?? [],
      trips: trips.data ?? [],
      expenses,
      settlements,
      contributions: contribsRes.data ?? [],
      shares: sharesRes.data ?? [],
    };
  });