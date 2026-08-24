import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Logo } from "@/components/site/Logo";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — عيادة شمس السنية التخصصية" },
      {
        name: "description",
        content: "سجّل الدخول لحجز موعد ومتابعة ملفك الطبي في عيادة شمس السنية التخصصية.",
      },
      { property: "og:title", content: "تسجيل الدخول — عيادة شمس السنية" },
      { property: "og:description", content: "دخول المرضى وفريق العيادة إلى حساباتهم." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const google = async () => {
    setBusy(true);
    const res = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (res?.error) {
      toast.error("تعذّر الدخول عبر Google");
      setBusy(false);
      return;
    }
    if (!res?.redirected) navigate({ to: "/dashboard", replace: true });
  };

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error("بيانات الدخول غير صحيحة");
    toast.success("مرحباً بك");
    navigate({ to: "/dashboard", replace: true });
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("كلمة المرور 6 أحرف على الأقل");
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName, phone },
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("تم إنشاء الحساب، تحقق من بريدك لتأكيد التسجيل");
  };

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-14">
      <Logo className="size-14" />
      <Card className="mt-6 w-full">
        <CardHeader className="text-center">
          <CardTitle>حسابك في العيادة</CardTitle>
          <CardDescription>سجّل الدخول لحجز المواعيد ومتابعة ملفك الطبي</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={google} disabled={busy} variant="outline" className="w-full">
            الدخول عبر Google
          </Button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> أو بالبريد الإلكتروني
            <span className="h-px flex-1 bg-border" />
          </div>

          <Tabs defaultValue="in">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="in">دخول</TabsTrigger>
              <TabsTrigger value="up">حساب جديد</TabsTrigger>
            </TabsList>

            <TabsContent value="in">
              <form onSubmit={signIn} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email">البريد الإلكتروني</Label>
                  <Input
                    id="email"
                    type="email"
                    dir="ltr"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">كلمة المرور</Label>
                  <Input
                    id="password"
                    type="password"
                    dir="ltr"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  دخول
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="up">
              <form onSubmit={signUp} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="name">الاسم الكامل</Label>
                  <Input
                    id="name"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    maxLength={100}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone2">رقم الهاتف</Label>
                  <Input
                    id="phone2"
                    dir="ltr"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    maxLength={20}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email2">البريد الإلكتروني</Label>
                  <Input
                    id="email2"
                    type="email"
                    dir="ltr"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password2">كلمة المرور</Label>
                  <Input
                    id="password2"
                    type="password"
                    dir="ltr"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  إنشاء الحساب
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <p className="mt-5 text-center text-xs text-muted-foreground">
            بالمتابعة أنت توافق على مشاركة بياناتك الطبية مع فريق العيادة.{" "}
            <Link to="/contact" className="text-primary underline">
              تواصل معنا
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
