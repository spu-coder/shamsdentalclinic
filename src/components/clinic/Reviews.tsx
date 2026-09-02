import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} من 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={i <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}
          style={{ width: size, height: size }}
        />
      ))}
    </span>
  );
}

export function useDoctorRatings() {
  return useQuery({
    queryKey: ["doctor-ratings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctor_reviews")
        .select("doctor_id,rating")
        .eq("is_visible", true);
      if (error) throw error;
      const map: Record<string, { avg: number; count: number }> = {};
      const groups: Record<string, number[]> = {};
      (data ?? []).forEach((r) => {
        groups[r.doctor_id] = [...(groups[r.doctor_id] ?? []), r.rating];
      });
      Object.entries(groups).forEach(([id, list]) => {
        map[id] = { avg: list.reduce((a, b) => a + b, 0) / list.length, count: list.length };
      });
      return map;
    },
  });
}

/** تقييم المريض لموعد مكتمل. */
export function ReviewForm({
  patientId,
  doctorId,
  appointmentId,
  doctorName,
}: {
  patientId: string;
  doctorId: string;
  appointmentId: string;
  doctorName: string;
}) {
  const qc = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  const existing = useQuery({
    queryKey: ["my-review", appointmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctor_reviews")
        .select("*")
        .eq("appointment_id", appointmentId)
        .eq("patient_id", patientId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!existing.data) return;
    setRating(existing.data.rating);
    setComment(existing.data.comment ?? "");
  }, [existing.data]);

  const save = useMutation({
    mutationFn: async () => {
      if (rating < 1) throw new Error("اختر عدد النجوم");
      const payload = {
        doctor_id: doctorId,
        patient_id: patientId,
        appointment_id: appointmentId,
        rating,
        comment: comment.trim().slice(0, 500) || null,
      };
      if (existing.data) {
        const { error } = await supabase
          .from("doctor_reviews")
          .update({ rating: payload.rating, comment: payload.comment })
          .eq("id", existing.data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("doctor_reviews").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("شكراً لتقييمك");
      void qc.invalidateQueries({ queryKey: ["my-review", appointmentId] });
      void qc.invalidateQueries({ queryKey: ["doctor-ratings"] });
      void qc.invalidateQueries({ queryKey: ["admin-reviews"] });
    },
    onError: (e: Error) => toast.error(e.message || "تعذّر إرسال التقييم"),
  });

  return (
    <div className="rounded-lg border p-3">
      <p className="text-sm font-medium">
        {existing.data ? "تقييمك" : "قيّم تجربتك"} مع {doctorName}
      </p>
      <div className="mt-2 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            aria-label={`${i} نجوم`}
            onClick={() => setRating(i)}
            className="p-0.5"
          >
            <Star
              className={`size-6 ${i <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
            />
          </button>
        ))}
      </div>
      <Textarea
        className="mt-2"
        rows={2}
        maxLength={500}
        placeholder="ملاحظتك (اختياري)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <Button size="sm" className="mt-2" disabled={save.isPending} onClick={() => save.mutate()}>
        {existing.data ? "تحديث التقييم" : "إرسال التقييم"}
      </Button>
    </div>
  );
}

/** إدارة التقييمات للمدير: إظهار/إخفاء أو حذف. */
export function ReviewsModeration() {
  const qc = useQueryClient();
  const reviews = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctor_reviews")
        .select("*, doctors(name,title), profiles:patient_id(full_name)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as unknown as {
        id: string;
        rating: number;
        comment: string | null;
        is_visible: boolean;
        created_at: string;
        doctors: { name: string; title: string | null } | null;
        profiles: { full_name: string | null } | null;
      }[];
    },
  });

  const setVisible = async (id: string, is_visible: boolean) => {
    const { error } = await supabase.from("doctor_reviews").update({ is_visible }).eq("id", id);
    if (error) {
      toast.error("تعذّر التحديث");
      return;
    }
    void qc.invalidateQueries({ queryKey: ["admin-reviews"] });
    void qc.invalidateQueries({ queryKey: ["doctor-ratings"] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">تقييمات المرضى</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {(reviews.data ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">لا توجد تقييمات بعد.</p>
        )}
        {(reviews.data ?? []).map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
            <div>
              <p className="font-medium">
                {r.doctors?.title} {r.doctors?.name} — <Stars value={r.rating} />
              </p>
              <p className="text-xs text-muted-foreground">
                {r.profiles?.full_name ?? "مريض"} — {new Date(r.created_at).toLocaleDateString("ar-SY")}
              </p>
              {r.comment && <p className="mt-1 text-xs">{r.comment}</p>}
            </div>
            <Button size="sm" variant={r.is_visible ? "outline" : "default"} onClick={() => void setVisible(r.id, !r.is_visible)}>
              {r.is_visible ? "إخفاء" : "إظهار"}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
