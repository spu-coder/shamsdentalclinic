import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarCheck, Search, Star, Stethoscope, UserCog, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PatientFile } from "@/components/clinic/PatientFile";
import { ProfileForm } from "@/components/clinic/ProfileForm";
import { DoctorServicesManager } from "@/components/clinic/DoctorServicesManager";
import { ReviewsModeration } from "@/components/clinic/Reviews";
import { STATUS_AR, WEEKDAYS_AR, formatDateTimeAr, formatMoney } from "@/lib/clinic";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "لوحة العيادة — عيادة شمس السنية التخصصية" },
      { name: "description", content: "إدارة المواعيد وملفات المرضى والأطباء والخدمات." },
      { property: "og:title", content: "لوحة العيادة — عيادة شمس السنية" },
      { property: "og:description", content: "إدارة المواعيد وملفات المرضى." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPanel,
});

function AdminPanel() {
  const { user, isStaff, isAdmin, isDoctorOnly, doctorId, loading } = useAuth();
  const qc = useQueryClient();
  const [patientId, setPatientId] = useState<string | null>(null);
  const [term, setTerm] = useState("");

  const doctors = useQuery({
    queryKey: ["admin-doctors"],
    enabled: isStaff,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctors")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const appointments = useQuery({
    queryKey: ["admin-appointments", isDoctorOnly ? doctorId : "all"],
    enabled: isStaff && (!isDoctorOnly || Boolean(doctorId)),
    queryFn: async () => {
      // الطبيب يرى مواعيده فقط ولا يقرر عن طبيب آخر
      let q = supabase
        .from("appointments")
        .select("*, doctors(name,title), services(name), profiles:patient_id(full_name,phone)")
        .order("starts_at", { ascending: false })
        .limit(200);
      if (isDoctorOnly && doctorId) q = q.eq("doctor_id", doctorId);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as AdminAppointment[];
    },
  });

  const patients = useQuery({
    queryKey: ["admin-patients", isDoctorOnly ? doctorId : "all"],
    enabled: isStaff && (!isDoctorOnly || Boolean(doctorId)),
    queryFn: async () => {
      // الطبيب يرى مرضاه فقط
      if (isDoctorOnly && doctorId) {
        const [appts, visits] = await Promise.all([
          supabase.from("appointments").select("patient_id").eq("doctor_id", doctorId),
          supabase.from("visits").select("patient_id").eq("doctor_id", doctorId),
        ]);
        const ids = Array.from(
          new Set([...(appts.data ?? []), ...(visits.data ?? [])].map((r) => r.patient_id)),
        );
        if (ids.length === 0) return [];
        const { data, error } = await supabase
          .from("profiles")
          .select("id,full_name,phone,created_at")
          .in("id", ids)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name,phone,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const services = useQuery({
    queryKey: ["admin-services"],
    enabled: isStaff,
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const decide = async (id: string, status: "approved" | "rejected" | "completed" | "no_show") => {
    const target = (appointments.data ?? []).find((a) => a.id === id);
    if (isDoctorOnly && target && target.doctor_id !== doctorId) {
      toast.error("لا يمكنك التصرف بموعد طبيب آخر");
      return;
    }
    const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
    if (error) {
      toast.error("تعذّر تحديث الموعد");
      return;
    }
    toast.success("تم التحديث");
    void qc.invalidateQueries({ queryKey: ["admin-appointments"] });
  };

  const filteredPatients = useMemo(() => {
    const t = term.trim();
    if (!t) return patients.data ?? [];
    return (patients.data ?? []).filter(
      (p) => (p.full_name ?? "").includes(t) || (p.phone ?? "").includes(t),
    );
  }, [patients.data, term]);

  const doctorOptions = (doctors.data ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    title: d.title,
  }));

  if (loading) return <div className="mx-auto max-w-6xl px-4 py-16">جارٍ التحميل…</div>;
  if (!isStaff)
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-xl font-bold">هذه الصفحة للكادر الطبي فقط</h1>
        <Button asChild className="mt-4">
          <Link to="/dashboard">العودة إلى حسابي</Link>
        </Button>
      </div>
    );

  const pending = (appointments.data ?? []).filter((a) => a.status === "pending");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">لوحة العيادة</h1>
          <p className="text-sm text-muted-foreground">
            إدارة المواعيد وملفات المرضى والصور والفواتير.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/billing">الفواتير والمدفوعات</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/reports">التقارير</Link>
          </Button>
        </div>
      </header>

      <Tabs defaultValue="appts">
        <TabsList className="flex w-full flex-wrap">
          <TabsTrigger value="appts" className="gap-1">
            <CalendarCheck className="size-4" /> المواعيد
            {pending.length > 0 && <Badge variant="secondary">{pending.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="patients" className="gap-1">
            <Users className="size-4" /> المرضى
          </TabsTrigger>
          <TabsTrigger value="clinic" className="gap-1">
            <Stethoscope className="size-4" /> الأطباء والخدمات
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="reviews" className="gap-1">
              <Star className="size-4" /> التقييمات
            </TabsTrigger>
          )}
          <TabsTrigger value="me" className="gap-1">
            <UserCog className="size-4" /> ملفي
          </TabsTrigger>
        </TabsList>

        <TabsContent value="appts" className="space-y-3">
          {(appointments.data ?? []).length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">لا توجد مواعيد.</p>
          )}
          {(appointments.data ?? []).map((a) => (
            <Card key={a.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-semibold">{formatDateTimeAr(a.starts_at)}</p>
                  <p className="text-sm text-muted-foreground">
                    {a.profiles?.full_name ?? "مريض"}
                    {a.profiles?.phone ? ` — ${a.profiles.phone}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.doctors?.title} {a.doctors?.name}
                    {a.services?.name ? ` — ${a.services.name}` : ""}
                  </p>
                  {a.patient_note && (
                    <p className="mt-1 text-xs text-muted-foreground">ملاحظة: {a.patient_note}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{STATUS_AR[a.status]}</Badge>
                  {a.status === "pending" && (
                    <>
                      <Button size="sm" onClick={() => void decide(a.id, "approved")}>
                        قبول
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => void decide(a.id, "rejected")}
                      >
                        رفض
                      </Button>
                    </>
                  )}
                  {a.status === "approved" && (
                    <>
                      <Button size="sm" onClick={() => void decide(a.id, "completed")}>
                        تم الحضور
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void decide(a.id, "no_show")}
                      >
                        لم يحضر
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setPatientId(a.patient_id)}>
                    ملف المريض
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="patients" className="space-y-4">
          <div className="flex items-center gap-2">
            <Search className="size-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالاسم أو الهاتف"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="max-w-xs"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPatients.map((p) => (
              <button
                key={p.id}
                onClick={() => setPatientId(p.id)}
                className={`rounded-lg border p-3 text-start text-sm transition hover:border-primary ${
                  patientId === p.id ? "border-primary bg-primary/5" : ""
                }`}
              >
                <p className="font-medium">{p.full_name ?? "بدون اسم"}</p>
                <p className="text-xs text-muted-foreground">{p.phone ?? "—"}</p>
              </button>
            ))}
          </div>
          {patientId ? (
            <PatientFile
              patientId={patientId}
              doctors={doctorOptions}
              {...(user?.id ? { staffId: user.id } : {})}
            />
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              اختر مريضاً لعرض ملفه الكامل.
            </p>
          )}
        </TabsContent>

        <TabsContent value="clinic" className="space-y-6">
          <DoctorsManager canEdit={isAdmin} />
          <DoctorServicesManager
            doctors={doctorOptions}
            {...(isDoctorOnly && doctorId ? { lockedDoctorId: doctorId } : {})}
          />
          <ServicesManager canEdit={isAdmin} services={services.data ?? []} />
          {isAdmin && <SchedulesManager doctors={doctorOptions} />}
        </TabsContent>

        {isAdmin && (
          <TabsContent value="reviews">
            <ReviewsModeration />
          </TabsContent>
        )}

        <TabsContent value="me" className="space-y-6">
          {user?.id && <ProfileForm userId={user.id} title="بياناتي الشخصية" />}
          {doctorId && <DoctorBioEditor doctorId={doctorId} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

type AdminAppointment = {
  id: string;
  patient_id: string;
  doctor_id: string;
  starts_at: string;
  status: string;
  patient_note: string | null;
  doctors: { name: string; title: string | null } | null;
  services: { name: string } | null;
  profiles: { full_name: string | null; phone: string | null } | null;
};

function DoctorsManager({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", title: "د.", specialty: "", bio: "" });

  const doctors = useQuery({
    queryKey: ["admin-doctors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("doctors").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const add = async () => {
    if (!form.name.trim()) return;
    const { error } = await supabase.from("doctors").insert({
      name: form.name.trim().slice(0, 120),
      title: form.title.trim().slice(0, 60) || null,
      specialty: form.specialty.trim().slice(0, 120) || null,
      bio: form.bio.trim().slice(0, 600) || null,
    });
    if (error) {
      toast.error("تعذّرت الإضافة");
      return;
    }
    setForm({ name: "", title: "د.", specialty: "", bio: "" });
    toast.success("تمت إضافة الطبيب");
    void qc.invalidateQueries({ queryKey: ["admin-doctors"] });
  };

  const toggle = async (id: string, is_active: boolean) => {
    const { error } = await supabase.from("doctors").update({ is_active }).eq("id", id);
    if (error) {
      toast.error("تعذّر التحديث");
      return;
    }
    void qc.invalidateQueries({ queryKey: ["admin-doctors"] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">الأطباء</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {(doctors.data ?? []).map((d) => (
          <div key={d.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
            <div>
              <p className="font-medium">
                {d.title} {d.name}
              </p>
              <p className="text-xs text-muted-foreground">{d.specialty ?? "—"}</p>
            </div>
            {canEdit && (
              <Switch checked={d.is_active} onCheckedChange={(v) => void toggle(d.id, v)} />
            )}
          </div>
        ))}
        {canEdit && (
          <div className="space-y-3 rounded-lg border p-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>اللقب</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>الاسم</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>الاختصاص</Label>
                <Input
                  value={form.specialty}
                  onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                />
              </div>
            </div>
            <Textarea
              placeholder="نبذة"
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
            />
            <Button size="sm" onClick={() => void add()}>
              إضافة طبيب
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type ServiceRow = {
  id: string;
  name: string;
  category: string | null;
  price: number | null;
  duration_min: number;
  is_active: boolean;
};

function ServicesManager({ canEdit, services }: { canEdit: boolean; services: ServiceRow[] }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", category: "", price: "", duration: "30" });

  const add = async () => {
    if (!form.name.trim()) return;
    const { error } = await supabase.from("services").insert({
      name: form.name.trim().slice(0, 120),
      category: form.category.trim().slice(0, 60) || null,
      price: form.price ? Number(form.price) : null,
      duration_min: Number(form.duration) || 30,
    });
    if (error) {
      toast.error("تعذّرت الإضافة");
      return;
    }
    setForm({ name: "", category: "", price: "", duration: "30" });
    toast.success("تمت إضافة الخدمة");
    void qc.invalidateQueries({ queryKey: ["admin-services"] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">الخدمات والأسعار</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {services.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
            <div>
              <p className="font-medium">{s.name}</p>
              <p className="text-xs text-muted-foreground">
                {s.category ?? "—"} — {s.duration_min} دقيقة
              </p>
            </div>
            <span className="text-xs font-semibold">{formatMoney(s.price)}</span>
          </div>
        ))}
        {canEdit && (
          <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-4">
            <Input
              placeholder="اسم الخدمة"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Input
              placeholder="التصنيف"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
            <Input
              placeholder="السعر"
              inputMode="numeric"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value.replace(/\D/g, "") })}
            />
            <Input
              placeholder="المدة"
              inputMode="numeric"
              value={form.duration}
              onChange={(e) => setForm({ ...form, duration: e.target.value.replace(/\D/g, "") })}
            />
            <Button size="sm" className="sm:col-span-4" onClick={() => void add()}>
              إضافة خدمة
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SchedulesManager({ doctors }: { doctors: { id: string; name: string; title: string | null }[] }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    doctor_id: "",
    weekday: "0",
    start_time: "10:00",
    end_time: "18:00",
    slot_minutes: "30",
  });

  const schedules = useQuery({
    queryKey: ["admin-schedules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctor_schedules")
        .select("*, doctors(name)")
        .order("weekday");
      if (error) throw error;
      return data;
    },
  });

  const add = async () => {
    const doctorId = form.doctor_id || doctors[0]?.id;
    if (!doctorId) return;
    const { error } = await supabase.from("doctor_schedules").insert({
      doctor_id: doctorId,
      weekday: Number(form.weekday),
      start_time: form.start_time,
      end_time: form.end_time,
      slot_minutes: Number(form.slot_minutes) || 30,
    });
    if (error) {
      toast.error("تعذّرت الإضافة");
      return;
    }
    toast.success("تمت إضافة الدوام");
    void qc.invalidateQueries({ queryKey: ["admin-schedules"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("doctor_schedules").delete().eq("id", id);
    if (error) {
      toast.error("تعذّر الحذف");
      return;
    }
    void qc.invalidateQueries({ queryKey: ["admin-schedules"] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">أوقات الدوام</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {(schedules.data ?? []).map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
            <span>
              {WEEKDAYS_AR[s.weekday]} — {s.start_time.slice(0, 5)} إلى {s.end_time.slice(0, 5)} (
              {s.doctors?.name})
            </span>
            <Button size="sm" variant="ghost" onClick={() => void remove(s.id)}>
              حذف
            </Button>
          </div>
        ))}
        <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-5">
          <select
            className="rounded-md border bg-background p-2 text-sm"
            value={form.doctor_id || doctors[0]?.id || ""}
            onChange={(e) => setForm({ ...form, doctor_id: e.target.value })}
          >
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title} {d.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border bg-background p-2 text-sm"
            value={form.weekday}
            onChange={(e) => setForm({ ...form, weekday: e.target.value })}
          >
            {WEEKDAYS_AR.map((w, i) => (
              <option key={w} value={String(i)}>
                {w}
              </option>
            ))}
          </select>
          <Input
            type="time"
            value={form.start_time}
            onChange={(e) => setForm({ ...form, start_time: e.target.value })}
          />
          <Input
            type="time"
            value={form.end_time}
            onChange={(e) => setForm({ ...form, end_time: e.target.value })}
          />
          <Input
            inputMode="numeric"
            value={form.slot_minutes}
            onChange={(e) => setForm({ ...form, slot_minutes: e.target.value.replace(/\D/g, "") })}
          />
          <Button size="sm" className="sm:col-span-5" onClick={() => void add()}>
            إضافة دوام
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


function DoctorBioEditor({ doctorId }: { doctorId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", title: "", specialty: "", bio: "" });
  const [ready, setReady] = useState(false);

  const doctor = useQuery({
    queryKey: ["doctor-self", doctorId],
    queryFn: async () => {
      const { data, error } = await supabase.from("doctors").select("*").eq("id", doctorId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (doctor.data && !ready) {
    setReady(true);
    setForm({
      name: doctor.data.name ?? "",
      title: doctor.data.title ?? "",
      specialty: doctor.data.specialty ?? "",
      bio: doctor.data.bio ?? "",
    });
  }

  const save = async () => {
    const { error } = await supabase
      .from("doctors")
      .update({
        name: form.name.trim().slice(0, 120),
        title: form.title.trim().slice(0, 60) || null,
        specialty: form.specialty.trim().slice(0, 120) || null,
        bio: form.bio.trim().slice(0, 600) || null,
      })
      .eq("id", doctorId);
    if (error) {
      toast.error("تعذّر الحفظ");
      return;
    }
    toast.success("تم تحديث بطاقة الطبيب");
    void qc.invalidateQueries({ queryKey: ["doctor-self", doctorId] });
    void qc.invalidateQueries({ queryKey: ["doctors"] });
    void qc.invalidateQueries({ queryKey: ["admin-doctors"] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">بطاقتي كطبيب في الموقع</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>اللقب</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>الاسم</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>الاختصاص</Label>
            <Input
              value={form.specialty}
              onChange={(e) => setForm({ ...form, specialty: e.target.value })}
            />
          </div>
        </div>
        <Textarea
          rows={3}
          placeholder="نبذة تعريفية"
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
        />
        <Button onClick={() => void save()}>حفظ بطاقة الطبيب</Button>
      </CardContent>
    </Card>
  );
}
