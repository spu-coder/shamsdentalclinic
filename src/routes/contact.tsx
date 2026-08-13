import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, MapPin, Phone, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Reveal } from "@/components/site/Reveal";
import { CLINIC } from "@/lib/clinic";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "تواصل معنا — عيادة شمس السنية التخصصية" },
      {
        name: "description",
        content: "عين منين – طريق حلبون – جانب صيدلية طحلة. هاتف 0959405017 وأوقات العمل.",
      },
      { property: "og:title", content: "تواصل مع عيادة شمس السنية" },
      { property: "og:description", content: "الموقع، الهاتف، وأوقات الدوام." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("عين منين طريق حلبون")}`;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-extrabold">تواصل معنا</h1>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <Reveal>
          <Card className="h-full shadow-soft">
            <CardContent className="space-y-4 pt-6 text-sm">
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-5 text-primary" />
                {CLINIC.address}
              </p>
              <p className="flex items-center gap-2">
                <Phone className="size-5 text-primary" />
                <a href={`tel:${CLINIC.phoneIntl}`} className="hover:text-primary">
                  {CLINIC.phone}
                </a>
              </p>
              <p className="flex items-center gap-2">
                <Phone className="size-5 text-primary" />
                {CLINIC.landline}
              </p>
              {CLINIC.hours.map((h) => (
                <p key={h.days} className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="size-5 text-primary" />
                  {h.days}: {h.time}
                </p>
              ))}
            </CardContent>
          </Card>
        </Reveal>

        <Reveal delay={90}>
          <Card className="h-full shadow-soft">
            <CardContent className="flex h-full flex-col justify-center gap-3 pt-6">
              <Button asChild size="lg">
                <Link to="/book">احجز موعداً إلكترونياً</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href={`tel:${CLINIC.phoneIntl}`}>
                  <Phone className="size-5" />
                  اتصال مباشر
                </a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a
                  href={`https://wa.me/${CLINIC.phoneIntl.replace("+", "")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="size-5" />
                  واتساب
                </a>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <a href={mapsUrl} target="_blank" rel="noreferrer">
                  <MapPin className="size-5" />
                  الموقع على الخريطة
                </a>
              </Button>
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
