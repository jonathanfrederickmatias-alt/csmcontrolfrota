import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DBEquipment, ChecklistItemDB } from "@/lib/supabase-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardCheck, CheckCircle, Loader2, AlertTriangle, ShieldCheck, ShieldX } from "lucide-react";

const defaultItems = [
  "Nível de óleo do motor",
  "Nível de água/refrigerante",
  "Nível de óleo hidráulico",
  "Condições dos pneus/esteiras",
  "Luzes e sinalização",
  "Freios",
  "Limpador de para-brisa",
  "Vazamentos visíveis",
  "Cintos e dispositivos de segurança",
  "Extintor de incêndio",
  "Estado geral de limpeza",
  "Funcionamento dos instrumentos do painel",
];

export default function ChecklistPage() {
  const [equipments, setEquipments] = useState<DBEquipment[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [hourMeter, setHourMeter] = useState('');
  const [items, setItems] = useState<ChecklistItemDB[]>(
    defaultItems.map((label, i) => ({ id: String(i), label, checked: false, observation: '' }))
  );
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [maintenanceDesc, setMaintenanceDesc] = useState('');
  const [maintenancePriority, setMaintenancePriority] = useState('medium');
  const [savingMaintenance, setSavingMaintenance] = useState(false);

  useEffect(() => {
    supabase.from('equipments').select('*').order('name').then(({ data }) => {
      setEquipments((data || []) as DBEquipment[]);
    });
  }, []);

  const toggleItem = (id: string) => setItems(prev => prev.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
  const setObservation = (id: string, obs: string) => setItems(prev => prev.map(i => i.id === id ? { ...i, observation: obs } : i));

  const resetForm = () => {
    setSelectedEquipment('');
    setOperatorName('');
    setHourMeter('');
    setItems(defaultItems.map((label, i) => ({ id: String(i), label, checked: false, observation: '' })));
    setShowMaintenanceForm(false);
    setMaintenanceDesc('');
    setMaintenancePriority('medium');
  };

  const handleSaveChecklist = async (isConforme: boolean) => {
    setSaving(true);
    const unchecked = items.filter(i => !i.checked).length;
    const status = !isConforme ? 'critical' : unchecked > 3 ? 'critical' : unchecked > 0 ? 'attention' : 'ok';

    await supabase.from('checklists').insert({
      equipment_id: selectedEquipment,
      operator_name: operatorName,
      hour_meter: Number(hourMeter),
      date: new Date().toISOString().split('T')[0],
      items: items as unknown as never,
      status,
    });

    setSaving(false);

    if (!isConforme) {
      const failedItems = items.filter(i => !i.checked).map(i => {
        const obs = i.observation ? ` (${i.observation})` : '';
        return `- ${i.label}${obs}`;
      }).join('\n');
      setMaintenanceDesc(`Itens não conformes do checklist:\n${failedItems}`);
      setShowMaintenanceForm(true);
    } else {
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        resetForm();
      }, 2000);
    }
  };

  const handleSaveMaintenance = async () => {
    setSavingMaintenance(true);
    await supabase.from('maintenance_requests').insert({
      equipment_id: selectedEquipment,
      operator_name: operatorName,
      description: maintenanceDesc,
      priority: maintenancePriority,
      status: 'open',
    });
    setSavingMaintenance(false);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      resetForm();
    }, 2000);
  };

  const canSave = selectedEquipment && operatorName && hourMeter;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-gradient">Checklist Diário</h1>
        <p className="text-muted-foreground mt-1">Inspeção diária do equipamento</p>
      </div>

      {saved ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
          <h2 className="text-xl font-bold text-success">Checklist Salvo!</h2>
          <p className="text-muted-foreground mt-2">Horímetro atualizado e plano de manutenção verificado.</p>
        </div>
      ) : showMaintenanceForm ? (
        <div className="space-y-6">
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-warning" />
              <h2 className="text-lg font-bold">Pedido de Manutenção — Não Conforme</h2>
            </div>
            <div className="space-y-4">
              <div>
                <Label>Descrição do Problema *</Label>
                <Textarea
                  value={maintenanceDesc}
                  onChange={e => setMaintenanceDesc(e.target.value)}
                  rows={6}
                  placeholder="Descreva o que está errado..."
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select value={maintenancePriority} onValueChange={setMaintenancePriority}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => { setShowMaintenanceForm(false); setSaved(true); setTimeout(() => { setSaved(false); resetForm(); }, 2000); }} className="flex-1">
                  Pular
                </Button>
                <Button
                  onClick={handleSaveMaintenance}
                  disabled={!maintenanceDesc || savingMaintenance}
                  className="flex-1 bg-warning text-warning-foreground hover:bg-warning/90"
                >
                  {savingMaintenance && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Enviar Pedido
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="glass-card rounded-xl p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Equipamento *</Label>
                <Select value={selectedEquipment} onValueChange={setSelectedEquipment}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent position="popper">
                    {equipments.map(eq => <SelectItem key={eq.id} value={eq.id}>{eq.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Operador *</Label>
                <Input value={operatorName} onChange={e => setOperatorName(e.target.value)} placeholder="Nome do operador" />
              </div>
              <div>
                <Label>Horímetro Atual *</Label>
                <Input type="number" inputMode="decimal" value={hourMeter} onChange={e => setHourMeter(e.target.value)} placeholder="Ex: 1250" />
              </div>
            </div>
          </div>

          <div className="glass-card rounded-xl p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-primary" />
              Itens de Verificação
            </h2>
            <div className="space-y-3">
              {items.map(item => (
                <div key={item.id} className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${item.checked ? 'bg-success/5' : 'bg-secondary/50'}`}>
                  <Checkbox checked={item.checked} onCheckedChange={() => toggleItem(item.id)} className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-medium ${item.checked ? 'text-success line-through' : 'text-foreground'}`}>{item.label}</span>
                    {!item.checked && (
                      <Input className="mt-2 h-8 text-xs" placeholder="Observação (opcional)" value={item.observation} onChange={e => setObservation(item.id, e.target.value)} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => handleSaveChecklist(false)}
              disabled={!canSave || saving}
              variant="outline"
              className="h-12 text-base font-bold border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <ShieldX className="w-5 h-5 mr-2" />
              Não Conforme
            </Button>
            <Button
              onClick={() => handleSaveChecklist(true)}
              disabled={!canSave || saving}
              className="h-12 text-base font-bold bg-success text-success-foreground hover:bg-success/90"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <ShieldCheck className="w-5 h-5 mr-2" />
              Conforme
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
