import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/site/Logo";
import { CLINIC } from "@/lib/clinic";
import { ClinicStamp, DoctorSignature } from "@/components/print/Stamp";

/**
 * قالب طباعة رسمي بحجم A4 على هوية المركز: ترويسة باللوغو، محتوى، تذييل بالتوقيع والختم.
 */
export function PrintDoc({
  open,
  onClose,
  docTitle,
  subtitle,
  children,
  footerNote,
}: {
  open: boolean;
  onClose: () => void;
  docTitle: string;
  subtitle?: string;
  children: ReactNode;
  footerNote?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("printing");
    return () => {
      document.body.style.overflow = prev;
      document.body.classList.remove("printing");
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="print-overlay fixed inset-0 z-[100] overflow-auto bg-foreground/60 p-4">
      <div className="mx-auto max-w-[820px]">
        <div className="print-hide mb-3 flex justify-end gap-2">
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="size-4" /> طباعة / حفظ PDF
          </Button>
          <Button size="sm" variant="secondary" onClick={onClose}>
            <X className="size-4" /> إغلاق
          </Button>
        </div>

        <div className="print-area mx-auto bg-white p-8 text-[#123b46] shadow-2xl" dir="rtl">
          <header className="flex items-start justify-between gap-4 border-b-4 border-[#0e8a8f] pb-4">
            <div className="flex items-center gap-3">
              <Logo className="size-16" />
              <div>
                <p className="text-xl font-extrabold">{CLINIC.name}</p>
                <p className="text-sm font-semibold text-[#0e8a8f]">SHAMS Dental Clinic</p>
                <p className="text-xs">{CLINIC.doctor}</p>
              </div>
            </div>
            <div className="text-left text-xs leading-6" dir="ltr">
              <p>{CLINIC.phoneIntl}</p>
              <p>{CLINIC.landline}</p>
              <p dir="rtl">{CLINIC.address}</p>
            </div>
          </header>

          <div className="mt-5 flex items-end justify-between gap-3 border-b border-[#0e8a8f]/30 pb-2">
            <h2 className="text-lg font-extrabold">{docTitle}</h2>
            {subtitle && <p className="text-xs">{subtitle}</p>}
          </div>

          <div className="mt-5 text-sm leading-7">{children}</div>

          <footer className="mt-10 flex items-end justify-between gap-6 border-t border-[#0e8a8f]/30 pt-6">
            <div className="text-center">
              <DoctorSignature />
              <p className="mt-1 border-t border-[#123b46]/40 pt-1 text-xs font-semibold">
                {CLINIC.doctor} — مالك المركز
              </p>
            </div>
            <div className="text-center">
              <ClinicStamp />
              <p className="mt-1 text-[10px]">ختم المركز</p>
            </div>
          </footer>

          <p className="mt-4 text-center text-[10px] text-[#123b46]/70">
            {footerNote ?? "شكراً لثقتكم بعيادة شمس السنية التخصصية — نتمنى لكم دوام الصحة."}
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function PrintTable({
  head,
  rows,
}: {
  head: string[];
  rows: (ReactNode[])[];
}) {
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="bg-[#0e8a8f]/10">
          {head.map((h) => (
            <th key={h} className="border border-[#0e8a8f]/30 p-2 text-right font-bold">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j} className="border border-[#0e8a8f]/20 p-2">
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
