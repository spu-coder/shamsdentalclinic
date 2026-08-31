import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

type HealthState = {
  blood_type: string;
  chronic_diseases: string;
  medications: string;
  allergies: string;
  notes: string;
  diabetes: boolean;
  hypertension: boolean;
  heart_disease: boolean;
  bleeding_disorder: boolean;
  pregnant: boolean;
  smoker: boolean;
};

const emptyHealth: HealthState = {
  blood_type: "",
  chronic_diseases: "",
  medications: "",
  allergies: "",
  notes: "",
  diabetes: false,
  hypertension: false,
  heart_disease: false,
  bleeding_disorder: false,
  pregnant: false,
  smoker: false,
};

const flags: { key: keyof HealthState; label: string }[] = [
  { key: "diabetes", label: "سكري" },
  { key: "hypertension", label: "ضغط مرتفع" },
  { key: "heart_disease", label: "أمراض قلبية" },
  { key: "bleeding_disorder", label: "سيولة دم / نزف" },
  { key: "pregnant", label: "حمل" },
  { key: "smoker", label: "تدخين" },
];

export function HealthForm({ patientId }: { patientId?: string }) {
  const [form, setForm] = useState<HealthState>(emptyHealth);
  const [busy, setBusy] = useState(false);

  const health = useQuery({
    queryKey: ["health", patientId],
    enabled: !!patientId,
    queryFn: async () => {
      const { data } = await supabase
        .from("health_profiles")
        .select("*")
        .eq("patient_id", patientId!)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (health.data) {
      setForm({
        blood_type: health.data.blood_type ?? "",
        chronic_diseases: health.data.chronic_diseases ?? "",
        medications: health.data.medications ?? "",
        allergies: health.data.allergies ?? "",
        notes: health.data.notes ?? "",
        diabetes: health.data.diabetes,
        hypertension: health.data.hypertension,
        heart_disease: health.data.heart_disease,
        bleeding_disorder: health.data.bleeding_disorder,
        pregnant: health.data.pregnant,
        smoker: health.data.smoker,
      });
    }
  }, [health.data]);

  const save = async () => {
    if (!patientId) return;
    setBusy(true);
    const { error } = await supabase.from("health_profiles").upsert({
      patient_id: patientId,
      ...form,
      blood_type: form.blood_type.slice(0, 10) || null,
      chronic_diseases: form.chronic_diseases.slice(0, 1000) || null,
      medications: form.medications.slice(0, 1000) || null,
      allergies: form.allergies.slice(0, 1000) || null,
      notes: form.notes.slice(0, 1000) || null,
      updated_at: new Date().toISOString(),
    });
    setBusy(false);
    if (error) {
      toast.error("تعذّر الحفظ");
      return;
    }
    toast.success("تم حفظ الملف الصحي");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">استبيان الصحة العامة</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>زمرة الدم</Label>
            <Input
              dir="ltr"
              value={form.blood_type}
              onChange={(e) => setForm({ ...form, blood_type: e.target.value })}
              maxLength={10}
            />
          </div>
          <div className="space-y-1.5">
            <Label>الحساسية (أدوية/بنسلين…)</Label>
            <Input
              value={form.allergies}
              onChange={(e) => setForm({ ...form, allergies: e.target.value })}
              maxLength={200}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {flags.map((f) => (
            <label
              key={String(f.key)}
              className="flex items-center justify-between rounded-lg border p-3 text-sm"
            >
              {f.label}
              <Switch
                checked={Boolean(form[f.key])}
                onCheckedChange={(v) => setForm({ ...form, [f.key]: v })}
              />
            </label>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label>أمراض مزمنة</Label>
          <Textarea
            value={form.chronic_diseases}
            onChange={(e) => setForm({ ...form, chronic_diseases: e.target.value })}
            maxLength={1000}
          />
        </div>
        <div className="space-y-1.5">
          <Label>أدوية تتناولها حالياً</Label>
          <Textarea
            value={form.medications}
            onChange={(e) => setForm({ ...form, medications: e.target.value })}
            maxLength={1000}
          />
        </div>
        <div className="space-y-1.5">
          <Label>ملاحظات إضافية</Label>
          <Textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            maxLength={1000}
          />
        </div>

        <Button onClick={() => void save()} disabled={busy}>
          حفظ الملف الصحي
        </Button>
      </CardContent>
    </Card>
  );
}
