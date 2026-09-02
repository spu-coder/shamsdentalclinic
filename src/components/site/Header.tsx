import { Link, useNavigate } from "@tanstack/react-router";
import { Menu, Phone } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/site/Logo";
import { CLINIC } from "@/lib/clinic";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const links = [
  { to: "/", label: "الرئيسية" },
  { to: "/services", label: "الخدمات" },
  { to: "/team", label: "الفريق الطبي" },
  { to: "/contact", label: "تواصل" },
] as const;

export function Header() {
  const { user, isStaff, loading } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  const nav = (mobile = false) => (
    <>
      {links.map((l) => (
        <Link
          key={l.to}
          to={l.to}
          onClick={() => setOpen(false)}
          className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          activeProps={{ className: "text-primary bg-accent" }}
          activeOptions={{ exact: l.to === "/" }}
        >
          {l.label}
        </Link>
      ))}
      {!loading && user && (
        <Link
          to={isStaff ? "/admin" : "/dashboard"}
          onClick={() => setOpen(false)}
          className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          {isStaff ? "لوحة العيادة" : "حسابي"}
        </Link>
      )}
      <Link
        to="/m"
        onClick={() => setOpen(false)}
        className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground md:hidden"
      >
        خدمة سريعة من الهاتف
      </Link>
      {mobile && (

        <div className="mt-4 flex flex-col gap-2">
          {user ? (
            <Button variant="outline" onClick={signOut}>
              تسجيل الخروج
            </Button>
          ) : (
            <Button asChild>
              <Link to="/auth" onClick={() => setOpen(false)}>
                تسجيل الدخول
              </Link>
            </Button>
          )}
        </div>
      )}
    </>
  );

  return (
    <header className="no-print sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Link to="/" className="flex items-center gap-3">
          <Logo />
          <span className="hidden leading-tight sm:block">
            <span className="block text-sm font-bold">شمس السنية التخصصية</span>
            <span className="block text-xs text-muted-foreground">{CLINIC.doctorShort}</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">{nav()}</nav>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <a href={`tel:${CLINIC.phoneIntl}`}>
              <Phone className="size-4" />
              {CLINIC.phone}
            </a>
          </Button>
          <Button asChild size="sm" className="hidden md:inline-flex">
            <Link to="/book">احجز موعد</Link>
          </Button>
          {!loading &&
            (user ? (
              <Button
                variant="outline"
                size="sm"
                className="hidden md:inline-flex"
                onClick={signOut}
              >
                خروج
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm" className="hidden md:inline-flex">
                <Link to="/auth">دخول</Link>
              </Button>
            ))}

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden" aria-label="القائمة">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-6">
              <div className="mb-6 flex items-center gap-3">
                <Logo />
                <span className="text-sm font-bold">شمس السنية التخصصية</span>
              </div>
              <nav className="flex flex-col gap-1">{nav(true)}</nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
