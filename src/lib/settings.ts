import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { CLINIC } from "@/lib/clinic";

export type ClinicSettings = {
  phone: string;
  phone_alt: string | null;
  landline: string | null;
  whatsapp: string | null;
  address: string;
  map_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
};

const fallback: ClinicSettings = {
  phone: CLINIC.phone,
  phone_alt: null,
  landline: CLINIC.landline,
  whatsapp: null,
  address: CLINIC.address,
  map_url: null,
  facebook_url: null,
  instagram_url: null,
};

/** إعدادات التواصل القابلة للتعديل من لوحة الإدارة، مع قيم افتراضية إن لم تُحمّل بعد. */
export function useClinicSettings() {
  const query = useQuery({
    queryKey: ["clinic-settings"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ClinicSettings> => {
      const { data, error } = await supabase
        .from("clinic_settings")
        .select("*")
        .eq("id", true)
        .maybeSingle();
      if (error) throw error;
      if (!data) return fallback;
      return {
        phone: data.phone || fallback.phone,
        phone_alt: data.phone_alt,
        landline: data.landline,
        whatsapp: data.whatsapp,
        address: data.address || fallback.address,
        map_url: data.map_url,
        facebook_url: data.facebook_url,
        instagram_url: data.instagram_url,
      };
    },
  });

  return { settings: query.data ?? fallback, isLoading: query.isLoading };
}

/** رقم دولي صالح لروابط الاتصال. */
export function telHref(phone: string) {
  const clean = phone.replace(/[^\d+]/g, "");
  if (clean.startsWith("+")) return `tel:${clean}`;
  if (clean.startsWith("00")) return `tel:+${clean.slice(2)}`;
  if (clean.startsWith("0")) return `tel:+963${clean.slice(1)}`;
  return `tel:${clean}`;
}
