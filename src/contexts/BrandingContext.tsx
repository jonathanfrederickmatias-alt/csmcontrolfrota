import { createContext, useContext, useEffect, useMemo, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface TenantBranding {
  id: string;
  name: string;
  slug: string;
  nome_exibicao: string | null;
  logo_url: string | null;
  cor_primaria: string | null;
  cor_secundaria: string | null;
  cor_alerta: string | null;
  ativo: boolean;
}

interface BrandingContextValue {
  branding: TenantBranding | null;
  loading: boolean;
  refresh: () => Promise<void>;
  /** Nome para exibir (fallback: name → "Sistema") */
  displayName: string;
}

const DEFAULT_PRIMARY = "#003B73";
const DEFAULT_SECONDARY = "#0F172A";
const DEFAULT_ALERT = "#DC2626";

const BrandingContext = createContext<BrandingContextValue | undefined>(undefined);

/** Converte HEX → "H S% L%" para uso em hsl(var(--xxx)) do Tailwind. */
function hexToHslTriplet(hex: string): string | null {
  const m = hex.trim().replace("#", "");
  if (!/^([0-9a-fA-F]{6})$/.test(m)) return null;
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function applyTheme(branding: TenantBranding | null) {
  const root = document.documentElement;
  const primary = branding?.cor_primaria || DEFAULT_PRIMARY;
  const secondary = branding?.cor_secundaria || DEFAULT_SECONDARY;
  const alert = branding?.cor_alerta || DEFAULT_ALERT;

  const primaryHsl = hexToHslTriplet(primary);
  const secondaryHsl = hexToHslTriplet(secondary);
  const alertHsl = hexToHslTriplet(alert);

  if (primaryHsl) {
    root.style.setProperty("--primary", primaryHsl);
    root.style.setProperty("--ring", primaryHsl);
    root.style.setProperty("--sidebar-primary", primaryHsl);
  }
  if (secondaryHsl) {
    root.style.setProperty("--secondary", secondaryHsl);
  }
  if (alertHsl) {
    root.style.setProperty("--destructive", alertHsl);
  }
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [branding, setBranding] = useState<TenantBranding | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBranding = useCallback(async () => {
    if (!user) {
      setBranding(null);
      setLoading(false);
      applyTheme(null);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc("get_my_tenant_branding");
    if (error) {
      console.error("[branding] erro ao carregar", error);
      setBranding(null);
    } else {
      const row = (Array.isArray(data) ? data[0] : data) as TenantBranding | undefined;
      setBranding(row || null);
      applyTheme(row || null);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  const value = useMemo<BrandingContextValue>(
    () => ({
      branding,
      loading,
      refresh: fetchBranding,
      displayName: branding?.nome_exibicao || branding?.name || "Sistema",
    }),
    [branding, loading, fetchBranding]
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding(): BrandingContextValue {
  const ctx = useContext(BrandingContext);
  if (!ctx) {
    return {
      branding: null,
      loading: false,
      refresh: async () => {},
      displayName: "Sistema",
    };
  }
  return ctx;
}
