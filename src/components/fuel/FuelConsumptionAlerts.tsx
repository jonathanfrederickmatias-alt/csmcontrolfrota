import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { findConsumptionAlerts, CAUSE_LABEL, causeExplanation, ConsumptionAlert, AlertEquipment, AlertRecord } from "@/lib/consumption-alerts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const FUEL_ALERTS_EVENT = "fuel-alerts-changed";

interface Eq extends AlertEquipment { cost_center?: string | null; current_hour_meter?: number | null }

export async function fetchDismissedKeys(): Promise<Set<string>> {
  const { data } = await supabase.from("fuel_alert_dismissals").select("alert_key");
  return new Set((data || []).map((d: any) => d.alert_key));
}

export function visibleAlerts(records: AlertRecord[], equipments: AlertEquipment[], dismissed: Set<string>) {
  const confirmed = new Set(records.filter(r => r.hour_meter_confirmed).map(r => r.id));
  return findConsumptionAlerts(records, equipments).filter(a =>
    !dismissed.has(a.key) && !(a.cause !== 'missing_fill' && a.cause !== 'extra_liters' && a.recordIds.some(id => confirmed.has(id)))
  );
}

const fmt = (n?: number | null, d = 0) => n == null ? "—" : n.toLocaleString("pt-BR", { maximumFractionDigits: d });
const fdate = (d?: string) => d ? new Date(d.slice(0, 10) + "T12:00:00").toLocaleDateString("pt-BR") : "—";

