import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DBEquipment } from "@/lib/supabase-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, Wrench, Loader2 } from "lucide-react";
import PublicLayout from "@/components/PublicLayout";
import PhotoUpload from "@/components/PhotoUpload";

export default function QRMaintenanceRequest() {
  const [searchParams] = useSearchParams();
  const preselected = searchParams.get('equipment') || '';
  const [equipments, setEquipments] = useState<DBEquipment[]>([]);
  const [equipmentId, setEquipmentId] = useState(preselected);
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low'|'medium'|'high'|'urgent'>('medium');
  const [operatorName, setOperatorName] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');

  useEffect(() => {
    supabase.from('equipments').select('*').order('name').then(({ data }) => {
      setEquipments((data || []) as DBEquipment[]);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { data: inserted } = await supabase.from('maintenance_requests').insert({
      equipment_id: equipmentId,
      description,
      priority,
      status: 'open',
      operator_name: operatorName,
      photo_start_url: photoUrl || null,
    }).select().single();

    if (inserted && ['urgent', 'high'].includes(priority)) {
      supabase.functions.invoke('notify-maintenance', {
        body: { requestId: inserted.id },
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
          <p className="text-muted-foreground mt-2">O pedido de manutenção foi registrado com sucesso.</p>
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
        <div><Label>Descrição do Problema *</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descreva o problema detalhadamente..." rows={4} /></div>
        <div>
          <Label>Prioridade</Label>
          <select
            value={priority}
            onChange={e => setPriority(e.target.value as 'low'|'medium'|'high'|'urgent')}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 mt-1"
          >
            <option value="low">🟢 Baixa</option>
            <option value="medium">🟡 Média</option>
            <option value="high">🟠 Alta</option>
            <option value="urgent">🔴 Urgente</option>
          </select>
        </div>
        <PhotoUpload label="Foto do Problema (opcional)" onUploaded={setPhotoUrl} />
        <Button onClick={handleSave} disabled={!equipmentId || !description || !operatorName || saving} className="w-full h-12 text-base font-bold">
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          <Wrench className="w-5 h-5 mr-2" /> Enviar Pedido
        </Button>
      </div>
    </PublicLayout>
  );
}
