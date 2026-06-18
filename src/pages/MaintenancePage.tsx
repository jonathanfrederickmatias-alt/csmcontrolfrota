import { useState, useEffect } from "react";
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

function eqLabel(eq: DBEquipment): string {
  const id = eq.cost_center || eq.plate || '';
  return id ? `${eq.name} (${id})` : eq.name;
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
  const { isAdmin, isGestor, isMecanico, isAbastecedor } = useUserRoles();
  const canEdit = isAdmin || isGestor;
  const canComplete = isAdmin || isGestor || isMecanico || isAbastecedor;
  const [plans, setPlans] = useState<DBMaintenancePlan[]>([]);
  const [requests, setRequests] = useState<DBMaintenanceRequest[]>([]);
  const [equipments, setEquipments] = useState<DBEquipment[]>([]);
  const [history, setHistory] = useState<DBMaintenanceHistory[]>([]);
  const [workOrders, setWorkOrders] = useState<DBWorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<DBMaintenancePlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ equipmentId: '', description: '', planType: 'horimetro' as 'km' | 'horimetro' | 'tempo', intervalHours: '', lastDoneAt: '', intervalDays: '', lastDoneDate: '' });

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
  const [completedFilter, setCompletedFilter] = useState('all');
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

  // Complete plan dialog
  const [completePlan, setCompletePlanState] = useState<DBMaintenancePlan | null>(null);
  const [completeForm, setCompleteForm] = useState({ hourMeter: '', operatorName: '', notes: '', laborCost: '', partsCost: '', photoUrl: '' });
  const [completeSaving, setCompleteSaving] = useState(false);

  // Controlled tab
  const [activeTab, setActiveTab] = useState('plans');

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

  const emptyForm = { equipmentId: '', description: '', planType: 'horimetro' as 'km' | 'horimetro' | 'tempo', intervalHours: '', lastDoneAt: '', intervalDays: '', lastDoneDate: '' };

  const computeTempoStatus = (nextDueIso: string): 'ok' | 'approaching' | 'overdue' => {
    const now = new Date();
    const next = new Date(nextDueIso);
    const diffDays = (next.getTime() - now.getTime()) / 86400000;
    if (diffDays <= 0) return 'overdue';
    if (diffDays <= 7) return 'approaching';
    return 'ok';
  };

  const handleSave = async () => {
    setSaving(true);
    const eq = equipments.find(e => e.id === form.equipmentId);
    const eqType = eq?.type || 'machine';

    let payload: any = {
      equipment_id: form.equipmentId,
      description: form.description,
      plan_type: form.planType,
    };

    if (form.planType === 'tempo') {
      const days = Number(form.intervalDays);
      const lastDate = form.lastDoneDate ? new Date(form.lastDoneDate) : new Date();
      const nextDate = new Date(lastDate.getTime() + days * 86400000);
      payload = {
        ...payload,
        interval_hours: 0,
        last_done_at: 0,
        next_due_at: 0,
        interval_days: days,
        last_done_date: lastDate.toISOString(),
        next_due_date: nextDate.toISOString(),
        status: computeTempoStatus(nextDate.toISOString()),
      };
    } else {
      const lastDone = Number(form.lastDoneAt);
      const interval = Number(form.intervalHours);
      const currentHM = eq?.current_hour_meter || 0;
      const nextDue = lastDone + interval;
      const remaining = nextDue - currentHM;
      payload = {
        ...payload,
        interval_hours: interval,
        last_done_at: lastDone,
        next_due_at: nextDue,
        interval_days: null,
        last_done_date: null,
        next_due_date: null,
        status: calculateMaintenanceStatus(remaining, eqType),
      };
    }

    if (editPlan) {
      await supabase.from('maintenance_plans').update(payload).eq('id', editPlan.id);
      toast({ title: 'Plano atualizado com sucesso!' });
    } else {
      const { getMyTenantId } = await import('@/lib/tenant');
      const tenant_id = await getMyTenantId();
      await supabase.from('maintenance_plans').insert([{ tenant_id, ...payload }]);
      toast({ title: 'Plano criado com sucesso!' });
    }

    setSaving(false);
    setOpen(false);
    setEditPlan(null);
    setForm(emptyForm);
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('maintenance_plans').delete().eq('id', id);
    fetchAll();
  };

  const handleComplete = (plan: DBMaintenancePlan) => {
    const eq = equipments.find(e => e.id === plan.equipment_id);
    const currentHM = eq?.current_hour_meter || 0;
    setCompletePlanState(plan);
    setCompleteForm({
      hourMeter: plan.plan_type === 'tempo' ? '' : String(currentHM || ''),
      operatorName: '',
      notes: '',
      laborCost: '',
      partsCost: '',
      photoUrl: '',
    });
  };

  const submitCompletePlan = async () => {
    if (!completePlan) return;
    const plan = completePlan;
    const isTempo = plan.plan_type === 'tempo';
    const hm = isTempo ? 0 : parseFloat(completeForm.hourMeter);
    if (!isTempo && (isNaN(hm) || hm < 0)) {
      toast({ title: 'Horímetro/Km inválido', description: 'Informe um valor numérico válido.', variant: 'destructive' });
      return;
    }
    setCompleteSaving(true);
    const { getMyTenantId } = await import('@/lib/tenant');
    const tenant_id = await getMyTenantId();

    await supabase.from('maintenance_history').insert([{
      tenant_id,
      equipment_id: plan.equipment_id,
      plan_id: plan.id,
      description: plan.description,
      hour_meter: hm,
      operator_name: completeForm.operatorName || null,
      notes: completeForm.notes || null,
      labor_cost: completeForm.laborCost ? parseFloat(completeForm.laborCost) : 0,
      parts_cost: completeForm.partsCost ? parseFloat(completeForm.partsCost) : 0,
      photo_url: completeForm.photoUrl || null,
    }]);

    if (isTempo) {
      const now = new Date();
      const days = plan.interval_days || 0;
      const nextDate = new Date(now.getTime() + days * 86400000);
      await supabase.from('maintenance_plans').update({
        last_done_date: now.toISOString(),
        next_due_date: nextDate.toISOString(),
        status: computeTempoStatus(nextDate.toISOString()),
        last_executed_at: now.toISOString(),
      }).eq('id', plan.id);
      toast({ title: 'Manutenção concluída!', description: `Próxima em ${nextDate.toLocaleDateString('pt-BR')}` });
    } else {
      await supabase.from('maintenance_plans').update({
        last_done_at: hm,
        next_due_at: hm + (plan.interval_hours || 0),
        status: 'ok',
        last_executed_at: new Date().toISOString(),
      }).eq('id', plan.id);

      await supabase.from('equipments').update({
        current_hour_meter: Math.max(hm, equipments.find(e => e.id === plan.equipment_id)?.current_hour_meter || 0),
      }).eq('id', plan.equipment_id);

      toast({ title: 'Manutenção concluída e registrada no histórico!', description: `Próxima em ${hm + (plan.interval_hours || 0)}h` });
    }

    setCompleteSaving(false);
    setCompletePlanState(null);
    fetchAll();
  };

  const handleEditPlan = (plan: DBMaintenancePlan) => {
    setEditPlan(plan);
    setForm({
      equipmentId: plan.equipment_id,
      description: plan.description,
      planType: (plan.plan_type as any) || 'horimetro',
      intervalHours: plan.interval_hours != null ? String(plan.interval_hours) : '',
      lastDoneAt: plan.last_done_at != null ? String(plan.last_done_at) : '',
      intervalDays: plan.interval_days != null ? String(plan.interval_days) : '',
      lastDoneDate: plan.last_done_date ? plan.last_done_date.slice(0, 10) : '',
    });
    setOpen(true);
  };


  const handleSaveHistory = async () => {
    setHistorySaving(true);
    const { getMyTenantId } = await import('@/lib/tenant');
    const tenant_id = await getMyTenantId();
    await supabase.from('maintenance_history').insert([{
      tenant_id,
      equipment_id: historyForm.equipmentId,
      description: historyForm.description,
      hour_meter: Number(historyForm.hourMeter),
      notes: historyForm.notes || null,
      operator_name: historyForm.operatorName || null,
    }]);
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

  // Serviços Realizados: histórico (vem de OS concluídas + planos concluídos + manuais)
  const filteredCompleted = (completedFilter === 'all' ? history : history.filter(h => h.equipment_id === completedFilter))
    .slice()
    .sort((a, b) => new Date(b.executed_at).getTime() - new Date(a.executed_at).getTime());

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
    const { getMyTenantId } = await import('@/lib/tenant');
    const tenant_id = await getMyTenantId();
    // Create maintenance request first (required by work_orders FK)
    const { data: reqData, error: reqErr } = await supabase.from('maintenance_requests').insert([{
      tenant_id,
      equipment_id: newOsForm.equipmentId,
      description: newOsForm.description,
      priority: newOsForm.priority,
      operator_name: newOsForm.operator_name || 'Sistema',
      status: 'open',
    }]).select().single();

    if (reqErr || !reqData) {
      toast({ title: 'Erro ao criar pedido vinculado', variant: 'destructive' });
      setNewOsSaving(false);
      return;
    }

    // Create work order
    const { error: osErr } = await supabase.from('work_orders').insert([{
      tenant_id,
      equipment_id: newOsForm.equipmentId,
      maintenance_request_id: reqData.id,
      description: newOsForm.description,
      priority: newOsForm.priority,
      status: 'open',
    }]);

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
        <TabsList className="w-full grid grid-cols-2 md:grid-cols-4">
          <TabsTrigger value="os" className="gap-1.5"><Clipboard className="w-4 h-4" /> OS</TabsTrigger>
          <TabsTrigger value="plans" className="gap-1.5"><Wrench className="w-4 h-4" /> Planos</TabsTrigger>
          <TabsTrigger value="completed" className="gap-1.5"><CheckCircle className="w-4 h-4" /> Realizados</TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5"><History className="w-4 h-4" /> Histórico</TabsTrigger>
        </TabsList>

        {/* ===== ORDENS DE SERVIÇO ===== */}
        <TabsContent value="os" className="space-y-4 mt-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              <Select value={osFilter} onValueChange={setOsFilter}>
                <SelectTrigger className="w-64"><SelectValue placeholder="Filtrar por equipamento" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os equipamentos</SelectItem>
                  {equipments.map(eq => <SelectItem key={eq.id} value={eq.id}>{eqLabel(eq)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={osStatusFilter} onValueChange={setOsStatusFilter}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Filtrar por status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="open">Aberta</SelectItem>
                  <SelectItem value="in_progress">Em andamento</SelectItem>
                  <SelectItem value="done">Concluída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 flex-wrap">
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
                <Button size="sm" className="gap-2" onClick={() => setNewOsOpen(true)}>
                  <Plus className="w-4 h-4" /> Nova OS
                </Button>
              )}
            </div>
          </div>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : filteredOrders.length === 0 ? (
            <div className="glass-card rounded-xl p-12 text-center">
              <Clipboard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhuma OS registrada. As OS são geradas automaticamente ao criar um pedido de manutenção.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map(os => {
                const eq = equipments.find(e => e.id === os.equipment_id);
                const pc = priorityConfig[os.priority] || priorityConfig.medium;
                const sc = osStatusConfig[os.status] || osStatusConfig.open;
                return (
                  <div key={os.id} className="glass-card rounded-xl p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs font-mono font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">OS #{os.os_number}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pc.bg}`}>{pc.label}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sc.bg}`}>{sc.label}</span>
                        </div>
                        <p className="font-semibold mt-1">{os.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{eq ? eqLabel(eq) : '—'} — {new Date(os.created_at).toLocaleDateString('pt-BR')}</p>
                        {os.mechanic_name && <p className="text-xs text-muted-foreground">Mecânico: {os.mechanic_name}</p>}
                        {os.started_at && <p className="text-xs text-muted-foreground">Início: {new Date(os.started_at).toLocaleDateString('pt-BR')}</p>}
                        {os.completed_at && <p className="text-xs text-success">Concluída: {new Date(os.completed_at).toLocaleDateString('pt-BR')}</p>}
                        {os.notes && <p className="text-xs text-muted-foreground italic mt-1">Obs: {os.notes}</p>}
                        {(os as any).invoice_number && <p className="text-xs text-muted-foreground mt-1">📄 NF: {(os as any).invoice_number}</p>}
                        {(os as any).service_executed && <p className="text-xs text-muted-foreground mt-1">🔧 Serviço: {(os as any).service_executed}</p>}
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 gap-1.5 text-xs"
                          onClick={() => {
                            const url = `${window.location.origin}/qr/mecanico?id=${os.id}`;
                            window.open(url, '_blank');
                          }}
                        >
                          <Wrench className="w-3.5 h-3.5" /> Tela Mecânico
                        </Button>
                        {canEdit && (
                          <Button size="sm" variant="outline" className="mt-1 gap-1.5 text-xs" onClick={() => openEditOS(os)}>
                            <Edit2 className="w-3.5 h-3.5" /> Editar
                          </Button>
                        )}
                        {canEdit && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline" className="mt-1 gap-1.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/10">
                                <Trash2 className="w-3.5 h-3.5" /> Excluir
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir OS #{os.os_number}?</AlertDialogTitle>
                                <AlertDialogDescription>A ordem de serviço será removida. Você poderá desfazer nos próximos segundos.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={async () => {
                                  const backup = { ...os };
                                  await supabase.from('work_orders').delete().eq('id', os.id);
                                  fetchAll();
                                  sonnerToast.success('OS excluída!', {
                                    action: { label: 'Desfazer', onClick: async () => {
                                      const { id, os_number, ...rest } = backup;
                                      await supabase.from('work_orders').insert([{ ...rest, id, os_number } as any]);
                                      fetchAll();
                                      sonnerToast.success('OS restaurada!');
                                    }},
                                    duration: 8000,
                                  });
                                }}>Excluir</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                      <div className="shrink-0 space-y-2">
                        {canEdit && (
                          <>
                            <Input
                              placeholder="Nome do mecânico"
                              className="h-8 text-xs w-40"
                              defaultValue={os.mechanic_name || ''}
                              onBlur={e => { if (e.target.value !== (os.mechanic_name || '')) handleOsMechanicChange(os, e.target.value); }}
                            />
                            <Select value={os.status} onValueChange={v => handleOsStatusChange(os, v)}>
                              <SelectTrigger className="h-8 text-xs w-40"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="open">Aberta</SelectItem>
                                <SelectItem value="in_progress">Em andamento</SelectItem>
                                <SelectItem value="done">Concluída</SelectItem>
                              </SelectContent>
                            </Select>
                          </>
                        )}
                        {os.status === 'done' && os.completed_at && (
                          <span className="text-xs text-muted-foreground">
                            Concluída em {new Date(os.completed_at).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
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
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditPlan(null); setForm(emptyForm); } }}>
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
                  <div>
                    <Label>Tipo de plano *</Label>
                    <Select value={form.planType} onValueChange={(v: 'km' | 'horimetro' | 'tempo') => setForm({...form, planType: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="horimetro">Horímetro (horas)</SelectItem>
                        <SelectItem value="km">Quilometragem (km)</SelectItem>
                        <SelectItem value="tempo">Tempo (dias)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.planType === 'tempo' ? (
                    <>
                      <div><Label>Intervalo (dias) *</Label><Input type="number" inputMode="numeric" value={form.intervalDays} onChange={e => setForm({...form, intervalDays: e.target.value})} placeholder="Ex: 30" /></div>
                      <div><Label>Última feita em (data) *</Label><Input type="date" value={form.lastDoneDate} onChange={e => setForm({...form, lastDoneDate: e.target.value})} /></div>
                    </>
                  ) : (
                    <>
                      <div><Label>Intervalo ({form.planType === 'km' ? 'km' : 'horas'}) *</Label><Input type="number" inputMode="decimal" value={form.intervalHours} onChange={e => setForm({...form, intervalHours: e.target.value})} placeholder={form.planType === 'km' ? 'Ex: 10000' : 'Ex: 500'} /></div>
                      <div><Label>Última feita em ({form.planType === 'km' ? 'km' : 'horímetro'}) *</Label><Input type="number" inputMode="decimal" value={form.lastDoneAt} onChange={e => setForm({...form, lastDoneAt: e.target.value})} placeholder={form.planType === 'km' ? 'Ex: 50000' : 'Ex: 1000'} /></div>
                    </>
                  )}
                  <Button onClick={handleSave} disabled={!form.equipmentId || !form.description || (form.planType === 'tempo' ? (!form.intervalDays || !form.lastDoneDate) : (!form.intervalHours || !form.lastDoneAt)) || saving} className="w-full">
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
                const planType = plan.plan_type || 'horimetro';
                const unit = planType === 'km' ? 'km' : 'h';
                const isTempo = planType === 'tempo';
                const remaining = isTempo
                  ? (plan.next_due_date ? Math.ceil((new Date(plan.next_due_date).getTime() - Date.now()) / 86400000) : 0)
                  : ((plan.next_due_at || 0) - (eq?.current_hour_meter || 0));
                const intervalApprox = isTempo ? Math.max(1, (plan.interval_days || 0) * 0.1) : ((plan.interval_hours || 0) * 0.1);
                return (
                  <div key={plan.id} className={`glass-card rounded-xl p-5 border-l-4 ${sc.border}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-bold">{plan.description}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${sc.bg} ${sc.color} font-medium`}>{sc.label}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium uppercase">
                            {isTempo ? 'Tempo' : planType === 'km' ? 'KM' : 'Horímetro'}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{eq ? eqLabel(eq) : 'Equipamento'}</p>
                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground font-mono flex-wrap">
                          {isTempo ? (
                            <>
                              <span>Intervalo: {plan.interval_days} dias</span>
                              <span>Próxima: {plan.next_due_date ? new Date(plan.next_due_date).toLocaleDateString('pt-BR') : '—'}</span>
                              <span className={remaining <= 0 ? 'text-destructive font-bold' : remaining <= intervalApprox ? 'text-warning font-bold' : 'text-success'}>
                                {remaining <= 0 ? `Atrasada ${Math.abs(remaining)} dias` : `Faltam ${remaining} dias`}
                              </span>
                            </>
                          ) : (
                            <>
                              <span>Intervalo: {plan.interval_hours}{unit}</span>
                              <span>Próxima: {plan.next_due_at}{unit}</span>
                              <span className={remaining <= 0 ? 'text-destructive font-bold' : remaining <= intervalApprox ? 'text-warning font-bold' : 'text-success'}>
                                {remaining <= 0 ? `Atrasada ${Math.abs(remaining)}${unit}` : `Faltam ${remaining}${unit}`}
                              </span>
                            </>
                          )}
                          {plan.last_executed_at && (
                            <span>Executada: {new Date(plan.last_executed_at).toLocaleDateString('pt-BR')}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 shrink-0">
                        {canEdit && (
                          <button onClick={() => handleEditPlan(plan)} className="text-muted-foreground hover:text-primary p-2 transition-colors">
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {canComplete && plan.status !== 'ok' && (
                          <Button size="sm" variant="outline" onClick={() => handleComplete(plan)} className="text-success border-success/30 hover:bg-success/10">
                            <CheckCircle className="w-3 h-3 mr-1" />Concluir
                          </Button>
                        )}
                        {canEdit && (
                          <button onClick={() => handleDelete(plan.id)} className="text-muted-foreground hover:text-destructive p-2 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
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


        {/* ===== SERVIÇOS REALIZADOS ===== */}
        <TabsContent value="completed" className="space-y-4 mt-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Select value={completedFilter} onValueChange={setCompletedFilter}>
              <SelectTrigger className="w-72"><SelectValue placeholder="Filtrar por equipamento" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os equipamentos</SelectItem>
                {equipments.map(eq => <SelectItem key={eq.id} value={eq.id}>{eqLabel(eq)}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => {
                const wb = XLSX.utils.book_new();
                const data = filteredCompleted.map(h => {
                  const eq = equipments.find(e => e.id === h.equipment_id);
                  const plan = plans.find(p => p.id === h.plan_id);
                  const osMatch = h.description.match(/^OS #(\d+)/);
                  const linkedOS = osMatch ? workOrders.find(o => o.os_number === Number(osMatch[1])) : undefined;
                  return {
                    Data: new Date(h.executed_at).toLocaleDateString('pt-BR'),
                    Equipamento: eq?.name || '—',
                    Identificador: eq?.cost_center || eq?.plate || '—',
                    Origem: osMatch ? `OS #${osMatch[1]}` : (plan ? 'Plano' : 'Manual'),
                    'Tipo de manutenção': linkedOS?.maintenance_type || '—',
                    Serviço: h.description,
                    'Horímetro/Km': h.hour_meter,
                    Mecânico: h.operator_name || '—',
                    'Peças': linkedOS?.part_code || '—',
                    'Custo Mão de Obra': linkedOS?.labor_cost ?? h.labor_cost ?? 0,
                    'Custo Peças': linkedOS?.parts_cost ?? h.parts_cost ?? 0,
                    'Nota Fiscal': linkedOS?.invoice_number || '—',
                    Observações: h.notes || '—',
                  };
                });
                const ws = XLSX.utils.json_to_sheet(data);
                XLSX.utils.book_append_sheet(wb, ws, 'Serviços Realizados');
                const filterName = completedFilter === 'all' ? '' : `_${equipments.find(e => e.id === completedFilter)?.name || ''}`;
                XLSX.writeFile(wb, `Servicos_Realizados${filterName}.xlsx`);
              }}>
                <FileSpreadsheet className="w-4 h-4 text-success" /> Excel
              </Button>
              <Button size="sm" className="gap-1.5" onClick={() => {
                const filterName = completedFilter === 'all' ? 'Todos os equipamentos' : equipments.find(e => e.id === completedFilter)?.name || 'Filtrado';
                const selectedEq = completedFilter !== 'all' ? equipments.find(e => e.id === completedFilter) : undefined;
                const eqDetails = selectedEq ? {
                  name: selectedEq.name,
                  plate: selectedEq.plate || undefined,
                  model: selectedEq.model || undefined,
                  brand: selectedEq.brand || undefined,
                  costCenter: selectedEq.cost_center || undefined,
                  year: selectedEq.year || undefined,
                  currentHourMeter: selectedEq.current_hour_meter,
                } : undefined;
                const rows = filteredCompleted.map(h => {
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
                <FileText className="w-4 h-4" /> PDF
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="glass-card rounded-xl p-4">
              <p className="text-xs text-muted-foreground">Total de serviços</p>
              <p className="text-2xl font-black text-primary">{filteredCompleted.length}</p>
            </div>
            <div className="glass-card rounded-xl p-4">
              <p className="text-xs text-muted-foreground">OS concluídas</p>
              <p className="text-2xl font-black text-success">{filteredCompleted.filter(h => /^OS #\d+/.test(h.description)).length}</p>
            </div>
            <div className="glass-card rounded-xl p-4">
              <p className="text-xs text-muted-foreground">Planos executados</p>
              <p className="text-2xl font-black text-warning">{filteredCompleted.filter(h => h.plan_id).length}</p>
            </div>
            <div className="glass-card rounded-xl p-4">
              <p className="text-xs text-muted-foreground">Custo total</p>
              <p className="text-2xl font-black">
                {filteredCompleted.reduce((acc, h) => {
                  const osMatch = h.description.match(/^OS #(\d+)/);
                  const linkedOS = osMatch ? workOrders.find(o => o.os_number === Number(osMatch[1])) : undefined;
                  const labor = linkedOS?.labor_cost ?? h.labor_cost ?? 0;
                  const parts = linkedOS?.parts_cost ?? h.parts_cost ?? 0;
                  return acc + Number(labor) + Number(parts);
                }, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
          </div>

          {filteredCompleted.length === 0 ? (
            <div className="glass-card rounded-xl p-8 text-center">
              <CheckCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhum serviço concluído encontrado.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCompleted.map(h => {
                const eq = equipments.find(e => e.id === h.equipment_id);
                const plan = plans.find(p => p.id === h.plan_id);
                const osMatch = h.description.match(/^OS #(\d+)/);
                const linkedOS = osMatch ? workOrders.find(o => o.os_number === Number(osMatch[1])) : undefined;
                const origin = osMatch ? `OS #${osMatch[1]}` : (plan ? 'Plano Preventivo' : 'Registro Manual');
                const originBg = osMatch ? 'bg-primary/15 text-primary' : (plan ? 'bg-warning/15 text-warning' : 'bg-secondary text-muted-foreground');
                const labor = Number(linkedOS?.labor_cost ?? h.labor_cost ?? 0);
                const parts = Number(linkedOS?.parts_cost ?? h.parts_cost ?? 0);
                const total = labor + parts;
                return (
                  <div key={h.id} className="glass-card rounded-xl p-4 border-l-4 border-l-success">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${originBg}`}>{origin}</span>
                          {linkedOS?.maintenance_type && <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground capitalize">{linkedOS.maintenance_type}</span>}
                          <span className="text-xs text-muted-foreground">{new Date(h.executed_at).toLocaleString('pt-BR')}</span>
                        </div>
                        <p className="font-semibold text-sm">{h.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          <strong>{eq ? eqLabel(eq) : '—'}</strong>
                        </p>
                        {h.operator_name && <p className="text-xs text-muted-foreground">👤 Mecânico: {h.operator_name}</p>}
                        {linkedOS?.part_code && <p className="text-xs text-muted-foreground">🔧 Peças: <span className="font-mono">{linkedOS.part_code}</span></p>}
                        {linkedOS?.invoice_number && <p className="text-xs text-muted-foreground">🧾 NF: {linkedOS.invoice_number}</p>}
                        {plan && <p className="text-xs text-muted-foreground">📋 Plano: {plan.description}</p>}
                        {h.notes && <p className="text-xs text-muted-foreground italic mt-1 whitespace-pre-line">{h.notes}</p>}
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        <button
                          onClick={() => openEditHistory(h)}
                          className="text-muted-foreground hover:text-primary p-1 transition-colors"
                          title="Editar manutenção realizada"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <p className="text-xs text-muted-foreground">Horímetro/Km</p>
                        <p className="text-lg font-mono font-bold">{h.hour_meter}</p>
                        {total > 0 && (
                          <>
                            <p className="text-xs text-muted-foreground mt-1">Custo</p>
                            <p className="text-sm font-bold text-success">{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
                                    await supabase.from('maintenance_history').insert([backup as any]);
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

      {/* Complete Plan Dialog */}
      <Dialog open={!!completePlan} onOpenChange={(v) => !v && setCompletePlanState(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-success" /> Concluir Manutenção
            </DialogTitle>
          </DialogHeader>
          {completePlan && (() => {
            const eq = equipments.find(e => e.id === completePlan.equipment_id);
            const planType = completePlan.plan_type || 'horimetro';
            const isTempo = planType === 'tempo';
            const isVehicle = planType === 'km' || eq?.type === 'truck';
            const unitLabel = isVehicle ? 'Quilometragem (km)' : 'Horímetro (h)';
            const nextDateIfTempo = isTempo
              ? new Date(Date.now() + (completePlan.interval_days || 0) * 86400000).toLocaleDateString('pt-BR')
              : '';
            return (
              <div className="space-y-3">
                <div className="bg-secondary/50 rounded-lg p-3 text-sm">
                  <p className="font-semibold">{completePlan.description}</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    Equipamento: {eq ? eqLabel(eq) : '—'}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {isTempo
                      ? `Intervalo: ${completePlan.interval_days} dias`
                      : `Atual: ${eq?.current_hour_meter || 0}${isVehicle ? ' km' : ' h'} • Intervalo: ${completePlan.interval_hours}${isVehicle ? ' km' : ' h'}`}
                  </p>
                </div>
                {!isTempo && (
                  <div>
                    <Label>{unitLabel} em que foi executada *</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={completeForm.hourMeter}
                      onChange={e => setCompleteForm({ ...completeForm, hourMeter: e.target.value })}
                      placeholder="Ex: 1250"
                    />
                  </div>
                )}
                <div>
                  <Label>Executado por</Label>
                  <Input
                    value={completeForm.operatorName}
                    onChange={e => setCompleteForm({ ...completeForm, operatorName: e.target.value })}
                    placeholder="Nome do mecânico / responsável"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Custo Mão de Obra (R$)</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={completeForm.laborCost}
                      onChange={e => setCompleteForm({ ...completeForm, laborCost: e.target.value })}
                      placeholder="0,00"
                    />
                  </div>
                  <div>
                    <Label>Custo Peças (R$)</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={completeForm.partsCost}
                      onChange={e => setCompleteForm({ ...completeForm, partsCost: e.target.value })}
                      placeholder="0,00"
                    />
                  </div>
                </div>
                <div>
                  <Label>Observações</Label>
                  <Textarea
                    value={completeForm.notes}
                    onChange={e => setCompleteForm({ ...completeForm, notes: e.target.value })}
                    placeholder="Peças trocadas, serviços realizados, detalhes técnicos..."
                    rows={3}
                  />
                </div>
                <PhotoUpload
                  label="Foto da Execução"
                  value={completeForm.photoUrl}
                  onUploaded={(url) => setCompleteForm({ ...completeForm, photoUrl: url })}
                  acceptFiles
                />
                <div className="bg-primary/5 rounded-lg p-2 text-xs text-muted-foreground">
                  Próxima manutenção será agendada para: <strong className="text-primary">
                    {isTempo
                      ? nextDateIfTempo
                      : `${(parseFloat(completeForm.hourMeter) || 0) + (completePlan.interval_hours || 0)}${isVehicle ? ' km' : ' h'}`}
                  </strong>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={() => setCompletePlanState(null)} className="flex-1">

                    Cancelar
                  </Button>
                  <Button onClick={submitCompletePlan} disabled={completeSaving || (!isTempo && !completeForm.hourMeter)} className="flex-1 bg-success hover:bg-success/90 text-success-foreground">
                    {completeSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <CheckCircle className="w-4 h-4 mr-1" /> Confirmar Conclusão
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
