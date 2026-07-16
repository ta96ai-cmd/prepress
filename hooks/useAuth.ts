// hooks/useAuth.ts
// Uses BOS roles directly from public.user_roles (no separate prepress role table).
// full + manager = can create tickets & release. artist = designer. others = no access.

"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const ROLE_CACHE_KEY = "pp_bos_role";

interface AuthState {
  loading: boolean;
  userId: string | null;
  email: string | null;
  role: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    loading: true,
    userId: null,
    email: null,
    role: null,
  });

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      sessionStorage.removeItem(ROLE_CACHE_KEY);
      setState({ loading: false, userId: null, email: null, role: null });
      return;
    }

    const cached = sessionStorage.getItem(ROLE_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as { userId: string; role: string | null };
      if (parsed.userId === user.id) {
        setState({ loading: false, userId: user.id, email: user.email ?? null, role: parsed.role });
        return;
      }
    }

    // Read the BOS role from public.user_roles (default schema, already exposed)
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    const role = (data?.role as string | undefined) ?? null;
    sessionStorage.setItem(ROLE_CACHE_KEY, JSON.stringify({ userId: user.id, role }));
    setState({ loading: false, userId: user.id, email: user.email ?? null, role });
  }, []);

  useEffect(() => {
    load();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      sessionStorage.removeItem(ROLE_CACHE_KEY);
      load();
    });
    return () => subscription.unsubscribe();
  }, [load]);

  const signOut = useCallback(async () => {
    sessionStorage.removeItem(ROLE_CACHE_KEY);
    await supabase.auth.signOut();
  }, []);

  // Prepress permissions mapped onto BOS roles:
  const canRelease = state.role === "full" || state.role === "manager";
  const isDesigner = state.role === "artist";
  const canCreateTicket = canRelease || isDesigner; // full, manager, AND artist can raise tickets
  const hasAccess = canRelease || isDesigner;

  return {
    ...state,
    signOut,
    canRelease,
    isDesigner,
    canCreateTicket,
    hasAccess,
  };
}