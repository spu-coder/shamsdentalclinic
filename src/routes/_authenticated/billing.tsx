import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Save, Search, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDateTimeAr, formatMoney } from "@/lib/clinic";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({
    meta: [
      { title: "الفواتير والمدفوعات — عيادة شمس السنية التخصصية" },
      {
        name: "description",
        content: "تعديل الفواتير وتسجيل الدفعات يدوياً لكل مريض مع تحديث تقرير المدفوعات تلقائياً.",
      },
      { property: "og:title", content: "الفواتير والمدفوعات — عيادة شمس السنية" },
      {
        property: "og:description",
        content: "إدارة كشف العيادة: الفواتير، الدفعات، المسدد والمتبقي.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BillingPage,
});

type Payment = { id: string; amount: number; method: string | null; paid_at: string };
type Invoice = {
  id: string;
  patient_id: string;
  description: string | null;
  total: number;
  discount: number;
  issued_at: string;
  payments: Payment[] | null;
  profiles: { full_name: string | null; phone: string | null } | null;
};

function BillingPage() {
  const { isStaff, loading } = useAuth();
  const qc = useQueryClient();
  const [term, setTerm] = useState("");

  const invoices = useQuery({
    queryKey: ["billing-invoices"],
    enabled: isStaff,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(
          "id,patient_id,description,total,discount,issued_at, payments(id,amount,method,paid_at), profiles:patient_id(full_name,phone)",
        )
        .order("issued_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data as unknown as Invoice[];
    },
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["billing-invoices"] });
    // تحديث تقرير المدفوعات وملفات المرضى تلقائياً
    void qc.invalidateQueries({ queryKey: ["rep-invoices"] });
    void qc.invalidateQueries({ queryKey: ["patient-invoices"] });
  };

  const list = useMemo(() => {
    const t = term.trim();
    const all = invoices.data ?? [];
    if (!t) return all;
    return all.filter(
      (i) =>
        (i.profiles?.full_name ?? "").includes(t) ||
        (i.profiles?.phone ?? "").includes(t) ||
        (i.description ?? "").includes(t),
    );
  }, [invoices.data, term]);

  const totals = useMemo(() => {
    let due = 0;
    let paid = 0;
    for (const i of list) {
      due += Number(i.total) - Number(i.discount);
      paid += (i.payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
    }
    return { due, paid, remaining: due - paid };
  }, [list]);

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

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">الفواتير والمدفوعات</h1>
          <p className="text-sm text-muted-foreground">
            تعديل الفواتير وتسجيل الدفعات يدوياً — يتحدّث تقرير المدفوعات تلقائياً.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/admin">لوحة العيادة</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/reports">التقارير</Link>
          </Button>
        </div>
      </header>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <SummaryCard label="إجمالي المستحق" value={totals.due} />
        <SummaryCard label="المسدّد" value={totals.paid} />
        <SummaryCard label="المتبقي" value={totals.remaining} />
      </div>

      <div className="mb-4 flex items-center gap-2">
        <Search className="size-4 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="ابحث باسم المريض أو الهاتف أو وصف الفاتورة"
        />
      </div>

      {invoices.isLoading && <p className="py-8 text-sm text-muted-foreground">جارٍ التحميل…</p>}
      {!invoices.isLoading && list.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">لا توجد فواتير مطابقة.</p>
      )}

      <div className="space-y-3">
        {list.map((inv) => (
          <InvoiceRow key={inv.id} invoice={inv} onChanged={refresh} />
        ))}
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-lg font-extrabold">{formatMoney(value)}</p>
      </CardContent>
    </Card>
  );
}

function InvoiceRow({ invoice, onChanged }: { invoice: Invoice; onChanged: () => void }) {
  const [desc, setDesc] = useState(invoice.description ?? "");
  const [total, setTotal] = useState(String(invoice.total));
  const [discount, setDiscount] = useState(String(invoice.discount));
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("نقداً");
  const [busy, setBusy] = useState(false);

  const payments = invoice.payments ?? [];
  const paid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const due = Number(invoice.total) - Number(invoice.discount);
  const remaining = due - paid;

  const saveInvoice = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("invoices")
      .update({
        description: desc || null,
        total: Number(total) || 0,
        discount: Number(discount) || 0,
      })
      .eq("id", invoice.id);
    setBusy(false);
    if (error) {
      toast.error("تعذّر حفظ الفاتورة");
      return;
    }
    toast.success("تم حفظ الفاتورة");
    onChanged();
  };

  const addPayment = async () => {
    const value = Number(amount);
    if (!value || value <= 0) {
      toast.error("أدخل مبلغاً صحيحاً");
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

  const deletePayment = async (id: string) => {
    const { error } = await supabase.from("payments").delete().eq("id", id);
    if (error) {
      toast.error("تعذّر حذف الدفعة");
      return;
    }
    toast.success("تم حذف الدفعة");
    onChanged();
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <span>{invoice.profiles?.full_name ?? "مريض"}</span>
          <span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
            {invoice.profiles?.phone}
            <Badge variant={remaining > 0 ? "destructive" : "secondary"}>
              {remaining > 0 ? `متبقي ${formatMoney(remaining)}` : "مسدّدة"}
            </Badge>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <Label className="text-xs">الوصف</Label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">الإجمالي</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">الحسم</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted-foreground">
            المستحق {formatMoney(due)} — المسدّد {formatMoney(paid)}
          </span>
          <Button size="sm" disabled={busy} onClick={() => void saveInvoice()}>
            <Save className="size-4" /> حفظ الفاتورة
          </Button>
        </div>

        <div className="rounded-lg border border-border/70 p-3">
          <p className="mb-2 text-sm font-semibold">الدفعات</p>
          {payments.length === 0 && (
            <p className="text-xs text-muted-foreground">لا توجد دفعات مسجّلة.</p>
          )}
          <div className="space-y-1">
            {payments.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-2 py-1.5 text-sm"
              >
                <span>
                  {formatMoney(Number(p.amount))} — {p.method ?? "غير محدد"} —{" "}
                  {formatDateTimeAr(p.paid_at)}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="حذف الدفعة"
                  onClick={() => void deletePayment(p.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <Input
              type="number"
              inputMode="numeric"
              placeholder="مبلغ الدفعة"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Input
              placeholder="طريقة الدفع"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            />
            <Button disabled={busy} onClick={() => void addPayment()}>
              <Plus className="size-4" /> إضافة دفعة
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
