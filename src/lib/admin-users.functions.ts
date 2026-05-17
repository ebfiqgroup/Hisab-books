import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("অনুমতি নেই");
}

export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      user_id: z.string().uuid(),
      full_name: z.string().max(200).nullable().optional(),
      avatar_url: z.string().max(2000).nullable().optional(),
      email: z.string().email().optional(),
      password: z.string().min(6).max(200).optional(),
      email_confirm: z.boolean().optional(),
      ban: z.boolean().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);

    // Update profile
    if (data.full_name !== undefined || data.avatar_url !== undefined) {
      const patch: any = {};
      if (data.full_name !== undefined) patch.full_name = data.full_name;
      if (data.avatar_url !== undefined) patch.avatar_url = data.avatar_url;
      const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", data.user_id);
      if (error) throw new Error(error.message);
    }

    // Update auth user (email/password/confirm/ban)
    const authPatch: any = {};
    if (data.email) authPatch.email = data.email;
    if (data.password) authPatch.password = data.password;
    if (data.email_confirm) authPatch.email_confirm = true;
    if (data.ban !== undefined) authPatch.ban_duration = data.ban ? "876000h" : "none";

    if (Object.keys(authPatch).length > 0) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, authPatch);
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });

export const adminSendPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ email: z.string().email() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(data.email);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminGetUserDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);

    const [profileRes, txnsRes, debtsRes, goalsRes, notesRes, tasksRes, budgetsRes, authRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("id,full_name,avatar_url,status,created_at").eq("id", data.user_id).maybeSingle(),
      supabaseAdmin.from("transactions").select("id,type,category,amount,occurred_on,note").eq("user_id", data.user_id).order("occurred_on", { ascending: false }).limit(1000),
      supabaseAdmin.from("debts").select("id,kind,amount,settled,person,due_date,note").eq("user_id", data.user_id).order("created_at", { ascending: false }),
      supabaseAdmin.from("goals").select("id,label,target,current,color,deadline").eq("user_id", data.user_id).order("created_at", { ascending: false }),
      supabaseAdmin.from("notes").select("id,body,created_at").eq("user_id", data.user_id).order("created_at", { ascending: false }).limit(50),
      supabaseAdmin.from("plan_tasks").select("id,task,due_text,amount_text,priority,done").eq("user_id", data.user_id).order("created_at", { ascending: false }),
      supabaseAdmin.from("budgets").select("id,category,monthly_limit,label").eq("user_id", data.user_id).order("created_at", { ascending: false }),
      supabaseAdmin.auth.admin.getUserById(data.user_id),
    ]);

    const firstError = [profileRes, txnsRes, debtsRes, goalsRes, notesRes, tasksRes, budgetsRes]
      .find((res) => res.error)?.error;
    if (firstError) throw new Error(firstError.message);

    return {
      profile: profileRes.data,
      email: authRes.data?.user?.email ?? null,
      txns: txnsRes.data ?? [],
      debts: debtsRes.data ?? [],
      goals: goalsRes.data ?? [],
      notes: notesRes.data ?? [],
      tasks: tasksRes.data ?? [],
      budgets: budgetsRes.data ?? [],
    };
  });