import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  doctorId: z.string().uuid(),
  from: z.string().min(1),
  to: z.string().min(1),
});

/**
 * Busy appointment windows for a doctor. The underlying SECURITY DEFINER
 * helper is no longer callable by signed-in users directly; only this
 * authenticated server function may use it.
 */
export const getTakenSlots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }): Promise<{ starts_at: string; ends_at: string }[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("taken_slots", {
      _doctor_id: data.doctorId,
      _from: data.from,
      _to: data.to,
    });
    if (error) throw new Error("failed_to_load_availability");
    return (rows ?? []).map((r) => ({ starts_at: r.starts_at, ends_at: r.ends_at }));
  });
