import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarCheck,
  MapPin,
  Phone,
  ShieldCheck,
  Smile,
  Sparkles,
  Stethoscope,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Reveal } from "@/components/site/Reveal";
import { Logo } from "@/components/site/Logo";
import { CLINIC } from "@/lib/clinic";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "عيادة شمس السنية التخصصية — د. ياسر زكريا شمس الدين" },
      {
        name: "description",
        content:
          "عيادة أسنان تخصصية في عين منين – طريق حلبون: جراحة، تقويم، معالجات لبية ولثوية، تجميل. احجز موعدك إلكترونياً.",
      },
      { property: "og:title", content: "عيادة شمس السنية التخصصية" },
      {
        property: "og:description",
        content: "د. ياسر زكريا شمس الدين — حجز مواعيد إلكتروني وملف طبي لكل مريض.",
      },
    ],
  }),
  component: Home,
});

const features = [
  {
    icon: CalendarCheck,
    title: "حجز إلكتروني ذكي",
    text: "اختر الطبيب والخدمة والوقت المتاح، والطبيب يعتمد الموعد قبل تثبيته.",
  },
  {
    icon: Stethoscope,
    title: "ملف طبي متكامل",
    text: "استبيان الصحة العامة، مخطط الأسنان، خطة المعالجة وأرشيف الزيارات.",
  },
  {
    icon: ShieldCheck,
    title: "خصوصية عالية",
    text: "بياناتك الطبية مشفّرة ولا يراها إلا الكادر الطبي المخوّل.",
  },
  {
    icon: Sparkles,
    title: "تجميل وابتسامة",
    text: "تبييض، فينير، وتركيبات خزفية بلمسة طبيعية متناسقة.",
  },
];

function Home() {
  const { data: services } = useQuery({
    queryKey: ["home-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id,name,description,category")
        .eq("is_active", true)
        .order("sort_order")
        .limit(6);
      if (error) throw error;
      return data;
    },
  });

  return (
    <>
      <section className="relative overflow-hidden bg-gradient-deep px-4 py-16 sm:py-24">
        <div
          aria-hidden
          className="animate-soft-pulse pointer-events-none absolute -top-24 start-1/2 size-72 rounded-full bg-primary-glow/25 blur-3xl"
        />
        <div className="relative mx-auto max-w-6xl text-center">
          <div className="animate-rise mx-auto mb-6 flex w-fit items-center gap-3 rounded-full border border-primary-foreground/15 bg-primary-foreground/5 px-4 py-2">
            <Logo className="h-9 w-9" />
            <span className="text-sm font-medium text-primary-foreground">{CLINIC.name}</span>
          </div>
          <h1 className="animate-rise text-3xl font-extrabold text-primary-foreground sm:text-5xl">
            {CLINIC.doctor}
          </h1>
          <p className="animate-rise mx-auto mt-4 max-w-2xl text-base text-primary-foreground/80 sm:text-lg">
            {CLINIC.specialties.join(" • ")}
          </p>
          <div className="animate-rise mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="shadow-glow">
              <Link to="/book">
                <CalendarCheck className="size-5" />
                احجز موعدك الآن
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
            >
              <a href={`tel:${CLINIC.phoneIntl}`}>
                <Phone className="size-5" />
                {CLINIC.phone}
              </a>
            </Button>
          </div>
          <p className="mt-6 flex items-center justify-center gap-2 text-sm text-primary-foreground/70">
            <MapPin className="size-4" />
            {CLINIC.address}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <Reveal>
          <h2 className="text-center text-2xl font-bold sm:text-3xl">لماذا عيادتنا؟</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
            رعاية سنية تخصصية بأدوات حديثة، وإدارة رقمية كاملة لمواعيدك وملفك الطبي.
          </p>
        </Reveal>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={i * 90}>
              <Card className="h-full border-border/70 shadow-soft transition-transform duration-300 hover:-translate-y-1">
                <CardContent className="pt-6">
                  <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground">
                    <f.icon className="size-5" />
                  </div>
                  <h3 className="text-base font-bold">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="bg-gradient-surface px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <h2 className="text-center text-2xl font-bold sm:text-3xl">خدماتنا</h2>
          </Reveal>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {(services ?? []).map((s, i) => (
              <Reveal key={s.id} delay={i * 70}>
                <Card className="h-full border-border/70 shadow-soft">
                  <CardContent className="pt-6">
                    <div className="mb-3 flex items-center gap-2">
                      <Smile className="size-5 text-primary" />
                      <h3 className="font-bold">{s.name}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">{s.description}</p>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Button asChild variant="outline">
              <Link to="/services">كل الخدمات</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-16">
        <Reveal>
          <Card className="overflow-hidden border-0 bg-gradient-primary text-primary-foreground shadow-glow">
            <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
              <h2 className="text-2xl font-bold">ابتسامتك تبدأ بموعد واحد</h2>
              <p className="max-w-xl text-primary-foreground/85">
                سجّل بحساب Google خلال ثوانٍ، اختر الوقت المناسب، وسيصلك تأكيد الموعد من العيادة.
              </p>
              <Button asChild size="lg" variant="secondary">
                <Link to="/book">احجز الآن</Link>
              </Button>
            </CardContent>
          </Card>
        </Reveal>
      </section>
    </>
  );
}
