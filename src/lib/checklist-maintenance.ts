import { ChecklistItemDB } from "@/lib/supabase-types";

export type ChecklistType = "daily" | "corrective" | "preventive";

export interface ChecklistMaintenanceIssueDraft {
  id: string;
  description: string;
  notes: string | null;
}

const getChecklistTypeLabel = (checklistType: ChecklistType) => {
  if (checklistType === "corrective") return "Corretivo";
  if (checklistType === "preventive") return "Preventivo";
  return "Diário";
};

const normalizeIssueText = (value: string) => value.replace(/\s+/g, " ").trim().toLowerCase();

export function buildChecklistMaintenanceIssues(
  items: ChecklistItemDB[],
  checklistType: ChecklistType,
  generalObservations: string,
): ChecklistMaintenanceIssueDraft[] {
  const typeLabel = getChecklistTypeLabel(checklistType);
  const trimmedGeneralObservations = generalObservations.trim();
  const seenDescriptions = new Set<string>();

  const failedIssues = items
    .filter((item) => item.checked === false)
    .map((item) => {
      const description = item.label.trim();
      const normalizedDescription = normalizeIssueText(description);

      if (!description || seenDescriptions.has(normalizedDescription)) {
        return null;
      }

      seenDescriptions.add(normalizedDescription);

      const notes = [
        `Checklist ${typeLabel}`,
        item.observation?.trim() ? `Observação do item: ${item.observation.trim()}` : null,
        trimmedGeneralObservations ? `Observações gerais: ${trimmedGeneralObservations}` : null,
      ].filter(Boolean).join("\n");

      return {
        id: item.id,
        description,
        notes: notes || null,
      } satisfies ChecklistMaintenanceIssueDraft;
    })
    .filter((issue): issue is ChecklistMaintenanceIssueDraft => issue !== null);

  if (failedIssues.length > 0) {
    return failedIssues;
  }

  if (!trimmedGeneralObservations) {
    return [];
  }

  return [{
    id: "general-observations",
    description: `Observações gerais do checklist ${typeLabel}`,
    notes: trimmedGeneralObservations,
  }];
}