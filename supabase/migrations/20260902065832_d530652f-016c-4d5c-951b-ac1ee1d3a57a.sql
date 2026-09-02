-- Restrict public read on doctor_schedules
DROP POLICY IF EXISTS "schedules public read" ON public.doctor_schedules;
REVOKE SELECT ON public.doctor_schedules FROM anon;
CREATE POLICY "schedules authenticated read" ON public.doctor_schedules
  FOR SELECT TO authenticated USING (true);

-- Restrict public read on time_off
DROP POLICY IF EXISTS "timeoff public read" ON public.time_off;
REVOKE SELECT ON public.time_off FROM anon;
CREATE POLICY "timeoff authenticated read" ON public.time_off
  FOR SELECT TO authenticated USING (true);

-- SECURITY DEFINER helper should not be directly callable by signed-in users
REVOKE ALL ON FUNCTION public.taken_slots(uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taken_slots(uuid, timestamptz, timestamptz) TO service_role;