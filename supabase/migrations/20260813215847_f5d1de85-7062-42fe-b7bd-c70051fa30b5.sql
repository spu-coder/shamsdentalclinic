DROP VIEW IF EXISTS public.booked_slots;

CREATE OR REPLACE FUNCTION public.taken_slots(_doctor_id uuid, _from timestamptz, _to timestamptz)
RETURNS TABLE (starts_at timestamptz, ends_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.starts_at, a.ends_at
  FROM public.appointments a
  WHERE a.doctor_id = _doctor_id
    AND a.status IN ('pending','approved')
    AND a.starts_at >= _from
    AND a.starts_at < _to
$$;

REVOKE ALL ON FUNCTION public.taken_slots(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.taken_slots(uuid, timestamptz, timestamptz) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;