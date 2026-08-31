import { supabase } from "@/integrations/supabase/client";

export const BUCKET = "clinic-media";

export const MEDIA_KINDS = [
  { value: "xray", label: "صورة شعاعية" },
  { value: "clinical", label: "صورة سنية / أثناء المعالجة" },
  { value: "before", label: "قبل المعالجة" },
  { value: "after", label: "بعد المعالجة" },
  { value: "other", label: "أخرى" },
] as const;

export const kindLabel = (kind: string) =>
  MEDIA_KINDS.find((k) => k.value === kind)?.label ?? "صورة";

export type MediaRow = {
  id: string;
  patient_id: string;
  visit_id: string | null;
  doctor_id: string | null;
  storage_path: string;
  kind: string;
  caption: string | null;
  taken_at: string;
  created_at: string;
};

function safeExt(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "jpg";
  return /^[a-z0-9]{2,5}$/.test(ext) ? ext : "jpg";
}

export async function uploadPatientMedia(params: {
  file: File;
  patientId: string;
  kind: string;
  caption?: string;
  takenAt?: string;
  visitId?: string | null;
  doctorId?: string | null;
  uploadedBy?: string | null;
}) {
  const { file, patientId } = params;
  const path = `${patientId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt(file.name)}`;

  const up = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (up.error) throw up.error;

  const { error } = await supabase.from("visit_media").insert({
    patient_id: patientId,
    storage_path: path,
    kind: params.kind,
    caption: params.caption?.slice(0, 300) || null,
    taken_at: params.takenAt || new Date().toISOString().slice(0, 10),
    visit_id: params.visitId ?? null,
    doctor_id: params.doctorId ?? null,
    uploaded_by: params.uploadedBy ?? null,
  });
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw error;
  }
  return path;
}

export async function deletePatientMedia(row: Pick<MediaRow, "id" | "storage_path">) {
  const { error } = await supabase.from("visit_media").delete().eq("id", row.id);
  if (error) throw error;
  await supabase.storage.from(BUCKET).remove([row.storage_path]);
}

export async function signMediaUrls(paths: string[]) {
  if (paths.length === 0) return {} as Record<string, string>;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 60 * 60);
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
  }
  return map;
}
