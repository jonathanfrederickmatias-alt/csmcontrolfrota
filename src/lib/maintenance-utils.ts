/**
 * Returns the approaching threshold based on equipment type.
 * - truck: 1000 hours/km
 * - machine/combo/other: 50 hours
 */
export function getApproachingThreshold(equipmentType: string): number {
  return equipmentType === 'truck' ? 1000 : 50;
}

/**
 * Calculates maintenance plan status based on remaining hours and equipment type.
 */
export function calculateMaintenanceStatus(
  remaining: number,
  equipmentType: string
): 'ok' | 'approaching' | 'overdue' {
  if (remaining <= 0) return 'overdue';
  const threshold = getApproachingThreshold(equipmentType);
  if (remaining <= threshold) return 'approaching';
  return 'ok';
}
