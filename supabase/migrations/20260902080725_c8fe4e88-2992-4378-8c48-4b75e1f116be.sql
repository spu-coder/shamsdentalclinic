-- helpers
CREATE OR REPLACE FUNCTION public.current_doctor_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.id FROM public.doctors d WHERE d.profile_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','staff'))
$$;

CREATE OR REPLACE FUNCTION public.is_my_patient(_patient_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.patient_id = _patient_id AND a.doctor_id = public.current_doctor_id()
  ) OR EXISTS (
    SELECT 1 FROM public.visits v
    WHERE v.patient_id = _patient_id AND v.doctor_id = public.current_doctor_id()
  )
$$;

GRANT EXECUTE ON FUNCTION public.current_doctor_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_my_patient(uuid) TO authenticated;

-- doctor services pricing
CREATE TABLE public.doctor_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  price numeric,
  duration_min integer NOT NULL DEFAULT 30,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (doctor_id, service_id)
);

GRANT SELECT ON public.doctor_services TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctor_services TO authenticated;
GRANT ALL ON public.doctor_services TO service_role;
ALTER TABLE public.doctor_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ds public read" ON public.doctor_services FOR SELECT
  USING (is_active = true OR public.is_staff(auth.uid()));
CREATE POLICY "ds admin write" ON public.doctor_services FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "ds doctor manage own" ON public.doctor_services FOR ALL TO authenticated
  USING (doctor_id = public.current_doctor_id())
  WITH CHECK (doctor_id = public.current_doctor_id());

CREATE TRIGGER doctor_services_touch BEFORE UPDATE ON public.doctor_services
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- reviews
CREATE TABLE public.doctor_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (patient_id, appointment_id)
);

GRANT SELECT ON public.doctor_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctor_reviews TO authenticated;
GRANT ALL ON public.doctor_reviews TO service_role;
ALTER TABLE public.doctor_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews public read" ON public.doctor_reviews FOR SELECT
  USING (is_visible = true OR patient_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "reviews patient insert" ON public.doctor_reviews FOR INSERT TO authenticated
  WITH CHECK (
    patient_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = appointment_id AND a.patient_id = auth.uid()
        AND a.doctor_id = doctor_reviews.doctor_id AND a.status = 'completed'
    )
  );
CREATE POLICY "reviews patient update" ON public.doctor_reviews FOR UPDATE TO authenticated
  USING (patient_id = auth.uid()) WITH CHECK (patient_id = auth.uid());
