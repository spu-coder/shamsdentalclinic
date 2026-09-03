import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  fullName: z.string().min(2).max(120),
  phone: z.string().max(30).optional(),
  title: z.string().max(60).optional(),
  specialty: z.string().max(120).optional(),
  bio: z.string().max(600).optional(),
  role: z.enum(["doctor", "staff", "admin"]).default("doctor"),
});

const passwordSchema = z.object({
  userId: z.string().uuid(),
  password: z.string().min(8).max(72),
});

async function assertAdmin(supabase: {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }>;
}, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (data !== true) throw new Error("forbidden");
}

/** إنشاء حساب طبيب/موظف/مدير مع كلمة سر مباشرة (للمدير فقط). */
export const createStaffAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const created = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });

    let userId = created.data.user?.id;
    if (created.error || !userId) {
      // إن كان البريد موجوداً مسبقاً: نحدّث كلمة السر ونعيد استخدام الحساب
      const list = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const found = list.data.users.find(
        (u) => (u.email ?? "").toLowerCase() === data.email.toLowerCase(),
      );
      if (!found) throw new Error(created.error?.message ?? "cannot_create_user");
      userId = found.id;
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: data.password,
        email_confirm: true,
      });
    }

    await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, full_name: data.fullName, phone: data.phone ?? null }, { onConflict: "id" });

    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: data.role }, { onConflict: "user_id,role" });

    if (data.role === "doctor") {
      const existing = await supabaseAdmin
        .from("doctors")
        .select("id")
        .eq("profile_id", userId)
        .maybeSingle();
      if (!existing.data) {
        await supabaseAdmin.from("doctors").insert({
          profile_id: userId,
          name: data.fullName,
          title: data.title ?? "د.",
          specialty: data.specialty ?? null,
          bio: data.bio ?? null,
        });
      }
    }

    return { userId, email: data.email };
  });

/** تغيير كلمة سر أي حساب (للمدير فقط). */
export const setAccountPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => passwordSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** قائمة حسابات الكادر مع بريدها (للمدير فقط). */
export const listStaffAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [roles, users, profiles] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id,role"),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabaseAdmin.from("profiles").select("id,full_name,phone"),
    ]);

    const byId = new Map((profiles.data ?? []).map((p) => [p.id, p]));
    const roleMap = new Map<string, string[]>();
    (roles.data ?? []).forEach((r) => {
      roleMap.set(r.user_id, [...(roleMap.get(r.user_id) ?? []), r.role as string]);
    });

    return users.data.users
      .map((u) => ({
        id: u.id,
        email: u.email ?? "",
        roles: roleMap.get(u.id) ?? ["patient"],
        full_name: byId.get(u.id)?.full_name ?? null,
        phone: byId.get(u.id)?.phone ?? null,
      }))
      .filter((u) => u.roles.some((r) => r !== "patient"))
      .sort((a, b) => a.email.localeCompare(b.email));
  });
