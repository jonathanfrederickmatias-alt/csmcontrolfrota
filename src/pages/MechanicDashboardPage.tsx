import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DBEquipment, DBWorkOrder } from "@/lib/supabase-types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Wrench, Loader2, CheckCircle, Clock, AlertTriangle, CalendarClock,
  ChevronRight, Filter, ClipboardList, UserRound, Building2
} from "lucide-react";
import { WorkOrderExecutionView } from "@/components/mechanic/WorkOrderExecutionView";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface WorkOrder {
  id: string;
  os_number: number;
  equipment_id: string;
  maintenance_request_id: string;
  description: string;
  priority: string;
  status: string;
  mechanic_name: string | null;
  notes: string | null;
  part_code: string | null;
  parts: Part[];
  photo_start_url: string | null;
  photo_end_url: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

const priorityLabels: Record<string, string> = {
  low: '🟢 Baixa',
  medium: '🟡 Média',
  high: '🟠 Alta',
  urgent: '🔴 Urgente',
};

const statusLabels: Record<string, string> = {
  open: 'Aberta',
  in_progress: 'Em andamento',
  done: 'Concluída',
};

const statusColors: Record<string, string> = {
  open: 'border-warning/30 bg-warning/10 text-warning',
  in_progress: 'border-primary/30 bg-primary/10 text-primary',
  done: 'border-success/30 bg-success/10 text-success',
};

export default function MechanicDashboardPage() {
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [equipments, setEquipments] = useState<Record<string, DBEquipment>>({});
  const [obras, setObras] = useState<Record<string, { id: string; name: string; location?: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [selectedOS, setSelectedOS] = useState<WorkOrder | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: woData }, { data: obraData }] = await Promise.all([
      supabase.from('work_orders').select('*').order('created_at', { ascending: false }),
      supabase.from('obras').select('id, name, location'),
    ]);

    const workOrders = (woData || []) as unknown as WorkOrder[];
    setOrders(workOrders);

    // Fetch all unique equipment ids
    const eqIds = [...new Set(workOrders.map(o => o.equipment_id))];
    if (eqIds.length > 0) {
      const { data: eqData } = await supabase
        .from('equipments')
        .select('*')
        .in('id', eqIds);
      const eqMap: Record<string, DBEquipment> = {};
      (eqData || []).forEach(eq => { eqMap[eq.id] = eq as unknown as DBEquipment; });
      setEquipments(eqMap);
    }
    const obraMap: Record<string, { id: string; name: string; location?: string | null }> = {};
    (obraData || []).forEach((obra) => { obraMap[obra.id] = obra; });
    setObras(obraMap);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filteredOrders = useMemo(() => orders.filter(o => {
    if (statusFilter === 'pending') return o.status === 'open' || o.status === 'in_progress';
    if (statusFilter === 'all') return true;
    return o.status === statusFilter;
  }), [orders, statusFilter]);

  const summary = useMemo(() => ({
    total: orders.length,
    open: orders.filter((order) => order.status === 'open').length,
    inProgress: orders.filter((order) => order.status === 'in_progress').length,
    done: orders.filter((order) => order.status === 'done').length,
  }), [orders]);

  if (selectedOS) {
    return (
      <WorkOrderExecutionView
        initialOS={selectedOS as unknown as DBWorkOrder}
        equipment={equipments[selectedOS.equipment_id] || null}
        obra={obras[equipments[selectedOS.equipment_id]?.obra_id || ''] || null}
        onBack={() => { setSelectedOS(null); fetchData(); }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
            <Wrench className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground">Painel do Mecânico</h1>
            <p className="text-sm text-muted-foreground">Fila operacional com leitura rápida, prioridade visual e execução rastreável.</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-4">
          <Card className="border-border/70 bg-card/95 shadow-sm"><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Total</p><p className="mt-2 text-2xl font-black text-foreground">{summary.total}</p></CardContent></Card>
          <Card className="border-border/70 bg-card/95 shadow-sm"><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Abertas</p><p className="mt-2 text-2xl font-black text-warning">{summary.open}</p></CardContent></Card>
          <Card className="border-border/70 bg-card/95 shadow-sm"><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Em execução</p><p className="mt-2 text-2xl font-black text-primary">{summary.inProgress}</p></CardContent></Card>
          <Card className="border-border/70 bg-card/95 shadow-sm sm:col-span-3 xl:col-span-1"><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Concluídas</p><p className="mt-2 text-2xl font-black text-success">{summary.done}</p></CardContent></Card>
        </div>
      </div>

      <div className="sticky top-0 z-10 rounded-lg border border-border/70 bg-background/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Filter className="h-4 w-4 text-primary" />
            Filtros operacionais
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-56">
            <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="open">Abertas</SelectItem>
              <SelectItem value="in_progress">Em andamento</SelectItem>
              <SelectItem value="done">Concluídas</SelectItem>
              <SelectItem value="all">Todas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{filteredOrders.length} OS encontrada{filteredOrders.length !== 1 ? 's' : ''}</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <CheckCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhuma OS encontrada.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map(order => {
            const eq = equipments[order.equipment_id];
            const obra = obras[eq?.obra_id || ''];
            return (
              <button
                key={order.id}
                onClick={() => setSelectedOS(order)}
                className="w-full rounded-lg border border-border/70 bg-card p-4 text-left shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-border bg-secondary/40 text-foreground">OS #{order.os_number}</Badge>
                      <Badge variant="outline" className={statusColors[order.status]}>
                        {statusLabels[order.status] || order.status}
                      </Badge>
                      <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
                        {priorityLabels[order.priority] || order.priority}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-base font-black text-foreground">{eq?.name || 'Equipamento não localizado'}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{order.description}</p>
                    </div>

                    <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                      <div className="flex items-center gap-2"><ClipboardList className="h-3.5 w-3.5 text-primary" /><span>{order.mechanic_name || 'Sem mecânico'}</span></div>
                      <div className="flex items-center gap-2"><CalendarClock className="h-3.5 w-3.5 text-primary" /><span>{new Date(order.created_at).toLocaleDateString('pt-BR')}</span></div>
                      <div className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5 text-primary" /><span>{obra?.name || 'Sem obra'}</span></div>
                      <div className="flex items-center gap-2"><UserRound className="h-3.5 w-3.5 text-primary" /><span>{eq?.plate || eq?.cost_center || 'Sem identificação'}</span></div>
                    </div>

                    {order.status === 'in_progress' && order.started_at && (
                      <div className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs text-primary">
                        <Clock className="w-3.5 h-3.5" />
                        Iniciada em {new Date(order.started_at).toLocaleString('pt-BR')}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3 self-center">
                    <div className="hidden text-right text-xs text-muted-foreground sm:block">
                      <p className="font-medium text-foreground">Abrir execução</p>
                      <p>Detalhes completos da OS</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
    return (
      <div>
        <Button variant="ghost" onClick={onBack} className="mb-4 gap-2">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
        <div className="glass-card rounded-xl p-8 text-center">
          <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
          <h2 className="text-xl font-bold text-success">OS #{os.os_number} Concluída!</h2>
          {os.mechanic_name && <p className="text-sm text-muted-foreground mt-2">Mecânico: <strong>{os.mechanic_name}</strong></p>}
          {os.started_at && <p className="text-sm text-muted-foreground">Início: {new Date(os.started_at).toLocaleString('pt-BR')}</p>}
          {os.completed_at && <p className="text-sm text-success">Término: {new Date(os.completed_at).toLocaleString('pt-BR')}</p>}

          {requestItems.length > 0 && (
            <div className="mt-4 text-left">
              <p className="text-xs text-muted-foreground font-semibold mb-2">Itens do Pedido ({requestItems.length})</p>
              <div className="space-y-1.5">
                {requestItems.map(item => (
                  <div key={item.id} className="bg-success/10 rounded-lg px-3 py-2 text-sm flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-success shrink-0" />
                    <span>{item.description}</span>
                    <span className="ml-auto text-xs">{priorityLabels[item.priority] || item.priority}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {doneParts.length > 0 && (
            <div className="mt-4 text-left">
              <p className="text-xs text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" /> Peças Trocadas ({doneParts.length})
              </p>
              <div className="space-y-1.5">
                {doneParts.map((p, i) => (
                  <div key={i} className="bg-secondary/50 rounded-lg px-3 py-2 text-sm">
                    <span className="font-mono font-bold text-primary">{p.code || '—'}</span>
                    {p.description && <span className="text-muted-foreground ml-2">— {p.description}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mt-4">
            {os.photo_start_url && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Foto Início</p>
                <img src={os.photo_start_url} alt="Início" className="w-full h-32 object-cover rounded-lg border border-border" />
              </div>
            )}
            {os.photo_end_url && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Foto Término</p>
                <img src={os.photo_end_url} alt="Término" className="w-full h-32 object-cover rounded-lg border border-border" />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Active/Open form ──
  return (
    <div>
      <Button variant="ghost" onClick={onBack} className="mb-4 gap-2">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Button>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Wrench className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-black text-gradient">OS #{os.os_number}</h1>
          <Badge variant="outline" className={statusColors[os.status]}>
            {statusLabels[os.status]}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm">{os.description}</p>
        {equipment && <p className="text-xs text-muted-foreground mt-1">Equipamento: <strong>{equipment.name}</strong></p>}
        <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full font-medium bg-secondary text-muted-foreground">
          {priorityLabels[os.priority] || os.priority}
        </span>
      </div>

      <div className="glass-card rounded-xl p-5 space-y-4">
        {/* Request items checklist */}
        {requestItems.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-base font-bold">Itens do Pedido</Label>
              <span className="text-xs text-muted-foreground">{doneCount}/{requestItems.length} concluídos</span>
            </div>
            <div className="space-y-2">
              {requestItems.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => isInProgress && toggleItemDone(item.id)}
                  className={`w-full text-left border rounded-lg p-3 flex items-start gap-3 transition-colors ${
                    item.done
                      ? 'bg-success/10 border-success/30'
                      : 'bg-background/50 border-border hover:border-primary/30'
                  } ${!isInProgress ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  {item.done ? (
                    <CheckSquare className="w-5 h-5 text-success shrink-0 mt-0.5" />
                  ) : (
                    <SquareIcon className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${item.done ? 'line-through text-muted-foreground' : ''}`}>{item.description}</p>
                    <span className="text-xs text-muted-foreground">{priorityLabels[item.priority] || item.priority}</span>
                  </div>
                </button>
              ))}
            </div>
            {!isInProgress && (
              <p className="text-xs text-muted-foreground mt-2 italic">Inicie o serviço para marcar itens como concluídos.</p>
            )}
          </div>
        )}

        {/* Mechanic name */}
        <div>
          <Label>Nome do Mecânico *</Label>
          <Input value={mechanicName} onChange={e => setMechanicName(e.target.value)} placeholder="Seu nome" disabled={isInProgress && !!os.mechanic_name} />
        </div>

        {/* Parts */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="flex items-center gap-1.5"><Package className="w-4 h-4" /> Peças Trocadas</Label>
            <Button type="button" variant="outline" size="sm" onClick={addPart} className="gap-1 text-xs h-7">
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </Button>
          </div>
          <div className="space-y-2">
            {parts.map((part, index) => (
              <div key={index} className="flex gap-2 items-start">
                <div className="flex-1 space-y-1.5">
                  <Input value={part.code} onChange={e => updatePart(index, 'code', e.target.value)} placeholder="Código (ex: RLM-4520)" className="h-9 text-sm" />
                  <Input value={part.description} onChange={e => updatePart(index, 'description', e.target.value)} placeholder="Descrição da peça" className="h-9 text-sm" />
                </div>
                {parts.length > 1 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => removePart(index)} className="h-9 w-9 p-0 text-destructive hover:text-destructive shrink-0 mt-0">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <Label>Observações</Label>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Detalhes do serviço..." rows={3} />
        </div>

        {/* START phase */}
        {!isInProgress && (
          <>
            <div className="border-t border-border pt-4">
              <p className="text-sm font-semibold flex items-center gap-2 mb-3">
                <Play className="w-4 h-4 text-primary" /> Início do Serviço
              </p>
              <PhotoUpload label="Foto de Início do Serviço *" required onUploaded={setPhotoStartUrl} value={photoStartUrl} />
            </div>
            <Button onClick={handleStartService} disabled={!mechanicName || !photoStartUrl || saving} className="w-full h-12 text-base font-bold">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Play className="w-5 h-5 mr-2" /> Iniciar Serviço
            </Button>
          </>
        )}

        {/* COMPLETION phase */}
        {isInProgress && (
          <>
            {os.photo_start_url && (
              <div className="border-t border-border pt-4">
                <p className="text-xs text-muted-foreground mb-1">Foto de Início</p>
                <img src={os.photo_start_url} alt="Início" className="w-full h-32 object-cover rounded-lg border border-border" />
                <p className="text-xs text-muted-foreground mt-1">
                  Iniciado em: {os.started_at ? new Date(os.started_at).toLocaleString('pt-BR') : '—'}
                </p>
              </div>
            )}

            {requestItems.length > 0 && doneCount > 0 && !requestItems.every(i => i.done) && (
              <Button
                type="button" variant="outline"
                onClick={async () => { setSaving(true); await saveItemsStatus(); setSaving(false); }}
                disabled={saving} className="w-full gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                <CheckSquare className="w-4 h-4" /> Salvar Progresso ({doneCount}/{requestItems.length})
              </Button>
            )}

            <div className="border-t border-border pt-4">
              <p className="text-sm font-semibold flex items-center gap-2 mb-3">
                <Square className="w-4 h-4 text-success" /> Término do Serviço
              </p>
              <PhotoUpload label="Foto de Término do Serviço *" required onUploaded={setPhotoEndUrl} value={photoEndUrl} />
            </div>
            <Button
              onClick={handleCompleteService}
              disabled={!photoEndUrl || saving}
              className="w-full h-12 text-base font-bold bg-success hover:bg-success/90 text-success-foreground"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <CheckCircle className="w-5 h-5 mr-2" /> Finalizar e Dar Baixa
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
