import { describe, it, expect } from 'vitest';
import { findSuspiciousJumps } from '@/lib/hour-meter-check';

const today = new Date('2026-10-28T12:00:00Z');
const rec = (id: string, eq: string, date: string, hm: number, confirmed = false) => ({
  id, target_equipment_id: eq, date, created_at: date + 'T10:00:00Z', hour_meter: hm, hour_meter_confirmed: confirmed,
});
const eqs = [{ id: 'm', type: 'machine' }, { id: 't', type: 'truck' }];

describe('findSuspiciousJumps', () => {
  it('flags a machine jump of 1010h in 5 days (FR113 case)', () => {
    const r = findSuspiciousJumps([rec('a', 'm', '2026-10-19', 3457), rec('b', 'm', '2026-10-24', 4467)], eqs, today);
    expect(r.map(x => x.record.id)).toEqual(['b']);
    expect(r[0].jump).toBe(1010);
  });

  it('does not flag a machine jump within 24h per day', () => {
    const r = findSuspiciousJumps([rec('a', 'm', '2026-10-19', 3457), rec('b', 'm', '2026-10-24', 3577)], eqs, today);
    expect(r).toHaveLength(0);
  });

  it('flags a truck jump above 1000 km per day', () => {
    const r = findSuspiciousJumps([rec('a', 't', '2026-10-20', 100000), rec('b', 't', '2026-10-21', 101001)], eqs, today);
    expect(r.map(x => x.record.id)).toEqual(['b']);
  });

  it('does not flag a truck jump of 1000 km in one day', () => {
    const r = findSuspiciousJumps([rec('a', 't', '2026-10-20', 100000), rec('b', 't', '2026-10-21', 101000)], eqs, today);
    expect(r).toHaveLength(0);
  });

  it('does not flag a jump the manager already confirmed', () => {
    const r = findSuspiciousJumps([rec('a', 'm', '2026-10-19', 3457), rec('b', 'm', '2026-10-24', 4467, true)], eqs, today);
    expect(r).toHaveLength(0);
  });

  it('compares the next reading with the last trustworthy one, not the typo', () => {
    const r = findSuspiciousJumps([
      rec('a', 'm', '2026-10-19', 3457), rec('b', 'm', '2026-10-24', 4467), rec('c', 'm', '2026-10-26', 3480),
    ], eqs, today);
    expect(r.map(x => x.record.id)).toEqual(['b']);
  });

  it('does not flag readings that continue from a jump (earlier low reading was the typo)', () => {
    const r = findSuspiciousJumps([
      rec('a', 't', '2026-09-01', 43556), rec('b', 't', '2026-09-10', 415143), rec('c', 't', '2026-09-15', 415726),
    ], eqs, today);
    expect(r).toHaveLength(0);
  });
});
