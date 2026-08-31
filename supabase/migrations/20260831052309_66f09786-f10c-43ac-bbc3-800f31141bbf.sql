-- 1) Media for visits (x-rays / intra-oral photos)
CREATE TABLE public.visit_media (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visit_id uuid REFERENCES public.visits(id) ON DELETE SET NULL,
  doctor_id uuid REFERENCES public.doctors(id) ON DELETE SET NULL,
  storage_path text NOT NULL UNIQUE,
  kind text NOT NULL DEFAULT 'clinical',
  caption text,
  taken_at date NOT NULL DEFAULT CURRENT_DATE,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX visit_media_patient_idx ON public.visit_media(patient_id, taken_at DESC);
CREATE INDEX visit_media_visit_idx ON public.visit_media(visit_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.visit_media TO authenticated;
GRANT ALL ON public.visit_media TO service_role;

ALTER TABLE public.visit_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "media read" ON public.visit_media FOR SELECT TO authenticated
  USING (patient_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "media staff insert" ON public.visit_media FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "media staff update" ON public.visit_media FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "media staff delete" ON public.visit_media FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER visit_media_touch BEFORE UPDATE ON public.visit_media
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) Admin allow-list (5 clinic admin accounts)
CREATE TABLE public.admin_emails (
  email text NOT NULL PRIMARY KEY,
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_emails TO authenticated;
GRANT ALL ON public.admin_emails TO service_role;

ALTER TABLE public.admin_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin emails read staff" ON public.admin_emails FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "admin emails admin write" ON public.admin_emails FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.admin_emails (email, label) VALUES
  ('admin1@shamsdental.sy', 'مدير 1 — الدكتور ياسر'),
  ('admin2@shamsdental.sy', 'مدير 2'),
  ('admin3@shamsdental.sy', 'مدير 3'),
  ('admin4@shamsdental.sy', 'مدير 4'),
  ('admin5@shamsdental.sy', 'مدير 5');

-- 3) Grant admin role automatically to allow-listed emails on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE admin_exists boolean; is_allowed boolean;
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, avatar_url)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone', NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;

  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') INTO admin_exists;
  SELECT EXISTS (
    SELECT 1 FROM public.admin_emails WHERE lower(email) = lower(NEW.email)
  ) INTO is_allowed;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN is_allowed OR NOT admin_exists THEN 'admin'::public.app_role ELSE 'patient'::public.app_role END)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

-- 4) Admins can manage roles
CREATE POLICY "roles admin insert" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles admin update" ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles admin delete" ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5) Storage policies for the private clinic-media bucket
CREATE POLICY "clinic media staff read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'clinic-media' AND (public.is_staff(auth.uid()) OR (storage.foldername(name))[1] = auth.uid()::text));
CREATE POLICY "clinic media staff insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'clinic-media' AND public.is_staff(auth.uid()));
CREATE POLICY "clinic media staff update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'clinic-media' AND public.is_staff(auth.uid()));
CREATE POLICY "clinic media staff delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'clinic-media' AND public.is_staff(auth.uid()));