import { createFileRoute } from "@tanstack/react-router";

// TEMPORARY setup endpoint: creates the clinic admin accounts and demo users.
// Guarded by a shared token header; removed after the one-time run.
const TOKEN = "shams-setup-2026";

export const Route = createFileRoute("/api/setup-admins")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (request.headers.get("x-setup-token") !== TOKEN) {
          return new Response("Forbidden", { status: 403 });
        }
        const payload = (await request.json()) as {
          users: { email: string; password: string; full_name: string; role: string }[];
        };
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const results: Record<string, string> = {};
        for (const u of payload.users) {
          const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email: u.email,
            password: u.password,
            email_confirm: true,
            user_metadata: { full_name: u.full_name },
          });
          if (error) {
            results[u.email] = `error: ${error.message}`;
            continue;
          }
          const id = data.user?.id;
          if (id) {
            await supabaseAdmin.from("user_roles").upsert(
              { user_id: id, role: u.role as never },
              { onConflict: "user_id,role" },
            );
            await supabaseAdmin
              .from("profiles")
              .upsert({ id, full_name: u.full_name }, { onConflict: "id" });
            results[u.email] = id;
          }
        }
        return new Response(JSON.stringify(results), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
