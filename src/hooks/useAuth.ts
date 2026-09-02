import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "doctor" | "staff" | "patient";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadRoles = async (uid: string | undefined) => {
      if (!uid) {
        if (active) {
          setRoles([]);
          setDoctorId(null);
        }
        return;
      }
      const [{ data: roleRows }, { data: doctorRow }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", uid),
        supabase.from("doctors").select("id").eq("profile_id", uid).maybeSingle(),
      ]);
      if (!active) return;
      setRoles((roleRows ?? []).map((r) => r.role as AppRole));
      setDoctorId(doctorRow?.id ?? null);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setUser(next?.user ?? null);
      void loadRoles(next?.user?.id);
    });

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      await loadRoles(data.session?.user?.id);
      if (active) setLoading(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const isAdmin = roles.includes("admin");
  const isStaff = roles.some((r) => r === "admin" || r === "doctor" || r === "staff");
  const isDoctor = roles.includes("doctor");

  return {
    session,
    user,
    roles,
    isStaff,
    isAdmin,
    isDoctor,
    /** معرّف الطبيب المرتبط بالحساب (إن وجد) */
    doctorId,
    /** طبيب فقط بدون صلاحية إدارة: يرى مواعيده ومرضاه حصراً */
    isDoctorOnly: isDoctor && !isAdmin,
    loading,
  };
}
