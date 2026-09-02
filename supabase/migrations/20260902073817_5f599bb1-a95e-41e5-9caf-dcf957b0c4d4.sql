REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.taken_slots(uuid, timestamptz, timestamptz) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.taken_slots(uuid, timestamptz, timestamptz) TO service_role;