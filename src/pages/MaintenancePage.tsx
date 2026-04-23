import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DBEquipment, DBMaintenancePlan, DBMaintenanceRequest, DBMaintenanceHistory, DBWorkOrder } from "@/lib/supabase-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Wrench, AlertTriangle, CheckCircle, Trash2, Edit2, Loader2, Camera, ClipboardList, History, FileSpreadsheet, FileText, Clipboard } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import PhotoUpload from "@/components/PhotoUpload";
import * as XLSX from 'xlsx';
import { exportMaintenancePlansPDF, exportMaintenanceRequestsPDF, exportMaintenanceHistoryPDF, exportWorkOrdersPDF, PlanHistoryRow } from '@/lib/pdf-export';
import { calculateMaintenanceStatus } from '@/lib/maintenance-utils';
import { useUserRoles } from '@/hooks/useUserRoles';
import { PremiumOsWorkspace } from '@/components/maintenance/PremiumOsWorkspace';
import { getEquipmentDisplayName } from '@/lib/equipment-display';

function eqLabel(eq: DBEquipment): string {
  return getEquipmentDisplayName(eq);
}

const statusConfig = {
  ok: { color: 'text-success', bg: 'bg-success/10', border: 'border-l-success', label: 'OK' },
  approaching: { color: 'text-warning', bg: 'bg-warning/10', border: 'border-l-warning', label: 'Próxima' },
  overdue: { color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-l-destructive', label: 'Atrasada' },
};

const requestStatusConfig = {
  open: { label: 'Aberto', bg: 'bg-secondary text-muted-foreground' },
  in_progress: { label: 'Em andamento', bg: 'bg-primary/15 text-primary' },
  done: { label: 'Concluído', bg: 'bg-success/15 text-success' },
};

const priorityConfig = {
  low: { label: 'Baixa', bg: 'bg-secondary text-muted-foreground' },
  medium: { label: 'Média', bg: 'bg-primary/15 text-primary' },
  high: { label: 'Alta', bg: 'bg-warning/20 text-warning' },
  urgent: { label: 'Urgente', bg: 'bg-destructive/20 text-destructive' },
};
const osStatusConfig = {
  open: { label: 'Aberta', bg: 'bg-secondary text-muted-foreground' },
  in_progress: { label: 'Em andamento', bg: 'bg-primary/15 text-primary' },
  done: { label: 'Concluída', bg: 'bg-success/15 text-success' },
};

export default function MaintenancePage() {
  const [searchParams] = useSearchParams();
  const { isAdmin, isGestor } = useUserRoles();
  const canEdit = isAdmin || isGestor;
  const [plans, setPlans] = useState<DBMaintenancePlan[]>([]);
  const [requests, setRequests] = useState<DBMaintenanceRequest[]>([]);
  const [equipments, setEquipments] = useState<DBEquipment[]>([]);
  const [history, setHistory] = useState<DBMaintenanceHistory[]>([]);
  const [workOrders, setWorkOrders] = useState<DBWorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<DBMaintenancePlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ equipmentId: '', description: '', intervalHours: '', lastDoneAt: '' });

  // History dialog
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyForm, setHistoryForm] = useState({ equipmentId: '', description: '', hourMeter: '', notes: '', operatorName: '' });
  const [historySaving, setHistorySaving] = useState(false);

  // History filter
  const [historyFilter, setHistoryFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [requestFilter, setRequestFilter] = useState('all');
  const [osFilter, setOsFilter] = useState('all');
  const [planStatusFilter, setPlanStatusFilter] = useState('all');
  const [requestStatusFilter, setRequestStatusFilter] = useState('all');
  const [osStatusFilter, setOsStatusFilter] = useState('all');
  // Photo dialog state
  const [photoDialog, setPhotoDialog] = useState<{ requestId: string; targetStatus: 'in_progress' | 'done'; label: string } | null>(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoSaving, setPhotoSaving] = useState(false);

  // Edit request dialog
  const [editRequest, setEditRequest] = useState<DBMaintenanceRequest | null>(null);
  const [reqEditForm, setReqEditForm] = useState({ description: '', priority: '', operator_name: '', notes: '' });

  // Edit OS dialog
  const [editOS, setEditOS] = useState<DBWorkOrder | null>(null);
  const [osEditForm, setOsEditForm] = useState({ description: '', priority: '', mechanic_name: '', notes: '' });

  // Edit history dialog
  const [editHistory, setEditHistory] = useState<DBMaintenanceHistory | null>(null);
  const [histEditForm, setHistEditForm] = useState({ description: '', hour_meter: '', operator_name: '', notes: '' });

  // Closure dialog (dar baixa na OS)
  const [closureOS, setClosureOS] = useState<DBWorkOrder | null>(null);
  const [closureForm, setClosureForm] = useState({ invoice_number: '', service_executed: '', mechanic_name: '', notes: '', labor_cost: '', parts_cost: '', photo_start_url: '', photo_end_url: '' });

  // PDF history filter dialog
  const [pdfHistoryDialog, setPdfHistoryDialog] = useState(false);
  const [pdfHistoryFrom, setPdfHistoryFrom] = useState('');
  const [pdfHistoryTo, setPdfHistoryTo] = useState('');
  const [pdfExporting, setPdfExporting] = useState(false);

  // New OS dialog
  const [newOsOpen, setNewOsOpen] = useState(false);
  const [newOsForm, setNewOsForm] = useState({ equipmentId: '', description: '', priority: 'medium', operator_name: '' });
  const [newOsSaving, setNewOsSaving] = useState(false);

  // Controlled tab
  const [activeTab, setActiveTab] = useState('plans');

  useEffect(() => {
    const requestedTab = searchParams.get('tab');
    if (requestedTab && ['os', 'plans', 'requests', 'history'].includes(requestedTab)) {
      setActiveTab(requestedTab);
    }
  }, [searchParams]);

  const fetchAll = async () => {
    const [eqRes, plRes, reqRes, histRes, osRes] = await Promise.all([
      supabase.from('equipments').select('*').order('name'),
      supabase.from('maintenance_plans').select('*').order('status'),
      supabase.from('maintenance_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('maintenance_history').select('*').order('executed_at', { ascending: false }).limit(200),
      supabase.from('work_orders').select('*').order('created_at', { ascending: false }),
    ]);
    setEquipments((eqRes.data || []) as DBEquipment[]);
    setPlans((plRes.data || []) as DBMaintenancePlan[]);
    setRequests((reqRes.data || []) as unknown as DBMaintenanceRequest[]);
    setHistory((histRes.data || []) as DBMaintenanceHistory[]);
    setWorkOrders((osRes.data || []) as DBWorkOrder[]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleSave = async () => {
    setSaving(true);
    const lastDone = Number(form.lastDoneAt);
    const interval = Number(form.intervalHours);
    const eq = equipments.find(e => e.id === form.equipmentId);
    const currentHM = eq?.current_hour_meter || 0;
    const eqType = eq?.type || 'machine';
    const nextDue = lastDone + interval;
    const remaining = nextDue - currentHM;
    const status = calculateMaintenanceStatus(remaining, eqType);

    if (editPlan) {
      await supabase.from('maintenance_plans').update({
        equipment_id: form.equipmentId,
        description: form.description,
        interval_hours: interval,
        last_done_at: lastDone,
        next_due_at: nextDue,
        status,
      }).eq('id', editPlan.id);
      toast({ title: 'Plano atualizado com sucesso!' });
    } else {
      await supabase.from('maintenance_plans').insert({
        equipment_id: form.equipmentId,
        description: form.description,
        interval_hours: interval,
        last_done_at: lastDone,
        next_due_at: nextDue,
        status,
      });
      toast({ title: 'Plano criado com sucesso!' });
    }

    setSaving(false);
    setOpen(false);
    setEditPlan(null);
    setForm({ equipmentId: '', description: '', intervalHours: '', lastDoneAt: '' });
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('maintenance_plans').delete().eq('id', id);
    fetchAll();
  };

  const handleComplete = async (plan: DBMaintenancePlan) => {
    const eq = equipments.find(e => e.id === plan.equipment_id);
    const currentHM = eq?.current_hour_meter || 0;

    // Save to history
    await supabase.from('maintenance_history').insert({
      equipment_id: plan.equipment_id,
      plan_id: plan.id,
      description: plan.description,
      hour_meter: currentHM,
    });

    // Update plan
    await supabase.from('maintenance_plans').update({
      last_done_at: currentHM,
      next_due_at: currentHM + plan.interval_hours,
      status: 'ok',
      last_executed_at: new Date().toISOString(),
    }).eq('id', plan.id);

    toast({ title: 'Manutenção concluída e registrada no histórico!', description: `Próxima em ${currentHM + plan.interval_hours}h` });
    fetchAll();
  };

  const handleEditPlan = (plan: DBMaintenancePlan) => {
    setEditPlan(plan);
    setForm({
      equipmentId: plan.equipment_id,
      description: plan.description,
      intervalHours: String(plan.interval_hours),
      lastDoneAt: String(plan.last_done_at),
    });
    setOpen(true);
  };

  const handleSaveHistory = async () => {
    setHistorySaving(true);
    await supabase.from('maintenance_history').insert({
      equipment_id: historyForm.equipmentId,
      description: historyForm.description,
      hour_meter: Number(historyForm.hourMeter),
      notes: historyForm.notes || null,
      operator_name: historyForm.operatorName || null,
    });
    setHistorySaving(false);
    setHistoryOpen(false);
    setHistoryForm({ equipmentId: '', description: '', hourMeter: '', notes: '', operatorName: '' });
    toast({ title: 'Registro de manutenção adicionado!' });
    fetchAll();
  };

  const handleRequestStatusChange = (id: string, newStatus: string) => {
    if (newStatus === 'in_progress') {
      setPhotoDialog({ requestId: id, targetStatus: 'in_progress', label: 'Foto de Início do Serviço' });
      setPhotoUrl('');
    } else if (newStatus === 'done') {
      setPhotoDialog({ requestId: id, targetStatus: 'done', label: 'Foto de Término do Serviço' });
      setPhotoUrl('');
    } else {
      updateRequestStatus(id, newStatus as any);
    }
  };

  const updateRequestStatus = async (id: string, status: DBMaintenanceRequest['status'], photoField?: string, photoValue?: string) => {
    const update: any = { status };
    if (status === 'done') update.resolved_at = new Date().toISOString();
    if (photoField && photoValue) update[photoField] = photoValue;
    await supabase.from('maintenance_requests').update(update).eq('id', id);
    toast({ title: 'Status do pedido atualizado!' });
    fetchAll();
  };

  const handlePhotoConfirm = async () => {
    if (!photoDialog || !photoUrl) return;
    setPhotoSaving(true);
    const photoField = photoDialog.targetStatus === 'in_progress' ? 'photo_start_url' : 'photo_end_url';
    await updateRequestStatus(photoDialog.requestId, photoDialog.targetStatus, photoField, photoUrl);
    setPhotoSaving(false);
    setPhotoDialog(null);
    setPhotoUrl('');
  };

  const sortedPlans = [...plans].sort((a, b) => {
    const order = { overdue: 0, approaching: 1, ok: 2 };
    return order[a.status] - order[b.status];
  });

  const filteredPlans = sortedPlans
    .filter(p => planFilter === 'all' || p.equipment_id === planFilter)
    .filter(p => planStatusFilter === 'all' || p.status === planStatusFilter);
  const filteredRequests = requests
    .filter(r => requestFilter === 'all' || r.equipment_id === requestFilter)
    .filter(r => requestStatusFilter === 'all' || r.status === requestStatusFilter);
  const filteredHistory = historyFilter === 'all' ? history : history.filter(h => h.equipment_id === historyFilter);
  const filteredOrders = workOrders
    .filter(o => osFilter === 'all' || o.equipment_id === osFilter)
    .filter(o => osStatusFilter === 'all' || o.status === osStatusFilter);

  const handleOsStatusChange = async (os: DBWorkOrder, newStatus: string) => {
    if (newStatus === 'done') {
      setClosureOS(os);
      setClosureForm({
        invoice_number: (os as any).invoice_number || '',
        service_executed: (os as any).service_executed || '',
        labor_cost: (os as any).labor_cost ? String((os as any).labor_cost) : '',
        parts_cost: (os as any).parts_cost ? String((os as any).parts_cost) : '',
        mechanic_name: os.mechanic_name || '',
        notes: os.notes || '',
        photo_start_url: (os as any).photo_start_url || '',
        photo_end_url: (os as any).photo_end_url || '',
      });
      return;
    }
    const update: any = { status: newStatus };
    if (newStatus === 'in_progress') update.started_at = new Date().toISOString();
    if (newStatus === 'open') {
      update.started_at = null;
      update.completed_at = null;
    }
    await supabase.from('work_orders').update(update).eq('id', os.id);

    // Se a OS estava concluída e está sendo reaberta, reabrir também o pedido vinculado
    if (os.status === 'done' && (newStatus === 'open' || newStatus === 'in_progress')) {
      await supabase.from('maintenance_requests').update({
        status: newStatus === 'open' ? 'open' : 'in_progress',
        resolved_at: null,
      }).eq('id', os.maintenance_request_id);
    }

    toast({ title: 'Status da OS atualizado!' });
    fetchAll();
  };

  const handleClosureConfirm = async () => {
    if (!closureOS) return;
    const update: any = {
      status: 'done',
      completed_at: new Date().toISOString(),
      invoice_number: closureForm.invoice_number || null,
      service_executed: closureForm.service_executed || null,
      mechanic_name: closureForm.mechanic_name || null,
      notes: closureForm.notes || null,
      labor_cost: closureForm.labor_cost ? Number(closureForm.labor_cost) : 0,
      parts_cost: closureForm.parts_cost ? Number(closureForm.parts_cost) : 0,
      photo_start_url: closureForm.photo_start_url || null,
      photo_end_url: closureForm.photo_end_url || null,
    };
    await supabase.from('work_orders').update(update).eq('id', closureOS.id);
    toast({ title: 'OS concluída com sucesso!' });
    setClosureOS(null);
    fetchAll();
  };

  const handleOsMechanicChange = async (os: DBWorkOrder, mechanic: string) => {
    await supabase.from('work_orders').update({ mechanic_name: mechanic }).eq('id', os.id);
    fetchAll();
  };

  // Edit request handlers
  const openEditRequest = (r: DBMaintenanceRequest) => {
    setEditRequest(r);
    setReqEditForm({ description: r.description, priority: r.priority, operator_name: r.operator_name, notes: r.notes || '' });
  };
  const handleSaveEditRequest = async () => {
    if (!editRequest) return;
    await supabase.from('maintenance_requests').update({
      description: reqEditForm.description,
      priority: reqEditForm.priority,
      operator_name: reqEditForm.operator_name,
      notes: reqEditForm.notes || null,
    }).eq('id', editRequest.id);
    toast({ title: 'Pedido atualizado!' });
    setEditRequest(null);
    fetchAll();
  };

  // Edit OS handlers
  const openEditOS = (os: DBWorkOrder) => {
    setEditOS(os);
    setOsEditForm({ description: os.description, priority: os.priority, mechanic_name: os.mechanic_name || '', notes: os.notes || '' });
  };
  const handleSaveEditOS = async () => {
    if (!editOS) return;
    await supabase.from('work_orders').update({
      description: osEditForm.description,
      priority: osEditForm.priority,
      mechanic_name: osEditForm.mechanic_name || null,
      notes: osEditForm.notes || null,
    }).eq('id', editOS.id);
    toast({ title: 'OS atualizada!' });
    setEditOS(null);
    fetchAll();
  };

  // Edit history handlers
  const openEditHistory = (h: DBMaintenanceHistory) => {
    setEditHistory(h);
    setHistEditForm({ description: h.description, hour_meter: String(h.hour_meter), operator_name: h.operator_name || '', notes: h.notes || '' });
  };
  const handleSaveEditHistory = async () => {
    if (!editHistory) return;
    await supabase.from('maintenance_history').update({
      description: histEditForm.description,
      hour_meter: Number(histEditForm.hour_meter),
      operator_name: histEditForm.operator_name || null,
      notes: histEditForm.notes || null,
    }).eq('id', editHistory.id);
    toast({ title: 'Registro atualizado!' });
    setEditHistory(null);
    fetchAll();
  };

  const handleCreateOS = async () => {
    if (!newOsForm.equipmentId || !newOsForm.description) return;
    setNewOsSaving(true);
    // Create maintenance request first (required by work_orders FK)
    const { data: reqData, error: reqErr } = await supabase.from('maintenance_requests').insert({
      equipment_id: newOsForm.equipmentId,
      description: newOsForm.description,
      priority: newOsForm.priority,
      operator_name: newOsForm.operator_name || 'Sistema',
      status: 'open',
    }).select().single();

    if (reqErr || !reqData) {
      toast({ title: 'Erro ao criar pedido vinculado', variant: 'destructive' });
      setNewOsSaving(false);
      return;
    }

    // Create work order
    const { error: osErr } = await supabase.from('work_orders').insert({
      equipment_id: newOsForm.equipmentId,
      maintenance_request_id: reqData.id,
      description: newOsForm.description,
      priority: newOsForm.priority,
      status: 'open',
    });

    if (osErr) {
      toast({ title: 'Erro ao criar OS', variant: 'destructive' });
    } else {
      toast({ title: 'OS criada com sucesso!' });
      setNewOsOpen(false);
      setNewOsForm({ equipmentId: '', description: '', priority: 'medium', operator_name: '' });
    }
    setNewOsSaving(false);
    fetchAll();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-gradient">Manutenção</h1>
        <p className="text-muted-foreground mt-1">Planos preventivos, pedidos e histórico</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="os" className="gap-1.5"><Clipboard className="w-4 h-4" /> OS</TabsTrigger>
          <TabsTrigger value="plans" className="gap-1.5"><Wrench className="w-4 h-4" /> Planos</TabsTrigger>
          <TabsTrigger value="requests" className="gap-1.5"><AlertTriangle className="w-4 h-4" /> Pedidos</TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5"><History className="w-4 h-4" /> Histórico</TabsTrigger>
        </TabsList>

        {/* ===== ORDENS DE SERVIÇO ===== */}
        <TabsContent value="os" className="space-y-4 mt-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : filteredOrders.length === 0 ? (
            <div className="glass-card rounded-xl p-12 text-center">
              <Clipboard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhuma OS registrada. As OS são geradas automaticamente ao criar um pedido de manutenção.</p>
            </div>
          ) : (
            <PremiumOsWorkspace
              equipments={equipments}
              filteredOrders={filteredOrders}
              canEdit={canEdit}
              osFilter={osFilter}
              osStatusFilter={osStatusFilter}
              onOsFilterChange={setOsFilter}
              onOsStatusFilterChange={setOsStatusFilter}
              onOpenExecution={(os) => {
                const url = `${window.location.origin}/qr/mecanico?id=${os.id}`;
                window.open(url, '_blank');
              }}
              onOpenEdit={(os) => openEditOS(os)}
              onAssignMechanic={(os) => openEditOS(os)}
              priorityConfig={priorityConfig}
              osStatusConfig={osStatusConfig}
              renderToolbar={(
                <>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => {
                    const wb = XLSX.utils.book_new();
                    const data = filteredOrders.map(o => {
                      const eq = equipments.find(e => e.id === o.equipment_id);
                      return {
                        'OS #': o.os_number,
                        Equipamento: eq ? eqLabel(eq) : '—',
                        Descrição: o.description,
                        Prioridade: priorityConfig[o.priority]?.label || o.priority,
                        Status: osStatusConfig[o.status]?.label || o.status,
                        Mecânico: o.mechanic_name || '—',
                        'Data Abertura': new Date(o.created_at).toLocaleDateString('pt-BR'),
                        Início: o.started_at ? new Date(o.started_at).toLocaleDateString('pt-BR') : '—',
                        Conclusão: o.completed_at ? new Date(o.completed_at).toLocaleDateString('pt-BR') : '—',
                      };
                    });
                    const ws = XLSX.utils.json_to_sheet(data);
                    XLSX.utils.book_append_sheet(wb, ws, 'Ordens de Serviço');
                    const filterName = osFilter === 'all' ? '' : `_${equipments.find(e => e.id === osFilter)?.name || ''}`;
                    XLSX.writeFile(wb, `Ordens_Servico${filterName}.xlsx`);
                  }}>
                    <FileSpreadsheet className="w-4 h-4 text-success" /> Excel
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => {
                    const filterName = osFilter === 'all' ? 'Todos' : equipments.find(e => e.id === osFilter)?.name || 'Filtrado';
                    const selectedEq = osFilter !== 'all' ? equipments.find(e => e.id === osFilter) : undefined;
                    const eqDetails = selectedEq ? {
                      name: selectedEq.name,
                      plate: selectedEq.plate || undefined,
                      model: selectedEq.model || undefined,
                      brand: selectedEq.brand || undefined,
                      costCenter: selectedEq.cost_center || undefined,
                      year: selectedEq.year || undefined,
                      currentHourMeter: selectedEq.current_hour_meter,
                    } : undefined;
                    const rows = filteredOrders.map(o => {
                      const eq = equipments.find(e => e.id === o.equipment_id);
                      return {
                        osNumber: o.os_number,
                        equipment: eq ? eqLabel(eq) : '—',
                        description: o.description,
                        priority: priorityConfig[o.priority]?.label || o.priority,
                        status: osStatusConfig[o.status]?.label || o.status,
                        mechanic: o.mechanic_name || '—',
                        parts: (() => {
                          const p = Array.isArray((o as any).parts) ? (o as any).parts : [];
                          if (p.length > 0) return p.map((x: any) => x.code + (x.description ? ` (${x.description})` : '')).join(', ');
                          return (o as any).part_code || '—';
                        })(),
                        date: new Date(o.created_at).toLocaleDateString('pt-BR'),
                        startedAt: o.started_at ? new Date(o.started_at).toLocaleDateString('pt-BR') : undefined,
                        completedAt: o.completed_at ? new Date(o.completed_at).toLocaleDateString('pt-BR') : undefined,
                      };
                    });
                    exportWorkOrdersPDF(rows, filterName, eqDetails);
                  }}>
                    <FileText className="w-4 h-4 text-primary" /> PDF
                  </Button>
                  {canEdit && (
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => {
                      const url = `${window.location.origin}/qr/mecanico`;
                      window.open(url, '_blank');
                    }}>
                      <Wrench className="w-4 h-4" /> Tela Mecânico
                    </Button>
                  )}
                  {canEdit && (
                    <Button size="sm" className="gap-2" onClick={() => setNewOsOpen(true)}>
                      <Plus className="w-4 h-4" /> Nova OS
                    </Button>
                  )}
                </>
              )}
            />
          )}
        </TabsContent>

        {/* ===== PLANOS ===== */}
        <TabsContent value="plans" className="space-y-4 mt-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger className="w-64"><SelectValue placeholder="Filtrar por equipamento" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os equipamentos</SelectItem>
                  {equipments.map(eq => <SelectItem key={eq.id} value={eq.id}>{eqLabel(eq)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={planStatusFilter} onValueChange={setPlanStatusFilter}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Filtrar por status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="ok">OK</SelectItem>
                  <SelectItem value="approaching">Próxima</SelectItem>
                  <SelectItem value="overdue">Atrasada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => {
                const wb = XLSX.utils.book_new();
                const data = filteredPlans.map(p => {
                  const eq = equipments.find(e => e.id === p.equipment_id);
                  return {
                    Equipamento: eq ? eqLabel(eq) : '—', Descrição: p.description,
                    'Intervalo (h)': p.interval_hours, 'Próxima (h)': p.next_due_at,
                    'Última feita (h)': p.last_done_at,
                    Status: p.status === 'ok' ? 'OK' : p.status === 'approaching' ? 'Próxima' : 'Atrasada',
                    'Última execução': p.last_executed_at ? new Date(p.last_executed_at).toLocaleDateString('pt-BR') : '—',
                  };
                });
                const ws = XLSX.utils.json_to_sheet(data);
                XLSX.utils.book_append_sheet(wb, ws, 'Planos Manutenção');
                const filterName = planFilter === 'all' ? '' : `_${equipments.find(e => e.id === planFilter)?.name || ''}`;
                XLSX.writeFile(wb, `Planos_Manutencao${filterName}.xlsx`);
              }}>
                <FileSpreadsheet className="w-4 h-4 text-success" /> Excel
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setPdfHistoryDialog(true)}>
                <FileText className="w-4 h-4 text-primary" /> PDF
              </Button>
            {canEdit && (
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditPlan(null); setForm({ equipmentId: '', description: '', intervalHours: '', lastDoneAt: '' }); } }}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="w-4 h-4" /> Novo Plano</Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader><DialogTitle>{editPlan ? 'Editar Plano' : 'Novo Plano de Manutenção'}</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>Equipamento *</Label>
                    <Select value={form.equipmentId} onValueChange={v => setForm({...form, equipmentId: v})}>
                      <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                      <SelectContent>{equipments.map(eq => <SelectItem key={eq.id} value={eq.id}>{eqLabel(eq)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Descrição *</Label><Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Ex: Troca de óleo" /></div>
                  <div><Label>Intervalo (horas) *</Label><Input type="number" value={form.intervalHours} onChange={e => setForm({...form, intervalHours: e.target.value})} placeholder="Ex: 500" /></div>
                  <div><Label>Última feita em (horímetro) *</Label><Input type="number" value={form.lastDoneAt} onChange={e => setForm({...form, lastDoneAt: e.target.value})} placeholder="Ex: 1000" /></div>
                  <Button onClick={handleSave} disabled={!form.equipmentId || !form.description || !form.intervalHours || !form.lastDoneAt || saving} className="w-full">
                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{editPlan ? 'Salvar alterações' : 'Salvar'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            )}
            </div>
          </div>

          <div id="plans-content">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : filteredPlans.length === 0 ? (
            <div className="glass-card rounded-xl p-12 text-center">
              <Wrench className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">{planFilter === 'all' ? 'Nenhum plano de manutenção cadastrado.' : 'Nenhum plano para este equipamento.'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPlans.map(plan => {
                const eq = equipments.find(e => e.id === plan.equipment_id);
                const sc = statusConfig[plan.status];
                const remaining = plan.next_due_at - (eq?.current_hour_meter || 0);
                return (
                  <div key={plan.id} className={`glass-card rounded-xl p-5 border-l-4 ${sc.border}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-bold">{plan.description}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${sc.bg} ${sc.color} font-medium`}>{sc.label}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{eq ? eqLabel(eq) : 'Equipamento'}</p>
                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground font-mono flex-wrap">
                          <span>Intervalo: {plan.interval_hours}h</span>
                          <span>Próxima: {plan.next_due_at}h</span>
                          <span className={remaining <= 0 ? 'text-destructive font-bold' : remaining <= plan.interval_hours * 0.1 ? 'text-warning font-bold' : 'text-success'}>
                            {remaining <= 0 ? `Atrasada ${Math.abs(remaining)}h` : `Faltam ${remaining}h`}
                          </span>
                          {plan.last_executed_at && (
                            <span>Executada: {new Date(plan.last_executed_at).toLocaleDateString('pt-BR')}</span>
                          )}
                        </div>
                      </div>
                      {canEdit && (
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => handleEditPlan(plan)} className="text-muted-foreground hover:text-primary p-2 transition-colors">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {plan.status !== 'ok' && (
                            <Button size="sm" variant="outline" onClick={() => handleComplete(plan)} className="text-success border-success/30 hover:bg-success/10">
                              <CheckCircle className="w-3 h-3 mr-1" />Concluir
                            </Button>
                          )}
                          <button onClick={() => handleDelete(plan.id)} className="text-muted-foreground hover:text-destructive p-2 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </TabsContent>

        {/* ===== PEDIDOS ===== */}
        <TabsContent value="requests" className="space-y-4 mt-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              <Select value={requestFilter} onValueChange={setRequestFilter}>
                <SelectTrigger className="w-64"><SelectValue placeholder="Filtrar por equipamento" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os equipamentos</SelectItem>
                  {equipments.map(eq => <SelectItem key={eq.id} value={eq.id}>{eqLabel(eq)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={requestStatusFilter} onValueChange={setRequestStatusFilter}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Filtrar por status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="open">Aberto</SelectItem>
                  <SelectItem value="in_progress">Em andamento</SelectItem>
                  <SelectItem value="done">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => {
                const wb = XLSX.utils.book_new();
                const data = filteredRequests.map(r => {
                  const eq = equipments.find(e => e.id === r.equipment_id);
                  return {
                    Data: new Date(r.created_at).toLocaleDateString('pt-BR'),
                    Equipamento: eq ? eqLabel(eq) : '—',
                    Descrição: r.description,
                    Prioridade: priorityConfig[r.priority]?.label || r.priority,
                    Status: requestStatusConfig[r.status]?.label || r.status,
                    Operador: r.operator_name,
                    Observações: r.notes || '—',
                    Concluído: r.resolved_at ? new Date(r.resolved_at).toLocaleDateString('pt-BR') : '—',
                  };
                });
                const ws = XLSX.utils.json_to_sheet(data);
                XLSX.utils.book_append_sheet(wb, ws, 'Pedidos Manutenção');
                const filterName = requestFilter === 'all' ? '' : `_${equipments.find(e => e.id === requestFilter)?.name || ''}`;
                XLSX.writeFile(wb, `Pedidos_Manutencao${filterName}.xlsx`);
              }}>
                <FileSpreadsheet className="w-4 h-4 text-success" /> Excel
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => {
                const filterName = requestFilter === 'all' ? 'Todos' : equipments.find(e => e.id === requestFilter)?.name || 'Filtrado';
                const selectedEq = requestFilter !== 'all' ? equipments.find(e => e.id === requestFilter) : undefined;
                const eqDetails = selectedEq ? {
                  name: selectedEq.name,
                  plate: selectedEq.plate || undefined,
                  model: selectedEq.model || undefined,
                  brand: selectedEq.brand || undefined,
                  costCenter: selectedEq.cost_center || undefined,
                  year: selectedEq.year || undefined,
                  currentHourMeter: selectedEq.current_hour_meter,
                } : undefined;
                const rows = filteredRequests.map(r => {
                  const eq = equipments.find(e => e.id === r.equipment_id);
                  return {
                    equipment: eq ? eqLabel(eq) : '—',
                    description: r.description,
                    priority: priorityConfig[r.priority]?.label || r.priority,
                    status: requestStatusConfig[r.status]?.label || r.status,
                    operator: r.operator_name,
                    date: new Date(r.created_at).toLocaleDateString('pt-BR'),
                    resolvedAt: r.resolved_at ? new Date(r.resolved_at).toLocaleDateString('pt-BR') : undefined,
                    notes: r.notes || undefined,
                  };
                });
                exportMaintenanceRequestsPDF(rows, filterName, eqDetails);
              }}>
                <FileText className="w-4 h-4 text-primary" /> PDF
              </Button>
            </div>
          </div>
          <div id="requests-content">
          {filteredRequests.length === 0 ? (
            <div className="glass-card rounded-xl p-8 text-center">
              <p className="text-muted-foreground">{requestFilter === 'all' ? 'Nenhum pedido registrado.' : 'Nenhum pedido para este equipamento.'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRequests.map(r => {
                const eq = equipments.find(e => e.id === r.equipment_id);
                const pc = priorityConfig[r.priority];
                const sc = requestStatusConfig[r.status];
                const rAny = r as any;
                const linkedOSList = workOrders.filter(o => o.maintenance_request_id === r.id);
                const reqItems = Array.isArray((r as any).items) ? (r as any).items as { id: string; description: string; priority: string }[] : [];
                const hasItems = reqItems.length > 0;
                const allOsDone = linkedOSList.length > 0 && linkedOSList.every(o => o.status === 'done');
                return (
                  <div key={r.id} className="glass-card rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="font-semibold">{r.description}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pc.bg}`}>{pc.label}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sc.bg}`}>{sc.label}</span>
                          {hasItems && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                              {reqItems.length} item(ns)
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{eq ? eqLabel(eq) : '—'} — {r.operator_name} — {new Date(r.created_at).toLocaleDateString('pt-BR')}</p>
                        {r.notes && <p className="text-xs text-muted-foreground mt-1 italic">Obs: {r.notes}</p>}

                        {/* Items list */}
                        {hasItems && (
                          <div className="mt-2 space-y-1">
                            {reqItems.map((item, idx) => {
                              const itemOS = linkedOSList.find(o => o.description === item.description);
                              const itemPc = priorityConfig[item.priority] || priorityConfig.medium;
                              return (
                                <div key={item.id || idx} className="flex items-center gap-2 text-xs p-1.5 rounded bg-secondary/50">
                                  {itemOS ? (
                                    itemOS.status === 'done' ? (
                                      <CheckCircle className="w-3.5 h-3.5 text-success shrink-0" />
                                    ) : (
                                      <Wrench className="w-3.5 h-3.5 text-primary shrink-0" />
                                    )
                                  ) : (
                                    <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                  )}
                                  <span className="flex-1">{item.description}</span>
                                  <span className={`px-1.5 py-0.5 rounded-full font-medium ${itemPc.bg}`}>{itemPc.label}</span>
                                  {itemOS && (
                                    <button
                                      onClick={() => { setOsFilter('all'); setActiveTab('os'); }}
                                      className="text-primary hover:underline font-medium"
                                    >
                                      OS #{itemOS.os_number}
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Single OS link (for backwards compatibility) */}
                        {!hasItems && linkedOSList.length > 0 && (
                          <button
                            onClick={() => { setOsFilter('all'); setActiveTab('os'); }}
                            className="inline-flex items-center gap-1 mt-1.5 text-xs text-primary hover:underline font-medium"
                          >
                            <Clipboard className="w-3 h-3" />
                            Ver OS #{linkedOSList[0].os_number} — {osStatusConfig[linkedOSList[0].status]?.label || linkedOSList[0].status}
                          </button>
                        )}

                        {/* Multiple OS summary */}
                        {hasItems && linkedOSList.length > 0 && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            OS: {linkedOSList.filter(o => o.status === 'done').length}/{linkedOSList.length} concluídas
                          </div>
                        )}

                        {(rAny.photo_start_url || rAny.photo_end_url) && (
                          <div className="flex gap-2 mt-2">
                            {rAny.photo_start_url && (
                              <a href={rAny.photo_start_url} target="_blank" rel="noopener noreferrer" className="block">
                                <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-border">
                                  <img src={rAny.photo_start_url} alt="Início" className="w-full h-full object-cover" />
                                  <span className="absolute bottom-0 left-0 right-0 bg-primary/80 text-primary-foreground text-[8px] text-center py-0.5">Início</span>
                                </div>
                              </a>
                            )}
                            {rAny.photo_end_url && (
                              <a href={rAny.photo_end_url} target="_blank" rel="noopener noreferrer" className="block">
                                <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-border">
                                  <img src={rAny.photo_end_url} alt="Término" className="w-full h-full object-cover" />
                                  <span className="absolute bottom-0 left-0 right-0 bg-success/80 text-success-foreground text-[8px] text-center py-0.5">Término</span>
                                </div>
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 space-y-2">
                        {canEdit && (
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEditRequest(r)}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {canEdit && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir pedido?</AlertDialogTitle>
                                <AlertDialogDescription>O pedido e as OS vinculadas serão removidos. Você poderá desfazer nos próximos segundos.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={async () => {
                                  const backupReq = { ...r };
                                  const { data: linkedOS } = await supabase.from('work_orders').select('*').eq('maintenance_request_id', r.id);
                                  await supabase.from('work_orders').delete().eq('maintenance_request_id', r.id);
                                  await supabase.from('maintenance_requests').delete().eq('id', r.id);
                                  fetchAll();
                                  sonnerToast.success('Pedido excluído!', {
                                    action: { label: 'Desfazer', onClick: async () => {
                                      await supabase.from('maintenance_requests').insert(backupReq as any);
                                      if (linkedOS && linkedOS.length > 0) {
                                        await supabase.from('work_orders').insert(linkedOS as any);
                                      }
                                      fetchAll();
                                      sonnerToast.success('Pedido restaurado!');
                                    }},
                                    duration: 8000,
                                  });
                                }}>Excluir</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                        {canEdit && r.status !== 'done' && (
                          <>
                            {allOsDone && (
                              <Button
                                size="sm"
                                className="text-xs gap-1 bg-success hover:bg-success/90 text-success-foreground"
                                onClick={async () => {
                                  await supabase.from('maintenance_requests').update({
                                    status: 'done',
                                    resolved_at: new Date().toISOString(),
                                  }).eq('id', r.id);
                                  toast({ title: 'Pedido concluído!' });
                                  fetchAll();
                                }}
                              >
                                <CheckCircle className="w-3 h-3" /> Fechar Pedido
                              </Button>
                            )}
                            <Select value={r.status} onValueChange={v => handleRequestStatusChange(r.id, v)}>
                              <SelectTrigger className="h-8 text-xs w-36">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="open">Aberto</SelectItem>
                                <SelectItem value="in_progress">Em andamento</SelectItem>
                                <SelectItem value="done">Concluído</SelectItem>
                              </SelectContent>
                            </Select>
                          </>
                        )}
                        {r.status === 'done' && r.resolved_at && (
                          <span className="text-xs text-muted-foreground">
                            Concluído em {new Date(r.resolved_at).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </TabsContent>

        {/* ===== HISTÓRICO ===== */}
        <TabsContent value="history" className="space-y-4 mt-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Select value={historyFilter} onValueChange={setHistoryFilter}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Filtrar por equipamento" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os equipamentos</SelectItem>
                {equipments.map(eq => <SelectItem key={eq.id} value={eq.id}>{eqLabel(eq)}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => {
                const wb = XLSX.utils.book_new();
                const data = filteredHistory.map(h => {
                  const eq = equipments.find(e => e.id === h.equipment_id);
                  const plan = plans.find(p => p.id === h.plan_id);
                  return {
                    Data: new Date(h.executed_at).toLocaleDateString('pt-BR'),
                    Equipamento: eq?.name || '—',
                    Descrição: h.description,
                    'Horímetro': h.hour_meter,
                    Responsável: h.operator_name || '—',
                    Observações: h.notes || '—',
                    'Plano vinculado': plan?.description || '—',
                  };
                });
                const ws = XLSX.utils.json_to_sheet(data);
                XLSX.utils.book_append_sheet(wb, ws, 'Histórico Manutenção');
                const filterName = historyFilter === 'all' ? '' : `_${equipments.find(e => e.id === historyFilter)?.name || ''}`;
                XLSX.writeFile(wb, `Historico_Manutencao${filterName}.xlsx`);
              }}>
                <FileSpreadsheet className="w-4 h-4 text-success" /> Excel
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => {
                const filterName = historyFilter === 'all' ? 'Todos' : equipments.find(e => e.id === historyFilter)?.name || 'Filtrado';
                const selectedEq = historyFilter !== 'all' ? equipments.find(e => e.id === historyFilter) : undefined;
                const eqDetails = selectedEq ? {
                  name: selectedEq.name,
                  plate: selectedEq.plate || undefined,
                  model: selectedEq.model || undefined,
                  brand: selectedEq.brand || undefined,
                  costCenter: selectedEq.cost_center || undefined,
                  year: selectedEq.year || undefined,
                  currentHourMeter: selectedEq.current_hour_meter,
                } : undefined;
                const rows = filteredHistory.map(h => {
                  const eq = equipments.find(e => e.id === h.equipment_id);
                  const plan = plans.find(p => p.id === h.plan_id);
                  return {
                    equipment: eq ? eqLabel(eq) : '—',
                    description: h.description,
                    hourMeter: h.hour_meter,
                    executedAt: new Date(h.executed_at).toLocaleDateString('pt-BR'),
                    operator: h.operator_name || undefined,
                    notes: h.notes || undefined,
                    planDescription: plan?.description || undefined,
                  };
                });
                exportMaintenanceHistoryPDF(rows, filterName, eqDetails);
              }}>
                <FileText className="w-4 h-4 text-primary" /> PDF
              </Button>
              {canEdit && (
              <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2"><Plus className="w-4 h-4" /> Registrar Manual</Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border">
                  <DialogHeader><DialogTitle>Registrar Manutenção Manual</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div><Label>Equipamento *</Label>
                      <Select value={historyForm.equipmentId} onValueChange={v => setHistoryForm({...historyForm, equipmentId: v})}>
                        <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                        <SelectContent>{equipments.map(eq => <SelectItem key={eq.id} value={eq.id}>{eqLabel(eq)}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Descrição do serviço *</Label><Input value={historyForm.description} onChange={e => setHistoryForm({...historyForm, description: e.target.value})} placeholder="Ex: Troca de óleo do motor" /></div>
                    <div><Label>Horímetro *</Label><Input type="number" value={historyForm.hourMeter} onChange={e => setHistoryForm({...historyForm, hourMeter: e.target.value})} placeholder="Ex: 1500" /></div>
                    <div><Label>Responsável</Label><Input value={historyForm.operatorName} onChange={e => setHistoryForm({...historyForm, operatorName: e.target.value})} placeholder="Nome do mecânico" /></div>
                    <div><Label>Observações</Label><Textarea value={historyForm.notes} onChange={e => setHistoryForm({...historyForm, notes: e.target.value})} placeholder="Observações opcionais..." rows={2} /></div>
                    <Button onClick={handleSaveHistory} disabled={!historyForm.equipmentId || !historyForm.description || !historyForm.hourMeter || historySaving} className="w-full">
                      {historySaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar Registro
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              )}
            </div>
          </div>

          <div id="history-content">
          {filteredHistory.length === 0 ? (
            <div className="glass-card rounded-xl p-8 text-center">
              <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhum registro de manutenção encontrado.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredHistory.map(h => {
                const eq = equipments.find(e => e.id === h.equipment_id);
                const plan = plans.find(p => p.id === h.plan_id);
                return (
                  <div key={h.id} className="glass-card rounded-xl p-4 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{h.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {eq ? eqLabel(eq) : '—'} — {new Date(h.executed_at).toLocaleDateString('pt-BR')}
                      </p>
                      {h.operator_name && <p className="text-xs text-muted-foreground">Responsável: {h.operator_name}</p>}
                      {h.notes && <p className="text-xs text-muted-foreground italic mt-0.5">Obs: {h.notes}</p>}
                      {plan && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary mt-1 inline-block">Plano: {plan.description}</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {canEdit && (() => {
                        // Match by OS number in description (format: "OS #XX - ...")
                        const osMatch = h.description.match(/^OS #(\d+)/);
                        const linkedOS = osMatch
                          ? workOrders.find(o => o.os_number === Number(osMatch[1]))
                          : workOrders.find(o => o.equipment_id === h.equipment_id && o.status === 'done');
                        return linkedOS ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-warning border-warning/30 hover:bg-warning/10">
                                <Wrench className="w-3 h-3" /> Reabrir OS
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Reabrir OS #{linkedOS.os_number}?</AlertDialogTitle>
                                <AlertDialogDescription>A OS será reaberta, o pedido vinculado voltará ao status "Aberto" e este registro do histórico será removido.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={async () => {
                                  await supabase.from('work_orders').update({ status: 'open', completed_at: null, started_at: null }).eq('id', linkedOS.id);
                                  await supabase.from('maintenance_requests').update({ status: 'open', resolved_at: null }).eq('id', linkedOS.maintenance_request_id);
                                  await supabase.from('maintenance_history').delete().eq('id', h.id);
                                  toast({ title: `OS #${linkedOS.os_number} reaberta com sucesso!` });
                                  fetchAll();
                                }}>Reabrir</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : null;
                      })()}
                      {canEdit && (
                        <button onClick={() => openEditHistory(h)} className="text-muted-foreground hover:text-primary p-1 transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canEdit && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button className="text-muted-foreground hover:text-destructive p-1 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir registro do histórico?</AlertDialogTitle>
                              <AlertDialogDescription>O registro será removido. Você poderá desfazer nos próximos segundos.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={async () => {
                                const backup = { ...h };
                                await supabase.from('maintenance_history').delete().eq('id', h.id);
                                fetchAll();
                                sonnerToast.success('Registro excluído!', {
                                  action: { label: 'Desfazer', onClick: async () => {
                                    await supabase.from('maintenance_history').insert(backup as any);
                                    fetchAll();
                                    sonnerToast.success('Registro restaurado!');
                                  }},
                                  duration: 8000,
                                });
                              }}>Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                      <span className="text-sm font-mono font-bold text-muted-foreground">{h.hour_meter}h</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Photo dialog for status change */}
      <Dialog open={!!photoDialog} onOpenChange={(v) => { if (!v) { setPhotoDialog(null); setPhotoUrl(''); } }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              {photoDialog?.label}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {photoDialog?.targetStatus === 'in_progress'
                ? 'Tire uma foto antes de iniciar o serviço de manutenção.'
                : 'Tire uma foto após concluir o serviço de manutenção.'}
            </p>
            <PhotoUpload
              label={photoDialog?.label || 'Foto'}
              required
              onUploaded={setPhotoUrl}
            />
            <Button
              onClick={handlePhotoConfirm}
              disabled={!photoUrl || photoSaving}
              className="w-full font-bold"
            >
              {photoSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar e Atualizar Status
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Request Dialog */}
      <Dialog open={!!editRequest} onOpenChange={v => { if (!v) setEditRequest(null); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Editar Pedido de Manutenção</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Descrição *</Label><Textarea value={reqEditForm.description} onChange={e => setReqEditForm({...reqEditForm, description: e.target.value})} rows={3} /></div>
            <div><Label>Prioridade</Label>
              <Select value={reqEditForm.priority} onValueChange={v => setReqEditForm({...reqEditForm, priority: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Operador</Label><Input value={reqEditForm.operator_name} onChange={e => setReqEditForm({...reqEditForm, operator_name: e.target.value})} /></div>
            <div><Label>Observações</Label><Textarea value={reqEditForm.notes} onChange={e => setReqEditForm({...reqEditForm, notes: e.target.value})} rows={2} /></div>
            <Button onClick={handleSaveEditRequest} disabled={!reqEditForm.description} className="w-full">Salvar Alterações</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit OS Dialog */}
      <Dialog open={!!editOS} onOpenChange={v => { if (!v) setEditOS(null); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Editar Ordem de Serviço</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Descrição *</Label><Textarea value={osEditForm.description} onChange={e => setOsEditForm({...osEditForm, description: e.target.value})} rows={3} /></div>
            <div><Label>Prioridade</Label>
              <Select value={osEditForm.priority} onValueChange={v => setOsEditForm({...osEditForm, priority: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Mecânico</Label><Input value={osEditForm.mechanic_name} onChange={e => setOsEditForm({...osEditForm, mechanic_name: e.target.value})} /></div>
            <div><Label>Observações</Label><Textarea value={osEditForm.notes} onChange={e => setOsEditForm({...osEditForm, notes: e.target.value})} rows={2} /></div>
            <Button onClick={handleSaveEditOS} disabled={!osEditForm.description} className="w-full">Salvar Alterações</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit History Dialog */}
      <Dialog open={!!editHistory} onOpenChange={v => { if (!v) setEditHistory(null); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Editar Registro de Manutenção</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Descrição *</Label><Input value={histEditForm.description} onChange={e => setHistEditForm({...histEditForm, description: e.target.value})} /></div>
            <div><Label>Horímetro *</Label><Input type="number" value={histEditForm.hour_meter} onChange={e => setHistEditForm({...histEditForm, hour_meter: e.target.value})} /></div>
            <div><Label>Responsável</Label><Input value={histEditForm.operator_name} onChange={e => setHistEditForm({...histEditForm, operator_name: e.target.value})} /></div>
            <div><Label>Observações</Label><Textarea value={histEditForm.notes} onChange={e => setHistEditForm({...histEditForm, notes: e.target.value})} rows={2} /></div>
            <Button onClick={handleSaveEditHistory} disabled={!histEditForm.description || !histEditForm.hour_meter} className="w-full">Salvar Alterações</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Closure Dialog (Dar Baixa na OS) */}
      <Dialog open={!!closureOS} onOpenChange={v => { if (!v) setClosureOS(null); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Dar Baixa na OS #{closureOS?.os_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Serviço Executado *</Label>
              <Textarea
                value={closureForm.service_executed}
                onChange={e => setClosureForm({...closureForm, service_executed: e.target.value})}
                placeholder="Descreva o serviço realizado..."
                rows={3}
              />
            </div>
            <div>
              <Label>Número da Nota Fiscal</Label>
              <Input
                value={closureForm.invoice_number}
                onChange={e => setClosureForm({...closureForm, invoice_number: e.target.value})}
                placeholder="Ex: NF-001234"
              />
            </div>
            <div>
              <Label>Mecânico Responsável</Label>
              <Input
                value={closureForm.mechanic_name}
                onChange={e => setClosureForm({...closureForm, mechanic_name: e.target.value})}
                placeholder="Nome do mecânico"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Custo Mão de Obra (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={closureForm.labor_cost}
                  onChange={e => setClosureForm({...closureForm, labor_cost: e.target.value})}
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label>Custo Peças (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={closureForm.parts_cost}
                  onChange={e => setClosureForm({...closureForm, parts_cost: e.target.value})}
                  placeholder="0,00"
                />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                value={closureForm.notes}
                onChange={e => setClosureForm({...closureForm, notes: e.target.value})}
                placeholder="Observações adicionais..."
                rows={2}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <PhotoUpload
                label="Foto/Arquivo Início"
                onUploaded={url => setClosureForm({...closureForm, photo_start_url: url})}
                value={closureForm.photo_start_url}
              />
              <PhotoUpload
                label="Foto/Arquivo Término"
                onUploaded={url => setClosureForm({...closureForm, photo_end_url: url})}
                value={closureForm.photo_end_url}
              />
            </div>
            <Button
              onClick={handleClosureConfirm}
              disabled={!closureForm.service_executed}
              className="w-full"
            >
              Confirmar e Concluir OS
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* PDF History Period Filter Dialog */}
      <Dialog open={pdfHistoryDialog} onOpenChange={(v) => { setPdfHistoryDialog(v); if (!v) { setPdfHistoryFrom(''); setPdfHistoryTo(''); } }}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle>Exportar PDF com Histórico</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Selecione o período do histórico de manutenção a incluir no PDF. Deixe em branco para incluir todo o histórico.</p>
          <div className="space-y-3">
            <div><Label>Data inicial</Label><Input type="date" value={pdfHistoryFrom} onChange={e => setPdfHistoryFrom(e.target.value)} /></div>
            <div><Label>Data final</Label><Input type="date" value={pdfHistoryTo} onChange={e => setPdfHistoryTo(e.target.value)} /></div>
            <Button className="w-full" disabled={pdfExporting} onClick={async () => {
              setPdfExporting(true);
              try {
                // Build plan rows
                const filterName = planFilter === 'all' ? 'Todos' : equipments.find(e => e.id === planFilter)?.name || 'Filtrado';
                const rows = filteredPlans.map(p => {
                  const eq = equipments.find(e => e.id === p.equipment_id);
                  const currentHM = eq?.current_hour_meter || 0;
                  return {
                    equipment: eq ? eqLabel(eq) : '—',
                    description: p.description,
                    intervalHours: p.interval_hours,
                    nextDueAt: p.next_due_at,
                    lastDoneAt: p.last_done_at,
                    currentHM,
                    remaining: p.next_due_at - currentHM,
                    status: p.status as 'ok' | 'approaching' | 'overdue',
                    lastExecuted: p.last_executed_at ? new Date(p.last_executed_at).toLocaleDateString('pt-BR') : undefined,
                    plate: eq?.plate || undefined,
                    model: eq?.model || undefined,
                    brand: eq?.brand || undefined,
                    costCenter: eq?.cost_center || undefined,
                    year: eq?.year || undefined,
                  };
                });
                // Add equipments without plans
                const eqsWithPlans = new Set(filteredPlans.map(p => p.equipment_id));
                const targetEqs = planFilter === 'all' ? equipments : equipments.filter(e => e.id === planFilter);
                targetEqs.filter(eq => !eqsWithPlans.has(eq.id)).forEach(eq => {
                  rows.push({
                    equipment: eqLabel(eq),
                    description: 'Nenhum plano de manutenção cadastrado',
                    intervalHours: 0, nextDueAt: 0, lastDoneAt: 0,
                    currentHM: eq.current_hour_meter, remaining: 0,
                    status: 'ok' as const, lastExecuted: undefined,
                    plate: eq.plate || undefined, model: eq.model || undefined,
                    brand: eq.brand || undefined, costCenter: eq.cost_center || undefined,
                    year: eq.year || undefined,
                  });
                });

                // Fetch history with optional date filter
                let query = supabase.from('maintenance_history').select('*').order('executed_at', { ascending: false });
                if (pdfHistoryFrom) query = query.gte('executed_at', pdfHistoryFrom);
                if (pdfHistoryTo) query = query.lte('executed_at', pdfHistoryTo + 'T23:59:59');
                const { data: histData } = await query;
                const allHist = (histData || []) as DBMaintenanceHistory[];

                // Group by equipment name
                const historyByEquipment: Record<string, PlanHistoryRow[]> = {};
                allHist.forEach(h => {
                  const eq = equipments.find(e => e.id === h.equipment_id);
                  const eqName = eq ? eqLabel(eq) : '—';
                  if (!historyByEquipment[eqName]) historyByEquipment[eqName] = [];
                  historyByEquipment[eqName].push({
                    description: h.description,
                    hourMeter: h.hour_meter,
                    date: new Date(h.executed_at).toLocaleDateString('pt-BR'),
                    operator: h.operator_name || '—',
                    notes: h.notes || '',
                  });
                });

                // Build period label
                let periodLabel = '';
                if (pdfHistoryFrom && pdfHistoryTo) {
                  periodLabel = `${new Date(pdfHistoryFrom + 'T12:00:00').toLocaleDateString('pt-BR')} a ${new Date(pdfHistoryTo + 'T12:00:00').toLocaleDateString('pt-BR')}`;
                } else if (pdfHistoryFrom) {
                  periodLabel = `A partir de ${new Date(pdfHistoryFrom + 'T12:00:00').toLocaleDateString('pt-BR')}`;
                } else if (pdfHistoryTo) {
                  periodLabel = `Até ${new Date(pdfHistoryTo + 'T12:00:00').toLocaleDateString('pt-BR')}`;
                }

                await exportMaintenancePlansPDF(rows, filterName, undefined, historyByEquipment, periodLabel || undefined);
                setPdfHistoryDialog(false);
                setPdfHistoryFrom('');
                setPdfHistoryTo('');
              } finally {
                setPdfExporting(false);
              }
            }}>
              {pdfExporting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Gerar PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Nova OS Dialog */}
      <Dialog open={newOsOpen} onOpenChange={(v) => { setNewOsOpen(v); if (!v) setNewOsForm({ equipmentId: '', description: '', priority: 'medium', operator_name: '' }); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Nova Ordem de Serviço</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Equipamento *</Label>
              <Select value={newOsForm.equipmentId} onValueChange={v => setNewOsForm({...newOsForm, equipmentId: v})}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>{equipments.map(eq => <SelectItem key={eq.id} value={eq.id}>{eqLabel(eq)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Descrição do serviço *</Label><Textarea value={newOsForm.description} onChange={e => setNewOsForm({...newOsForm, description: e.target.value})} placeholder="Descreva o problema ou serviço necessário..." rows={3} /></div>
            <div><Label>Prioridade</Label>
              <Select value={newOsForm.priority} onValueChange={v => setNewOsForm({...newOsForm, priority: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Solicitante</Label><Input value={newOsForm.operator_name} onChange={e => setNewOsForm({...newOsForm, operator_name: e.target.value})} placeholder="Nome do solicitante" /></div>
            <Button onClick={handleCreateOS} disabled={!newOsForm.equipmentId || !newOsForm.description || newOsSaving} className="w-full">
              {newOsSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Criar OS
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
