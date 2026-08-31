import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  MEDIA_KINDS,
  deletePatientMedia,
  kindLabel,
  signMediaUrls,
  uploadPatientMedia,
  type MediaRow,
} from "@/lib/media";

export function MediaGallery({
  patientId,
  canEdit,
  uploaderId,
  visits,
}: {
  patientId: string;
  canEdit: boolean;
  uploaderId?: string;
  visits?: { id: string; visit_date: string }[];
}) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<string>("xray");
  const [caption, setCaption] = useState("");
  const [visitId, setVisitId] = useState<string>("none");
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);

  const media = useQuery({
    queryKey: ["visit-media", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visit_media")
        .select("*")
        .eq("patient_id", patientId)
        .order("taken_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as MediaRow[];
      const urls = await signMediaUrls(rows.map((r) => r.storage_path));
      return rows.map((r) => ({ ...r, url: urls[r.storage_path] ?? "" }));
    },
  });

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name}: يُسمح بالصور فقط`);
          continue;
        }
        if (file.size > 20 * 1024 * 1024) {
          toast.error(`${file.name}: الحجم أكبر من 20 ميغابايت`);
          continue;
        }
        await uploadPatientMedia({
          file,
          patientId,
          kind,
          caption,
          visitId: visitId === "none" ? null : visitId,
          uploadedBy: uploaderId ?? null,
        });
      }
      setCaption("");
      toast.success("تم رفع الصور");
      await qc.invalidateQueries({ queryKey: ["visit-media", patientId] });
    } catch {
      toast.error("تعذّر رفع الصورة");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: MediaRow) => {
    try {
      await deletePatientMedia(row);
      toast.success("تم حذف الصورة");
      await qc.invalidateQueries({ queryKey: ["visit-media", patientId] });
    } catch {
      toast.error("تعذّر الحذف");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">الصور الشعاعية والسنية</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {canEdit && (
          <div className="grid gap-3 rounded-xl border border-dashed p-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>نوع الصورة</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEDIA_KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>ربط بزيارة (اختياري)</Label>
              <Select value={visitId} onValueChange={setVisitId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون ربط</SelectItem>
                  {(visits ?? []).map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {new Date(v.visit_date).toLocaleDateString("ar-SY")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>وصف مختصر</Label>
              <Input
                value={caption}
                maxLength={300}
                placeholder="مثال: صورة ذروية للسن 36 قبل المعالجة اللبية"
                onChange={(e) => setCaption(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <input
                id={`media-${patientId}`}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => void onFiles(e.target.files)}
              />
              <Button asChild disabled={busy} variant="secondary">
                <label htmlFor={`media-${patientId}`} className="cursor-pointer">
                  <ImagePlus className="size-4" />
                  {busy ? "جارٍ الرفع…" : "اختر صوراً للرفع"}
                </label>
              </Button>
            </div>
          </div>
        )}

        {media.isLoading && <p className="text-sm text-muted-foreground">جارٍ التحميل…</p>}
        {media.data?.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">لا توجد صور محفوظة.</p>
        )}

        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {(media.data ?? []).map((m) => (
            <figure key={m.id} className="overflow-hidden rounded-xl border bg-card">
              <button
                type="button"
                onClick={() => setZoom(m.url)}
                className="block w-full"
                aria-label="تكبير الصورة"
              >
                <img
                  src={m.url}
                  alt={m.caption ?? kindLabel(m.kind)}
                  loading="lazy"
                  className="aspect-square w-full object-cover transition-transform duration-300 hover:scale-105"
                />
              </button>
              <figcaption className="space-y-1 p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="secondary">{kindLabel(m.kind)}</Badge>
                  <span className="text-muted-foreground">
                    {new Date(m.taken_at).toLocaleDateString("ar-SY")}
                  </span>
                </div>
                {m.caption && <p className="text-muted-foreground">{m.caption}</p>}
                {canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => void remove(m)}
                  >
                    <Trash2 className="size-4" /> حذف
                  </Button>
                )}
              </figcaption>
            </figure>
          ))}
        </div>

        <Dialog open={!!zoom} onOpenChange={(o) => !o && setZoom(null)}>
          <DialogContent className="max-w-3xl">
            <DialogTitle className="sr-only">عرض الصورة</DialogTitle>
            {zoom && <img src={zoom} alt="صورة المريض" className="w-full rounded-lg" />}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
