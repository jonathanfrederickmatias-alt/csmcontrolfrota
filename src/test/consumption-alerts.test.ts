import { describe, it, expect } from 'vitest';
import { findConsumptionAlerts, digitSuggestions } from '@/lib/consumption-alerts';

const today = new Date('2026-11-12T12:00:00Z');
let n = 0;
const rec = (eq: string, date: string, hm: number | null, liters: number, station = 'posto', fuel = 'Diesel S10') => ({
  id: `r${++n}`, target_equipment_id: eq, combo_equipment_id: station, date, created_at: `${date}T10:00:${String(n % 60).padStart(2, '0')}Z`, liters, hour_meter: hm, fuel_type: fuel,
});
const eqs = [
  { id: 'van', name: 'VAN BRANCA', type: 'truck' },
  { id: 'rolo', name: 'ROLO TANDEM', type: 'machine' },
  { id: 'esp', name: 'CAMINHÃO ESPARGIDOR', type: 'truck' },
  { id: 'posto', name: 'Posto Corujão', type: 'combo' },
  { id: 'cb', name: 'COMBOIO ALYA', type: 'combo' },
];
const vanSeries = (extra: any[] = []) => [
  rec('van', '2026-10-01', 99000, 50), rec('van', '2026-10-03', 99500, 50), rec('van', '2026-10-05', 99749, 25), ...extra,
  rec('van', '2026-10-10', 100509, 70), rec('van', '2026-10-12', 101000, 50), rec('van', '2026-10-14', 101500, 50),
];

describe('findConsumptionAlerts', () => {
  it('suggests the value with a missing digit (10093 between 99749 and 100509)', () => {
    const a = findConsumptionAlerts(vanSeries([rec('van', '2026-10-07', 10093, 40)]), eqs, { today });
    const d = a.find(x => x.reading === 10093)!;
    expect(d.cause).toBe('digit');
    expect(d.suggestions).toContain(100093);
  });

  it('flags a reading that went back as out of sequence with the expected range', () => {
    const a = findConsumptionAlerts(vanSeries([rec('van', '2026-10-07', 50000, 40)]), eqs, { today });
    const d = a.find(x => x.reading === 50000)!;
    expect(d.cause).toBe('out_of_sequence');
    expect(d.range).toEqual([99749, 100509]);
  });

  it('flags same reading on a later day as repeated', () => {
    const a = findConsumptionAlerts(vanSeries([rec('van', '2026-10-06', 99749, 40)]), eqs, { today });
    expect(a.some(x => x.cause === 'repeated' && x.date === '2026-10-06')).toBe(true);
  });

  it('flags km/L above 2.5x the median as a missing fill-up with estimated liters', () => {
    const recs = [
      rec('van', '2026-10-01', 1000, 50), rec('van', '2026-10-02', 1500, 50), rec('van', '2026-10-03', 2000, 50),
      rec('van', '2026-10-04', 2500, 50), rec('van', '2026-10-10', 4500, 50), // 40 km/L vs median 10
    ];
    const a = findConsumptionAlerts(recs, eqs, { today });
    const c = a.find(x => x.cause === 'missing_fill')!;
    expect(c.date).toBe('2026-10-10');
    expect(c.missingLiters).toBe(150); // 2000 km / 10 km/L - 50 L
  });

  it('flags L/h below 0.4x the median on machines and ignores intervals under 3h', () => {
    const recs = [
      rec('rolo', '2026-10-01', 100, 50, 'cb'), rec('rolo', '2026-10-02', 110, 100, 'cb'), rec('rolo', '2026-10-03', 120, 100, 'cb'),
      rec('rolo', '2026-10-04', 130, 100, 'cb'), rec('rolo', '2026-10-05', 132, 100, 'cb'), // 2h: ignored
      rec('rolo', '2026-10-06', 152, 40, 'cb'), // 2 L/h vs median 10
    ];
    const a = findConsumptionAlerts(recs, eqs, { today });
    expect(a.filter(x => x.cause === 'missing_fill').map(x => x.date)).toEqual(['2026-10-06']);
    expect(a.some(x => x.date === '2026-10-05')).toBe(false);
  });

  it('never compares hour-meter readings with km readings on the same truck', () => {
    const recs = [
      rec('esp', '2026-10-01', 370, 80, 'cb'), rec('esp', '2026-10-02', 3600, 60), rec('esp', '2026-10-03', 380, 20, 'cb'),
      rec('esp', '2026-10-04', 3650, 60), rec('esp', '2026-10-05', 390, 20, 'cb'), rec('esp', '2026-10-06', 3700, 60),
    ];
    const a = findConsumptionAlerts(recs, eqs, { today });
    expect(a.filter(x => x.cause === 'out_of_sequence' || x.cause === 'digit')).toHaveLength(0);
  });

  it('ignores Arla and 0 L records', () => {
    const a = findConsumptionAlerts(vanSeries([rec('van', '2026-10-07', 10, 20, 'posto', 'Arla'), rec('van', '2026-10-08', 10, 0)]), eqs, { today });
    expect(a.some(x => x.reading === 10)).toBe(false);
  });

  it('sums liters of same-day same-reading records', () => {
    const recs = vanSeries([rec('van', '2026-10-05', 99749, 25, 'posto', 'Gasolina')]);
    const a = findConsumptionAlerts(recs, eqs, { today });
    expect(a.some(x => x.cause === 'repeated')).toBe(false);
  });
});

describe('digitSuggestions', () => {
  it('returns the single value in range (31577 between 310356 and 310758)', () => {
    expect(digitSuggestions(31577, 310356, 310758)).toEqual([310577]);
  });
});
