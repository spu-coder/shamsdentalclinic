import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * يضمن وجود ملف شخصي ودور للمستخدم بعد تسجيل الدخول.
 * المدير يُمنح تلقائياً إذا كان بريده مدرجاً في قائمة بُرد المدراء.
 */
export const ensureAccountSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    const claims = context.claims as { email?: string; user_metadata?: { full_name?: string } };
    const email = (claims.email ?? "").toLowerCase();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin
      .from("profiles")
      .upsert(
        { id: userId, full_name: claims.user_metadata?.full_name ?? (email || null) },
        { onConflict: "id", ignoreDuplicates: true },
      );

    const { data: existing } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (existing && existing.length > 0) {
      return { role: existing[0]!.role as string };
    }

    const { data: allowed } = await supabaseAdmin
      .from("admin_emails")
      .select("email")
      .ilike("email", email)
      .maybeSingle();

    const role = allowed ? "admin" : "patient";
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role });
    return { role };
  });
