import { supabase } from "@/integrations/supabase/client";

let cachedTenantId: string | null = null;
let inflight: Promise<string | null> | null = null;

/**
 * Returns the current user's tenant_id.
 * Uses the SECURITY DEFINER RPC `get_my_tenant_id` and caches the result for the session.
 * Throws if no tenant is associated.
 */
export async function getMyTenantId(): Promise<string> {
  if (cachedTenantId) return cachedTenantId;
  if (!inflight) {
    inflight = supabase.rpc("get_my_tenant_id").then(({ data, error }) => {
      if (error) throw error;
      return (data as string | null) ?? null;
    });
  }
  const value = await inflight;
  inflight = null;
  if (!value) throw new Error("Usuário sem tenant associado.");
  cachedTenantId = value;
  return value;
}

export function clearTenantCache() {
  cachedTenantId = null;
  inflight = null;
}

// Reset cache on auth changes
supabase.auth.onAuthStateChange(() => {
  clearTenantCache();
});
