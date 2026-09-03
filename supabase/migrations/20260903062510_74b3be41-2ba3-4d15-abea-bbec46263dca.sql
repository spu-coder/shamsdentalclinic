-- 1) Fix policies that still call public (revoked) helper functions
DROP POLICY IF EXISTS "appt insert own" ON public.appointments;
CREATE POLICY "appt insert own" ON public.appointments FOR INSERT TO authenticated
WITH CHECK (patient_id = auth.uid() OR private.is_admin_or_staff(auth.uid()) OR doctor_id = private.current_doctor_id());

DROP POLICY IF EXISTS "health insert" ON public.health_profiles;
CREATE POLICY "health insert" ON public.health_profiles FOR INSERT TO authenticated
WITH CHECK (patient_id = auth.uid() OR private.is_admin_or_staff(auth.uid()) OR (private.has_role(auth.uid(),'doctor') AND private.is_my_patient(patient_id)));

DROP POLICY IF EXISTS "media staff insert" ON public.visit_media;
CREATE POLICY "media insert" ON public.visit_media FOR INSERT TO authenticated
WITH CHECK (patient_id = auth.uid() OR private.is_admin_or_staff(auth.uid()) OR (private.has_role(auth.uid(),'doctor') AND private.is_my_patient(patient_id)));

DROP POLICY IF EXISTS "media staff update" ON public.visit_media;
CREATE POLICY "media update" ON public.visit_media FOR UPDATE TO authenticated
USING (patient_id = auth.uid() OR private.is_admin_or_staff(auth.uid()) OR (private.has_role(auth.uid(),'doctor') AND private.is_my_patient(patient_id)))
WITH CHECK (patient_id = auth.uid() OR private.is_admin_or_staff(auth.uid()) OR (private.has_role(auth.uid(),'doctor') AND private.is_my_patient(patient_id)));

DROP POLICY IF EXISTS "media staff delete" ON public.visit_media;
CREATE POLICY "media delete" ON public.visit_media FOR DELETE TO authenticated
USING (patient_id = auth.uid() OR private.is_admin_or_staff(auth.uid()) OR (private.has_role(auth.uid(),'doctor') AND private.is_my_patient(patient_id)));

-- 2) Storage policies (clinic-media) rewritten with private helpers
DROP POLICY IF EXISTS "clinic media staff insert" ON storage.objects;
DROP POLICY IF EXISTS "clinic media staff read" ON storage.objects;
DROP POLICY IF EXISTS "clinic media staff update" ON storage.objects;
DROP POLICY IF EXISTS "clinic media staff delete" ON storage.objects;

CREATE POLICY "clinic media insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'clinic-media' AND (private.is_staff(auth.uid()) OR (storage.foldername(name))[1] = auth.uid()::text));
CREATE POLICY "clinic media read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'clinic-media' AND (private.is_staff(auth.uid()) OR (storage.foldername(name))[1] = auth.uid()::text));
CREATE POLICY "clinic media update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'clinic-media' AND (private.is_staff(auth.uid()) OR (storage.foldername(name))[1] = auth.uid()::text));
CREATE POLICY "clinic media delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'clinic-media' AND (private.is_staff(auth.uid()) OR (storage.foldername(name))[1] = auth.uid()::text));

-- 3) Service pricing extras
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS discount_price numeric,
  ADD COLUMN IF NOT EXISTS discount_until timestamptz,
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hide_price boolean NOT NULL DEFAULT false;

ALTER TABLE public.doctor_services
  ADD COLUMN IF NOT EXISTS discount_price numeric,
  ADD COLUMN IF NOT EXISTS discount_until timestamptz;

-- 4) Review of prices
ALTER TABLE public.doctor_reviews
  ADD COLUMN IF NOT EXISTS price_rating integer;

-- 5) Clinic settings (singleton row)
CREATE TABLE IF NOT EXISTS public.clinic_settings (
  id boolean PRIMARY KEY DEFAULT true,
  phone text,
  phone_alt text,
  landline text,
  whatsapp text,
  address text,
  map_url text,
  facebook_url text,
  instagram_url text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clinic_settings_singleton CHECK (id)
);
GRANT SELECT ON public.clinic_settings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.clinic_settings TO authenticated;
GRANT ALL ON public.clinic_settings TO service_role;
ALTER TABLE public.clinic_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings public read" ON public.clinic_settings FOR SELECT TO anon USING (true);
CREATE POLICY "settings auth read" ON public.clinic_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings admin insert" ON public.clinic_settings FOR INSERT TO authenticated
WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE POLICY "settings admin update" ON public.clinic_settings FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE TRIGGER clinic_settings_touch BEFORE UPDATE ON public.clinic_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.clinic_settings (id, phone, landline, whatsapp, address)
VALUES (true, '0959405017', '011 58 45 155', '963959405017', 'عين منين – طريق حلبون – جانب صيدلية طحلة')
ON CONFLICT (id) DO NOTHING;

-- 6) Page visibility per role
CREATE TABLE IF NOT EXISTS public.page_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key text NOT NULL,
  role public.app_role NOT NULL,
  is_visible boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page_key, role)
);
GRANT SELECT ON public.page_access TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_access TO authenticated;
GRANT ALL ON public.page_access TO service_role;
ALTER TABLE public.page_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "page access public read" ON public.page_access FOR SELECT TO anon USING (true);
CREATE POLICY "page access auth read" ON public.page_access FOR SELECT TO authenticated USING (true);
CREATE POLICY "page access admin write" ON public.page_access FOR ALL TO authenticated
USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE TRIGGER page_access_touch BEFORE UPDATE ON public.page_access
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.page_access (page_key, role, is_visible) VALUES
  ('dashboard','patient',true),('dashboard','doctor',true),('dashboard','staff',true),('dashboard','admin',true),
  ('book','patient',true),('book','doctor',false),('book','staff',true),('book','admin',true),
  ('admin','doctor',true),('admin','staff',true),('admin','admin',true),('admin','patient',false),
  ('billing','doctor',true),('billing','staff',true),('billing','admin',true),('billing','patient',false),
  ('reports','doctor',true),('reports','staff',true),('reports','admin',true),('reports','patient',false),
  ('settings','admin',true),('settings','doctor',false),('settings','staff',false),('settings','patient',false)
ON CONFLICT (page_key, role) DO NOTHING;