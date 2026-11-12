// Consumption / reading anomaly detection for fuel records.
// Only suggests — never changes data by itself.

export const ALERT_LOOKBACK_DAYS = 90;
export const HIGH_FACTOR = 2.5;
export const LOW_FACTOR = 0.4;
export const MIN_HOURS_INTERVAL = 3;
export const CAR_KM_L = [4, 20] as const;
export const TRUCK_KM_L = [1, 12] as const;

export interface AlertRecord {
  id: string;
  target_equipment_id?: string | null;
  combo_equipment_id?: string | null;
  date: string;
  created_at: string;
  liters: number;
  hour_meter?: number | null;
  fuel_type?: string | null;
  hour_meter_confirmed?: boolean | null;
}
export interface AlertEquipment { id: string; name: string; type: string; plate?: string | null; track_hour_meter?: boolean | null; }

export type AlertCause = 'digit' | 'out_of_sequence' | 'missing_fill' | 'extra_liters' | 'repeated' | 'blank';

export interface ConsumptionAlert {
  key: string;
  cause: AlertCause;
  equipmentId: string;
  recordIds: string[];
  date: string;
  previousDate?: string;
  stationId?: string | null;
  liters: number;
  reading: number | null;
  previousReading?: number | null;
  nextReading?: number | null;
  unit: 'km' | 'h';
  consumption?: number;   // km/L or L/h
  median?: number;
  suggestions?: number[]; // for 'digit'
  range?: [number | null, number | null];
  missingLiters?: number;
}

const isComboio = (eq?: AlertEquipment) => !!eq && /comboio/i.test(eq.name);
const isCar = (eq: AlertEquipment) => /carro|van|furg|sprinter|strada|saveiro|gol|uno|hilux|pickup|picape/i.test(eq.name);

export function median(values: number[]): number | undefined {
  if (!values.length) return undefined;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Indices (in order) of a longest non-decreasing subsequence. Prefers keeping later items on ties. */
export function longestNonDecreasing(values: number[]): Set<number> {
  const n = values.length;
  const len = new Array(n).fill(1);
  const prev = new Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) {
      if (values[j] <= values[i] && len[j] + 1 >= len[i]) { len[i] = len[j] + 1; prev[i] = j; }
    }
  }
  let best = -1;
  for (let i = 0; i < n; i++) if (best < 0 || len[i] >= len[best]) best = i;
  const keep = new Set<number>();
  for (let i = best; i >= 0; i = prev[i]) keep.add(i);
  return keep;
}

/** Values obtained by inserting or removing one digit that fall within [lo, hi]. */
export function digitSuggestions(value: number, lo: number | null, hi: number | null): number[] {
  const s = String(Math.round(value));
  const out = new Set<number>();
  for (let p = 0; p <= s.length; p++) for (let d = 0; d <= 9; d++) {
    const c = s.slice(0, p) + d + s.slice(p);
    if (c[0] !== '0') out.add(Number(c));
  }
  for (let p = 0; p < s.length; p++) {
    const c = s.slice(0, p) + s.slice(p + 1);
    if (c && c[0] !== '0') out.add(Number(c));
  }
  out.delete(Math.round(value));
  return [...out].filter(v => (lo == null || v >= lo) && (hi == null || v <= hi)).sort((a, b) => a - b);
}

interface Point { ids: string[]; date: string; created_at: string; liters: number; reading: number; station?: string | null; }

const dayMs = 86400000;
const toDay = (d: string) => new Date(d.slice(0, 10) + 'T12:00:00Z').getTime();

