import type { ReactNode } from "react";

import { PrintDoc, PrintTable } from "@/components/print/PrintDoc";

export type ReportSection = {
  title: string;
  head: string[];
  rows: ReactNode[][];
  note?: string;
};

export function ReportPrint({
  open,
  onClose,
  title,
  subtitle,
  summary,
  sections,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  summary?: { label: string; value: string }[];
  sections: ReportSection[];
}) {
  return (
    <PrintDoc
      open={open}
      onClose={onClose}
      docTitle={title}
      {...(subtitle ? { subtitle } : {})}
      footerNote="تقرير رسمي صادر عن عيادة شمس السنية التخصصية — لا يُعتد به إلا بالتوقيع والختم."
    >
      {summary && summary.length > 0 && (
        <div className="mb-6 grid grid-cols-3 gap-3">
          {summary.map((s) => (
            <div key={s.label} className="rounded border border-[#0e8a8f]/30 p-3 text-center">
              <p className="text-[10px]">{s.label}</p>
              <p className="text-sm font-extrabold">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-6">
        {sections.map((sec) => (
          <section key={sec.title} className="print-section">
            <p className="mb-2 text-sm font-extrabold text-[#0e8a8f]">{sec.title}</p>
            {sec.rows.length === 0 ? (
              <p className="text-xs">لا توجد بيانات.</p>
            ) : (
              <PrintTable head={sec.head} rows={sec.rows} />
            )}
            {sec.note && <p className="mt-2 text-[10px]">{sec.note}</p>}
          </section>
        ))}
      </div>
    </PrintDoc>
  );
}
