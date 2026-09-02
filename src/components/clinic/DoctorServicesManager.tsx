import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/clinic";

type DoctorOption = { id: string; name: string; title: string | null };

/**
 * تسعير الخدمات لكل طبيب: الطبيب يرى تسعيره فقط، والمدير يرى الجميع.
 */
export function DoctorServicesManager({
  doctors,
  lockedDoctorId,
}: {
  doctors: DoctorOption[];
  lockedDoctorId?: string;
}) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string>(lockedDoctorId ?? "");
  const doctorId = lockedDoctorId ?? (selected || doctors[0]?.id || "");

  const services = useQuery({
    queryKey: ["ds-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id,name,category,price,duration_min")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const rows = useQuery({
    queryKey: ["doctor-services", doctorId],
    enabled: Boolean(doctorId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctor_services")
        .select("*")
        .eq("doctor_id", doctorId);
      if (error) throw error;
      return data;
    },
  });

  const byService = useMemo(() => {
    const map = new Map<string, NonNullable<typeof rows.data>[number]>();
    (rows.data ?? []).forEach((r) => map.set(r.service_id, r));
    return map;
  }, [rows.data]);

  const upsert = async (
    serviceId: string,
    patch: { price?: number | null; duration_min?: number; is_active?: boolean },
  ) => {
    if (!doctorId) return;
    const existing = byService.get(serviceId);
    const base = services.data?.find((s) => s.id === serviceId);
    const payload = {
      doctor_id: doctorId,
      service_id: serviceId,
      price: patch.price ?? existing?.price ?? base?.price ?? null,
      duration_min: patch.duration_min ?? existing?.duration_min ?? base?.duration_min ?? 30,
      is_active: patch.is_active ?? existing?.is_active ?? true,
    };
    const { error } = await supabase
      .from("doctor_services")
      .upsert(payload, { onConflict: "doctor_id,service_id" });
    if (error) {
      toast.error("تعذّر حفظ التسعير");
      return;
    }
    void qc.invalidateQueries({ queryKey: ["doctor-services", doctorId] });
    void qc.invalidateQueries({ queryKey: ["doctor-service-options"] });
    void qc.invalidateQueries({ queryKey: ["service-price-range"] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {lockedDoctorId ? "خدماتي وأجوري (تعديل خاص بي فقط)" : "تسعير الخدمات لكل طبيب"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!lockedDoctorId && (
          <div className="space-y-1.5">
            <Label>الطبيب</Label>
            <select
              className="h-9 w-full max-w-sm rounded-md border border-input bg-background px-3 text-sm"
              value={doctorId}
              onChange={(e) => setSelected(e.target.value)}
            >
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title} {d.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-2">
          {(services.data ?? []).map((s) => {
            const row = byService.get(s.id);
            return (
              <ServiceRow
                key={s.id}
                name={s.name}
                category={s.category}
                basePrice={s.price == null ? null : Number(s.price)}
                price={row?.price == null ? null : Number(row.price)}
                duration={row?.duration_min ?? s.duration_min}
                active={row?.is_active ?? false}
                onSave={(price, duration) => void upsert(s.id, { price, duration_min: duration })}
                onToggle={(v) => void upsert(s.id, { is_active: v })}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function ServiceRow({
  name,
  category,
  basePrice,
  price,
  duration,
  active,
  onSave,
  onToggle,
}: {
  name: string;
  category: string | null;
  basePrice: number | null;
  price: number | null;
  duration: number;
  active: boolean;
  onSave: (price: number | null, duration: number) => void;
  onToggle: (value: boolean) => void;
}) {
  const [p, setP] = useState(price == null ? "" : String(price));
  const [d, setD] = useState(String(duration));

  return (
    <div className="grid items-end gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_auto_auto_auto_auto]">
      <div>
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">
          {category ?? "—"} — السعر الأساسي: {formatMoney(basePrice)}
        </p>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">سعر الطبيب</Label>
        <Input
          className="h-9 w-28"
          inputMode="numeric"
          value={p}
          onChange={(e) => setP(e.target.value.replace(/\D/g, ""))}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">المدة (د)</Label>
        <Input
          className="h-9 w-20"
          inputMode="numeric"
          value={d}
          onChange={(e) => setD(e.target.value.replace(/\D/g, ""))}
        />
      </div>
      <Button size="sm" variant="outline" onClick={() => onSave(p === "" ? null : Number(p), Number(d) || 30)}>
        حفظ
      </Button>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">مفعّل</span>
        <Switch checked={active} onCheckedChange={onToggle} />
      </div>
    </div>
  );
}
