import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DBEquipment } from "@/lib/supabase-types";
import PublicLayout from "@/components/PublicLayout";
import { Loader2, Lock, ArrowLeft, History, Wrench, Clock, User, DollarSign, FileText, Package, Image as ImageIcon, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import PhotoUpload from "@/components/PhotoUpload";
import { toast } from "sonner";

const REGISTRO_PIN = "0123";

interface PartItem { code: string; description: string; quantity: string; }

interface MaintenanceHistoryRow {
  id: string;
  equipment_id: string;
  description: string;
  hour_meter: number;
  executed_at: string;
  operator_name?: string | null;
  notes?: string | null;
  parts_cost?: number | null;
  labor_cost?: number | null;
  photo_url?: string | null;
}

interface WorkOrderRow {
  id: string;
  os_number: number;
  equipment_id: string;
  description: string;
  mechanic_name?: string | null;
  maintenance_type?: string | null;
  service_executed?: string | null;
  cause_identified?: string | null;
  technical_observations?: string | null;
  part_code?: string | null;
  parts?: any;
  parts_cost?: number | null;
  labor_cost?: number | null;
  execution_meter?: number | null;
  completed_at?: string | null;
  final_status?: string | null;
  photo_start_url?: string | null;
  photo_end_url?: string | null;
  invoice_number?: string | null;
  status: string;
}

export default function QRRegistroManutencao() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const equipmentId = params.get("equipment");

  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(true);
  const [equipment, setEquipment] = useState<DBEquipment | null>(null);
  const [history, setHistory] = useState<MaintenanceHistoryRow[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrderRow[]>([]);

  useEffect(() => {
    if (!equipmentId) return;
    (async () => {
      const [{ data: eq }, { data: hist }, { data: wos }] = await Promise.all([
        supabase.from("equipments").select("*").eq("id", equipmentId).maybeSingle(),
        supabase.from("maintenance_history").select("*").eq("equipment_id", equipmentId).order("executed_at", { ascending: false }),
        supabase.from("work_orders").select("*").eq("equipment_id", equipmentId).eq("status", "done").order("completed_at", { ascending: false }),
      ]);
      setEquipment(eq as DBEquipment | null);
      setHistory((hist || []) as MaintenanceHistoryRow[]);
      setWorkOrders((wos || []) as WorkOrderRow[]);
      setLoading(false);
    })();
  }, [equipmentId]);

  // Mescla histórico + OS concluídas, priorizando OS quando existir mesmo registro
  const items = useMemo(() => {
    const merged = history.map((h) => {
      const wo = workOrders.find((w) => w.completed_at && h.description.includes(`OS #${w.os_number}`));
      return {
        id: h.id,
        date: h.executed_at,
        hourMeter: h.hour_meter,
        description: h.description,
        operator: h.operator_name || wo?.mechanic_name || "—",
        notes: h.notes,
        partsCost: h.parts_cost || 0,
        laborCost: h.labor_cost || 0,
        photoUrl: h.photo_url,
        wo,
      };
    });
    return merged;
  }, [history, workOrders]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === REGISTRO_PIN) {
      setUnlocked(true);
      toast.success("Acesso liberado");
    } else {
      toast.error("PIN incorreto");
      setPin("");
    }
  };

  if (!equipmentId) {
    return (
      <PublicLayout>
        <div className="glass-card rounded-xl p-12 text-center">
          <p className="text-muted-foreground">Equipamento não informado.</p>
        </div>
      </PublicLayout>
    );
  }

  if (loading) {
    return (
      <PublicLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </PublicLayout>
    );
  }

  if (!unlocked) {
    return (
      <PublicLayout>
        <button onClick={() => navigate(`/qr/equipamento/${equipmentId}`)} className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="glass-card rounded-xl p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
            <Lock className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-xl font-black mb-2">Registro de Manutenção</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Área restrita. Digite o PIN numérico para continuar.
          </p>
          <form onSubmit={handleUnlock} className="space-y-3 max-w-xs mx-auto">
            <Input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
              className="text-center text-2xl tracking-[0.5em] font-mono h-14"
            />
            <Button type="submit" className="w-full" disabled={pin.length < 4}>
              Desbloquear
            </Button>
          </form>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <button onClick={() => navigate(`/qr/equipamento/${equipmentId}`)} className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <History className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-black text-gradient">Registro de Manutenção</h1>
        </div>
        {equipment && (
          <div className="text-sm text-muted-foreground">
            <span className="font-bold text-foreground">{equipment.name}</span>
            {equipment.plate && <span className="ml-2 font-mono">({equipment.plate})</span>}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {items.length} {items.length === 1 ? "registro encontrado" : "registros encontrados"}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <Wrench className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhuma manutenção executada ainda.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((it) => {
            const total = (it.partsCost || 0) + (it.laborCost || 0);
            const wo = it.wo;
            const partsList = Array.isArray(wo?.parts) ? wo!.parts : [];
            return (
              <div key={it.id} className="glass-card rounded-xl p-4 border border-border/60">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3 pb-3 border-b border-border/40">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm leading-snug">{it.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(it.date).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  {wo?.final_status && (
                    <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded bg-success/10 text-success border border-success/20 whitespace-nowrap">
                      {wo.final_status}
                    </span>
                  )}
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="flex items-start gap-2">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-muted-foreground">Horímetro/Km</p>
                      <p className="font-mono font-bold">{Number(it.hourMeter).toLocaleString("pt-BR")}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <User className="w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-muted-foreground">Responsável</p>
                      <p className="font-bold truncate">{it.operator}</p>
                    </div>
                  </div>
                  {wo?.maintenance_type && (
                    <div className="flex items-start gap-2">
                      <Wrench className="w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-muted-foreground">Tipo</p>
                        <p className="font-bold capitalize">{wo.maintenance_type}</p>
                      </div>
                    </div>
                  )}
                  {total > 0 && (
                    <div className="flex items-start gap-2">
                      <DollarSign className="w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-muted-foreground">Custo total</p>
                        <p className="font-bold">R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Serviço executado */}
                {wo?.service_executed && (
                  <div className="mt-3 pt-3 border-t border-border/40">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 flex items-center gap-1">
                      <Wrench className="w-3 h-3" /> Serviço executado
                    </p>
                    <p className="text-xs">{wo.service_executed}</p>
                  </div>
                )}

                {/* Causa */}
                {wo?.cause_identified && (
                  <div className="mt-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Causa identificada</p>
                    <p className="text-xs">{wo.cause_identified}</p>
                  </div>
                )}

                {/* Peças */}
                {(partsList.length > 0 || wo?.part_code) && (
                  <div className="mt-3 pt-3 border-t border-border/40">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-1">
                      <Package className="w-3 h-3" /> Peças utilizadas
                    </p>
                    {partsList.length > 0 ? (
                      <ul className="space-y-1">
                        {partsList.map((p: any, idx: number) => (
                          <li key={idx} className="text-xs flex items-center justify-between gap-2 bg-muted/40 rounded px-2 py-1">
                            <span className="truncate">
                              <span className="font-mono font-bold">{p.code || "—"}</span>
                              {p.description && <span className="text-muted-foreground"> · {p.description}</span>}
                            </span>
                            {p.quantity && <span className="font-mono text-muted-foreground">x{p.quantity}</span>}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs font-mono">{wo?.part_code}</p>
                    )}
                    {wo?.invoice_number && (
                      <p className="text-[10px] text-muted-foreground mt-2">NF: {wo.invoice_number}</p>
                    )}
                  </div>
                )}

                {/* Observações técnicas */}
                {(wo?.technical_observations || it.notes) && (
                  <div className="mt-3 pt-3 border-t border-border/40">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 flex items-center gap-1">
                      <FileText className="w-3 h-3" /> Observações
                    </p>
                    <p className="text-xs whitespace-pre-line">{wo?.technical_observations || it.notes}</p>
                  </div>
                )}

                {/* Fotos */}
                {(wo?.photo_start_url || wo?.photo_end_url || it.photoUrl) && (
                  <div className="mt-3 pt-3 border-t border-border/40">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" /> Fotos
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {wo?.photo_start_url && (
                        <a href={wo.photo_start_url} target="_blank" rel="noreferrer">
                          <img src={wo.photo_start_url} alt="Antes" className="w-20 h-20 object-cover rounded border border-border" />
                        </a>
                      )}
                      {wo?.photo_end_url && (
                        <a href={wo.photo_end_url} target="_blank" rel="noreferrer">
                          <img src={wo.photo_end_url} alt="Depois" className="w-20 h-20 object-cover rounded border border-border" />
                        </a>
                      )}
                      {it.photoUrl && !wo && (
                        <a href={it.photoUrl} target="_blank" rel="noreferrer">
                          <img src={it.photoUrl} alt="Registro" className="w-20 h-20 object-cover rounded border border-border" />
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </PublicLayout>
  );
}
