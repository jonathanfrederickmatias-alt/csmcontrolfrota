import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DBEquipment } from "@/lib/supabase-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, Wrench, Loader2, Plus, Trash2 } from "lucide-react";
import PublicLayout from "@/components/PublicLayout";
import PhotoUpload from "@/components/PhotoUpload";

interface RequestItem {
  id: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

let itemCounter = 0;
function newItem(): RequestItem {
  return { id: String(++itemCounter), description: '', priority: 'medium' };
}

export default function QRMaintenanceRequest() {
  const [searchParams] = useSearchParams();
  const preselected = searchParams.get('equipment') || '';
  const [equipments, setEquipments] = useState<DBEquipment[]>([]);
  const [equipmentId, setEquipmentId] = useState(preselected);
  const [operatorName, setOperatorName] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');
  const [items, setItems] = useState<RequestItem[]>([newItem()]);

  useEffect(() => {
    supabase.from('equipments').select('*').order('name').then(({ data }) => {
      setEquipments((data || []) as DBEquipment[]);
    });
  }, []);

  const updateItem = (id: string, field: keyof RequestItem, value: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const addItem = () => setItems(prev => [...prev, newItem()]);

  const removeItem = (id: string) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const validItems = items.filter(i => i.description.trim());

  const [error, setError] = useState('');

  const handleSave = async () => {
    if (validItems.length === 0) return;
    setSaving(true);
    setError('');

    // Use the first item's priority as the general priority, and a summary description
    const generalPriority = validItems.reduce((highest, item) => {
      const order = { urgent: 3, high: 2, medium: 1, low: 0 };
      return order[item.priority] > order[highest] ? item.priority : highest;
    }, 'low' as 'low' | 'medium' | 'high' | 'urgent');

    const generalDescription = validItems.length === 1
      ? validItems[0].description
      : `${validItems.length} itens de manutenção`;

    const itemsPayload = validItems.map(i => ({
      id: i.id,
      description: i.description,
      priority: i.priority,
    }));

    const { error: insertError } = await supabase.from('maintenance_requests').insert([{
      equipment_id: equipmentId,
      description: generalDescription,
      priority: generalPriority,
      status: 'open',
      operator_name: operatorName,
      photo_start_url: photoUrl || null,
      items: itemsPayload,
    } as any]);

    if (insertError) {
      console.error('Insert error:', insertError);
      setError(`Erro ao salvar: ${insertError.message}`);
      setSaving(false);
      return;
    }

    if (['urgent', 'high'].includes(generalPriority)) {
      supabase.functions.invoke('notify-maintenance', {
        body: { priority: generalPriority },
      }).catch(console.error);
    }

    setSaving(false);
    setSaved(true);
  };

  const selectedEq = equipments.find(e => e.id === equipmentId);

  if (saved) {
    return (
      <PublicLayout>
        <div className="glass-card rounded-xl p-12 text-center">
          <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
          <h2 className="text-xl font-bold text-success">Pedido Enviado!</h2>
          <p className="text-muted-foreground mt-2">
            {validItems.length > 1
              ? `${validItems.length} itens registrados. Uma OS será criada para cada item.`
              : 'O pedido de manutenção foi registrado com sucesso.'}
          </p>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Wrench className="w-6 h-6 text-warning" />
          <h1 className="text-2xl font-black text-gradient">Pedido de Manutenção</h1>
        </div>
        {selectedEq && <p className="text-muted-foreground text-sm">{selectedEq.name}</p>}
      </div>
      <div className="glass-card rounded-xl p-5 space-y-4">
        {!preselected && (
          <div>
            <Label>Equipamento *</Label>
            <select
              value={equipmentId}
              onChange={e => setEquipmentId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">Selecionar...</option>
              {equipments.map(eq => <option key={eq.id} value={eq.id}>{eq.name}</option>)}
            </select>
          </div>
        )}
        <div><Label>Seu Nome *</Label><Input value={operatorName} onChange={e => setOperatorName(e.target.value)} placeholder="Nome do operador" /></div>

        {/* Items */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-base font-bold">Itens do Pedido</Label>
            <span className="text-xs text-muted-foreground">{validItems.length} item(ns)</span>
          </div>

          {items.map((item, idx) => (
            <div key={item.id} className="border border-border rounded-lg p-3 space-y-2 bg-background/50">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-muted-foreground">Item {idx + 1}</span>
                {items.length > 1 && (
                  <button onClick={() => removeItem(item.id)} className="text-destructive hover:text-destructive/80 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <Textarea
                value={item.description}
                onChange={e => updateItem(item.id, 'description', e.target.value)}
                placeholder="Descreva o problema..."
                rows={2}
              />
              <select
                value={item.priority}
                onChange={e => updateItem(item.id, 'priority', e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="low">🟢 Baixa</option>
                <option value="medium">🟡 Média</option>
                <option value="high">🟠 Alta</option>
                <option value="urgent">🔴 Urgente</option>
              </select>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addItem}
            className="w-full gap-2 border-dashed"
          >
            <Plus className="w-4 h-4" /> Adicionar outro item
          </Button>
        </div>

        <PhotoUpload label="Foto do Problema (opcional)" onUploaded={setPhotoUrl} />
        {error && <p className="text-destructive text-sm font-medium">{error}</p>}
        <Button onClick={handleSave} disabled={!equipmentId || validItems.length === 0 || !operatorName || saving} className="w-full h-12 text-base font-bold">
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          <Wrench className="w-5 h-5 mr-2" /> Enviar Pedido ({validItems.length} item{validItems.length !== 1 ? 's' : ''})
        </Button>
      </div>
    </PublicLayout>
  );
}