function analyzeSeries(eq: AlertEquipment, unit: 'km' | 'h', pts: Point[]): ConsumptionAlert[] {
  const alerts: ConsumptionAlert[] = [];
  if (pts.length < 2) return alerts;
  const readings = pts.map(p => p.reading);
  const keep = longestNonDecreasing(readings);
  const keptIdx = pts.map((_, i) => i).filter(i => keep.has(i));

  // Out-of-sequence readings
  pts.forEach((p, i) => {
    if (keep.has(i)) return;
    const before = keptIdx.filter(k => k < i).pop();
    const after = keptIdx.find(k => k > i);
    const lo = before != null ? pts[before].reading : null;
    const hi = after != null ? pts[after].reading : null;
    const sugg = digitSuggestions(p.reading, lo, hi);
    alerts.push({
      key: `seq:${p.ids[0]}`, cause: sugg.length ? 'digit' : 'out_of_sequence',
      equipmentId: eq.id, recordIds: p.ids, date: p.date, stationId: p.station, liters: p.liters,
      reading: p.reading, previousReading: lo, nextReading: hi, unit,
      suggestions: sugg.length ? sugg.slice(0, 6) : undefined, range: [lo, hi],
    });
  });

  // Consumption over in-order consecutive pairs
  type Pair = { a: Point; b: Point; value: number; delta: number };
  const pairs: Pair[] = [];
  for (let k = 1; k < keptIdx.length; k++) {
    const a = pts[keptIdx[k - 1]], b = pts[keptIdx[k]];
    const delta = b.reading - a.reading;
    if (delta === 0) {
      if (toDay(b.date) - toDay(a.date) >= dayMs) {
        alerts.push({
          key: `rep:${b.ids[0]}`, cause: 'repeated', equipmentId: eq.id, recordIds: b.ids, date: b.date,
          previousDate: a.date, stationId: b.station, liters: b.liters, reading: b.reading, previousReading: a.reading, unit,
        });
      }
      continue;
    }
    if (b.liters <= 0) continue;
    if (unit === 'h' && delta < MIN_HOURS_INTERVAL) continue;
    pairs.push({ a, b, delta, value: unit === 'km' ? delta / b.liters : b.liters / delta });
  }
  const med = median(pairs.map(p => p.value));
  const [absLo, absHi] = isCar(eq) ? CAR_KM_L : TRUCK_KM_L;
  for (const p of pairs) {
    const rel = med != null && pairs.length >= 3 ? (p.value > med * HIGH_FACTOR ? 'high' : p.value < med * LOW_FACTOR ? 'low' : null) : null;
    const abs = unit === 'km' ? (p.value > absHi ? 'high' : p.value < absLo ? 'low' : null) : null;
    const dir = rel || abs;
    if (!dir) continue;
    // "high" value means: km/L high (efficient) or L/h high (thirsty)
    const tooEfficient = unit === 'km' ? dir === 'high' : dir === 'low';
    let missing: number | undefined;
    const ref = med ?? (unit === 'km' ? (absLo + absHi) / 2 : undefined);
    if (tooEfficient && ref) {
      missing = unit === 'km' ? p.delta / ref - p.b.liters : p.delta * ref - p.b.liters;
      missing = Math.max(0, Math.round(missing));
    }
    alerts.push({
      key: `cons:${p.b.ids[0]}`, cause: tooEfficient ? 'missing_fill' : 'extra_liters',
      equipmentId: eq.id, recordIds: p.b.ids, date: p.b.date, previousDate: p.a.date, stationId: p.b.station,
      liters: p.b.liters, reading: p.b.reading, previousReading: p.a.reading, unit,
      consumption: p.value, median: med, missingLiters: missing,
    });
  }
  return alerts;
}

