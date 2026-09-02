import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  CalendarCheck,
  ClipboardList,
  Home,
  Images,
  MapPin,
  MoreHorizontal,
  Phone,
  Receipt,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { HealthForm } from "@/components/clinic/HealthForm";
import { useAuth } from "@/hooks/useAuth";
import { CLINIC } from "@/lib/clinic";

type Panel = "health" | "more" | null;

/** شريط سفلي للهاتف + نوافذ سريعة داخل الموقع (بدل صفحة منفصلة). */
export function MobileQuickBar() {
  const { user, loading } = useAuth();
  const [panel, setPanel] = useState<Panel>(null);

  return (
    <>
      <nav
        className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 backdrop-blur-md md:hidden"
        aria-label="شريط الخدمة السريعة"
      >
        <div className="mx-auto grid max-w-md grid-cols-4">
          <Link
            to="/"
            className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground transition-colors active:scale-95"
            activeProps={{ className: "text-primary" }}
            activeOptions={{ exact: true }}
          >
            <Home className="size-5" />
            الرئيسية
          </Link>

          <Link
            to="/book"
            className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground transition-colors active:scale-95"
            activeProps={{ className: "text-primary" }}
          >
            <CalendarCheck className="size-5" />
            احجز موعد
          </Link>

          <button
            type="button"
            onClick={() => setPanel("health")}
            className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground transition-transform active:scale-95"
          >
            <ClipboardList className="size-5" />
            ملفي الصحي
          </button>

          <button
            type="button"
            onClick={() => setPanel("more")}
            className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground transition-transform active:scale-95"
          >
            <MoreHorizontal className="size-5" />
            المزيد
          </button>
        </div>
      </nav>

      {/* مساحة لكي لا يغطي الشريط آخر المحتوى */}
      <div className="h-16 md:hidden" aria-hidden />

      <Sheet open={panel === "health"} onOpenChange={(o) => setPanel(o ? "health" : null)}>
        <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto">
          <SheetHeader className="text-start">
            <SheetTitle>ملفي الصحي</SheetTitle>
            <SheetDescription>
              معلومات الصحة العامة تساعد الطبيب على اختيار المعالجة الآمنة لك.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            {loading ? (
              <p className="text-sm text-muted-foreground">جارٍ التحميل…</p>
            ) : user ? (
              <HealthForm patientId={user.id} />
            ) : (
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>سجّل الدخول لتعبئة ملفك الصحي وحفظه في العيادة.</p>
                <Button asChild className="w-full" onClick={() => setPanel(null)}>
                  <Link to="/auth">تسجيل الدخول</Link>
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={panel === "more"} onOpenChange={(o) => setPanel(o ? "more" : null)}>
        <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto">
          <SheetHeader className="text-start">
            <SheetTitle>خدمة سريعة</SheetTitle>
            <SheetDescription>كل ما تحتاجه من هاتفك بلمسة واحدة.</SheetDescription>
          </SheetHeader>

          <div className="mt-4 grid gap-2">
            {[
              {
                icon: Images,
                title: "صوري الشعاعية والسنية",
                text: "الصور المحفوظة في ملفك خلال المعالجة.",
              },
              {
                icon: Receipt,
                title: "فواتيري ودفعاتي",
                text: "كشف العيادة والمبالغ المسددة والمتبقية.",
              },
            ].map((it) => (
              <Link key={it.title} to={user ? "/dashboard" : "/auth"} onClick={() => setPanel(null)}>
                <Card className="border-border/70 active:scale-[.99] transition">
                  <CardContent className="flex items-center gap-3 py-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground">
                      <it.icon className="size-5" />
                    </div>
                    <div className="text-start">
                      <p className="text-sm font-bold">{it.title}</p>
                      <p className="text-xs text-muted-foreground">{it.text}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}

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
            <p className="pt-1 text-center text-xs text-muted-foreground">{CLINIC.address}</p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
