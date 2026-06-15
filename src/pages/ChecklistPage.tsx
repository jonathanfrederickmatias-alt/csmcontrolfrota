import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DBEquipment, ChecklistItemDB } from "@/lib/supabase-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardCheck, CheckCircle, Loader2, AlertTriangle, ShieldCheck, ShieldX, Plus, Trash2, Ban } from "lucide-react";
import PhotoUpload from "@/components/PhotoUpload";
import { toast } from "sonner";

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
  "Calibração dos pneus",
  "Condições do Tacógrafo",
];

type ChecklistType = 'daily' | 'corrective' | 'preventive';

export default function ChecklistPage() {
  const [equipments, setEquipments] = useState<DBEquipment[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [hourMeter, setHourMeter] = useState('');
  const [checklistType, setChecklistType] = useState<ChecklistType>('daily');
  const [items, setItems] = useState<ChecklistItemDB[]>(
    defaultItems.map((label, i) => ({ id: String(i), label, checked: null as unknown as boolean, observation: '' }))
  );
  const [newItemLabel, setNewItemLabel] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [generalObservations, setGeneralObservations] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [maintenanceDesc, setMaintenanceDesc] = useState('');
  const [maintenancePriority, setMaintenancePriority] = useState('medium');
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  const [maintenancePhotoUrl, setMaintenancePhotoUrl] = useState('');

  useEffect(() => {
    supabase.from('equipments').select('*').order('name').then(({ data }) => {
      setEquipments((data || []) as DBEquipment[]);
    });
  }, []);

  useEffect(() => {
    if (checklistType === 'daily') {
      setItems(defaultItems.map((label, i) => ({ id: String(i), label, checked: null as unknown as boolean, observation: '' })));
    } else {
      setItems([]);
    }
  }, [checklistType]);

  const toggleItem = (id: string, value: boolean) => setItems(prev => prev.map(i => i.id === id ? { ...i, checked: value, na: false } : i));
  const setNa = (id: string, value: boolean) => setItems(prev => prev.map(i => i.id === id ? { ...i, na: value, checked: value ? (null as unknown as boolean) : i.checked } : i));
  const setObservation = (id: string, obs: string) => setItems(prev => prev.map(i => i.id === id ? { ...i, observation: obs } : i));

  const addItem = () => {
    if (!newItemLabel.trim()) return;
    setItems(prev => [...prev, { id: String(Date.now()), label: newItemLabel.trim(), checked: null as unknown as boolean, observation: '' }]);
    setNewItemLabel('');
  };

  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));

  const resetForm = () => {
    setSelectedEquipment('');
    setOperatorName('');
    setHourMeter('');
    setChecklistType('daily');
    setItems(defaultItems.map((label, i) => ({ id: String(i), label, checked: null as unknown as boolean, observation: '' })));
    setNewItemLabel('');
    setPhotoUrl('');
    setGeneralObservations('');
    setShowMaintenanceForm(false);
    setMaintenanceDesc('');
    setMaintenancePriority('medium');
    setMaintenancePhotoUrl('');
  };

  const handleSaveChecklist = async () => {
    setSaving(true);
    const unchecked = items.filter(i => i.checked === false && !i.na).length;
    const isConforme = unchecked === 0;
    const status = !isConforme ? (unchecked > 3 ? 'critical' : 'attention') : 'ok';

    const { getMyTenantId } = await import('@/lib/tenant');
    const tenant_id = await getMyTenantId();

    await supabase.from('checklists').insert([{
      tenant_id,
      equipment_id: selectedEquipment,
      operator_name: operatorName,
      hour_meter: Number(hourMeter),
      date: new Date().toISOString().split('T')[0],
      items: items as unknown as never,
      status,
      type: checklistType,
      photo_url: photoUrl || null,
      observations: generalObservations || null,
    }]);

    setSaving(false);

    const hasObservations = generalObservations.trim().length > 0;

    if (!isConforme || hasObservations) {
      const parts: string[] = [];
      const typeLabel = checklistType === 'corrective' ? 'Corretivo' : checklistType === 'preventive' ? 'Preventivo' : 'Diário';

      if (!isConforme) {
        const failedItems = items.filter(i => i.checked === false).map(i => {
          const obs = i.observation ? ` (${i.observation})` : '';
          return `- ${i.label}${obs}`;
        }).join('\n');
        parts.push(`Itens não conformes do checklist ${typeLabel}:\n${failedItems}`);
      }

      if (hasObservations) {
        parts.push(`Observações Gerais:\n${generalObservations.trim()}`);
      }

      setMaintenanceDesc(parts.join('\n\n'));
      setShowMaintenanceForm(true);
    } else {
      setSaved(true);
      setTimeout(() => { setSaved(false); resetForm(); }, 2000);
    }
  };

  const handleSaveMaintenance = async () => {
    if (!maintenancePhotoUrl) {
      toast.error('Foto obrigatória para o pedido de manutenção.');
      return;
    }
    setSavingMaintenance(true);
    const { getMyTenantId } = await import('@/lib/tenant');
    const tenant_id = await getMyTenantId();
    await supabase.from('maintenance_requests').insert([{
      tenant_id,
      equipment_id: selectedEquipment,
      operator_name: operatorName,
      description: maintenanceDesc,
      priority: maintenancePriority,
      status: 'open',
      photo_start_url: maintenancePhotoUrl,
    }]);
    setSavingMaintenance(false);
    setSaved(true);
    setTimeout(() => { setSaved(false); resetForm(); }, 2000);
  };

  const allAnswered = items.length > 0 && items.every(i => i.checked === true || i.checked === false || i.na === true);
  const hasNC = items.some(i => i.checked === false && !i.na);
  const canSave = selectedEquipment && operatorName && hourMeter && allAnswered;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-gradient">Checklist</h1>
        <p className="text-muted-foreground mt-1">Inspeção do equipamento</p>
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
                <Textarea value={maintenanceDesc} onChange={e => setMaintenanceDesc(e.target.value)} rows={6} placeholder="Descreva o que está errado..." className="mt-1" />
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
              <PhotoUpload label="Foto da Não Conformidade" required onUploaded={setMaintenancePhotoUrl} />
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => { setShowMaintenanceForm(false); setSaved(true); setTimeout(() => { setSaved(false); resetForm(); }, 2000); }} className="flex-1">
                  Pular
                </Button>
                <Button
                  onClick={handleSaveMaintenance}
                  disabled={!maintenanceDesc || !maintenancePhotoUrl || savingMaintenance}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label>Tipo de Checklist *</Label>
                <Select value={checklistType} onValueChange={v => setChecklistType(v as ChecklistType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="daily">Diário</SelectItem>
                    <SelectItem value="corrective">Corretivo</SelectItem>
                    <SelectItem value="preventive">Preventivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Equipamento *</Label>
                <Select value={selectedEquipment} onValueChange={setSelectedEquipment}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent position="popper">
                    {equipments.map(eq => {
                      const ident = eq.cost_center || eq.plate || '';
                      return <SelectItem key={eq.id} value={eq.id}>{ident ? `${eq.name} (${ident})` : eq.name}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          {/* Manual item addition for corrective/preventive */}
          {checklistType !== 'daily' && (
            <div className="glass-card rounded-xl p-6">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" />
                Adicionar Itens de Verificação
              </h2>
              <div className="flex gap-2">
                <Input
                  value={newItemLabel}
                  onChange={e => setNewItemLabel(e.target.value)}
                  placeholder="Descreva o item a verificar..."
                  onKeyDown={e => e.key === 'Enter' && addItem()}
                />
                <Button onClick={addItem} disabled={!newItemLabel.trim()}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {items.length === 0 && (
                <p className="text-xs text-muted-foreground text-center mt-4">Adicione pelo menos um item para verificar</p>
              )}
            </div>
          )}

          {items.length > 0 && (
            <div className="glass-card rounded-xl p-6">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-primary" />
                Itens de Verificação
              </h2>
              <div className="space-y-3">
                {items.map(item => (
                  <div key={item.id} className={`p-3 rounded-lg transition-colors ${item.na ? 'bg-muted/50' : item.checked === true ? 'bg-success/5' : item.checked === false ? 'bg-destructive/5' : 'bg-secondary/50'}`}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className={`text-sm font-medium ${item.na ? 'text-muted-foreground line-through' : item.checked === true ? 'text-success' : item.checked === false ? 'text-destructive' : 'text-foreground'}`}>{item.label}</span>
                      <div className="flex gap-1 flex-shrink-0">
                        {checklistType !== 'daily' && (
                          <Button type="button" size="sm" variant="ghost" className="h-7 px-1 text-xs text-muted-foreground hover:text-destructive" onClick={() => removeItem(item.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button type="button" size="sm" variant={item.checked === false ? "destructive" : "outline"} className="h-7 px-2 text-xs" onClick={() => toggleItem(item.id, false)}>
                          <ShieldX className="w-3.5 h-3.5 mr-1" /><span translate="no">NC</span>
                        </Button>
                        <Button type="button" size="sm" variant={item.na ? "secondary" : "outline"} className={`h-7 px-2 text-xs ${item.na ? 'bg-muted text-muted-foreground' : ''}`} onClick={() => setNa(item.id, !item.na)}>
                          <span translate="no">Não aplica</span>
                        </Button>
                        <Button type="button" size="sm" variant={item.checked === true ? "default" : "outline"} className={`h-7 px-2 text-xs ${item.checked === true ? 'bg-success text-success-foreground hover:bg-success/90' : ''}`} onClick={() => toggleItem(item.id, true)}>
                          <ShieldCheck className="w-3.5 h-3.5 mr-1" /><span translate="no">C</span>
                        </Button>
                      </div>
                    </div>
                    {item.checked === false && !item.na && (
                      <Input className="mt-2 h-8 text-xs" placeholder="Observação (obrigatório p/ não conforme)" value={item.observation} onChange={e => setObservation(item.id, e.target.value)} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* General observations */}
          <div className="glass-card rounded-xl p-6">
            <Label>Observações Gerais</Label>
            <Textarea
              value={generalObservations}
              onChange={e => setGeneralObservations(e.target.value)}
              placeholder="Observações do operador (opcional)..."
              rows={3}
              className="mt-1"
            />
          </div>

          {/* Optional photo */}
          <div className="glass-card rounded-xl p-6">
            <PhotoUpload label="Foto (opcional)" onUploaded={setPhotoUrl} value={photoUrl} />
          </div>

          {/* Photo required when NC exists */}
          {hasNC && !photoUrl && (
            <p className="text-xs text-warning text-center">⚠️ Recomendado: tire uma foto de evidência quando há itens não conformes</p>
          )}

          <div>
            <Button
              onClick={handleSaveChecklist}
              disabled={!canSave || saving}
              className="w-full h-12 text-base font-bold bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <ClipboardCheck className="w-5 h-5 mr-2" />
              Salvar Checklist
            </Button>
            {items.length > 0 && !allAnswered && selectedEquipment && operatorName && hourMeter && (
              <p className="text-xs text-muted-foreground text-center mt-2">Responda todos os itens para salvar</p>
            )}
            {items.length === 0 && checklistType !== 'daily' && (
              <p className="text-xs text-muted-foreground text-center mt-2">Adicione itens de verificação para continuar</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
