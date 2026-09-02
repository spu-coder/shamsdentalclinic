-- 1) Internal (non-API) schema for authorization helpers
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION private.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','doctor','staff'))
$$;

CREATE OR REPLACE FUNCTION private.is_admin_or_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','staff'))
$$;

CREATE OR REPLACE FUNCTION private.current_doctor_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.id FROM public.doctors d WHERE d.profile_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION private.is_my_patient(_patient_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.patient_id = _patient_id AND a.doctor_id = private.current_doctor_id()
  ) OR EXISTS (
    SELECT 1 FROM public.visits v
    WHERE v.patient_id = _patient_id AND v.doctor_id = private.current_doctor_id()
  )
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_staff(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_admin_or_staff(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.current_doctor_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_my_patient(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_staff(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_admin_or_staff(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.current_doctor_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_my_patient(uuid) TO authenticated, service_role;

-- 2) Rewrite every policy to use the internal helpers
DROP POLICY IF EXISTS "admin emails admin write" ON public.admin_emails;
CREATE POLICY "admin emails admin write" ON public.admin_emails FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "admin emails read staff" ON public.admin_emails;
CREATE POLICY "admin emails read staff" ON public.admin_emails FOR SELECT TO authenticated
  USING (private.is_staff(auth.uid()));

DROP POLICY IF EXISTS "appt delete staff" ON public.appointments;
CREATE POLICY "appt delete staff" ON public.appointments FOR DELETE TO authenticated
  USING (private.is_admin_or_staff(auth.uid()) OR doctor_id = private.current_doctor_id());
DROP POLICY IF EXISTS "appt read" ON public.appointments;
CREATE POLICY "appt read" ON public.appointments FOR SELECT TO authenticated
  USING (patient_id = auth.uid() OR private.is_admin_or_staff(auth.uid()) OR doctor_id = private.current_doctor_id());
DROP POLICY IF EXISTS "appt update" ON public.appointments;
CREATE POLICY "appt update" ON public.appointments FOR UPDATE TO authenticated
  USING (patient_id = auth.uid() OR private.is_admin_or_staff(auth.uid()) OR doctor_id = private.current_doctor_id())
  WITH CHECK (patient_id = auth.uid() OR private.is_admin_or_staff(auth.uid()) OR doctor_id = private.current_doctor_id());

DROP POLICY IF EXISTS "reviews admin update" ON public.doctor_reviews;
CREATE POLICY "reviews admin update" ON public.doctor_reviews FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "reviews patient delete" ON public.doctor_reviews;
CREATE POLICY "reviews patient delete" ON public.doctor_reviews FOR DELETE TO authenticated
  USING (patient_id = auth.uid() OR private.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "reviews public read" ON public.doctor_reviews;
CREATE POLICY "reviews anon read visible" ON public.doctor_reviews FOR SELECT TO anon
  USING (is_visible = true);
CREATE POLICY "reviews authenticated read" ON public.doctor_reviews FOR SELECT TO authenticated
  USING (is_visible = true OR patient_id = auth.uid() OR private.is_staff(auth.uid()));

-- reviewer identity is never readable by anonymous visitors
REVOKE SELECT ON public.doctor_reviews FROM anon;
GRANT SELECT (id, doctor_id, appointment_id, rating, comment, is_visible, created_at, updated_at)
  ON public.doctor_reviews TO anon;

DROP POLICY IF EXISTS "ds admin write" ON public.doctor_services;
CREATE POLICY "ds admin write" ON public.doctor_services FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "ds doctor manage own" ON public.doctor_services;
CREATE POLICY "ds doctor manage own" ON public.doctor_services FOR ALL TO authenticated
  USING (doctor_id = private.current_doctor_id()) WITH CHECK (doctor_id = private.current_doctor_id());
DROP POLICY IF EXISTS "ds public read" ON public.doctor_services;
CREATE POLICY "ds anon read" ON public.doctor_services FOR SELECT TO anon USING (is_active = true);
CREATE POLICY "ds authenticated read" ON public.doctor_services FOR SELECT TO authenticated
  USING (is_active = true OR private.is_staff(auth.uid()));

DROP POLICY IF EXISTS "doctors admin write" ON public.doctors;
CREATE POLICY "doctors admin write" ON public.doctors FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "doctors public read" ON public.doctors;
CREATE POLICY "doctors anon read" ON public.doctors FOR SELECT TO anon USING (is_active = true);
CREATE POLICY "doctors authenticated read" ON public.doctors FOR SELECT TO authenticated
  USING (is_active = true OR private.is_staff(auth.uid()));

DROP POLICY IF EXISTS "health read" ON public.health_profiles;
CREATE POLICY "health read" ON public.health_profiles FOR SELECT TO authenticated
  USING (patient_id = auth.uid() OR private.is_admin_or_staff(auth.uid())
    OR (private.has_role(auth.uid(), 'doctor') AND private.is_my_patient(patient_id)));
DROP POLICY IF EXISTS "health update" ON public.health_profiles;
CREATE POLICY "health update" ON public.health_profiles FOR UPDATE TO authenticated
  USING (patient_id = auth.uid() OR private.is_admin_or_staff(auth.uid())
    OR (private.has_role(auth.uid(), 'doctor') AND private.is_my_patient(patient_id)))
  WITH CHECK (patient_id = auth.uid() OR private.is_admin_or_staff(auth.uid())
    OR (private.has_role(auth.uid(), 'doctor') AND private.is_my_patient(patient_id)));

DROP POLICY IF EXISTS "invoices read" ON public.invoices;
CREATE POLICY "invoices read" ON public.invoices FOR SELECT TO authenticated
  USING (patient_id = auth.uid() OR private.is_admin_or_staff(auth.uid())
    OR (private.has_role(auth.uid(), 'doctor') AND private.is_my_patient(patient_id)));
DROP POLICY IF EXISTS "invoices staff write" ON public.invoices;
CREATE POLICY "invoices staff write" ON public.invoices FOR ALL TO authenticated
  USING (private.is_admin_or_staff(auth.uid())
    OR (private.has_role(auth.uid(), 'doctor') AND private.is_my_patient(patient_id)))
  WITH CHECK (private.is_admin_or_staff(auth.uid())
    OR (private.has_role(auth.uid(), 'doctor') AND private.is_my_patient(patient_id)));

DROP POLICY IF EXISTS "payments read" ON public.payments;
CREATE POLICY "payments read" ON public.payments FOR SELECT TO authenticated
  USING (private.is_staff(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.invoices i WHERE i.id = payments.invoice_id AND i.patient_id = auth.uid()));
DROP POLICY IF EXISTS "payments staff write" ON public.payments;
CREATE POLICY "payments staff write" ON public.payments FOR ALL TO authenticated
  USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));

DROP POLICY IF EXISTS "own profile read" ON public.profiles;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR private.is_admin_or_staff(auth.uid())
    OR (private.has_role(auth.uid(), 'doctor') AND private.is_my_patient(id)));
DROP POLICY IF EXISTS "own profile update" ON public.profiles;
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR private.is_admin_or_staff(auth.uid())
    OR (private.has_role(auth.uid(), 'doctor') AND private.is_my_patient(id)))
  WITH CHECK (id = auth.uid() OR private.is_admin_or_staff(auth.uid())
    OR (private.has_role(auth.uid(), 'doctor') AND private.is_my_patient(id)));

DROP POLICY IF EXISTS "services admin write" ON public.services;
CREATE POLICY "services admin write" ON public.services FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "services public read" ON public.services;
CREATE POLICY "services anon read" ON public.services FOR SELECT TO anon USING (is_active = true);
CREATE POLICY "services authenticated read" ON public.services FOR SELECT TO authenticated
  USING (is_active = true OR private.is_staff(auth.uid()));

DROP POLICY IF EXISTS "roles admin delete" ON public.user_roles;
CREATE POLICY "roles admin delete" ON public.user_roles FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "roles admin update" ON public.user_roles;
CREATE POLICY "roles admin update" ON public.user_roles FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "roles read own" ON public.user_roles;
CREATE POLICY "roles read own" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_staff(auth.uid()));

