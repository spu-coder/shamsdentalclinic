export const CLINIC = {
  name: "عيادة شمس السنية التخصصية",
  doctor: "الدكتور ياسر زكريا شمس الدين",
  doctorShort: "د. ياسر شمس الدين",
  phone: "0959405017",
  phoneIntl: "+963959405017",
  landline: "011 58 45 155",
  address: "عين منين – طريق حلبون – جانب صيدلية طحلة",
  specialties: ["جراحة", "تقويم", "معالجات لبية ولثوية", "تجميل"],
  hours: [
    { days: "السبت – الخميس", time: "10:00 صباحاً – 6:00 مساءً" },
    { days: "الجمعة", time: "مغلق" },
  ],
} as const;

export const WEEKDAYS_AR = [
  "الأحد",
  "الإثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
] as const;

export const STATUS_AR: Record<string, string> = {
  pending: "بانتظار الموافقة",
  approved: "مقبول",
  rejected: "مرفوض",
  completed: "مكتمل",
  cancelled: "ملغى",
  no_show: "لم يحضر",
};

export function formatDateTimeAr(iso: string) {
  return new Date(iso).toLocaleString("ar-SY", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatMoney(value: number | null | undefined) {
  return `${Number(value ?? 0).toLocaleString("ar-SY")} ل.س`;
}
