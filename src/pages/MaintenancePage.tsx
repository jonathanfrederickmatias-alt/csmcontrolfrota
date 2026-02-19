import { useState } from "react";
import { store, generateId } from "@/lib/store";
import { MaintenancePlan } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Wrench, AlertTriangle, CheckCircle, Trash2 } from "lucide-react";

export default function MaintenancePage() {
  const [plans, setPlans] = useState(store.getMaintenancePlans());
  const equipments = store.getEquipments();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ equipmentId: '', description: '', intervalHours: '', lastDoneAt: '' });
  const requests = store.getMaintenanceRequests();

  const refresh = () => setPlans(store.getMaintenancePlans());

  const handleSave = () => {
    const lastDone = Number(form.lastDoneAt);
    const interval = Number(form.intervalHours);
    const eq = equipments.find(e => e.id === form.equipmentId);
    const currentHM = eq?.currentHourMeter || 0;
    const nextDue = lastDone + interval;
    const remaining = nextDue - currentHM;

    let status: MaintenancePlan['status'] = 'ok';
    if (remaining <= 0) status = 'overdue';
    else if (remaining <= interval * 0.1) status = 'approaching';

    const mp: MaintenancePlan = {
      id: generateId(),
      equipmentId: form.equipmentId,
      description: form.description,
      intervalHours: interval,
      lastDoneAt: lastDone,
      nextDueAt: nextDue,
      status,
      createdAt: new Date().toISOString(),
    };
    store.saveMaintenancePlan(mp);
    refresh();
    setOpen(false);
    setForm({ equipmentId: '', description: '', intervalHours: '', lastDoneAt: '' });
  };

  const handleDelete = (id: string) => {
    store.deleteMaintenancePlan(id);
    refresh();
  };

  const handleComplete = (plan: MaintenancePlan) => {
    const eq = equipments.find(e => e.id === plan.equipmentId);
    const currentHM = eq?.currentHourMeter || 0;
    const updated: MaintenancePlan = {
      ...plan,
      lastDoneAt: currentHM,
      nextDueAt: currentHM + plan.intervalHours,
      status: 'ok',
    };
    store.saveMaintenancePlan(updated);
    refresh();
  };

  const statusConfig = {
    ok: { icon: CheckCircle, color: 'text-success', bg: 'bg-success/10', label: 'OK' },
    approaching: { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10', label: 'Próxima' },
    overdue: { icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/10', label: 'Atrasada' },
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-gradient">Manutenção</h1>
          <p className="text-muted-foreground mt-1">Planos preventivos e pedidos</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> Novo Plano</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle>Novo Plano de Manutenção</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Equipamento *</Label>
                <Select value={form.equipmentId} onValueChange={v => setForm({...form, equipmentId: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {equipments.map(eq => <SelectItem key={eq.id} value={eq.id}>{eq.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Descrição *</Label><Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Ex: Troca de óleo" /></div>
              <div><Label>Intervalo (horas) *</Label><Input type="number" value={form.intervalHours} onChange={e => setForm({...form, intervalHours: e.target.value})} placeholder="Ex: 500" /></div>
              <div><Label>Última feita em (horímetro) *</Label><Input type="number" value={form.lastDoneAt} onChange={e => setForm({...form, lastDoneAt: e.target.value})} placeholder="Ex: 1000" /></div>
              <Button onClick={handleSave} disabled={!form.equipmentId || !form.description || !form.intervalHours || !form.lastDoneAt} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {plans.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <Wrench className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Nenhum plano de manutenção cadastrado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.sort((a, b) => {
            const order = { overdue: 0, approaching: 1, ok: 2 };
            return order[a.status] - order[b.status];
          }).map(plan => {
            const eq = equipments.find(e => e.id === plan.equipmentId);
            const sc = statusConfig[plan.status];
            const remaining = plan.nextDueAt - (eq?.currentHourMeter || 0);
            return (
              <div key={plan.id} className={`glass-card rounded-xl p-5 border-l-4 ${
                plan.status === 'overdue' ? 'border-l-destructive' :
                plan.status === 'approaching' ? 'border-l-warning' : 'border-l-success'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold">{plan.description}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${sc.bg} ${sc.color} font-medium`}>{sc.label}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{eq?.name || 'Equipamento'}</p>
                    <div className="flex gap-4 mt-2 text-xs text-muted-foreground font-mono">
                      <span>Intervalo: {plan.intervalHours}h</span>
                      <span>Próxima: {plan.nextDueAt}h</span>
                      <span className={remaining <= 0 ? 'text-destructive' : remaining <= plan.intervalHours * 0.1 ? 'text-warning' : 'text-success'}>
                        {remaining <= 0 ? `Atrasada ${Math.abs(remaining)}h` : `Faltam ${remaining}h`}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {plan.status !== 'ok' && (
                      <Button size="sm" variant="outline" onClick={() => handleComplete(plan)} className="text-success border-success/30 hover:bg-success/10">
                        Concluir
                      </Button>
                    )}
                    <button onClick={() => handleDelete(plan.id)} className="text-muted-foreground hover:text-destructive p-2">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Maintenance Requests */}
      {requests.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">Pedidos de Manutenção</h2>
          <div className="space-y-2">
            {requests.map(r => {
              const eq = equipments.find(e => e.id === r.equipmentId);
              return (
                <div key={r.id} className="glass-card rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{r.description}</p>
                    <p className="text-xs text-muted-foreground">{eq?.name} — {r.operatorName} — {new Date(r.createdAt).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    r.priority === 'urgent' ? 'bg-destructive/20 text-destructive' :
                    r.priority === 'high' ? 'bg-warning/20 text-warning' :
                    'bg-secondary text-secondary-foreground'
                  }`}>{r.priority}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
