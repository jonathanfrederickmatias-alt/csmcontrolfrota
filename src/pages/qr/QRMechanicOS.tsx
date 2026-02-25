import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DBEquipment } from "@/lib/supabase-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, Wrench, Loader2, Play, Square, Camera } from "lucide-react";
import PublicLayout from "@/components/PublicLayout";
import PhotoUpload from "@/components/PhotoUpload";

interface WorkOrder {
  id: string;
  os_number: number;
  equipment_id: string;
  description: string;
  priority: string;
  status: string;
  mechanic_name: string | null;
  notes: string | null;
  part_code: string | null;
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

export default function QRMechanicOS() {
  const [searchParams] = useSearchParams();
  const osId = searchParams.get('id') || '';
  const [os, setOs] = useState<WorkOrder | null>(null);
  const [equipment, setEquipment] = useState<DBEquipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [mechanicName, setMechanicName] = useState('');
  const [partCode, setPartCode] = useState('');
  const [notes, setNotes] = useState('');
  const [photoStartUrl, setPhotoStartUrl] = useState('');
  const [photoEndUrl, setPhotoEndUrl] = useState('');

  const fetchOS = async () => {
    if (!osId) return;
    const { data } = await supabase.from('work_orders').select('*').eq('id', osId).single();
    if (data) {
      const wo = data as unknown as WorkOrder;
      setOs(wo);
      setMechanicName(wo.mechanic_name || '');
      setPartCode(wo.part_code || '');
      setNotes(wo.notes || '');
      setPhotoStartUrl(wo.photo_start_url || '');
      setPhotoEndUrl(wo.photo_end_url || '');

      const { data: eq } = await supabase.from('equipments').select('*').eq('id', wo.equipment_id).single();
      setEquipment(eq as DBEquipment | null);
    }
    setLoading(false);
  };

  useEffect(() => { fetchOS(); }, [osId]);

  const handleStartService = async () => {
    if (!os || !mechanicName || !photoStartUrl) return;
    setSaving(true);
    await supabase.from('work_orders').update({
      status: 'in_progress',
      mechanic_name: mechanicName,
      photo_start_url: photoStartUrl,
      started_at: new Date().toISOString(),
      part_code: partCode || null,
      notes: notes || null,
    }).eq('id', os.id);
    setSaving(false);
    fetchOS();
  };

  const handleCompleteService = async () => {
    if (!os || !photoEndUrl) return;
    setSaving(true);
    await supabase.from('work_orders').update({
      status: 'done',
      photo_end_url: photoEndUrl,
      completed_at: new Date().toISOString(),
      part_code: partCode || null,
      notes: notes || null,
    }).eq('id', os.id);
    setSaving(false);
    fetchOS();
  };

  if (loading) {
    return (
      <PublicLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </PublicLayout>
    );
  }

  if (!os) {
    return (
      <PublicLayout>
        <div className="glass-card rounded-xl p-12 text-center">
          <p className="text-muted-foreground">Ordem de Serviço não encontrada.</p>
        </div>
      </PublicLayout>
    );
  }

  if (os.status === 'done') {
    return (
      <PublicLayout>
        <div className="glass-card rounded-xl p-8 text-center">
          <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
          <h2 className="text-xl font-bold text-success">OS #{os.os_number} Concluída!</h2>
          <p className="text-muted-foreground mt-2">Serviço finalizado e registrado no histórico.</p>
          {os.mechanic_name && <p className="text-sm text-muted-foreground mt-2">Mecânico: <strong>{os.mechanic_name}</strong></p>}
          {os.part_code && <p className="text-sm text-muted-foreground">Peça: <strong>{os.part_code}</strong></p>}
          {os.started_at && <p className="text-sm text-muted-foreground">Início: {new Date(os.started_at).toLocaleString('pt-BR')}</p>}
          {os.completed_at && <p className="text-sm text-success">Término: {new Date(os.completed_at).toLocaleString('pt-BR')}</p>}
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
      </PublicLayout>
    );
  }

  const isInProgress = os.status === 'in_progress';

  return (
    <PublicLayout>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Wrench className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-black text-gradient">OS #{os.os_number}</h1>
        </div>
        <p className="text-muted-foreground text-sm">{os.description}</p>
        {equipment && <p className="text-xs text-muted-foreground mt-1">Equipamento: <strong>{equipment.name}</strong></p>}
        <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full font-medium bg-secondary text-muted-foreground">
          {priorityLabels[os.priority] || os.priority}
        </span>
      </div>

      <div className="glass-card rounded-xl p-5 space-y-4">
        {/* Mechanic name */}
        <div>
          <Label>Nome do Mecânico *</Label>
          <Input
            value={mechanicName}
            onChange={e => setMechanicName(e.target.value)}
            placeholder="Seu nome"
            disabled={isInProgress && !!os.mechanic_name}
          />
        </div>

        {/* Part code */}
        <div>
          <Label>Código da Peça Trocada</Label>
          <Input
            value={partCode}
            onChange={e => setPartCode(e.target.value)}
            placeholder="Ex: RLM-4520, FLT-001..."
          />
        </div>

        {/* Notes */}
        <div>
          <Label>Observações</Label>
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Detalhes do serviço..."
            rows={3}
          />
        </div>

        {/* START phase */}
        {!isInProgress && (
          <>
            <div className="border-t border-border pt-4">
              <p className="text-sm font-semibold flex items-center gap-2 mb-3">
                <Play className="w-4 h-4 text-primary" /> Início do Serviço
              </p>
              <PhotoUpload
                label="Foto de Início do Serviço *"
                required
                onUploaded={setPhotoStartUrl}
                value={photoStartUrl}
              />
            </div>
            <Button
              onClick={handleStartService}
              disabled={!mechanicName || !photoStartUrl || saving}
              className="w-full h-12 text-base font-bold"
            >
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
            <div className="border-t border-border pt-4">
              <p className="text-sm font-semibold flex items-center gap-2 mb-3">
                <Square className="w-4 h-4 text-success" /> Término do Serviço
              </p>
              <PhotoUpload
                label="Foto de Término do Serviço *"
                required
                onUploaded={setPhotoEndUrl}
                value={photoEndUrl}
              />
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
    </PublicLayout>
  );
}
