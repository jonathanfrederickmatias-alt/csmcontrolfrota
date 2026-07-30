import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "csm-tenant-id";

let cachedTenantId: string | null = localStorage.getItem(STORAGE_KEY);
let inflight: Promise<string | null> | null = null;

/**
 * Returns the current user's tenant_id.
 * Uses the SECURITY DEFINER RPC `get_my_tenant_id` and caches the result
 * (in memory and in localStorage, so forms keep working offline).
 * Throws if no tenant is associated.
 */
export async function getMyTenantId(): Promise<string> {
  if (cachedTenantId) return cachedTenantId;
  if (!navigator.onLine) throw new Error("Sem conexão e sem empresa em cache.");
  if (!inflight) {
    inflight = (async () => {
      const { data, error } = await supabase.rpc("get_my_tenant_id");
      if (error) throw error;
      return (data as string | null) ?? null;
    })();
  }
  const value = await inflight;
  inflight = null;
  if (!value) throw new Error("Usuário sem tenant associado.");
  cachedTenantId = value;
  try { localStorage.setItem(STORAGE_KEY, value); } catch { /* ignore */ }
  return value;
}

export function clearTenantCache() {
  cachedTenantId = null;
  inflight = null;
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

// Reset cache on auth changes
supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") clearTenantCache();
});
