import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Cog,
  Gauge,
  ImageIcon,
  Loader2,
  Package,
  PlayCircle,
  Plus,
  ReceiptText,
  Save,
  ShieldCheck,
  Timer,
  Trash2,
  UserRound,
  Wrench,
} from "lucide-react";

import PhotoUpload from "@/components/PhotoUpload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DBEquipment, DBMaintenancePlan, DBObra, DBWorkOrder, WorkOrderPart } from "@/lib/supabase-types";

type WorkOrderUpdatePayload = {
  description: string;
  mechanic_name: string | null;
  cause_identified: string | null;
  maintenance_type: DBWorkOrder["maintenance_type"];
  maintenance_plan_id: string | null;
  service_executed: string | null;
  technical_observations: string | null;
  notes: string | null;
  execution_meter: number;
  parts: unknown;
  part_code: string | null;
  photo_start_url: string | null;
  photo_end_url: string | null;
  labor_cost: number;
  parts_cost: number;
  machine_released: boolean;
  final_status: WorkOrderFinalStatus;
  status: DBWorkOrder["status"];
  started_at?: string;
  completed_at?: string;
};

type RequestItem = {
  id: string;
  description: string;
  priority: string;
  done?: boolean;
};

type MaintenanceRequestDetails = {
  id: string;
  description: string;
  notes?: string | null;
  items: RequestItem[];
};

type WorkOrderFinalStatus = NonNullable<DBWorkOrder["final_status"]>;

const priorityLabels: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};

const statusLabels: Record<DBWorkOrder["status"], string> = {
  open: "Aberta",
  in_progress: "Em execução",
  done: "Concluída",
};

const finalStatusLabels: Record<WorkOrderFinalStatus, string> = {
  concluida: "Concluída",
  aguardando_peca: "Aguardando peça",
  servico_externo: "Serviço externo",
  maquina_parada: "Máquina parada",
};

const statusTone: Record<DBWorkOrder["status"], string> = {
  open: "bg-warning/10 text-warning border-warning/30",
  in_progress: "bg-primary/10 text-primary border-primary/30",
  done: "bg-success/10 text-success border-success/30",
};

const finalStatusTone: Record<WorkOrderFinalStatus, string> = {
  concluida: "bg-success/10 text-success border-success/30",
  aguardando_peca: "bg-warning/10 text-warning border-warning/30",
  servico_externo: "bg-primary/10 text-primary border-primary/30",
  maquina_parada: "bg-destructive/10 text-destructive border-destructive/30",
};

const typeLabels = {
  preventiva: "Preventiva",
  corretiva: "Corretiva",
} as const;

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString("pt-BR") : "—";
}

function formatCurrency(value?: number | null) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

function formatMeterLabel(equipment: DBEquipment | null, value?: number | null) {
  const label = equipment?.type === "truck" ? "KM atual" : "Horímetro atual";
  const unit = equipment?.type === "truck" ? "km" : "h";
  return { label, unit, value: Number(value ?? equipment?.current_hour_meter ?? 0) };
}

