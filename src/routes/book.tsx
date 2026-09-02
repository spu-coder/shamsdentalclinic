import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { dayKey, getDaySlots, parseDayKey, timeAr } from "@/lib/booking";
import { WEEKDAYS_AR, formatMoney } from "@/lib/clinic";

export const Route = createFileRoute("/book")({
  validateSearch: (search: Record<string, unknown>): { service?: string } =>
    typeof search['service'] === "string" ? { service: search['service'] } : {},

  head: () => ({
    meta: [
      { title: "حجز موعد — عيادة شمس السنية التخصصية" },
      {
        name: "description",
        content:
          "احجز موعدك في عيادة شمس السنية التخصصية بعين منين: اختر الطبيب والخدمة والوقت المتاح.",
      },
      { property: "og:title", content: "حجز موعد — عيادة شمس السنية التخصصية" },
      { property: "og:description", content: "حجز إلكتروني سريع للمواعيد مع اختيار الوقت المتاح." },
    ],
  }),
  component: BookPage,
});

function nextDays(count: number) {
  const out: Date[] = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    out.push(d);
  }
  return out;
}

function BookPage() {
  const { service: serviceParam } = Route.useSearch();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [doctorId, setDoctorId] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>(serviceParam ?? "");
  const [day, setDay] = useState<string>(dayKey(new Date()));
  const [slotIso, setSlotIso] = useState<string>("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const doctors = useQuery({
    queryKey: ["doctors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctors")
        .select("id,name,title,specialty")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  // قائمة الخدمات وأسعارها الخاصة بالطبيب المختار
  const services = useQuery({
    queryKey: ["doctor-service-options", doctorId],
    enabled: Boolean(doctorId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctor_services")
        .select("service_id,price,duration_min,services(id,name,category,is_active)")
        .eq("doctor_id", doctorId)
        .eq("is_active", true);
      if (error) throw error;
      return (data ?? [])
        .filter((r) => (r.services as { is_active: boolean } | null)?.is_active)
        .map((r) => {
          const svc = r.services as unknown as { id: string; name: string; category: string | null };
          return {
            id: r.service_id,
            name: svc.name,
            category: svc.category,
            price: r.price == null ? null : Number(r.price),
            duration_min: r.duration_min,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name, "ar"));
    },
  });

  useEffect(() => {
    if (!doctorId && doctors.data?.[0]) setDoctorId(doctors.data[0].id);
  }, [doctors.data, doctorId]);

  // إن لم يقدّم الطبيب المختار الخدمة المحددة، نُفرغ الاختيار
  useEffect(() => {
    if (!serviceId || !services.data) return;
    if (!services.data.some((s) => s.id === serviceId)) setServiceId("");
  }, [services.data, serviceId]);

  const selectedService = useMemo(
    () => services.data?.find((s) => s.id === serviceId) ?? null,
    [services.data, serviceId],
  );
  const duration = selectedService?.duration_min ?? 30;

  const slots = useQuery({
    queryKey: ["slots", doctorId, day, duration, user?.id ?? "anon"],
    enabled: Boolean(doctorId && user),
    queryFn: () => getDaySlots(doctorId, parseDayKey(day), duration),
  });

  const submit = async () => {
    if (!user) return;
    if (!doctorId || !slotIso) {
      toast.error("اختر الطبيب والوقت");
      return;
    }
    setBusy(true);
    const start = new Date(slotIso);
    const end = new Date(start.getTime() + duration * 60000);
    const { error } = await supabase.from("appointments").insert({
      patient_id: user.id,
      doctor_id: doctorId,
      service_id: serviceId || null,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      patient_note: note.trim().slice(0, 500) || null,
    });
    setBusy(false);
    if (error) {
      toast.error(
        error.code === "23505" || error.message.includes("duplicate")
          ? "هذا الوقت تم حجزه للتو، اختر وقتاً آخر"
          : "تعذّر إنشاء الحجز",
      );
      void slots.refetch();
      return;
    }
    toast.success("تم إرسال طلب الحجز، سيتم تأكيده من العيادة");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold">حجز موعد</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          اختر الطبيب والخدمة ثم الوقت المتاح، وسيصلك تأكيد من العيادة.
        </p>
      </header>

      {!loading && !user && (
        <Card className="mb-6 border-primary/40 bg-primary/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-5">
            <p className="text-sm">سجّل الدخول أولاً لحجز موعد ومتابعة مواعيدك.</p>
            <Button asChild size="sm">
              <Link to="/auth">تسجيل الدخول</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarDays className="size-5 text-primary" />
            تفاصيل الموعد
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>الطبيب</Label>
              <Select value={doctorId} onValueChange={setDoctorId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الطبيب" />
                </SelectTrigger>
                <SelectContent>
                  {(doctors.data ?? []).map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.title ? `${d.title} ` : ""}
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>الخدمة</Label>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الخدمة" />
                </SelectTrigger>
                <SelectContent>
                  {(services.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} — {s.duration_min} د
                      {s.price != null ? ` — ${formatMoney(s.price)}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {services.data && services.data.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  لا توجد خدمات مُسعّرة لهذا الطبيب بعد.
                </p>
              )}
              {selectedService?.price != null && (
                <p className="text-xs text-primary">
                  أجر الطبيب لهذه الخدمة: {formatMoney(selectedService.price)}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>اليوم</Label>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {nextDays(14).map((d) => {
                const key = dayKey(d);
                const active = key === day;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setDay(key);
                      setSlotIso("");
                    }}
                    className={`min-w-20 rounded-lg border px-3 py-2 text-center text-xs transition-colors ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    <span className="block font-semibold">{WEEKDAYS_AR[d.getDay()]}</span>
                    <span className="block opacity-80">
                      {d.getDate()}/{d.getMonth() + 1}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>الأوقات المتاحة</Label>
            {!user ? (
              <p className="text-sm text-muted-foreground">تظهر الأوقات المتاحة بعد تسجيل الدخول.</p>
            ) : slots.isLoading ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : (slots.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد أوقات متاحة في هذا اليوم.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {slots.data!.map((s) => {
                  const iso = s.start.toISOString();
                  const active = iso === slotIso;
                  return (
                    <button
                      key={iso}
                      type="button"
                      disabled={s.taken}
                      onClick={() => setSlotIso(iso)}
                      className={`rounded-lg border px-2 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:bg-accent"
                      }`}
                    >
                      {timeAr(s.start)}
                      {active && <Check className="mr-1 inline size-3" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note">ملاحظة للطبيب (اختياري)</Label>
            <Textarea
              id="note"
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              placeholder="مثال: ألم في الضرس الخلفي الأيمن"
            />
          </div>

          <Button
            className="w-full"
            disabled={busy || !user || !slotIso}
            onClick={() => void submit()}
          >
            تأكيد طلب الحجز
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
