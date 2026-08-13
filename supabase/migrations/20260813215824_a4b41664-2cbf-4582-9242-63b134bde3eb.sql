-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin','doctor','staff','patient');
CREATE TYPE public.appointment_status AS ENUM ('pending','approved','rejected','completed','cancelled','no_show');

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  birth_date date,
  gender text,
  address text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ROLES
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','doctor','staff'))
$$;

CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_staff(auth.uid()));

CREATE POLICY "roles read own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- signup trigger: first user becomes admin, others patient
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE admin_exists boolean;
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, avatar_url)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone', NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;

  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') INTO admin_exists;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN admin_exists THEN 'patient'::public.app_role ELSE 'admin'::public.app_role END)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- DOCTORS
CREATE TABLE public.doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  title text,
  specialty text,
  bio text,
  photo_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.doctors TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctors TO authenticated;
GRANT ALL ON public.doctors TO service_role;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doctors public read" ON public.doctors FOR SELECT USING (is_active = true OR public.is_staff(auth.uid()));
CREATE POLICY "doctors admin write" ON public.doctors FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- SERVICES
CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,
  description text,
  duration_min int NOT NULL DEFAULT 30,
  price numeric(12,2),
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.services TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "services public read" ON public.services FOR SELECT USING (is_active = true OR public.is_staff(auth.uid()));
CREATE POLICY "services admin write" ON public.services FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- SCHEDULES
CREATE TABLE public.doctor_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  weekday int NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  slot_minutes int NOT NULL DEFAULT 30,
  is_active boolean NOT NULL DEFAULT true
);
GRANT SELECT ON public.doctor_schedules TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctor_schedules TO authenticated;
GRANT ALL ON public.doctor_schedules TO service_role;
ALTER TABLE public.doctor_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedules public read" ON public.doctor_schedules FOR SELECT USING (true);
CREATE POLICY "schedules staff write" ON public.doctor_schedules FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.time_off (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text
);
GRANT SELECT ON public.time_off TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_off TO authenticated;
GRANT ALL ON public.time_off TO service_role;
ALTER TABLE public.time_off ENABLE ROW LEVEL SECURITY;
CREATE POLICY "timeoff public read" ON public.time_off FOR SELECT USING (true);
CREATE POLICY "timeoff staff write" ON public.time_off FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- APPOINTMENTS
CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_id uuid NOT NULL REFERENCES public.doctors(id) ON DELETE RESTRICT,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status public.appointment_status NOT NULL DEFAULT 'pending',
  patient_note text,
  decision_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX appointments_doctor_start_idx ON public.appointments (doctor_id, starts_at);
