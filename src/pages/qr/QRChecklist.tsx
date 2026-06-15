import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DBEquipment, ChecklistItemDB } from "@/lib/supabase-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardCheck, CheckCircle, Loader2, AlertTriangle, ShieldCheck, ShieldX, Plus, Trash2 } from "lucide-react";
import PublicLayout from "@/components/PublicLayout";
import { useSearchParams } from "react-router-dom";
import PhotoUpload from "@/components/PhotoUpload";
import { toast } from "sonner";

const defaultItems = [
  "Nível de óleo do motor","Nível de água/refrigerante","Nível de óleo hidráulico",
  "Condições dos pneus/esteiras","Luzes e sinalização","Freios","Limpador de para-brisa",
  "Vazamentos visíveis","Cintos e dispositivos de segurança","Extintor de incêndio",
  "Estado geral de limpeza","Funcionamento dos instrumentos do painel",
  "Calibração dos pneus","Condições do Tacógrafo",
];

type ChecklistType = 'daily' | 'corrective' | 'preventive';

export default function QRChecklist() {
  const [searchParams] = useSearchParams();
  const preselected = searchParams.get('equipment') || '';
  const [equipments, setEquipments] = useState<DBEquipment[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState(preselected);
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
  const [maintenanceSaved, setMaintenanceSaved] = useState(false);
  const [maintenancePhotoUrl, setMaintenancePhotoUrl] = useState('');
  const [lastHourMeter, setLastHourMeter] = useState<number | null>(null);

  useEffect(() => {
    supabase.from('equipments').select('*').order('name').then(({ data }) => {
      setEquipments((data || []) as DBEquipment[]);
    });
  }, []);

  // Fetch the last recorded hour meter for the selected equipment
  useEffect(() => {
    if (!selectedEquipment) { setLastHourMeter(null); return; }
    // Get the equipment's current_hour_meter as baseline
    const eq = equipments.find(e => e.id === selectedEquipment);
    const eqHour = eq?.current_hour_meter || 0;
    // Also check the latest checklist
    supabase.from('checklists')
      .select('hour_meter')
      .eq('equipment_id', selectedEquipment)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        const lastChecklist = data?.[0]?.hour_meter || 0;
        setLastHourMeter(Math.max(Number(eqHour), Number(lastChecklist)));
      });
  }, [selectedEquipment, equipments]);

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

  const handleSaveChecklist = async () => {
    // Photo is optional now

    setSaving(true);
    const unchecked = items.filter(i => i.checked === false && !i.na).length;
    const isConforme = unchecked === 0;
    const status = !isConforme ? (unchecked > 3 ? 'critical' : 'attention') : 'ok';

    const eq = equipments.find(e => e.id === selectedEquipment);
    const tenant_id = eq?.tenant_id;
    if (!tenant_id) { setSaving(false); toast.error('Equipamento sem empresa associada.'); return; }

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
    }
  };

  const handleSaveMaintenance = async () => {
    // Photo is optional for maintenance request
    setSavingMaintenance(true);
    const eq = equipments.find(e => e.id === selectedEquipment);
    const tenant_id = eq?.tenant_id;
    if (!tenant_id) { setSavingMaintenance(false); toast.error('Equipamento sem empresa associada.'); return; }
    await supabase.from('maintenance_requests').insert([{
      tenant_id,
      equipment_id: selectedEquipment,
      operator_name: operatorName,
      description: maintenanceDesc,
      priority: maintenancePriority,
      status: 'open',
      photo_start_url: maintenancePhotoUrl || null,
    }]);
    setSavingMaintenance(false);
    setMaintenanceSaved(true);

    if (maintenancePriority === 'high' || maintenancePriority === 'urgent') {
      const eq = equipments.find(e => e.id === selectedEquipment);
      try {
        await supabase.functions.invoke('notify-maintenance', {
          body: { equipment_name: eq?.name || 'Desconhecido', operator_name: operatorName, description: maintenanceDesc, priority: maintenancePriority },
        });
      } catch (_) { /* silent */ }
    }
  };

  const hourMeterTooLow = lastHourMeter !== null && hourMeter !== '' && Number(hourMeter) < lastHourMeter;
  const allAnswered = items.length > 0 && items.every(i => i.checked === true || i.checked === false || i.na === true);
  const hasNC = items.some(i => i.checked === false && !i.na);
  const canSave = selectedEquipment && operatorName && hourMeter && allAnswered && !hourMeterTooLow;

  if (maintenanceSaved) {
    return (
      <PublicLayout>
        <div className="glass-card rounded-xl p-12 text-center">
          <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
          <h2 className="text-xl font-bold text-success">Checklist e Pedido de Manutenção Salvos!</h2>
          <p className="text-muted-foreground mt-2">Obrigado, {operatorName}! O gestor será notificado.</p>
        </div>
      </PublicLayout>
    );
  }

  if (showMaintenanceForm) {
    return (
      <PublicLayout>
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-6 h-6 text-warning" />
            <h1 className="text-2xl font-black text-gradient">Pedido de Manutenção</h1>
          </div>
          <p className="text-muted-foreground text-sm">Checklist não conforme — descreva o problema</p>
        </div>
        <div className="glass-card rounded-xl p-5 space-y-4">
          <div>
            <Label>Descrição do Problema *</Label>
            <Textarea value={maintenanceDesc} onChange={e => setMaintenanceDesc(e.target.value)} rows={6} placeholder="Descreva o que está errado..." className="mt-1" />
          </div>
          <div>
            <Label>Prioridade</Label>
            <select value={maintenancePriority} onChange={e => setMaintenancePriority(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 mt-1">
              <option value="low">Baixa</option>
              <option value="medium">Média</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </select>
          </div>
          <PhotoUpload label="Foto da Não Conformidade (opcional)" onUploaded={setMaintenancePhotoUrl} />
          <Button
            onClick={handleSaveMaintenance}
            disabled={!maintenanceDesc || savingMaintenance}
            className="w-full h-12 text-base font-bold bg-warning text-warning-foreground hover:bg-warning/90"
          >
            {savingMaintenance && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Enviar Pedido de Manutenção
          </Button>
        </div>
      </PublicLayout>
    );
  }

  if (saved) {
    return (
      <PublicLayout>
        <div className="glass-card rounded-xl p-12 text-center">
          <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
          <h2 className="text-xl font-bold text-success">Checklist Salvo — Conforme!</h2>
          <p className="text-muted-foreground mt-2">Obrigado, {operatorName}! Horímetro atualizado.</p>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <ClipboardCheck className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-black text-gradient">Checklist</h1>
        </div>
        {equipments.find(e => e.id === selectedEquipment) && <p className="text-muted-foreground text-sm">{equipments.find(e => e.id === selectedEquipment)?.name}</p>}
      </div>
      <div className="space-y-4">
        <div className="glass-card rounded-xl p-5 space-y-4">
          <div>
            <Label>Tipo de Checklist *</Label>
            <select value={checklistType} onChange={e => setChecklistType(e.target.value as ChecklistType)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
              <option value="daily">Diário</option>
              <option value="corrective">Corretivo</option>
              <option value="preventive">Preventivo</option>
            </select>
          </div>
          {!preselected && (
            <div>
              <Label>Equipamento *</Label>
              <select value={selectedEquipment} onChange={e => setSelectedEquipment(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                <option value="">Selecionar...</option>
                {equipments.map(eq => <option key={eq.id} value={eq.id}>{eq.name}</option>)}
              </select>
            </div>
          )}
          <div><Label>Seu Nome *</Label><Input value={operatorName} onChange={e => setOperatorName(e.target.value)} placeholder="Nome do operador" /></div>
          <div>
            <Label>Horímetro Atual *</Label>
            <Input type="number" inputMode="decimal" value={hourMeter} onChange={e => setHourMeter(e.target.value)} placeholder={lastHourMeter ? `Mínimo: ${lastHourMeter}` : 'Ex: 1250'} className={hourMeterTooLow ? 'border-destructive' : ''} />
            {hourMeterTooLow && (
              <p className="text-xs text-destructive mt-1">⚠️ Horímetro não pode ser menor que o último registrado ({lastHourMeter}h)</p>
            )}
          </div>
        </div>

        {checklistType !== 'daily' && (
          <div className="glass-card rounded-xl p-5">
            <h2 className="font-bold mb-3 text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Plus className="w-4 h-4" /> Adicionar Itens
            </h2>
            <div className="flex gap-2">
              <Input value={newItemLabel} onChange={e => setNewItemLabel(e.target.value)} placeholder="Descreva o item..." onKeyDown={e => e.key === 'Enter' && addItem()} />
              <Button onClick={addItem} disabled={!newItemLabel.trim()} size="sm"><Plus className="w-4 h-4" /></Button>
            </div>
            {items.length === 0 && <p className="text-xs text-muted-foreground text-center mt-3">Adicione itens para verificar</p>}
          </div>
        )}

        {items.length > 0 && (
          <div className="glass-card rounded-xl p-5">
            <h2 className="font-bold mb-3 text-sm text-muted-foreground uppercase tracking-wider">Itens de Verificação</h2>
            <div className="space-y-2">
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
        <div className="glass-card rounded-xl p-5">
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
        <div className="glass-card rounded-xl p-5">
          <PhotoUpload label="Foto (opcional)" onUploaded={setPhotoUrl} value={photoUrl} />
        </div>

        {hasNC && !photoUrl && (
          <p className="text-xs text-warning text-center">⚠️ Recomendado: tire uma foto de evidência quando há itens não conformes</p>
        )}

        <div>
          <Button onClick={handleSaveChecklist} disabled={!canSave || saving} className="w-full h-14 text-base font-bold bg-primary text-primary-foreground hover:bg-primary/90">
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
    </PublicLayout>
  );
}
