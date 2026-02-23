import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DBEquipment, DBMaintenancePlan, DBMaintenanceRequest } from "@/lib/supabase-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Wrench, AlertTriangle, CheckCircle, Trash2, Edit2, Loader2, Camera, ImageIcon } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import PhotoUpload from "@/components/PhotoUpload";

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

export default function MaintenancePage() {
  const [plans, setPlans] = useState<DBMaintenancePlan[]>([]);
  const [requests, setRequests] = useState<DBMaintenanceRequest[]>([]);
  const [equipments, setEquipments] = useState<DBEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<DBMaintenancePlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ equipmentId: '', description: '', intervalHours: '', lastDoneAt: '' });

  // Photo dialog state
  const [photoDialog, setPhotoDialog] = useState<{ requestId: string; targetStatus: 'in_progress' | 'done'; label: string } | null>(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoSaving, setPhotoSaving] = useState(false);

  const fetchAll = async () => {
    const [eqRes, plRes, reqRes] = await Promise.all([
      supabase.from('equipments').select('*').order('name'),
      supabase.from('maintenance_plans').select('*').order('status'),
      supabase.from('maintenance_requests').select('*').order('created_at', { ascending: false }),
    ]);
    setEquipments((eqRes.data || []) as DBEquipment[]);
    setPlans((plRes.data || []) as DBMaintenancePlan[]);
    setRequests((reqRes.data || []) as DBMaintenanceRequest[]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleSave = async () => {
    setSaving(true);
    const lastDone = Number(form.lastDoneAt);
    const interval = Number(form.intervalHours);
    const eq = equipments.find(e => e.id === form.equipmentId);
    const currentHM = eq?.current_hour_meter || 0;
    const nextDue = lastDone + interval;
    const remaining = nextDue - currentHM;
    const status = remaining <= 0 ? 'overdue' : remaining <= interval * 0.1 ? 'approaching' : 'ok';

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
    await supabase.from('maintenance_plans').update({
      last_done_at: currentHM,
      next_due_at: currentHM + plan.interval_hours,
      status: 'ok',
      last_executed_at: new Date().toISOString(),
    }).eq('id', plan.id);
    toast({ title: 'Manutenção marcada como concluída!', description: `Próxima em ${currentHM + plan.interval_hours}h` });
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

  const handleRequestStatusChange = (id: string, newStatus: string) => {
    if (newStatus === 'in_progress') {
      setPhotoDialog({ requestId: id, targetStatus: 'in_progress', label: 'Foto de Início do Serviço' });
      setPhotoUrl('');
    } else if (newStatus === 'done') {
      setPhotoDialog({ requestId: id, targetStatus: 'done', label: 'Foto de Término do Serviço' });
      setPhotoUrl('');
    } else {
      // Going back to open doesn't require photo
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

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gradient">Manutenção</h1>
          <p className="text-muted-foreground mt-1">Planos preventivos e pedidos</p>
        </div>
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
                  <SelectContent>{equipments.map(eq => <SelectItem key={eq.id} value={eq.id}>{eq.name}</SelectItem>)}</SelectContent>
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
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : sortedPlans.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <Wrench className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Nenhum plano de manutenção cadastrado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedPlans.map(plan => {
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
                    <p className="text-sm text-muted-foreground">{eq?.name || 'Equipamento'}</p>
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
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pedidos de Manutenção */}
      <div>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-warning" />
          Pedidos de Manutenção
        </h2>
        {requests.length === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center">
            <p className="text-muted-foreground">Nenhum pedido registrado.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map(r => {
              const eq = equipments.find(e => e.id === r.equipment_id);
              const pc = priorityConfig[r.priority];
              const sc = requestStatusConfig[r.status];
              const rAny = r as any;
              return (
                <div key={r.id} className="glass-card rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-semibold">{r.description}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pc.bg}`}>{pc.label}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sc.bg}`}>{sc.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{eq?.name} — {r.operator_name} — {new Date(r.created_at).toLocaleDateString('pt-BR')}</p>
                      {r.notes && <p className="text-xs text-muted-foreground mt-1 italic">Obs: {r.notes}</p>}
                      {/* Photo thumbnails */}
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
                    {/* Status control */}
                    {r.status !== 'done' && (
                      <div className="shrink-0">
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
                      </div>
                    )}
                    {r.status === 'done' && r.resolved_at && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        Concluído em {new Date(r.resolved_at).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
    </div>
  );
}
