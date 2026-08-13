import { Link } from "@tanstack/react-router";
import { MapPin, Phone, Clock } from "lucide-react";

import { Logo } from "@/components/site/Logo";
import { CLINIC } from "@/lib/clinic";

export function Footer() {
  return (
    <footer className="no-print mt-20 border-t border-border bg-gradient-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <div className="flex items-center gap-3">
            <Logo className="h-12 w-12" />
            <div>
              <p className="font-bold">{CLINIC.name}</p>
              <p className="text-sm text-muted-foreground">{CLINIC.doctor}</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            {CLINIC.specialties.join(" – ")}
          </p>
        </div>

        <div className="space-y-3 text-sm">
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-4 text-primary" />
            {CLINIC.address}
          </p>
          <p className="flex items-center gap-2">
            <Phone className="size-4 text-primary" />
            <a href={`tel:${CLINIC.phoneIntl}`} className="hover:text-primary">
              {CLINIC.phone}
            </a>
            <span className="text-muted-foreground">/ {CLINIC.landline}</span>
          </p>
          {CLINIC.hours.map((h) => (
            <p key={h.days} className="flex items-center gap-2 text-muted-foreground">
              <Clock className="size-4 text-primary" />
              {h.days}: {h.time}
            </p>
          ))}
        </div>

        <nav className="flex flex-col gap-2 text-sm">
          <Link to="/services" className="text-muted-foreground hover:text-primary">
            الخدمات
          </Link>
          <Link to="/team" className="text-muted-foreground hover:text-primary">
            الفريق الطبي
          </Link>
          <Link to="/book" className="text-muted-foreground hover:text-primary">
            حجز موعد
          </Link>
          <Link to="/contact" className="text-muted-foreground hover:text-primary">
            تواصل معنا
          </Link>
        </nav>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {CLINIC.name} — جميع الحقوق محفوظة
      </div>
    </footer>
  );
}
