import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck, ClipboardList, MapPin, Phone, Images, Receipt } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/site/Logo";
import { CLINIC } from "@/lib/clinic";

export const Route = createFileRoute("/m")({
  head: () => ({
    meta: [
      { title: "الخدمة السريعة من الهاتف — عيادة شمس السنية" },
      {
        name: "description",
        content:
          "صفحة مخصّصة للهاتف: احجز موعدك، املأ ملفك الصحي، واتصل بالعيادة بلمسة واحدة.",
      },
      { property: "og:title", content: "احجز من هاتفك — عيادة شمس السنية" },
      {
        property: "og:description",
        content: "حجز سريع وملف صحي وتواصل مباشر مع عيادة شمس السنية التخصصية.",
      },
    ],
  }),
  component: MobileQuick,
});

const items = [
  {
    icon: CalendarCheck,
    title: "احجز موعد",
    text: "اختر الطبيب والخدمة والوقت المتاح.",
    to: "/book" as const,
  },
  {
    icon: ClipboardList,
    title: "ملفي الصحي",
    text: "استبيان الصحة العامة والأدوية والحساسية.",
    to: "/dashboard" as const,
  },
  {
    icon: Images,
    title: "صوري الشعاعية",
    text: "الصور السنية والشعاعية المحفوظة في ملفك.",
    to: "/dashboard" as const,
  },
  {
    icon: Receipt,
    title: "فواتيري ودفعاتي",
    text: "كشف العيادة والمبالغ المسددة والمتبقية.",
    to: "/dashboard" as const,
  },
];

function MobileQuick() {
  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <div className="flex flex-col items-center text-center">
        <Logo className="size-16" />
        <h1 className="mt-3 text-xl font-extrabold">عيادة شمس السنية التخصصية</h1>
        <p className="mt-1 text-sm text-muted-foreground">د. ياسر زكريا شمس الدين</p>
      </div>

      <div className="mt-6 grid gap-3">
        {items.map((it) => (
          <Link key={it.title} to={it.to}>
            <Card className="border-border/70 shadow-soft active:scale-[.99] transition">
              <CardContent className="flex items-center gap-3 py-4">
                <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground">
                  <it.icon className="size-5" />
                </div>
                <div className="text-start">
                  <p className="font-bold">{it.title}</p>
                  <p className="text-xs text-muted-foreground">{it.text}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-2">
        <Button asChild size="lg">
          <a href={`tel:${CLINIC.phone}`}>
            <Phone className="size-4" /> اتصال بالعيادة {CLINIC.phone}
          </a>
        </Button>
        <Button asChild variant="outline" size="lg">
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(CLINIC.address)}`}
            target="_blank"
            rel="noreferrer"
          >
            <MapPin className="size-4" /> موقع العيادة
          </a>
        </Button>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">{CLINIC.address}</p>
    </div>
  );
}
