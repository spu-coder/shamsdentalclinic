import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Printer, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { HealthForm } from "@/components/clinic/HealthForm";
import { MediaGallery } from "@/components/clinic/MediaGallery";
import { CLINIC, formatMoney } from "@/lib/clinic";

type Doctor = { id: string; name: string; title: string | null };

export function PatientFile({
  patientId,
  staffId,
  doctors,
}: {
  patientId: string;
  staffId?: string;
  doctors: Doctor[];
}) {
  const qc = useQueryClient();

  const profile = useQuery({
    queryKey: ["patient-profile", patientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", patientId)
        .maybeSingle();
      return data;
    },
  });

  const visits = useQuery({
    queryKey: ["patient-visits", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visits")
        .select("*, doctors(name)")
        .eq("patient_id", patientId)
        .order("visit_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const invoices = useQuery({
    queryKey: ["patient-invoices", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, payments(id,amount,method,paid_at)")
        .eq("patient_id", patientId)
        .order("issued_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["patient-visits", patientId] });
    void qc.invalidateQueries({ queryKey: ["patient-invoices", patientId] });
  };

  return (
    <div className="space-y-4">
      <Card className="print-area">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {profile.data?.full_name ?? "مريض"} — ملف المريض
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
          <p>الهاتف: {profile.data?.phone ?? "—"}</p>
          <p>
            تاريخ الميلاد:{" "}
            {profile.data?.birth_date
              ? new Date(profile.data.birth_date).toLocaleDateString("ar-SY")
              : "—"}
          </p>
          <p>الجنس: {profile.data?.gender ?? "—"}</p>
          <p>العنوان: {profile.data?.address ?? "—"}</p>
        </CardContent>
      </Card>

      <Tabs defaultValue="visits">
        <TabsList className="flex w-full flex-wrap">
          <TabsTrigger value="visits">الزيارات والمعالجات</TabsTrigger>
          <TabsTrigger value="media">الصور</TabsTrigger>
          <TabsTrigger value="health">الملف الصحي</TabsTrigger>
          <TabsTrigger value="billing">الفواتير والدفعات</TabsTrigger>
          <TabsTrigger value="info">المعلومات الشخصية</TabsTrigger>
        </TabsList>

        <TabsContent value="visits" className="space-y-4">
          <VisitEditor
            patientId={patientId}
            doctors={doctors}
            onSaved={invalidate}
          />
          {(visits.data ?? []).map((v) => (
            <Card key={v.id}>
              <CardHeader className="flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm">
                  {new Date(v.visit_date).toLocaleDateString("ar-SY")}
                  {v.doctors?.name ? ` — د. ${v.doctors.name}` : ""}
                </CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive no-print"
                  onClick={async () => {
                    const { error } = await supabase.from("visits").delete().eq("id", v.id);
                    if (error) {
                      toast.error("تعذّر الحذف");
                      return;
                    }
                    toast.success("تم حذف الزيارة");
                    invalidate();
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
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

        <TabsContent value="media">
          <MediaGallery
            patientId={patientId}
            canEdit
            {...(staffId ? { uploaderId: staffId } : {})}
            visits={(visits.data ?? []).map((v) => ({ id: v.id, visit_date: v.visit_date }))}
          />
        </TabsContent>

        <TabsContent value="info">
          <ProfileForm userId={patientId} title="تعديل معلومات المريض" />
        </TabsContent>

        <TabsContent value="health">
          <HealthForm patientId={patientId} />
        </TabsContent>

        <TabsContent value="billing">
          <Billing
            patientId={patientId}
            doctors={doctors}
            invoices={invoices.data ?? []}
            visits={(visits.data ?? []).map((v) => ({ id: v.id, visit_date: v.visit_date }))}
            onChanged={invalidate}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function VisitEditor({
  patientId,
  doctors,
  onSaved,
}: {
  patientId: string;
  doctors: Doctor[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    visit_date: new Date().toISOString().slice(0, 10),
    doctor_id: doctors[0]?.id ?? "",
    teeth: "",
    diagnosis: "",
    treatment: "",
    prescription: "",
    notes: "",
  });

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("visits").insert({
      patient_id: patientId,
      doctor_id: form.doctor_id || null,
      visit_date: form.visit_date,
      teeth: form.teeth.slice(0, 200) || null,
      diagnosis: form.diagnosis.slice(0, 1000) || null,
      treatment: form.treatment.slice(0, 1000) || null,
      prescription: form.prescription.slice(0, 1000) || null,
      notes: form.notes.slice(0, 1000) || null,
    });
    setBusy(false);
    if (error) {
      toast.error("تعذّر حفظ الزيارة");
      return;
    }
    toast.success("تمت إضافة الزيارة");
    setForm({ ...form, teeth: "", diagnosis: "", treatment: "", prescription: "", notes: "" });
    setOpen(false);
    onSaved();
  };

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)} className="no-print">
        <Plus className="size-4" /> إضافة زيارة
      </Button>
    );
  }

  return (
    <Card className="no-print">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">زيارة جديدة</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>التاريخ</Label>
            <Input
              type="date"
              value={form.visit_date}
              onChange={(e) => setForm({ ...form, visit_date: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>الطبيب</Label>
            <Select
              value={form.doctor_id}
              onValueChange={(v) => setForm({ ...form, doctor_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر" />
              </SelectTrigger>
              <SelectContent>
                {doctors.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.title} {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>الأسنان (أرقام FDI)</Label>
            <Input
              dir="ltr"
              placeholder="16, 36"
              value={form.teeth}
              onChange={(e) => setForm({ ...form, teeth: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>التشخيص</Label>
            <Input
              value={form.diagnosis}
              onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>المعالجة</Label>
          <Textarea
            value={form.treatment}
            onChange={(e) => setForm({ ...form, treatment: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>الوصفة الدوائية</Label>
          <Textarea
            value={form.prescription}
            onChange={(e) => setForm({ ...form, prescription: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>ملاحظات</Label>
          <Textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={() => void save()} disabled={busy}>
            حفظ الزيارة
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            إلغاء
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

type InvoiceRow = {
  id: string;
  description: string | null;
  total: number;
  discount: number;
  issued_at: string;
  visit_id: string | null;
  payments: { id: string; amount: number; method: string | null; paid_at: string }[] | null;
};

function Billing({
  patientId,
  doctors,
  invoices,
  visits,
  onChanged,
}: {
  patientId: string;
  doctors: Doctor[];
  invoices: InvoiceRow[];
  visits: { id: string; visit_date: string }[];
  onChanged: () => void;
}) {
  const [desc, setDesc] = useState("");
  const [total, setTotal] = useState("");
  const [discount, setDiscount] = useState("0");
  const [visitId, setVisitId] = useState("none");
  const [doctorId, setDoctorId] = useState(doctors[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  const addInvoice = async () => {
    const amount = Number(total);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("أدخل مبلغاً صحيحاً");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("invoices").insert({
      patient_id: patientId,
      doctor_id: doctorId || null,
      visit_id: visitId === "none" ? null : visitId,
      description: desc.slice(0, 300) || null,
      total: amount,
      discount: Number(discount) || 0,
    });
    setBusy(false);
    if (error) {
      toast.error("تعذّر إنشاء الفاتورة");
      return;
    }
    setDesc("");
    setTotal("");
    setDiscount("0");
    toast.success("تم إنشاء الفاتورة");
    onChanged();
  };

  const totals = invoices.reduce(
    (acc, inv) => {
      const paid = (inv.payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
      acc.net += Number(inv.total) - Number(inv.discount);
      acc.paid += paid;
      return acc;
    },
    { net: 0, paid: 0 },
  );

  return (
    <div className="space-y-4">
      <Card className="no-print">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">فاتورة جديدة</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>وصف المعالجة</Label>
            <Input value={desc} maxLength={300} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>الإجمالي (ل.س)</Label>
            <Input dir="ltr" value={total} onChange={(e) => setTotal(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>الحسم</Label>
            <Input dir="ltr" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>الطبيب</Label>
            <Select value={doctorId} onValueChange={setDoctorId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر" />
              </SelectTrigger>
              <SelectContent>
                {doctors.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.title} {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>ربط بزيارة</Label>
            <Select value={visitId} onValueChange={setVisitId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون ربط</SelectItem>
                {visits.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {new Date(v.visit_date).toLocaleDateString("ar-SY")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Button onClick={() => void addInvoice()} disabled={busy}>
              إنشاء الفاتورة
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="print-area">
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">كشف العيادة</CardTitle>
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
          {invoices.length === 0 && (
            <p className="text-sm text-muted-foreground">لا توجد فواتير.</p>
          )}
          {invoices.map((inv) => (
            <InvoiceCard key={inv.id} invoice={inv} onChanged={onChanged} />
          ))}
          {invoices.length > 0 && (
            <div className="rounded-lg bg-muted p-3 text-sm font-semibold">
              المجموع: {formatMoney(totals.net)} — المدفوع: {formatMoney(totals.paid)} — المتبقي:{" "}
              {formatMoney(totals.net - totals.paid)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InvoiceCard({
  invoice,
  onChanged,
}: {
  invoice: InvoiceRow;
  onChanged: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("نقداً");
  const [busy, setBusy] = useState(false);

  const paid = (invoice.payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const net = Number(invoice.total) - Number(invoice.discount);
  const due = net - paid;

  const addPayment = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("أدخل مبلغ الدفعة");
      return;
    }
    if (value > due + 0.001) {
      toast.error("الدفعة أكبر من المتبقي");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("payments")
      .insert({ invoice_id: invoice.id, amount: value, method });
    setBusy(false);
    if (error) {
      toast.error("تعذّر تسجيل الدفعة");
      return;
    }
    setAmount("");
    toast.success("تم تسجيل الدفعة");
    onChanged();
  };

  return (
    <div className="space-y-3 rounded-xl border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{invoice.description ?? "فاتورة معالجة"}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(invoice.issued_at).toLocaleDateString("ar-SY")}
          </p>
        </div>
        <div className="text-xs">
          <p>الإجمالي: {formatMoney(net)}</p>
          <p className="text-primary">المدفوع: {formatMoney(paid)}</p>
          <p className="font-semibold">المتبقي: {formatMoney(due)}</p>
        </div>
        <Badge variant={due <= 0 ? "default" : "secondary"}>
          {due <= 0 ? "مسدّدة" : "قيد التسديد"}
        </Badge>
      </div>

      {(invoice.payments ?? []).length > 0 && (
        <ul className="space-y-1 rounded-lg bg-muted/60 p-2 text-xs">
          {(invoice.payments ?? [])
            .slice()
            .sort((a, b) => +new Date(a.paid_at) - +new Date(b.paid_at))
            .map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2">
                <span>
                  {new Date(p.paid_at).toLocaleDateString("ar-SY")} — {p.method ?? "دفعة"}
                </span>
                <span className="flex items-center gap-2">
                  {formatMoney(Number(p.amount))}
                  <button
                    type="button"
                    className="no-print text-destructive"
                    aria-label="حذف الدفعة"
                    onClick={async () => {
                      const { error } = await supabase.from("payments").delete().eq("id", p.id);
                      if (error) {
                        toast.error("تعذّر الحذف");
                        return;
                      }
                      onChanged();
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </span>
              </li>
            ))}
        </ul>
      )}

      {due > 0 && (
        <div className="no-print flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">دفعة</Label>
            <Input
              dir="ltr"
              className="h-9 w-28"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">الطريقة</Label>
            <Input
              className="h-9 w-32"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            />
          </div>
          <Button size="sm" onClick={() => void addPayment()} disabled={busy}>
            تسجيل الدفعة
          </Button>
        </div>
      )}
    </div>
  );
}
