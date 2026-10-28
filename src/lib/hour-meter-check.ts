// Detects suspicious hour meter / odometer jumps in fuel records (likely typos).
// Machines (hours): more than 24h per elapsed day is impossible.
// Trucks (km): more than 1000 km per elapsed day is treated as suspicious.

export const MAX_HOURS_PER_DAY = 24;
export const MAX_KM_PER_DAY = 1000;
export const LOOKBACK_DAYS = 60;

export interface CheckRecord {
  id: string;
  target_equipment_id?: string | null;
  date: string;
  created_at: string;
  hour_meter?: number | null;
  hour_meter_confirmed?: boolean | null;
}

export interface CheckEquipment {
  id: string;
  type: string;
  track_hour_meter?: boolean | null;
}

export interface SuspiciousJump<R extends CheckRecord = CheckRecord> {
  record: R;
  previousValue: number;
  previousDate: string;
  jump: number;
  days: number;
  limit: number;
  unit: 'h' | 'km';
}

const dayMs = 86400000;
const toDay = (d: string) => new Date(d.slice(0, 10) + 'T12:00:00Z').getTime();

export function findSuspiciousJumps<R extends CheckRecord>(
  records: R[],
  equipments: CheckEquipment[],
  today: Date = new Date(),
): SuspiciousJump<R>[] {
  const eqMap = new Map(equipments.map(e => [e.id, e]));
  const byEq = new Map<string, R[]>();
  for (const r of records) {
    if (!r.target_equipment_id || !r.hour_meter || r.hour_meter <= 0) continue;
    const eq = eqMap.get(r.target_equipment_id);
    if (!eq || eq.type === 'combo' || eq.track_hour_meter === false) continue;
    const list = byEq.get(r.target_equipment_id) || [];
    list.push(r);
    byEq.set(r.target_equipment_id, list);
  }

  const cutoff = today.getTime() - LOOKBACK_DAYS * dayMs;
  const result: SuspiciousJump<R>[] = [];

  for (const [eqId, list] of byEq) {
    const eq = eqMap.get(eqId)!;
    const isTruck = eq.type === 'truck';
    const perDay = isTruck ? MAX_KM_PER_DAY : MAX_HOURS_PER_DAY;
    list.sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at));

    let prev: R | null = null;
    for (const r of list) {
      if (!prev) { prev = r; continue; }
      const jump = Number(r.hour_meter) - Number(prev.hour_meter);
      const days = Math.max(1, Math.round((toDay(r.date) - toDay(prev.date)) / dayMs));
      const limit = perDay * days;
      if (jump > limit && !r.hour_meter_confirmed) {
        if (toDay(r.date) >= cutoff) {
          result.push({
            record: r,
            previousValue: Number(prev.hour_meter),
            previousDate: prev.date,
            jump,
            days,
            limit,
            unit: isTruck ? 'km' : 'h',
          });
        }
        continue; // keep comparing next readings with the last trustworthy one
      }
      if (jump < 0) continue; // lower reading than reference: ignore as reference
      prev = r;
    }
  }

  return result.sort((a, b) => b.record.date.localeCompare(a.record.date));
}
