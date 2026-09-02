import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ReportPrint } from "@/components/print/ReportPrint";
import { CLINIC, STATUS_AR, formatMoney } from "@/lib/clinic";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "تقارير العيادة — عيادة شمس السنية التخصصية" },
      { name: "description", content: "تقارير مالية وصحية وتاريخية للمرضى، جماعية وفردية." },
      { property: "og:title", content: "تقارير العيادة — عيادة شمس السنية" },
      { property: "og:description", content: "تقارير مالية وصحية وتاريخية." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReportsPage,
});

const today = () => new Date().toISOString().slice(0, 10);
const monthAgo = () => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

function toCsv(rows: Record<string, string | number>[], filename: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]!);
  const body = rows
    .map((r) => headers.map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\uFEFF" + headers.join(",") + "\n" + body], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ReportsPage() {
  const { isStaff, loading } = useAuth();
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(today());
  const [term, setTerm] = useState("");
  const [printOpen, setPrintOpen] = useState(false);

  const fromIso = `${from}T00:00:00.000Z`;
  const toIso = `${to}T23:59:59.999Z`;

  const invoices = useQuery({
    queryKey: ["rep-invoices", from, to],
    enabled: isStaff,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, payments(amount,paid_at,method), profiles:patient_id(full_name,phone)")
        .gte("issued_at", fromIso)
        .lte("issued_at", toIso)
        .order("issued_at", { ascending: false });
      if (error) throw error;
      return data as unknown as InvoiceRow[];
    },
  });

  const appointments = useQuery({
    queryKey: ["rep-appts", from, to],
    enabled: isStaff,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id,status,starts_at,doctors(name), profiles:patient_id(full_name)")
        .gte("starts_at", fromIso)
        .lte("starts_at", toIso);
      if (error) throw error;
      return data as unknown as ApptRow[];
    },
  });

  const health = useQuery({
    queryKey: ["rep-health"],
    enabled: isStaff,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("health_profiles")
        .select("*, profiles:patient_id(full_name,phone)");
      if (error) throw error;
      return data as unknown as HealthRow[];
    },
  });

  const money = useMemo(() => {
    let total = 0;
    let paid = 0;
    for (const inv of invoices.data ?? []) {
      total += Number(inv.total) - Number(inv.discount);
      paid += (inv.payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
    }
    return { total, paid, due: total - paid };
  }, [invoices.data]);

  const statusCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of appointments.data ?? []) map[a.status] = (map[a.status] ?? 0) + 1;
    return map;
  }, [appointments.data]);

  const healthRows = useMemo(() => {
    const t = term.trim();
    const rows = health.data ?? [];
    if (!t) return rows;
    return rows.filter((r) => (r.profiles?.full_name ?? "").includes(t));
  }, [health.data, term]);

  if (loading) return <div className="mx-auto max-w-5xl px-4 py-16">جارٍ التحميل…</div>;
  if (!isStaff)
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-xl font-bold">التقارير متاحة للكادر الطبي فقط</h1>
        <Button asChild className="mt-4">
          <Link to="/dashboard">العودة إلى حسابي</Link>
        </Button>
      </div>
    );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">تقارير العيادة</h1>
          <p className="text-sm text-muted-foreground">
            {CLINIC.name} — {CLINIC.phone}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2 no-print">
          <div className="space-y-1">
            <Label className="text-xs">من</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">إلى</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button size="sm" variant="outline" onClick={() => setPrintOpen(true)}>
            <Printer className="size-4" /> تقرير رسمي للطباعة
          </Button>
        </div>
      </header>

      <div className="mb-6 grid gap-3 sm:grid-cols-3 print-area">
        <StatCard label="إجمالي الفواتير" value={formatMoney(money.total)} />
        <StatCard label="المحصّل" value={formatMoney(money.paid)} />
        <StatCard label="المتبقي" value={formatMoney(money.due)} />
      </div>

      <Tabs defaultValue="financial">
        <TabsList className="flex w-full flex-wrap">
          <TabsTrigger value="financial">مالي</TabsTrigger>
          <TabsTrigger value="visits">المواعيد</TabsTrigger>
          <TabsTrigger value="health">الصحة العامة</TabsTrigger>
        </TabsList>

        <TabsContent value="financial" className="space-y-3">
          <Button
            size="sm"
            variant="outline"
            className="no-print"
            onClick={() =>
              toCsv(
                (invoices.data ?? []).map((inv) => ({
                  المريض: inv.profiles?.full_name ?? "",
                  الهاتف: inv.profiles?.phone ?? "",
                  الوصف: inv.description ?? "",
                  التاريخ: new Date(inv.issued_at).toLocaleDateString("ar-SY"),
                  الإجمالي: Number(inv.total) - Number(inv.discount),
                  المدفوع: (inv.payments ?? []).reduce((s, p) => s + Number(p.amount), 0),
                })),
                "financial-report.csv",
              )
            }
          >
            <Download className="size-4" /> تصدير CSV
          </Button>
          <Card className="print-area">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">الفواتير والدفعات</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(invoices.data ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">لا توجد فواتير في هذه الفترة.</p>
              )}
              {(invoices.data ?? []).map((inv) => {
                const paid = (inv.payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
                const net = Number(inv.total) - Number(inv.discount);
                return (
                  <div key={inv.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{inv.profiles?.full_name ?? "مريض"}</p>
                        <p className="text-xs text-muted-foreground">
                          {inv.description ?? "فاتورة معالجة"} —{" "}
                          {new Date(inv.issued_at).toLocaleDateString("ar-SY")}
                        </p>
                      </div>
                      <div className="text-xs">
                        <p>الإجمالي: {formatMoney(net)}</p>
                        <p className="text-primary">المدفوع: {formatMoney(paid)}</p>
                        <p className="font-semibold">المتبقي: {formatMoney(net - paid)}</p>
                      </div>
                    </div>
                    {(inv.payments ?? []).length > 0 && (
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {(inv.payments ?? []).map((p, i) => (
                          <li key={i}>
                            دفعة {formatMoney(Number(p.amount))} —{" "}
                            {new Date(p.paid_at).toLocaleDateString("ar-SY")}
                            {p.method ? ` (${p.method})` : ""}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="visits" className="space-y-3">
          <Card className="print-area">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">إحصاء المواعيد</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm sm:grid-cols-3">
              {Object.entries(STATUS_AR).map(([key, label]) => (
                <div key={key} className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-lg font-bold">{statusCounts[key] ?? 0}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 no-print">
            <Input
              placeholder="بحث باسم المريض"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="max-w-xs"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                toCsv(
                  healthRows.map((r) => ({
                    المريض: r.profiles?.full_name ?? "",
                    الهاتف: r.profiles?.phone ?? "",
                    الزمرة: r.blood_type ?? "",
                    سكري: r.diabetes ? "نعم" : "لا",
                    ضغط: r.hypertension ? "نعم" : "لا",
                    قلب: r.heart_disease ? "نعم" : "لا",
                    نزف: r.bleeding_disorder ? "نعم" : "لا",
                    تدخين: r.smoker ? "نعم" : "لا",
                    حساسية: r.allergies ?? "",
                    أدوية: r.medications ?? "",
                  })),
                  "health-report.csv",
                )
              }
            >
              <Download className="size-4" /> تصدير CSV
            </Button>
          </div>
          <Card className="print-area">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">تقرير الصحة العامة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {healthRows.length === 0 && (
                <p className="text-sm text-muted-foreground">لا توجد ملفات صحية.</p>
              )}
              {healthRows.map((r) => (
                <div key={r.patient_id} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{r.profiles?.full_name ?? "مريض"}</p>
                  <p className="text-xs text-muted-foreground">
                    الزمرة: {r.blood_type ?? "—"} — الحساسية: {r.allergies ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[
                      r.diabetes && "سكري",
                      r.hypertension && "ضغط",
                      r.heart_disease && "قلب",
                      r.bleeding_disorder && "نزف",
                      r.pregnant && "حمل",
                      r.smoker && "تدخين",
                    ]
                      .filter(Boolean)
                      .join(" • ") || "لا توجد عوامل خطورة مسجّلة"}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ReportPrint
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        title="تقرير العيادة الشامل"
        subtitle={`الفترة من ${from} إلى ${to}`}
        summary={[
          { label: "إجمالي الفواتير", value: formatMoney(money.total) },
          { label: "المحصّل", value: formatMoney(money.paid) },
          { label: "المتبقي", value: formatMoney(money.due) },
        ]}
        sections={[
          {
            title: "التقرير المالي",
            head: ["المريض", "الوصف", "التاريخ", "الصافي", "المدفوع", "المتبقي"],
            rows: (invoices.data ?? []).map((inv) => {
              const paid = (inv.payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
              const net = Number(inv.total) - Number(inv.discount);
              return [
                inv.profiles?.full_name ?? "مريض",
                inv.description ?? "فاتورة معالجة",
                new Date(inv.issued_at).toLocaleDateString("ar-SY"),
                formatMoney(net),
                formatMoney(paid),
                formatMoney(net - paid),
              ];
            }),
          },
          {
            title: "تقرير المواعيد",
            head: ["المريض", "الطبيب", "التاريخ", "الحالة"],
            rows: (appointments.data ?? []).map((a) => [
              a.profiles?.full_name ?? "مريض",
              a.doctors?.name ?? "—",
              new Date(a.starts_at).toLocaleDateString("ar-SY"),
              STATUS_AR[a.status] ?? a.status,
            ]),
          },
          {
            title: "تقرير الصحة العامة للمرضى",
            head: ["المريض", "الزمرة", "أمراض مزمنة", "حساسية", "تنبيهات"],
            rows: healthRows.map((h) => [
              h.profiles?.full_name ?? "مريض",
              h.blood_type ?? "—",
              h.chronic_diseases ?? "—",
              h.allergies ?? "—",
              [
                h.diabetes ? "سكري" : null,
                h.hypertension ? "ضغط" : null,
                h.heart_disease ? "قلب" : null,
                h.bleeding_disorder ? "نزف" : null,
                h.pregnant ? "حمل" : null,
                h.smoker ? "تدخين" : null,
              ]
                .filter(Boolean)
                .join("، ") || "—",
            ]),
          },
        ]}
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

type InvoiceRow = {
  id: string;
  total: number;
  discount: number;
  description: string | null;
  issued_at: string;
  payments: { amount: number; paid_at: string; method: string | null }[] | null;
  profiles: { full_name: string | null; phone: string | null } | null;
};

type ApptRow = {
  id: string;
  status: string;
  starts_at: string;
  doctors: { name: string } | null;
  profiles: { full_name: string | null } | null;
};

type HealthRow = {
  patient_id: string;
  blood_type: string | null;
  allergies: string | null;
  medications: string | null;
  diabetes: boolean;
  hypertension: boolean;
  heart_disease: boolean;
  bleeding_disorder: boolean;
  pregnant: boolean;
  smoker: boolean;
  profiles: { full_name: string | null; phone: string | null } | null;
};
