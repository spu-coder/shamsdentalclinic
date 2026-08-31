import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, FileText, HeartPulse, Printer, Receipt } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CLINIC, STATUS_AR, formatDateTimeAr, formatMoney } from "@/lib/clinic";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "حسابي — عيادة شمس السنية التخصصية" },
      { name: "description", content: "مواعيدك، ملفك الصحي، أرشيف زياراتك وفواتيرك." },
      { property: "og:title", content: "حسابي — عيادة شمس السنية" },
      { property: "og:description", content: "متابعة المواعيد والملف الطبي والفواتير." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PatientDashboard,
});

const statusVariant = (s: string) =>
  s === "approved" || s === "completed"
    ? "default"
    : s === "pending"
      ? "secondary"
      : "destructive";

function PatientDashboard() {
  const { user, isStaff } = useAuth();
  const qc = useQueryClient();
  const uid = user?.id;

  const profile = useQuery({
    queryKey: ["my-profile", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", uid!).maybeSingle();
      return data;
    },
  });

  const appointments = useQuery({
    queryKey: ["my-appointments", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*, doctors(name,title), services(name)")
        .eq("patient_id", uid!)
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const visits = useQuery({
    queryKey: ["my-visits", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visits")
        .select("*, doctors(name)")
        .eq("patient_id", uid!)
        .order("visit_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const invoices = useQuery({
    queryKey: ["my-invoices", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, payments(amount,paid_at,method)")
        .eq("patient_id", uid!)
        .order("issued_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const cancel = async (id: string) => {
    const { error } = await supabase.from("appointments").update({ status: "cancelled" }).eq("id", id);
    if (error) {
      toast.error("تعذّر الإلغاء");
      return;
    }
    toast.success("تم إلغاء الموعد");
    void qc.invalidateQueries({ queryKey: ["my-appointments", uid] });
  };

  const totals = (invoices.data ?? []).reduce(
    (acc, inv) => {
      const paid = (inv.payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
      const net = Number(inv.total) - Number(inv.discount);
      acc.net += net;
      acc.paid += paid;
      return acc;
    },
    { net: 0, paid: 0 },
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            مرحباً {profile.data?.full_name ?? user?.email ?? ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            مواعيدك وملفك الطبي وفواتيرك في مكان واحد.
          </p>
        </div>
        <div className="flex gap-2">
          {isStaff && (
            <Button asChild variant="outline" size="sm">
              <Link to="/admin">لوحة العيادة</Link>
            </Button>
          )}
          <Button asChild size="sm">
            <Link to="/book">حجز موعد</Link>
          </Button>
        </div>
      </header>

      <Tabs defaultValue="appts">
        <TabsList className="flex w-full flex-wrap">
          <TabsTrigger value="appts" className="gap-1">
            <CalendarDays className="size-4" /> مواعيدي
          </TabsTrigger>
          <TabsTrigger value="health" className="gap-1">
            <HeartPulse className="size-4" /> ملفي الصحي
          </TabsTrigger>
          <TabsTrigger value="archive" className="gap-1">
            <FileText className="size-4" /> الأرشيف
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-1">
            <Receipt className="size-4" /> الفواتير
          </TabsTrigger>
        </TabsList>

        <TabsContent value="appts" className="space-y-3">
          {appointments.isLoading && <Skeleton className="h-24" />}
          {appointments.data?.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">لا توجد مواعيد بعد.</p>
          )}
          {(appointments.data ?? []).map((a) => (
            <Card key={a.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-semibold">{formatDateTimeAr(a.starts_at)}</p>
                  <p className="text-sm text-muted-foreground">
                    {a.doctors?.title} {a.doctors?.name}
                    {a.services?.name ? ` — ${a.services.name}` : ""}
                  </p>
                  {a.decision_reason && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      ملاحظة العيادة: {a.decision_reason}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant(a.status)}>{STATUS_AR[a.status]}</Badge>
                  {(a.status === "pending" || a.status === "approved") &&
                    new Date(a.starts_at).getTime() > Date.now() && (
                      <Button size="sm" variant="outline" onClick={() => void cancel(a.id)}>
                        إلغاء
                      </Button>
                    )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="health">
          <HealthForm {...(uid ? { patientId: uid } : {})} />
        </TabsContent>

        <TabsContent value="archive" className="space-y-3">
          {visits.data?.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              لا توجد زيارات موثّقة بعد.
            </p>
          )}
          {(visits.data ?? []).map((v) => (
            <Card key={v.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  زيارة {new Date(v.visit_date).toLocaleDateString("ar-SY")}
                  {v.doctors?.name ? ` — د. ${v.doctors.name}` : ""}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                {v.teeth && <p>الأسنان: {v.teeth}</p>}
                {v.diagnosis && <p>التشخيص: {v.diagnosis}</p>}
                {v.treatment && <p>المعالجة: {v.treatment}</p>}
                {v.prescription && <p>الوصفة: {v.prescription}</p>}
                {v.notes && <p>ملاحظات: {v.notes}</p>}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="billing">
          <Card className="print-area">
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">كشف حساب</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {CLINIC.name} — {CLINIC.phone}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="no-print"
                onClick={() => window.print()}
              >
                <Printer className="size-4" /> طباعة
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {(invoices.data ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">لا توجد فواتير.</p>
              )}
              {(invoices.data ?? []).map((inv) => {
                const paid = (inv.payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
                const net = Number(inv.total) - Number(inv.discount);
                return (
                  <div
                    key={inv.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{inv.description ?? "فاتورة معالجة"}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(inv.issued_at).toLocaleDateString("ar-SY")}
                      </p>
                    </div>
                    <div className="text-xs">
                      <p>الإجمالي: {formatMoney(net)}</p>
                      <p className="text-primary">المدفوع: {formatMoney(paid)}</p>
                      <p className="font-semibold">المتبقي: {formatMoney(net - paid)}</p>
                    </div>
                  </div>
                );
              })}
              {(invoices.data ?? []).length > 0 && (
                <div className="rounded-lg bg-muted p-3 text-sm font-semibold">
                  المجموع: {formatMoney(totals.net)} — المدفوع: {formatMoney(totals.paid)} —
                  المتبقي: {formatMoney(totals.net - totals.paid)}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

type HealthState = {
  blood_type: string;
  chronic_diseases: string;
  medications: string;
  allergies: string;
  notes: string;
  diabetes: boolean;
  hypertension: boolean;
  heart_disease: boolean;
  bleeding_disorder: boolean;
  pregnant: boolean;
  smoker: boolean;
};

const emptyHealth: HealthState = {
  blood_type: "",
  chronic_diseases: "",
  medications: "",
  allergies: "",
  notes: "",
  diabetes: false,
  hypertension: false,
  heart_disease: false,
  bleeding_disorder: false,
  pregnant: false,
  smoker: false,
};

const flags: { key: keyof HealthState; label: string }[] = [
  { key: "diabetes", label: "سكري" },
  { key: "hypertension", label: "ضغط مرتفع" },
  { key: "heart_disease", label: "أمراض قلبية" },
  { key: "bleeding_disorder", label: "سيولة دم / نزف" },
  { key: "pregnant", label: "حمل" },
  { key: "smoker", label: "تدخين" },
];

export function HealthForm({ patientId }: { patientId?: string }) {
  const [form, setForm] = useState<HealthState>(emptyHealth);
  const [busy, setBusy] = useState(false);

  const health = useQuery({
    queryKey: ["health", patientId],
    enabled: !!patientId,
    queryFn: async () => {
      const { data } = await supabase
        .from("health_profiles")
        .select("*")
        .eq("patient_id", patientId!)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (health.data) {
      setForm({
        blood_type: health.data.blood_type ?? "",
        chronic_diseases: health.data.chronic_diseases ?? "",
        medications: health.data.medications ?? "",
        allergies: health.data.allergies ?? "",
        notes: health.data.notes ?? "",
        diabetes: health.data.diabetes,
        hypertension: health.data.hypertension,
        heart_disease: health.data.heart_disease,
        bleeding_disorder: health.data.bleeding_disorder,
        pregnant: health.data.pregnant,
        smoker: health.data.smoker,
      });
    }
  }, [health.data]);

  const save = async () => {
    if (!patientId) return;
    setBusy(true);
    const { error } = await supabase.from("health_profiles").upsert({
      patient_id: patientId,
      ...form,
      blood_type: form.blood_type.slice(0, 10) || null,
      chronic_diseases: form.chronic_diseases.slice(0, 1000) || null,
      medications: form.medications.slice(0, 1000) || null,
      allergies: form.allergies.slice(0, 1000) || null,
      notes: form.notes.slice(0, 1000) || null,
      updated_at: new Date().toISOString(),
    });
    setBusy(false);
    if (error) {
      toast.error("تعذّر الحفظ");
      return;
    }
    toast.success("تم حفظ الملف الصحي");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">استبيان الصحة العامة</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>زمرة الدم</Label>
            <Input
              dir="ltr"
              value={form.blood_type}
              onChange={(e) => setForm({ ...form, blood_type: e.target.value })}
              maxLength={10}
            />
          </div>
          <div className="space-y-1.5">
            <Label>الحساسية (أدوية/بنسلين…)</Label>
            <Input
              value={form.allergies}
              onChange={(e) => setForm({ ...form, allergies: e.target.value })}
              maxLength={200}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {flags.map((f) => (
            <label
              key={String(f.key)}
              className="flex items-center justify-between rounded-lg border p-3 text-sm"
            >
              {f.label}
              <Switch
                checked={Boolean(form[f.key])}
                onCheckedChange={(v) => setForm({ ...form, [f.key]: v })}
              />
            </label>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label>أمراض مزمنة</Label>
          <Textarea
            value={form.chronic_diseases}
            onChange={(e) => setForm({ ...form, chronic_diseases: e.target.value })}
            maxLength={1000}
          />
        </div>
        <div className="space-y-1.5">
          <Label>أدوية تتناولها حالياً</Label>
          <Textarea
            value={form.medications}
            onChange={(e) => setForm({ ...form, medications: e.target.value })}
            maxLength={1000}
          />
        </div>
        <div className="space-y-1.5">
          <Label>ملاحظات إضافية</Label>
          <Textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            maxLength={1000}
          />
        </div>

        <Button onClick={() => void save()} disabled={busy}>
          حفظ الملف الصحي
        </Button>
      </CardContent>
    </Card>
  );
}