DROP POLICY IF EXISTS "media read" ON public.visit_media;
CREATE POLICY "media read" ON public.visit_media FOR SELECT TO authenticated
  USING (patient_id = auth.uid() OR private.is_admin_or_staff(auth.uid())
    OR (private.has_role(auth.uid(), 'doctor') AND private.is_my_patient(patient_id)));
DROP POLICY IF EXISTS "media staff delete" ON public.visit_media;
CREATE POLICY "media staff delete" ON public.visit_media FOR DELETE TO authenticated
  USING (private.is_admin_or_staff(auth.uid())
    OR (private.has_role(auth.uid(), 'doctor') AND private.is_my_patient(patient_id)));
DROP POLICY IF EXISTS "media staff update" ON public.visit_media;
CREATE POLICY "media staff update" ON public.visit_media FOR UPDATE TO authenticated
  USING (private.is_admin_or_staff(auth.uid())
    OR (private.has_role(auth.uid(), 'doctor') AND private.is_my_patient(patient_id)))
  WITH CHECK (private.is_admin_or_staff(auth.uid())
    OR (private.has_role(auth.uid(), 'doctor') AND private.is_my_patient(patient_id)));

DROP POLICY IF EXISTS "visits read" ON public.visits;
CREATE POLICY "visits read" ON public.visits FOR SELECT TO authenticated
  USING (patient_id = auth.uid() OR private.is_admin_or_staff(auth.uid())
    OR doctor_id = private.current_doctor_id()
    OR (private.has_role(auth.uid(), 'doctor') AND private.is_my_patient(patient_id)));
