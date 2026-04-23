import { supabase } from "@/integrations/supabase/client";

const normalizeIssueText = (value: string) => value.replace(/\s+/g, " ").trim().toLowerCase();

export interface DuplicateMaintenanceIssue {
  requestId: string;
  osNumber: number | null;
}

export async function findOpenDuplicateMaintenanceIssue(equipmentId: string, description: string): Promise<DuplicateMaintenanceIssue | null> {
  const normalizedDescription = normalizeIssueText(description || "");
  if (!equipmentId || !normalizedDescription) return null;

  const { data: requests, error: requestsError } = await supabase
    .from("maintenance_requests")
    .select("id, description, status")
    .eq("equipment_id", equipmentId)
    .in("status", ["open", "in_progress"]);

  if (requestsError) throw requestsError;

  const matchingRequests = (requests || []).filter((request) => normalizeIssueText(request.description || "") === normalizedDescription);
  if (matchingRequests.length === 0) return null;

  const { data: workOrders, error: workOrdersError } = await supabase
    .from("work_orders")
    .select("maintenance_request_id, os_number, status")
    .in("maintenance_request_id", matchingRequests.map((request) => request.id))
    .in("status", ["open", "in_progress"])
    .order("os_number", { ascending: false });

  if (workOrdersError) throw workOrdersError;

  const activeOrder = (workOrders || [])[0];
  if (!activeOrder) return null;

  return {
    requestId: activeOrder.maintenance_request_id,
    osNumber: activeOrder.os_number ?? null,
  };
}