export function findConsumptionAlerts(
  records: AlertRecord[],
  equipments: AlertEquipment[],
  opts: { today?: Date; lookbackDays?: number } = {},
): ConsumptionAlert[] {
  const today = opts.today ?? new Date();
  const cutoff = today.getTime() - (opts.lookbackDays ?? ALERT_LOOKBACK_DAYS) * dayMs;
  const eqMap = new Map(equipments.map(e => [e.id, e]));
  const byEq = new Map<string, AlertRecord[]>();
  for (const r of records) {
    if (!r.target_equipment_id) continue;
    const eq = eqMap.get(r.target_equipment_id);
    if (!eq || eq.type === 'combo' || eq.track_hour_meter === false) continue;
    if (!(Number(r.liters) > 0)) continue;
    if (r.fuel_type && /arla/i.test(r.fuel_type)) continue;
    const l = byEq.get(eq.id) || []; l.push(r); byEq.set(eq.id, l);
  }

  const out: ConsumptionAlert[] = [];
  for (const [eqId, list] of byEq) {
    const eq = eqMap.get(eqId)!;
    list.sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at));
    const blanks: AlertRecord[] = [];
    // Merge same day + same reading
    const merged: (Point & { comboio: boolean })[] = [];
    for (const r of list) {
      const hm = Number(r.hour_meter);
      if (!r.hour_meter || hm <= 1) { blanks.push(r); continue; }
      const last = merged[merged.length - 1];
      if (last && last.date === r.date && last.reading === hm) { last.liters += Number(r.liters); last.ids.push(r.id); continue; }
      merged.push({ ids: [r.id], date: r.date, created_at: r.created_at, liters: Number(r.liters), reading: hm, station: r.combo_equipment_id, comboio: isComboio(eqMap.get(r.combo_equipment_id || '')) });
    }
    for (const r of blanks) {
      out.push({ key: `blank:${r.id}`, cause: 'blank', equipmentId: eqId, recordIds: [r.id], date: r.date, stationId: r.combo_equipment_id, liters: Number(r.liters), reading: r.hour_meter ? Number(r.hour_meter) : null, unit: eq.type === 'truck' ? 'km' : 'h' });
    }

    if (eq.type !== 'truck') { out.push(...analyzeSeries(eq, 'h', merged)); continue; }
    // Trucks: comboio = hours, station = km; reassign station readings closer in magnitude to the hour series.
    const hours = merged.filter(p => p.comboio), km = merged.filter(p => !p.comboio);
    if (hours.length && km.length) {
      const mh = Math.log(median(hours.map(p => p.reading))!), mk = Math.log(median(km.map(p => p.reading))!);
      const hSeries: Point[] = [], kSeries: Point[] = [];
      for (const p of merged) {
        const lr = Math.log(p.reading);
        (Math.abs(lr - mh) < Math.abs(lr - mk) ? hSeries : kSeries).push(p);
      }
      out.push(...analyzeSeries(eq, 'h', hSeries), ...analyzeSeries(eq, 'km', kSeries));
    } else {
      out.push(...analyzeSeries(eq, hours.length ? 'h' : 'km', merged));
    }
  }
  return out.filter(a => toDay(a.date) >= cutoff).sort((a, b) => b.date.localeCompare(a.date));
}

export const CAUSE_LABEL: Record<AlertCause, string> = {
  digit: 'Dígito faltando ou sobrando',
  out_of_sequence: 'Leitura fora de sequência',
  missing_fill: 'Abastecimento sem lançamento',
  extra_liters: 'Litro a mais ou duplicado',
  repeated: 'Mesma leitura repetida',
  blank: 'Leitura em branco',
};

export function causeExplanation(a: ConsumptionAlert): string {
  const u = a.unit;
  const fmt = (n?: number | null) => n == null ? '—' : n.toLocaleString('pt-BR');
  switch (a.cause) {
    case 'digit': return a.suggestions!.length === 1
      ? `A leitura parece ter um dígito a menos/a mais. Valor sugerido: ${fmt(a.suggestions![0])} ${u}.`
      : `A leitura parece ter um dígito a menos/a mais. Possíveis valores: ${a.suggestions!.map(fmt).join(', ')} ${u}.`;
    case 'out_of_sequence': return `Não se resolve com um dígito. Pode ser digitação errada ou abastecimento lançado no veículo errado. Deveria ficar entre ${fmt(a.range?.[0])} e ${fmt(a.range?.[1])} ${u}.`;
    case 'missing_fill': return `Rodou/trabalhou muito para os litros lançados. Provável abastecimento sem lançamento entre ${br(a.previousDate)} e ${br(a.date)}${a.missingLiters ? ` (≈ ${fmt(a.missingLiters)} L faltando)` : ''}. Confira o extrato do posto.`;
    case 'extra_liters': return 'Muitos litros para a distância/horas. Pode ser litro digitado a mais, abastecimento lançado duas vezes ou leitura anterior digitada a menos.';
    case 'repeated': return 'A leitura é igual à do abastecimento anterior: cópia do campo, veículo parado ou abastecimento duplicado.';
    case 'blank': return 'O posto não informou a leitura; não dá para calcular o consumo. Colha a leitura.';
  }
}
const br = (d?: string) => d ? d.slice(0, 10).split('-').reverse().slice(0, 2).join('/') : '—';