DROP POLICY IF EXISTS "visits staff write" ON public.visits;
CREATE POLICY "visits staff write" ON public.visits FOR ALL TO authenticated
  USING (private.is_admin_or_staff(auth.uid())
    OR (private.has_role(auth.uid(), 'doctor') AND private.is_my_patient(patient_id)))
  WITH CHECK (private.is_admin_or_staff(auth.uid())
    OR (private.has_role(auth.uid(), 'doctor') AND private.is_my_patient(patient_id)));

-- 3) Scheduling tables: no more blanket read for every signed-in user
DROP POLICY IF EXISTS "schedules authenticated read" ON public.doctor_schedules;
DROP POLICY IF EXISTS "schedules staff write" ON public.doctor_schedules;
CREATE POLICY "schedules staff read" ON public.doctor_schedules FOR SELECT TO authenticated
  USING (private.is_admin_or_staff(auth.uid()) OR doctor_id = private.current_doctor_id());
CREATE POLICY "schedules staff write" ON public.doctor_schedules FOR ALL TO authenticated
  USING (private.is_admin_or_staff(auth.uid())) WITH CHECK (private.is_admin_or_staff(auth.uid()));

DROP POLICY IF EXISTS "timeoff authenticated read" ON public.time_off;
DROP POLICY IF EXISTS "timeoff staff write" ON public.time_off;
CREATE POLICY "timeoff staff read" ON public.time_off FOR SELECT TO authenticated
  USING (private.is_admin_or_staff(auth.uid()) OR doctor_id = private.current_doctor_id());
CREATE POLICY "timeoff staff write" ON public.time_off FOR ALL TO authenticated
  USING (private.is_admin_or_staff(auth.uid())) WITH CHECK (private.is_admin_or_staff(auth.uid()));

-- 4) Public-schema helpers are no longer callable through the Data API
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_staff(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_my_patient(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_doctor_id() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.taken_slots(uuid, timestamptz, timestamptz) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, authenticated, PUBLIC;