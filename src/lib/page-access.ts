import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/hooks/useAuth";

export const PAGE_KEYS = [
  { key: "dashboard", label: "حسابي / لوحة المريض" },
  { key: "book", label: "حجز موعد" },
  { key: "admin", label: "لوحة العيادة" },
  { key: "billing", label: "الفواتير والمدفوعات" },
  { key: "reports", label: "التقارير" },
  { key: "settings", label: "إعدادات المركز" },
] as const;

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "مدير",
  doctor: "طبيب",
  staff: "موظف",
  patient: "مريض",
};

export type PageAccessRow = {
  id: string;
  page_key: string;
  role: AppRole;
  is_visible: boolean;
};

export function usePageAccessRows() {
  return useQuery({
    queryKey: ["page-access"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("page_access")
        .select("id,page_key,role,is_visible");
      if (error) throw error;
      return (data ?? []) as PageAccessRow[];
    },
  });
}

/**
 * صلاحية عرض الواجهات لكل دور كما يضبطها المدير.
 * المدير يرى كل شيء دائماً حتى لا يُقفل على نفسه.
 */
export function usePageAccess(roles: AppRole[]) {
  const rows = usePageAccessRows();

  const can = (pageKey: string) => {
    if (roles.includes("admin")) return true;
    if (!rows.data || roles.length === 0) return true;
    const relevant = rows.data.filter((r) => r.page_key === pageKey && roles.includes(r.role));
    if (relevant.length === 0) return true;
    return relevant.some((r) => r.is_visible);
  };

  return { can, isLoading: rows.isLoading };
}