export default function FuelConsumptionAlerts({ records, equipments, canEdit, onChanged }: {
  records: AlertRecord[]; equipments: Eq[]; canEdit: boolean; onChanged: () => void;
}) {
  const [dismissed, setDismissed] = useState<Set<string> | null>(null);
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => { fetchDismissedKeys().then(setDismissed); }, []);

  const alerts = useMemo(
    () => (dismissed && equipments.length && records.length ? visibleAlerts(records, equipments, dismissed) : []),
    [records, equipments, dismissed]
  );
  useEffect(() => { window.dispatchEvent(new CustomEvent(FUEL_ALERTS_EVENT, { detail: alerts.length })); }, [alerts.length]);

  const eqMap = useMemo(() => new Map(equipments.map(e => [e.id, e])), [equipments]);
  const grouped = useMemo(() => {
    const m = new Map<string, ConsumptionAlert[]>();
    alerts.forEach(a => { const l = m.get(a.equipmentId) || []; l.push(a); m.set(a.equipmentId, l); });
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [alerts]);

  if (!canEdit || alerts.length === 0) return null;

  const fixReading = async (a: ConsumptionAlert, value: number) => {
    if (!value || value <= 0) { toast.error("Informe o valor correto"); return; }
    setBusy(a.key);
    const { error } = await supabase.from("fuel_records").update({ hour_meter: value } as any).in("id", a.recordIds);
    if (error) { setBusy(null); toast.error("Não foi possível corrigir: " + error.message); return; }
    // Equipment meter only goes up automatically; lower it back if it came from the wrong reading
    const eq = eqMap.get(a.equipmentId);
    if (eq && a.reading != null && Number(eq.current_hour_meter) === a.reading) {
      const others = records.filter(r => r.target_equipment_id === eq.id && !a.recordIds.includes(r.id) && r.hour_meter).map(r => Number(r.hour_meter));
      await supabase.from("equipments").update({ current_hour_meter: Math.max(value, ...others) }).eq("id", eq.id);
    }
    setBusy(null);
    toast.success("Leitura corrigida");
    onChanged();
  };

  const ignore = async (a: ConsumptionAlert) => {
    setBusy(a.key);
    const { data: u } = await supabase.auth.getUser();
    const { data: prof } = u.user ? await supabase.from("profiles").select("display_name").eq("user_id", u.user.id).maybeSingle() : { data: null };
    const { error } = await supabase.from("fuel_alert_dismissals").insert({
      alert_key: a.key, record_id: a.recordIds[0], dismissed_by_name: (prof as any)?.display_name || u.user?.email || null,
    } as any);
    setBusy(null);
    if (error) { toast.error("Não foi possível ignorar: " + error.message); return; }
    setDismissed(prev => new Set([...(prev || []), a.key]));
    toast.success("Ocorrência ignorada");
  };

  const ignoreAll = async () => {
    if (!confirm(`Marcar todas as ${alerts.length} ocorrências como "Está certo, ignorar"?`)) return;
    setBusy("__all");
    const { data: u } = await supabase.auth.getUser();
    const { data: prof } = u.user ? await supabase.from("profiles").select("display_name").eq("user_id", u.user.id).maybeSingle() : { data: null };
    const name = (prof as any)?.display_name || u.user?.email || null;
    const rows = alerts.map(a => ({ alert_key: a.key, record_id: a.recordIds[0], dismissed_by_name: name }));
    const { error } = await supabase.from("fuel_alert_dismissals").insert(rows as any);
    setBusy(null);
    if (error) { toast.error("Não foi possível ignorar: " + error.message); return; }
    setDismissed(prev => new Set([...(prev || []), ...rows.map(r => r.alert_key)]));
    toast.success(`${rows.length} ocorrências ignoradas`);
  };

  const stationName = (id?: string | null) => (id && eqMap.get(id)?.name) || "—";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full mb-6 flex items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-left hover:bg-warning/15 transition-colors"
      >
        <AlertTriangle className="w-6 h-6 text-warning shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-bold">{alerts.length} abastecimento{alerts.length > 1 ? "s" : ""} com consumo extremo ou leitura incoerente</p>
          <p className="text-sm text-muted-foreground truncate">
            {grouped.slice(0, 5).map(([id, l]) => `${eqMap.get(id)?.cost_center || eqMap.get(id)?.name} (${l.length})`).join(" · ")}
            {grouped.length > 5 ? ` · +${grouped.length - 5}` : ""} — clique para conferir
          </p>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" /> Conferir consumo e leituras
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Últimos 90 dias. O sistema só sugere — nada é alterado sem você confirmar.
          </p>
          <Button variant="outline" size="sm" className="self-start" disabled={busy === "__all"} onClick={ignoreAll}>
            {busy === "__all" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}Está certo, ignorar todos ({alerts.length})
          </Button>
          <div className="space-y-5">
            {grouped.map(([eqId, list]) => {
              const eq = eqMap.get(eqId);
              return (
                <div key={eqId} className="space-y-2">
                  <h3 className="font-bold text-sm">{eq?.cost_center ? `${eq.cost_center} — ` : ""}{eq?.name} <span className="text-muted-foreground font-normal">({list.length})</span></h3>
                  {list.map(a => {
                    const u = a.unit;
                    const single = a.cause === "digit" && a.suggestions?.length === 1 ? a.suggestions[0] : null;
                    const canFixReading = a.cause !== "missing_fill" && a.cause !== "extra_liters";
                    return (
                      <div key={a.key} className="rounded-lg border border-warning/30 bg-warning/5 p-3 space-y-2 text-sm">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="font-semibold text-warning">{CAUSE_LABEL[a.cause]}</span>
                          <span className="text-muted-foreground">{a.previousDate && a.previousDate !== a.date ? `${fdate(a.previousDate)} → ` : ""}{fdate(a.date)} · {stationName(a.stationId)} · {fmt(a.liters, 3)} L</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div><p className="text-muted-foreground">Leitura anterior</p><p className="font-mono">{fmt(a.previousReading, 1)} {u}</p></div>
                          <div><p className="text-muted-foreground">Leitura atual</p><p className="font-mono font-bold">{fmt(a.reading, 1)} {u}</p></div>
                          <div><p className="text-muted-foreground">Consumo</p><p className="font-mono">{a.consumption != null ? `${fmt(a.consumption, 1)} ${u === "km" ? "km/L" : "L/h"}` : "—"}</p></div>
                          <div><p className="text-muted-foreground">Mediana do equipamento</p><p className="font-mono">{a.median != null ? `${fmt(a.median, 1)} ${u === "km" ? "km/L" : "L/h"}` : "—"}</p></div>
                        </div>
                        <p>{causeExplanation(a)}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          {a.cause === "digit" && a.suggestions!.map(s => (
                            <Button key={s} size="sm" disabled={busy === a.key} onClick={() => fixReading(a, s)}>
                              {single ? "Corrigir para" : "Usar"} {fmt(s)} {u}
                            </Button>
                          ))}
                          {canFixReading && (
                            <div className="flex items-center gap-1">
                              <Input type="number" inputMode="decimal" className="h-9 w-32" placeholder="Valor correto"
                                value={manual[a.key] || ""} onChange={e => setManual({ ...manual, [a.key]: e.target.value })} />
                              <Button size="sm" variant="outline" disabled={busy === a.key || !manual[a.key]} onClick={() => fixReading(a, Number(manual[a.key]))}>
                                Corrigir manualmente
                              </Button>
                            </div>
                          )}
                          <Button size="sm" variant="ghost" disabled={busy === a.key} onClick={() => ignore(a)}>
                            {busy === a.key && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}Está certo, ignorar
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
