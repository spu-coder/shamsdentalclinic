import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Reveal } from "@/components/site/Reveal";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/clinic";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: "خدمات العيادة — شمس السنية التخصصية" },
      {
        name: "description",
        content:
          "جراحة الفم، تقويم الأسنان، معالجات لبية ولثوية، حشوات تجميلية، تبييض، تركيبات ثابتة وأسنان أطفال.",
      },
      { property: "og:title", content: "خدمات عيادة شمس السنية التخصصية" },
      { property: "og:description", content: "كل خدمات الأسنان التخصصية في مكان واحد." },
    ],
  }),
  component: ServicesPage,
});

function ServicesPage() {
  const ranges = useQuery({
    queryKey: ["service-price-range"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctor_services")
        .select("service_id,price")
        .eq("is_active", true);
      if (error) throw error;
      const map: Record<string, { min: number; max: number }> = {};
      (data ?? []).forEach((r) => {
        if (r.price == null) return;
        const v = Number(r.price);
        const cur = map[r.service_id];
        map[r.service_id] = cur
          ? { min: Math.min(cur.min, v), max: Math.max(cur.max, v) }
          : { min: v, max: v };
      });
      return map;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-extrabold">الخدمات</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        نغطي معالجات الأسنان التخصصية للأطفال والكبار بأحدث التقنيات وتعقيم كامل للأدوات. تختلف
        الأجور حسب الطبيب المعالج ودرجة اختصاصه.
      </p>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading &&
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        {(data ?? []).map((s, i) => (
          <Reveal key={s.id} delay={i * 60}>
            <Card className="flex h-full flex-col border-border/70 shadow-soft">
              <CardContent className="flex flex-1 flex-col pt-6">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-bold">{s.name}</h2>
                  {s.category && <Badge variant="secondary">{s.category}</Badge>}
                </div>
                <p className="mt-2 flex-1 text-sm text-muted-foreground">{s.description}</p>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="size-4" />
                    {s.duration_min} دقيقة
                  </span>
                  {(() => {
                    const r = ranges.data?.[s.id];
                    if (r) {
                      return (
                        <span className="font-semibold text-primary">
                          {r.min === r.max
                            ? formatMoney(r.min)
                            : `${formatMoney(r.min)} — ${formatMoney(r.max)}`}
                        </span>
                      );
                    }
                    return s.price != null ? (
                      <span className="font-semibold text-primary">{formatMoney(Number(s.price))}</span>
                    ) : null;
                  })()}
                </div>
                <Button asChild className="mt-4" size="sm">
                  <Link to="/book" search={{ service: s.id }}>
                    احجز هذه الخدمة
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