CREATE UNIQUE INDEX appointments_no_double_booking ON public.appointments (doctor_id, starts_at) WHERE status IN ('pending','approved');
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "appt read" ON public.appointments FOR SELECT TO authenticated USING (patient_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "appt insert own" ON public.appointments FOR INSERT TO authenticated WITH CHECK (patient_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "appt update" ON public.appointments FOR UPDATE TO authenticated USING (patient_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "appt delete staff" ON public.appointments FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));

-- taken slots view for booking (no patient data exposed)
CREATE OR REPLACE VIEW public.booked_slots
WITH (security_invoker = off) AS
  SELECT doctor_id, starts_at, ends_at FROM public.appointments WHERE status IN ('pending','approved');
GRANT SELECT ON public.booked_slots TO anon, authenticated;

-- HEALTH PROFILE
CREATE TABLE public.health_profiles (
  patient_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  blood_type text,
  chronic_diseases text,
  medications text,
  allergies text,
  diabetes boolean NOT NULL DEFAULT false,
  hypertension boolean NOT NULL DEFAULT false,
  heart_disease boolean NOT NULL DEFAULT false,
  bleeding_disorder boolean NOT NULL DEFAULT false,
  pregnant boolean NOT NULL DEFAULT false,
  smoker boolean NOT NULL DEFAULT false,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_profiles TO authenticated;
GRANT ALL ON public.health_profiles TO service_role;
ALTER TABLE public.health_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "health read" ON public.health_profiles FOR SELECT TO authenticated USING (patient_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "health insert" ON public.health_profiles FOR INSERT TO authenticated WITH CHECK (patient_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "health update" ON public.health_profiles FOR UPDATE TO authenticated USING (patient_id = auth.uid() OR public.is_staff(auth.uid()));

-- VISITS (archive + odontogram)
CREATE TABLE public.visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES public.doctors(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  visit_date date NOT NULL DEFAULT current_date,
  teeth text,
  diagnosis text,
  treatment text,
  prescription text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visits TO authenticated;
GRANT ALL ON public.visits TO service_role;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "visits read" ON public.visits FOR SELECT TO authenticated USING (patient_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "visits staff write" ON public.visits FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- BILLING
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES public.doctors(id) ON DELETE SET NULL,
  visit_id uuid REFERENCES public.visits(id) ON DELETE SET NULL,
  description text,
  total numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  issued_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoices read" ON public.invoices FOR SELECT TO authenticated USING (patient_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "invoices staff write" ON public.invoices FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  method text,
  paid_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments read" ON public.payments FOR SELECT TO authenticated USING (
  public.is_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.patient_id = auth.uid())
);
CREATE POLICY "payments staff write" ON public.payments FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- SEED
INSERT INTO public.doctors (name, title, specialty, bio, sort_order) VALUES
 ('ياسر زكريا شمس الدين','الدكتور','جراحة الفم والأسنان – تقويم – معالجات لبية ولثوية – تجميل','طبيب أسنان مختص، مؤسس عيادة شمس السنية التخصصية في عين منين.',1);

INSERT INTO public.services (name, category, description, duration_min, price, sort_order) VALUES
 ('تنظيف وتلميع الأسنان','وقاية','إزالة الجير والتصبغات وتلميع الأسنان مع تعليمات العناية المنزلية.',30,NULL,1),
 ('حشوة تجميلية','معالجة','حشوات كومبوزيت بلون السن للأسنان الأمامية والخلفية.',45,NULL,2),
 ('معالجة لبية (سحب عصب)','معالجات لبية','تنظيف قنوات الجذر وحشوها لإنقاذ السن المتأذي.',60,NULL,3),
 ('قلع بسيط','جراحة','قلع السن مع تخدير موضعي ومتابعة الشفاء.',30,NULL,4),
 ('قلع جراحي / رحى العقل','جراحة','قلع جراحي للأسنان المنطمرة أو أضراس العقل.',60,NULL,5),
 ('تقويم أسنان – استشارة','تقويم','فحص وتخطيط لعلاج التقويم الثابت أو المتحرك.',30,NULL,6),
 ('معالجة لثوية','معالجات لثوية','تنظيف عميق ومعالجة التهاب اللثة والجيوب.',45,NULL,7),
 ('تجميل الأسنان (فينير / تبييض)','تجميل','تبييض احترافي وقشور خزفية لابتسامة متناسقة.',60,NULL,8),
 ('تركيبات ثابتة (تيجان وجسور)','تركيبات','تيجان زيركون وخزف وجسور لاستعادة الأسنان المفقودة.',60,NULL,9),
 ('أسنان أطفال','أطفال','معالجات وقائية وترميمية لطيفة للأطفال.',30,NULL,10);

INSERT INTO public.doctor_schedules (doctor_id, weekday, start_time, end_time, slot_minutes)
SELECT d.id, w, '10:00', '18:00', 30 FROM public.doctors d, generate_series(0,4) AS w WHERE d.name = 'ياسر زكريا شمس الدين';
INSERT INTO public.doctor_schedules (doctor_id, weekday, start_time, end_time, slot_minutes)
SELECT d.id, 6, '10:00', '15:00', 30 FROM public.doctors d WHERE d.name = 'ياسر زكريا شمس الدين';