function getDurationLabel(start?: string | null, end?: string | null) {
  if (!start || !end) return "—";
  const diff = Math.max(0, new Date(end).getTime() - new Date(start).getTime());
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}min`;
}

function getPartTotal(part: WorkOrderPart) {
  const quantity = Number(part.quantity || 0);
  const unitPrice = Number(part.unit_price || 0);
  return Number(part.total_price ?? quantity * unitPrice);
}

export function WorkOrderExecutionView({
  initialOS,
  equipment,
  obra,
  onBack,
}: {
  initialOS: DBWorkOrder;
  equipment: DBEquipment | null;
  obra: DBObra | null;
  onBack: () => void;
}) {
  const [os, setOs] = useState<DBWorkOrder>(initialOS);
  const [saving, setSaving] = useState(false);
  const [mechanicName, setMechanicName] = useState(initialOS.mechanic_name || "");
  const [requestDetails, setRequestDetails] = useState<MaintenanceRequestDetails | null>(null);
  const [requestItems, setRequestItems] = useState<RequestItem[]>([]);
  const [maintenancePlans, setMaintenancePlans] = useState<DBMaintenancePlan[]>([]);
  const [diagnosis, setDiagnosis] = useState({
    reportedProblem: initialOS.description || "",
    causeIdentified: initialOS.cause_identified || "",
    maintenanceType: initialOS.maintenance_type || "corretiva",
    maintenancePlanId: initialOS.maintenance_plan_id || "none",
  });
  const [execution, setExecution] = useState({
    serviceExecuted: initialOS.service_executed || "",
    technicalObservations: initialOS.technical_observations || initialOS.notes || "",
    executionMeter: String(initialOS.execution_meter ?? equipment?.current_hour_meter ?? 0),
  });
  const [parts, setParts] = useState<WorkOrderPart[]>(
    Array.isArray(initialOS.parts) && initialOS.parts.length > 0
      ? initialOS.parts.map((part) => ({
          code: part.code || "",
          description: part.description || "",
          quantity: Number(part.quantity || 1),
          unit_price: Number(part.unit_price || 0),
          total_price: Number(part.total_price || getPartTotal(part)),
        }))
      : [{ code: initialOS.part_code || "", description: "", quantity: 1, unit_price: 0, total_price: 0 }],
  );
  const [evidence, setEvidence] = useState({
    photoStartUrl: initialOS.photo_start_url || "",
    photoEndUrl: initialOS.photo_end_url || "",
  });
  const [closure, setClosure] = useState({
    startedAt: initialOS.started_at || "",
    completedAt: initialOS.completed_at || "",
    laborCost: String(initialOS.labor_cost ?? 0),
    partsCost: String(initialOS.parts_cost ?? 0),
    finalStatus: (initialOS.final_status || "concluida") as WorkOrderFinalStatus,
    machineReleased: Boolean(initialOS.machine_released),
  });

  useEffect(() => {
    const loadDetails = async () => {
      const [requestRes, planRes] = await Promise.all([
        supabase
          .from("maintenance_requests")
          .select("id, description, notes, items")
          .eq("id", initialOS.maintenance_request_id)
          .single(),
        supabase
          .from("maintenance_plans")
          .select("*")
          .eq("equipment_id", initialOS.equipment_id)
          .order("next_due_at"),
      ]);

      if (requestRes.data) {
        const request = requestRes.data as unknown as MaintenanceRequestDetails;
        setRequestDetails(request);
        const items = Array.isArray(request.items) ? request.items : [];
        setRequestItems(items.map((item) => ({ ...item, done: Boolean(item.done) })));
        setDiagnosis((current) => ({
          ...current,
          reportedProblem: current.reportedProblem || request.description || "",
        }));
      }

      setMaintenancePlans((planRes.data || []) as DBMaintenancePlan[]);
    };

    loadDetails();
  }, [initialOS.equipment_id, initialOS.maintenance_request_id, initialOS]);

  const meterInfo = formatMeterLabel(equipment, Number(execution.executionMeter || 0));
  const cleanedParts = useMemo(
    () => parts.filter((part) => part.code?.trim() || part.description?.trim()),
    [parts],
  );
  const partsSubtotal = useMemo(
    () => cleanedParts.reduce((sum, part) => sum + getPartTotal(part), 0),
    [cleanedParts],
  );
  const laborCost = Number(closure.laborCost || 0);
  const closurePartsCost = Number(closure.partsCost || 0) || partsSubtotal;
  const totalCost = laborCost + closurePartsCost;
  const durationLabel = getDurationLabel(closure.startedAt || os.started_at, closure.completedAt || os.completed_at);
  const doneCount = requestItems.filter((item) => item.done).length;
  const currentMeterValue = Number(execution.executionMeter || 0);

  const syncPart = (index: number, field: keyof WorkOrderPart, value: string | number) => {
    setParts((current) => current.map((part, partIndex) => {
      if (partIndex !== index) return part;
      const next = { ...part, [field]: value };
      next.total_price = getPartTotal(next);
      return next;
    }));
  };

  const addPart = () => setParts((current) => [...current, { code: "", description: "", quantity: 1, unit_price: 0, total_price: 0 }]);
  const removePart = (index: number) => setParts((current) => current.filter((_, currentIndex) => currentIndex !== index));
  const toggleItemDone = (itemId: string) => setRequestItems((current) => current.map((item) => item.id === itemId ? { ...item, done: !item.done } : item));

  const refreshOS = async () => {
    const { data } = await supabase.from("work_orders").select("*").eq("id", os.id).single();
    if (data) {
      setOs(data as unknown as DBWorkOrder);
    }
  };

  const saveRequestItems = async (markAllDone = false) => {
    const nextItems = markAllDone ? requestItems.map((item) => ({ ...item, done: true })) : requestItems;
    await supabase.from("maintenance_requests").update({
      items: nextItems as unknown as never,
      status: markAllDone ? "done" : os.status === "in_progress" ? "in_progress" : "open",
      resolved_at: markAllDone ? new Date().toISOString() : null,
    }).eq("id", os.maintenance_request_id);
    if (markAllDone) setRequestItems(nextItems);
  };

  const buildPayload = (status: DBWorkOrder["status"], overrides: Partial<WorkOrderUpdatePayload> = {}): WorkOrderUpdatePayload => ({
    description: diagnosis.reportedProblem,
    mechanic_name: mechanicName || null,
    cause_identified: diagnosis.causeIdentified || null,
    maintenance_type: diagnosis.maintenanceType as DBWorkOrder["maintenance_type"],
    maintenance_plan_id: diagnosis.maintenanceType === "preventiva" && diagnosis.maintenancePlanId !== "none" ? diagnosis.maintenancePlanId : null,
    service_executed: execution.serviceExecuted || null,
    technical_observations: execution.technicalObservations || null,
    notes: execution.technicalObservations || null,
    execution_meter: currentMeterValue,
    parts: cleanedParts as unknown,
    part_code: cleanedParts.map((part) => part.code).filter(Boolean).join(", ") || null,
    photo_start_url: evidence.photoStartUrl || null,
    photo_end_url: evidence.photoEndUrl || null,
    labor_cost: laborCost,
    parts_cost: closurePartsCost,
    machine_released: closure.machineReleased,
    final_status: closure.finalStatus,
    status,
    ...overrides,
  });

  const handleSaveDraft = async () => {
    setSaving(true);
    await supabase.from("work_orders").update(buildPayload(os.status)).eq("id", os.id);
    await saveRequestItems(false);
    await refreshOS();
    setSaving(false);
    toast({ title: "OS atualizada", description: "As informações operacionais foram salvas." });
  };

  const handleStart = async () => {
    if (!mechanicName || !evidence.photoStartUrl) {
      toast({ title: "Preencha os dados obrigatórios", description: "Informe o mecânico e registre a foto inicial.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const startedAt = os.started_at || new Date().toISOString();
    setClosure((current) => ({ ...current, startedAt }));
    await supabase.from("work_orders").update(buildPayload("in_progress", { started_at: startedAt })).eq("id", os.id);
    await saveRequestItems(false);
    await refreshOS();
    setSaving(false);
    toast({ title: "Serviço iniciado", description: "A OS entrou em execução com rastreabilidade ativa." });
  };

  const handleComplete = async () => {
    if (!evidence.photoEndUrl || !closure.completedAt) {
      toast({ title: "Encerramento incompleto", description: "Registre a foto final e o horário de encerramento.", variant: "destructive" });
      return;
    }
    setSaving(true);
    await supabase.from("work_orders").update(buildPayload("done", {
      started_at: closure.startedAt || os.started_at || new Date().toISOString(),
      completed_at: closure.completedAt,
    })).eq("id", os.id);
    await saveRequestItems(true);
    await refreshOS();
    setSaving(false);
    toast({ title: "OS encerrada", description: "Histórico, plano preventivo e disponibilidade foram atualizados." });
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Voltar para a fila do mecânico
      </Button>

      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">OS #{os.os_number}</Badge>
                <Badge variant="outline" className={statusTone[os.status]}>{statusLabels[os.status]}</Badge>
                <Badge variant="outline" className="border-border bg-secondary/50 text-foreground">{priorityLabels[os.priority]}</Badge>
                {os.final_status && <Badge variant="outline" className={finalStatusTone[os.final_status]}>{finalStatusLabels[os.final_status]}</Badge>}
              </div>
              <CardTitle className="text-2xl font-black text-foreground">{equipment?.name || "Equipamento não localizado"}</CardTitle>
              <CardDescription>{diagnosis.reportedProblem || "Sem descrição informada"}</CardDescription>
            </div>
            <div className="grid min-w-[260px] gap-2 rounded-lg border border-border bg-secondary/20 p-4 text-sm">
              <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Abertura</span><span className="font-medium text-foreground">{formatDateTime(os.created_at)}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Obra / local</span><span className="text-right font-medium text-foreground">{obra?.name || "Sem obra"}{obra?.location ? ` • ${obra.location}` : ""}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">{meterInfo.label}</span><span className="font-medium text-foreground">{meterInfo.value.toLocaleString("pt-BR")} {meterInfo.unit}</span></div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-border bg-secondary/20 p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarClock className="h-4 w-4 text-primary" /> Início</div>
            <p className="mt-2 text-sm font-bold text-foreground">{formatDateTime(closure.startedAt || os.started_at)}</p>
          </div>
          <div className="rounded-lg border border-border bg-secondary/20 p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarClock className="h-4 w-4 text-primary" /> Encerramento</div>
            <p className="mt-2 text-sm font-bold text-foreground">{formatDateTime(closure.completedAt || os.completed_at)}</p>
          </div>
          <div className="rounded-lg border border-border bg-secondary/20 p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Timer className="h-4 w-4 text-primary" /> Tempo total</div>
            <p className="mt-2 text-sm font-bold text-foreground">{durationLabel}</p>
          </div>
          <div className="rounded-lg border border-border bg-secondary/20 p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><ReceiptText className="h-4 w-4 text-primary" /> Custo total</div>
            <p className="mt-2 text-sm font-bold text-foreground">{formatCurrency(totalCost)}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-black"><AlertTriangle className="h-4 w-4 text-primary" /> Diagnóstico</CardTitle>
              <CardDescription>Registre problema relatado, causa identificada e tipo da manutenção.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Problema relatado</Label>
                <Textarea value={diagnosis.reportedProblem} onChange={(e) => setDiagnosis((current) => ({ ...current, reportedProblem: e.target.value }))} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Causa identificada</Label>
                <Textarea value={diagnosis.causeIdentified} onChange={(e) => setDiagnosis((current) => ({ ...current, causeIdentified: e.target.value }))} rows={3} placeholder="Descreva a causa raiz encontrada" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tipo de manutenção</Label>
                  <Select value={diagnosis.maintenanceType} onValueChange={(value) => setDiagnosis((current) => ({ ...current, maintenanceType: value as typeof current.maintenanceType }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="corretiva">Corretiva</SelectItem>
                      <SelectItem value="preventiva">Preventiva</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Plano preventivo vinculado</Label>
                  <Select value={diagnosis.maintenancePlanId} onValueChange={(value) => setDiagnosis((current) => ({ ...current, maintenancePlanId: value }))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar plano" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum plano</SelectItem>
                      {maintenancePlans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>{plan.description}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-black"><Cog className="h-4 w-4 text-primary" /> Execução</CardTitle>
              <CardDescription>Controle operacional do mecânico, peças, serviços realizados e observações técnicas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome do mecânico</Label>
                  <Input value={mechanicName} onChange={(e) => setMechanicName(e.target.value)} placeholder="Responsável pela execução" />
                </div>
                <div className="space-y-2">
                  <Label>{meterInfo.label}</Label>
                  <Input type="number" value={execution.executionMeter} onChange={(e) => setExecution((current) => ({ ...current, executionMeter: e.target.value }))} inputMode="decimal" />
                </div>
              </div>

              {requestDetails && (
                <div className="space-y-3 rounded-lg border border-border bg-secondary/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-foreground">Itens do pedido</p>
                      <p className="text-xs text-muted-foreground">{doneCount}/{requestItems.length} itens executados</p>
                    </div>
                    <Badge variant="outline" className="border-border bg-background text-foreground">Pedido #{requestDetails.id.slice(0, 8)}</Badge>
                  </div>
                  <div className="space-y-2">
                    {requestItems.map((item) => (
                      <button key={item.id} type="button" onClick={() => toggleItemDone(item.id)} className={`flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${item.done ? "border-success/30 bg-success/10" : "border-border bg-background hover:border-primary/30"}`}>
                        <ClipboardList className={`mt-0.5 h-4 w-4 shrink-0 ${item.done ? "text-success" : "text-muted-foreground"}`} />
                        <div className="flex-1">
                          <p className={`text-sm ${item.done ? "text-muted-foreground line-through" : "text-foreground"}`}>{item.description}</p>
                          <p className="text-xs text-muted-foreground">Prioridade {priorityLabels[item.priority] || item.priority}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Label className="flex items-center gap-2 text-sm font-bold"><Package className="h-4 w-4 text-primary" /> Peças trocadas</Label>
                  <Button type="button" size="sm" variant="outline" className="gap-2" onClick={addPart}>
                    <Plus className="h-4 w-4" /> Adicionar peça
                  </Button>
                </div>
                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="w-[90px]">Qtd.</TableHead>
                        <TableHead className="w-[130px]">Valor unit.</TableHead>
                        <TableHead className="w-[130px]">Valor total</TableHead>
                        <TableHead className="w-[56px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parts.map((part, index) => (
                        <TableRow key={`${part.code}-${index}`}>
                          <TableCell><Input value={part.code} onChange={(e) => syncPart(index, "code", e.target.value)} placeholder="Código" /></TableCell>
                          <TableCell><Input value={part.description} onChange={(e) => syncPart(index, "description", e.target.value)} placeholder="Descrição" /></TableCell>
                          <TableCell><Input type="number" inputMode="decimal" value={part.quantity ?? 1} onChange={(e) => syncPart(index, "quantity", Number(e.target.value || 0))} /></TableCell>
                          <TableCell><Input type="number" inputMode="decimal" value={part.unit_price ?? 0} onChange={(e) => syncPart(index, "unit_price", Number(e.target.value || 0))} /></TableCell>
                          <TableCell className="font-bold text-foreground">{formatCurrency(getPartTotal(part))}</TableCell>
                          <TableCell>
                            {parts.length > 1 && (
                              <Button type="button" size="icon" variant="ghost" onClick={() => removePart(index)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Serviços realizados</Label>
                  <Textarea value={execution.serviceExecuted} onChange={(e) => setExecution((current) => ({ ...current, serviceExecuted: e.target.value }))} rows={5} placeholder="Descreva a execução da OS" />
                </div>
                <div className="space-y-2">
                  <Label>Observações técnicas</Label>
                  <Textarea value={execution.technicalObservations} onChange={(e) => setExecution((current) => ({ ...current, technicalObservations: e.target.value }))} rows={5} placeholder="Medições, regulagens, ajustes e observações" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-black"><ImageIcon className="h-4 w-4 text-primary" /> Evidências</CardTitle>
              <CardDescription>Registre as fotos de início e término para rastreabilidade visual.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3">
                <PhotoUpload label="Foto de início *" required onUploaded={(value) => setEvidence((current) => ({ ...current, photoStartUrl: value }))} value={evidence.photoStartUrl} />
                {evidence.photoStartUrl && <img src={evidence.photoStartUrl} alt="Registro inicial da manutenção" className="h-40 w-full rounded-lg border border-border object-cover" loading="lazy" />}
              </div>
              <Separator />
              <div className="space-y-3">
                <PhotoUpload label="Foto final *" required onUploaded={(value) => setEvidence((current) => ({ ...current, photoEndUrl: value }))} value={evidence.photoEndUrl} />
                {evidence.photoEndUrl && <img src={evidence.photoEndUrl} alt="Registro final da manutenção" className="h-40 w-full rounded-lg border border-border object-cover" loading="lazy" />}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-black"><ShieldCheck className="h-4 w-4 text-primary" /> Encerramento</CardTitle>
              <CardDescription>Fechamento operacional, custos, disponibilidade e situação final da máquina.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Data/hora de início</Label>
                  <Input type="datetime-local" value={(closure.startedAt || "").slice(0, 16)} onChange={(e) => setClosure((current) => ({ ...current, startedAt: e.target.value ? new Date(e.target.value).toISOString() : "" }))} />
                </div>
                <div className="space-y-2">
                  <Label>Data/hora de fim</Label>
                  <Input type="datetime-local" value={(closure.completedAt || "").slice(0, 16)} onChange={(e) => setClosure((current) => ({ ...current, completedAt: e.target.value ? new Date(e.target.value).toISOString() : "" }))} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Custo de peças</Label>
                  <Input type="number" inputMode="decimal" value={closure.partsCost} onChange={(e) => setClosure((current) => ({ ...current, partsCost: e.target.value }))} placeholder={String(partsSubtotal)} />
                </div>
                <div className="space-y-2">
                  <Label>Custo de mão de obra</Label>
                  <Input type="number" inputMode="decimal" value={closure.laborCost} onChange={(e) => setClosure((current) => ({ ...current, laborCost: e.target.value }))} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Status final operacional</Label>
                  <Select value={closure.finalStatus} onValueChange={(value) => setClosure((current) => ({ ...current, finalStatus: value as WorkOrderFinalStatus }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="concluida">Concluída</SelectItem>
                      <SelectItem value="aguardando_peca">Aguardando peça</SelectItem>
                      <SelectItem value="servico_externo">Serviço externo</SelectItem>
                      <SelectItem value="maquina_parada">Máquina parada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end justify-between rounded-lg border border-border bg-secondary/20 px-4 py-3">
                  <div>
                    <p className="text-sm font-bold text-foreground">Máquina liberada?</p>
                    <p className="text-xs text-muted-foreground">Define a disponibilidade operacional após o encerramento.</p>
                  </div>
                  <Switch checked={closure.machineReleased} onCheckedChange={(checked) => setClosure((current) => ({ ...current, machineReleased: checked }))} />
                </div>
              </div>

              <div className="rounded-lg border border-border bg-secondary/20 p-4 text-sm">
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Custo de peças</span><span className="font-bold text-foreground">{formatCurrency(closurePartsCost)}</span></div>
                <div className="mt-2 flex items-center justify-between gap-3"><span className="text-muted-foreground">Mão de obra</span><span className="font-bold text-foreground">{formatCurrency(laborCost)}</span></div>
                <Separator className="my-3" />
                <div className="flex items-center justify-between gap-3"><span className="text-foreground font-bold">Custo total da OS</span><span className="text-lg font-black text-primary">{formatCurrency(totalCost)}</span></div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-black"><Gauge className="h-4 w-4 text-primary" /> Ações operacionais</CardTitle>
              <CardDescription>Salve progresso, inicie execução ou conclua a OS com atualização automática do histórico.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full gap-2" onClick={handleSaveDraft} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar andamento
              </Button>
              {os.status === "open" && (
                <Button className="w-full gap-2" onClick={handleStart} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />} Iniciar execução da OS
                </Button>
              )}
              {os.status !== "done" && (
                <Button className="w-full gap-2 bg-success text-success-foreground hover:bg-success/90" onClick={handleComplete} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Concluir OS e atualizar histórico
                </Button>
              )}
              {os.status === "done" && (
                <div className="rounded-lg border border-success/30 bg-success/10 p-4 text-sm text-success">
                  OS encerrada com rastreabilidade completa. O histórico da máquina e o plano preventivo vinculado já foram atualizados automaticamente.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}