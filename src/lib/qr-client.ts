import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Client used by public QR pages. Sends the scanned equipment / OS id as a
 * header so database rules only expose records of that equipment or OS.
 */
export function qrClient(scope: { equipmentId?: string; osId?: string }) {
  const headers: Record<string, string> = {};
  if (scope.equipmentId) headers["x-qr-equipment"] = scope.equipmentId;
  if (scope.osId) headers["x-qr-os"] = scope.osId;
  return createClient<Database>(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, storageKey: "qr-scoped" },
    global: { headers },
  });
}
