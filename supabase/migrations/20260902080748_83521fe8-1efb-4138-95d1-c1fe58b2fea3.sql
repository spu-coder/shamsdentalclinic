REVOKE EXECUTE ON FUNCTION public.current_doctor_id() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_staff(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_my_patient(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_doctor_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_my_patient(uuid) TO authenticated;