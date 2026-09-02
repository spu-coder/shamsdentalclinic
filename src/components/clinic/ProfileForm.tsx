import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

type Form = {
  full_name: string;
  phone: string;
  birth_date: string;
  gender: string;
  address: string;
};

const EMPTY: Form = { full_name: "", phone: "", birth_date: "", gender: "", address: "" };

export function ProfileForm({
  userId,
  title = "المعلومات الشخصية",
}: {
  userId: string;
  title?: string;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Form>(EMPTY);

  const profile = useQuery({
    queryKey: ["profile-edit", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!profile.data) return;
    setForm({
      full_name: profile.data.full_name ?? "",
      phone: profile.data.phone ?? "",
      birth_date: profile.data.birth_date ?? "",
      gender: profile.data.gender ?? "",
      address: profile.data.address ?? "",
    });
  }, [profile.data]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        id: userId,
        full_name: form.full_name.trim() || null,
        phone: form.phone.trim() || null,
        birth_date: form.birth_date || null,
        gender: form.gender || null,
        address: form.address.trim() || null,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حفظ المعلومات الشخصية");
      void qc.invalidateQueries({ queryKey: ["profile-edit", userId] });
      void qc.invalidateQueries({ queryKey: ["my-profile"] });
      void qc.invalidateQueries({ queryKey: ["admin-patients"] });
    },
    onError: (e: Error) => toast.error(e.message || "تعذّر الحفظ"),
  });

  const field = (k: keyof Form) => ({
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value })),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pf-name">الاسم الكامل</Label>
            <Input id="pf-name" {...field("full_name")} placeholder="الاسم الثلاثي" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-phone">رقم الهاتف</Label>
            <Input id="pf-phone" inputMode="tel" {...field("phone")} placeholder="09XXXXXXXX" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-birth">تاريخ الميلاد</Label>
            <Input id="pf-birth" type="date" {...field("birth_date")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-gender">الجنس</Label>
            <select
              id="pf-gender"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.gender}
              onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
            >
              <option value="">غير محدد</option>
              <option value="male">ذكر</option>
              <option value="female">أنثى</option>
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-address">العنوان</Label>
          <Textarea id="pf-address" rows={2} {...field("address")} />
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "جارٍ الحفظ…" : "حفظ التعديلات"}
        </Button>
      </CardContent>
    </Card>
  );
}
