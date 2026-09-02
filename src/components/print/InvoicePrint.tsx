import { PrintDoc, PrintTable } from "@/components/print/PrintDoc";
import { formatMoney } from "@/lib/clinic";

export type PrintInvoice = {
  id: string;
  description: string | null;
  total: number | null;
  discount: number | null;
  issued_at: string;
  patient?: { full_name: string | null; phone: string | null } | null;
  doctor?: { name: string; title: string | null } | null;
  payments?: { id: string; amount: number | null; method: string | null; paid_at: string }[];
};

export function InvoicePrint({
  invoice,
  open,
  onClose,
}: {
  invoice: PrintInvoice | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!invoice) return null;
  const total = Number(invoice.total ?? 0);
  const discount = Number(invoice.discount ?? 0);
  const net = Math.max(total - discount, 0);
  const paid = (invoice.payments ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const rest = net - paid;
  const date = new Date(invoice.issued_at).toLocaleDateString("ar-SY");

  return (
    <PrintDoc
      open={open}
      onClose={onClose}
      docTitle="فاتورة معالجة سنية"
      subtitle={`رقم الفاتورة: ${invoice.id.slice(0, 8).toUpperCase()} — التاريخ: ${date}`}
    >
      <div className="mb-5 grid grid-cols-2 gap-3 text-xs">
        <div className="rounded border border-[#0e8a8f]/30 p-3">
          <p className="font-bold">بيانات المريض</p>
          <p>الاسم: {invoice.patient?.full_name ?? "—"}</p>
          <p>الهاتف: {invoice.patient?.phone ?? "—"}</p>
        </div>
        <div className="rounded border border-[#0e8a8f]/30 p-3">
          <p className="font-bold">الطبيب المعالج</p>
          <p>
            {invoice.doctor ? `${invoice.doctor.title ?? ""} ${invoice.doctor.name}` : "—"}
          </p>
          <p>تاريخ الإصدار: {date}</p>
        </div>
      </div>

      <PrintTable
        head={["البند", "التفاصيل", "المبلغ"]}
        rows={[["معالجة", invoice.description ?? "معالجة سنية", formatMoney(total)]]}
      />

      <div className="mt-4 ms-auto w-64 space-y-1 text-xs">
        <Row label="الإجمالي" value={formatMoney(total)} />
        <Row label="الحسم" value={formatMoney(discount)} />
        <Row label="الصافي" value={formatMoney(net)} bold />
        <Row label="المدفوع" value={formatMoney(paid)} />
        <Row label="المتبقي" value={formatMoney(rest)} bold />
      </div>

      {(invoice.payments ?? []).length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-xs font-bold">سجل الدفعات</p>
          <PrintTable
            head={["التاريخ", "الطريقة", "المبلغ"]}
            rows={(invoice.payments ?? []).map((p) => [
              new Date(p.paid_at).toLocaleDateString("ar-SY"),
              p.method ?? "نقداً",
              formatMoney(Number(p.amount ?? 0)),
            ])}
          />
        </div>
      )}
    </PrintDoc>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div
      className={`flex justify-between border-b border-[#0e8a8f]/20 pb-1 ${bold ? "font-extrabold" : ""}`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
