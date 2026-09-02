DROP POLICY IF EXISTS "health update" ON public.health_profiles;
CREATE POLICY "health update" ON public.health_profiles FOR UPDATE TO authenticated
USING (patient_id = auth.uid() OR public.is_admin_or_staff(auth.uid()) OR (public.has_role(auth.uid(),'doctor') AND public.is_my_patient(patient_id)))
WITH CHECK (patient_id = auth.uid() OR public.is_admin_or_staff(auth.uid()) OR (public.has_role(auth.uid(),'doctor') AND public.is_my_patient(patient_id)));

DROP POLICY IF EXISTS "health insert" ON public.health_profiles;
CREATE POLICY "health insert" ON public.health_profiles FOR INSERT TO authenticated
WITH CHECK (patient_id = auth.uid() OR public.is_admin_or_staff(auth.uid()) OR (public.has_role(auth.uid(),'doctor') AND public.is_my_patient(patient_id)));

DROP POLICY IF EXISTS "own profile update" ON public.profiles;
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid() OR public.is_admin_or_staff(auth.uid()) OR (public.has_role(auth.uid(),'doctor') AND public.is_my_patient(id)))
WITH CHECK (id = auth.uid() OR public.is_admin_or_staff(auth.uid()) OR (public.has_role(auth.uid(),'doctor') AND public.is_my_patient(id)));