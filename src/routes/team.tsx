import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Stethoscope } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Reveal } from "@/components/site/Reveal";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "الفريق الطبي — شمس السنية التخصصية" },
      {
        name: "description",
        content: "تعرّف على د. ياسر زكريا شمس الدين والأطباء المختصين في مركز شمس السنية.",
      },
      { property: "og:title", content: "الفريق الطبي في عيادة شمس السنية" },
      { property: "og:description", content: "أطباء مختصون في الجراحة والتقويم والتجميل." },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["doctors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctors")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-extrabold">الفريق الطبي</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        كادر طبي مختص يعمل ضمن مركز واحد لتغطية كل احتياجات الفم والأسنان.
      </p>

      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {isLoading && Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-44" />)}
        {(data ?? []).map((d, i) => (
          <Reveal key={d.id} delay={i * 80}>
            <Card className="h-full border-border/70 shadow-soft">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground">
                    <Stethoscope className="size-6" />
                  </div>
                  <div>
                    <h2 className="font-bold">
                      {d.title} {d.name}
                    </h2>
                    <p className="text-sm text-primary">{d.specialty}</p>
                  </div>
                </div>
                {d.bio && <p className="mt-4 text-sm text-muted-foreground">{d.bio}</p>}
              </CardContent>
            </Card>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