CREATE POLICY "reviews patient delete" ON public.doctor_reviews FOR DELETE TO authenticated
  USING (patient_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "reviews admin update" ON public.doctor_reviews FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER doctor_reviews_touch BEFORE UPDATE ON public.doctor_reviews
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- seed doctor pricing from base services
INSERT INTO public.doctor_services (doctor_id, service_id, price, duration_min)
SELECT d.id, s.id,
  ROUND(COALESCE(s.price, 0) * CASE WHEN d.specialty IS NOT NULL AND d.specialty <> '' THEN 1.25 ELSE 1 END),
  s.duration_min
FROM public.doctors d CROSS JOIN public.services s
WHERE d.is_active AND s.is_active
ON CONFLICT DO NOTHING;

-- tighten role separation: doctors only their own data
DROP POLICY IF EXISTS "appt read" ON public.appointments;
CREATE POLICY "appt read" ON public.appointments FOR SELECT TO authenticated
  USING (
    patient_id = auth.uid()
    OR public.is_admin_or_staff(auth.uid())
    OR doctor_id = public.current_doctor_id()
  );

DROP POLICY IF EXISTS "appt update" ON public.appointments;
CREATE POLICY "appt update" ON public.appointments FOR UPDATE TO authenticated
  USING (
    patient_id = auth.uid()
    OR public.is_admin_or_staff(auth.uid())
    OR doctor_id = public.current_doctor_id()
  )
  WITH CHECK (
    patient_id = auth.uid()
    OR public.is_admin_or_staff(auth.uid())
    OR doctor_id = public.current_doctor_id()
  );

DROP POLICY IF EXISTS "appt delete staff" ON public.appointments;
CREATE POLICY "appt delete staff" ON public.appointments FOR DELETE TO authenticated
  USING (public.is_admin_or_staff(auth.uid()) OR doctor_id = public.current_doctor_id());

DROP POLICY IF EXISTS "visits read" ON public.visits;
CREATE POLICY "visits read" ON public.visits FOR SELECT TO authenticated
  USING (
    patient_id = auth.uid()
    OR public.is_admin_or_staff(auth.uid())
    OR doctor_id = public.current_doctor_id()
    OR (public.has_role(auth.uid(), 'doctor') AND public.is_my_patient(patient_id))
  );

DROP POLICY IF EXISTS "visits staff write" ON public.visits;
CREATE POLICY "visits staff write" ON public.visits FOR ALL TO authenticated
  USING (public.is_admin_or_staff(auth.uid()) OR (public.has_role(auth.uid(), 'doctor') AND public.is_my_patient(patient_id)))
  WITH CHECK (public.is_admin_or_staff(auth.uid()) OR (public.has_role(auth.uid(), 'doctor') AND public.is_my_patient(patient_id)));

DROP POLICY IF EXISTS "invoices read" ON public.invoices;
CREATE POLICY "invoices read" ON public.invoices FOR SELECT TO authenticated
  USING (
    patient_id = auth.uid()
    OR public.is_admin_or_staff(auth.uid())
    OR (public.has_role(auth.uid(), 'doctor') AND public.is_my_patient(patient_id))
  );

DROP POLICY IF EXISTS "invoices staff write" ON public.invoices;
CREATE POLICY "invoices staff write" ON public.invoices FOR ALL TO authenticated
  USING (public.is_admin_or_staff(auth.uid()) OR (public.has_role(auth.uid(), 'doctor') AND public.is_my_patient(patient_id)))
  WITH CHECK (public.is_admin_or_staff(auth.uid()) OR (public.has_role(auth.uid(), 'doctor') AND public.is_my_patient(patient_id)));

DROP POLICY IF EXISTS "media read" ON public.visit_media;
CREATE POLICY "media read" ON public.visit_media FOR SELECT TO authenticated
  USING (
    patient_id = auth.uid()
    OR public.is_admin_or_staff(auth.uid())
    OR (public.has_role(auth.uid(), 'doctor') AND public.is_my_patient(patient_id))
  );

DROP POLICY IF EXISTS "media staff insert" ON public.visit_media;
CREATE POLICY "media staff insert" ON public.visit_media FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_staff(auth.uid()) OR (public.has_role(auth.uid(), 'doctor') AND public.is_my_patient(patient_id)));

DROP POLICY IF EXISTS "media staff update" ON public.visit_media;
CREATE POLICY "media staff update" ON public.visit_media FOR UPDATE TO authenticated
  USING (public.is_admin_or_staff(auth.uid()) OR (public.has_role(auth.uid(), 'doctor') AND public.is_my_patient(patient_id)))
  WITH CHECK (public.is_admin_or_staff(auth.uid()) OR (public.has_role(auth.uid(), 'doctor') AND public.is_my_patient(patient_id)));

DROP POLICY IF EXISTS "media staff delete" ON public.visit_media;
CREATE POLICY "media staff delete" ON public.visit_media FOR DELETE TO authenticated
  USING (public.is_admin_or_staff(auth.uid()) OR (public.has_role(auth.uid(), 'doctor') AND public.is_my_patient(patient_id)));

DROP POLICY IF EXISTS "own profile read" ON public.profiles;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_admin_or_staff(auth.uid())
    OR (public.has_role(auth.uid(), 'doctor') AND public.is_my_patient(id))
  );

DROP POLICY IF EXISTS "own profile update" ON public.profiles;
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin_or_staff(auth.uid()))
  WITH CHECK (id = auth.uid() OR public.is_admin_or_staff(auth.uid()));

-- doctors can edit their own doctor card
CREATE POLICY "doctors edit own card" ON public.doctors FOR UPDATE TO authenticated
  USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "health read" ON public.health_profiles;
CREATE POLICY "health read" ON public.health_profiles FOR SELECT TO authenticated
  USING (
    patient_id = auth.uid()
    OR public.is_admin_or_staff(auth.uid())
    OR (public.has_role(auth.uid(), 'doctor') AND public.is_my_patient(patient_id))
  );