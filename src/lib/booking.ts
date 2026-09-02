import { supabase } from "@/integrations/supabase/client";
import { getTakenSlots } from "@/lib/availability.functions";

export type Slot = { start: Date; end: Date; taken: boolean };

function atTime(date: Date, time: string) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
}

export function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseDayKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

export async function getDaySlots(
  doctorId: string,
  day: Date,
  durationMin = 30,
): Promise<Slot[]> {
  const weekday = day.getDay();
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const [{ data: schedules }, taken, { data: offs }] = await Promise.all([
    supabase
      .from("doctor_schedules")
      .select("start_time,end_time,slot_minutes")
      .eq("doctor_id", doctorId)
      .eq("weekday", weekday)
      .eq("is_active", true),
    getTakenSlots({
      data: {
        doctorId,
        from: dayStart.toISOString(),
        to: dayEnd.toISOString(),
      },
    }).catch(() => [] as { starts_at: string; ends_at: string }[]),
    supabase
      .from("time_off")
      .select("starts_at,ends_at")
      .eq("doctor_id", doctorId)
      .lt("starts_at", dayEnd.toISOString())
      .gt("ends_at", dayStart.toISOString()),
  ]);

  const takenSet = new Set(taken.map((t) => new Date(t.starts_at).getTime()));
  const offRanges: [number, number][] = (offs ?? []).map((o) => [
    new Date(o.starts_at).getTime(),
    new Date(o.ends_at).getTime(),
  ]);

  const slots: Slot[] = [];
  const now = Date.now();
  for (const s of schedules ?? []) {
    const step = durationMin || s.slot_minutes || 30;
    let cursor = atTime(dayStart, s.start_time);
    const end = atTime(dayStart, s.end_time);
    while (cursor.getTime() + step * 60000 <= end.getTime()) {
      const slotEnd = new Date(cursor.getTime() + step * 60000);
      const inOff = offRanges.some(
        ([a, b]) => cursor.getTime() < b && slotEnd.getTime() > a,
      );
      if (cursor.getTime() > now && !inOff) {
        slots.push({
          start: new Date(cursor),
          end: slotEnd,
          taken: takenSet.has(cursor.getTime()),
        });
      }
      cursor = new Date(cursor.getTime() + step * 60000);
    }
  }
  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function timeAr(d: Date) {
  return d.toLocaleTimeString("ar-SY", { hour: "2-digit", minute: "2-digit" });
}
