import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  doctorId: z.string().uuid(),
  from: z.string().min(1),
  to: z.string().min(1),
  weekday: z.number().int().min(0).max(6),
});

export type DayAvailability = {
  schedules: { start_time: string; end_time: string; slot_minutes: number }[];
  offs: { starts_at: string; ends_at: string }[];
  taken: { starts_at: string; ends_at: string }[];
};

/**
 * Booking availability for one doctor on one day.
 * Working hours, time-off ranges and busy windows are never readable directly
 * from the client: this server function returns only the non-personal data the
 * booking calendar needs (no patient or appointment details).
 */
export const getDayAvailability = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }): Promise<DayAvailability> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [schedules, offs, taken] = await Promise.all([
      supabaseAdmin
        .from("doctor_schedules")
        .select("start_time,end_time,slot_minutes")
        .eq("doctor_id", data.doctorId)
        .eq("weekday", data.weekday)
        .eq("is_active", true),
      supabaseAdmin
        .from("time_off")
        .select("starts_at,ends_at")
        .eq("doctor_id", data.doctorId)
        .lt("starts_at", data.to)
        .gt("ends_at", data.from),
      supabaseAdmin.rpc("taken_slots", {
        _doctor_id: data.doctorId,
        _from: data.from,
        _to: data.to,
      }),
    ]);

    if (schedules.error || offs.error || taken.error) {
      throw new Error("failed_to_load_availability");
    }

    return {
      schedules: schedules.data ?? [],
      offs: (offs.data ?? []).map((o) => ({ starts_at: o.starts_at, ends_at: o.ends_at })),
      taken: (taken.data ?? []).map((t) => ({ starts_at: t.starts_at, ends_at: t.ends_at })),
    };
  });
