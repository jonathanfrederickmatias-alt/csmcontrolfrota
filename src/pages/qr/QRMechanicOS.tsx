import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DBEquipment } from "@/lib/supabase-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, Wrench, Loader2, Play, Square, Plus, Trash2, Package, CheckSquare, SquareIcon } from "lucide-react";
import PublicLayout from "@/components/PublicLayout";
import PhotoUpload from "@/components/PhotoUpload";
import MultiPhotoUpload from "@/components/MultiPhotoUpload";

interface Part {
  code: string;
  description: string;
}

interface RequestItem {
  id: string;
  description: string;
  priority: string;
  done?: boolean;
}

interface WorkOrder {
  id: string;
  os_number: number;
  equipment_id: string;
  maintenance_request_id: string;
  description: string;
  priority: string;
  status: string;
  mechanic_name: string | null;
  notes: string | null;
  part_code: string | null;
  parts: Part[];
  photo_start_url: string | null;
  photo_end_url: string | null;
  photos_start: string[] | null;
  photos_end: string[] | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  cause_identified: string | null;
  service_executed: string | null;
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
  const [parts, setParts] = useState<Part[]>([{ code: '', description: '' }]);
  const [notes, setNotes] = useState('');
  const [photosStart, setPhotosStart] = useState<string[]>([]);
  const [photosEnd, setPhotosEnd] = useState<string[]>([]);
  const [resolvingReported, setResolvingReported] = useState(true);
  const [causeIdentified, setCauseIdentified] = useState('');
  const [serviceExecuted, setServiceExecuted] = useState('');

  // Request items for per-item completion
  const [requestItems, setRequestItems] = useState<RequestItem[]>([]);

  const fetchOS = async () => {
    if (!osId) return;
    const { data } = await supabase.from('work_orders').select('*').eq('id', osId).single();
    if (data) {
      const wo = data as unknown as WorkOrder;
      setOs(wo);
      setMechanicName(wo.mechanic_name || '');
      setNotes(wo.notes || '');
      setPhotosStart(wo.photos_start && wo.photos_start.length ? wo.photos_start : (wo.photo_start_url ? [wo.photo_start_url] : []));
      setPhotosEnd(wo.photos_end && wo.photos_end.length ? wo.photos_end : (wo.photo_end_url ? [wo.photo_end_url] : []));
      setCauseIdentified(wo.cause_identified || '');
      setServiceExecuted(wo.service_executed || '');
      // If a distinct cause was already recorded and differs from OS description, mark as not resolving reported
      setResolvingReported(!wo.cause_identified || wo.cause_identified === wo.description);

      const dbParts = Array.isArray(wo.parts) && wo.parts.length > 0
        ? wo.parts
        : wo.part_code
          ? [{ code: wo.part_code, description: '' }]
          : [{ code: '', description: '' }];
      setParts(dbParts);

      // Fetch linked maintenance request items
      const { data: reqData } = await supabase
        .from('maintenance_requests')
        .select('items')
        .eq('id', wo.maintenance_request_id)
        .single();

      if (reqData && Array.isArray(reqData.items)) {
        setRequestItems((reqData.items as unknown as RequestItem[]).map(item => ({
          ...item,
          done: item.done || false,
        })));
      }

      const { data: eq } = await supabase.from('equipments').select('*').eq('id', wo.equipment_id).single();
      setEquipment(eq as DBEquipment | null);
    }
    setLoading(false);
  };

  useEffect(() => { fetchOS(); }, [osId]);

  const addPart = () => setParts(prev => [...prev, { code: '', description: '' }]);
  const removePart = (index: number) => setParts(prev => prev.filter((_, i) => i !== index));
  const updatePart = (index: number, field: keyof Part, value: string) => {
    setParts(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const cleanParts = () => parts.filter(p => p.code.trim() || p.description.trim());

  const toggleItemDone = (itemId: string) => {
    setRequestItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, done: !item.done } : item
    ));
  };

  const allItemsDone = requestItems.length > 0 && requestItems.every(i => i.done);
  const doneCount = requestItems.filter(i => i.done).length;

  const saveItemsStatus = async () => {
    if (!os) return;
    // Save item completion status back to the maintenance_request items
    await supabase.from('maintenance_requests').update({
      items: requestItems as unknown as any,
    }).eq('id', os.maintenance_request_id);
  };

  const resolvedCause = () => resolvingReported ? (os?.description || '') : (causeIdentified.trim() || '');

  const handleStartService = async () => {
    if (!os || !mechanicName || photosStart.length === 0) return;
    setSaving(true);
    await supabase.from('work_orders').update({
      status: 'in_progress',
      mechanic_name: mechanicName,
      photos_start: photosStart as unknown as any,
      photo_start_url: photosStart[0] || null,
      started_at: new Date().toISOString(),
      parts: cleanParts() as unknown as any,
      part_code: cleanParts().map(p => p.code).filter(Boolean).join(', ') || null,
      notes: notes || null,
      cause_identified: resolvedCause() || null,
      service_executed: serviceExecuted || null,
    }).eq('id', os.id);
    await saveItemsStatus();
    setSaving(false);
    fetchOS();
  };

  const handleCompleteService = async () => {
    if (!os || photosEnd.length === 0 || !serviceExecuted.trim()) return;
    setSaving(true);
    await supabase.from('work_orders').update({
      status: 'done',
      photos_end: photosEnd as unknown as any,
      photo_end_url: photosEnd[0] || null,
      completed_at: new Date().toISOString(),
      parts: cleanParts() as unknown as any,
      part_code: cleanParts().map(p => p.code).filter(Boolean).join(', ') || null,
      notes: notes || null,
      cause_identified: resolvedCause() || null,
      service_executed: serviceExecuted.trim(),
    }).eq('id', os.id);
    // Mark all items as done on completion
    const allDoneItems = requestItems.map(i => ({ ...i, done: true }));
    await supabase.from('maintenance_requests').update({
      items: allDoneItems as unknown as any,
    }).eq('id', os.maintenance_request_id);
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
    const doneParts = Array.isArray(os.parts) ? os.parts : [];
    return (
      <PublicLayout>
        <div className="glass-card rounded-xl p-8 text-center">
          <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
          <h2 className="text-xl font-bold text-success">OS #{os.os_number} Concluída!</h2>
          <p className="text-muted-foreground mt-2">Serviço finalizado e registrado no histórico.</p>
          {os.mechanic_name && <p className="text-sm text-muted-foreground mt-2">Mecânico: <strong>{os.mechanic_name}</strong></p>}
          {os.started_at && <p className="text-sm text-muted-foreground">Início: {new Date(os.started_at).toLocaleString('pt-BR')}</p>}
          {os.completed_at && <p className="text-sm text-success">Término: {new Date(os.completed_at).toLocaleString('pt-BR')}</p>}

          {/* Request items summary */}
          {requestItems.length > 0 && (
            <div className="mt-4 text-left">
              <p className="text-xs text-muted-foreground font-semibold mb-2">
                Itens do Pedido ({requestItems.length})
              </p>
              <div className="space-y-1.5">
                {requestItems.map((item) => (
                  <div key={item.id} className="bg-success/10 rounded-lg px-3 py-2 text-sm flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-success shrink-0" />
                    <span>{item.description}</span>
                    <span className="ml-auto text-xs">{priorityLabels[item.priority] || item.priority}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {doneParts.length > 0 && (
            <div className="mt-4 text-left">
              <p className="text-xs text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" /> Peças Trocadas ({doneParts.length})
              </p>
              <div className="space-y-1.5">
                {doneParts.map((p, i) => (
                  <div key={i} className="bg-secondary/50 rounded-lg px-3 py-2 text-sm">
                    <span className="font-mono font-bold text-primary">{p.code || '—'}</span>
                    {p.description && <span className="text-muted-foreground ml-2">— {p.description}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(() => {
            const startPhotos = (os.photos_start && os.photos_start.length ? os.photos_start : (os.photo_start_url ? [os.photo_start_url] : []));
            const endPhotos = (os.photos_end && os.photos_end.length ? os.photos_end : (os.photo_end_url ? [os.photo_end_url] : []));
            if (startPhotos.length === 0 && endPhotos.length === 0) return null;
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                {startPhotos.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Fotos de Início ({startPhotos.length})</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {startPhotos.map((u, i) => (
                        <a key={u + i} href={u} target="_blank" rel="noreferrer">
                          <img src={u} alt={`Início ${i + 1}`} className="w-full h-20 object-cover rounded-lg border border-border" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {endPhotos.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Fotos de Término ({endPhotos.length})</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {endPhotos.map((u, i) => (
                        <a key={u + i} href={u} target="_blank" rel="noreferrer">
                          <img src={u} alt={`Término ${i + 1}`} className="w-full h-20 object-cover rounded-lg border border-border" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
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
        {/* Request items checklist */}
        {requestItems.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-base font-bold">Itens do Pedido</Label>
              <span className="text-xs text-muted-foreground">{doneCount}/{requestItems.length} concluídos</span>
            </div>
            <div className="space-y-2">
              {requestItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => isInProgress && toggleItemDone(item.id)}
                  className={`w-full text-left border rounded-lg p-3 flex items-start gap-3 transition-colors ${
                    item.done
                      ? 'bg-success/10 border-success/30'
                      : 'bg-background/50 border-border hover:border-primary/30'
                  } ${!isInProgress ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  {item.done ? (
                    <CheckSquare className="w-5 h-5 text-success shrink-0 mt-0.5" />
                  ) : (
                    <SquareIcon className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${item.done ? 'line-through text-muted-foreground' : ''}`}>
                      {item.description}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {priorityLabels[item.priority] || item.priority}
                    </span>
                  </div>
                </button>
              ))}
            </div>
            {!isInProgress && (
              <p className="text-xs text-muted-foreground mt-2 italic">
                Inicie o serviço para marcar itens como concluídos.
              </p>
            )}
          </div>
        )}

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

        {/* Problema x Solução */}
        <div className="border border-border rounded-lg p-3 bg-secondary/30 space-y-3">
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1">Problema relatado na OS</p>
            <p className="text-sm bg-background/60 rounded px-2 py-1.5 border border-border">{os.description}</p>
          </div>

          <label className="flex items-start gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={resolvingReported}
              onChange={e => {
                setResolvingReported(e.target.checked);
                if (e.target.checked) setCauseIdentified('');
              }}
              className="mt-1 w-4 h-4 accent-primary"
            />
            <span className="text-sm">
              Estou resolvendo <strong>exatamente</strong> o problema relatado nesta OS
            </span>
          </label>

          {!resolvingReported && (
            <div>
              <Label className="text-sm">Problema real identificado *</Label>
              <Textarea
                value={causeIdentified}
                onChange={e => setCauseIdentified(e.target.value)}
                placeholder="Descreva o que realmente foi identificado..."
                rows={2}
              />
            </div>
          )}

          <div>
            <Label className="text-sm">Solução aplicada / Serviço executado *</Label>
            <Textarea
              value={serviceExecuted}
              onChange={e => setServiceExecuted(e.target.value)}
              placeholder="Descreva o que foi feito para solucionar..."
              rows={3}
            />
          </div>
        </div>

        {/* Parts list */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="flex items-center gap-1.5">
              <Package className="w-4 h-4" /> Peças Trocadas
            </Label>
            <Button type="button" variant="outline" size="sm" onClick={addPart} className="gap-1 text-xs h-7">
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </Button>
          </div>
          <div className="space-y-2">
            {parts.map((part, index) => (
              <div key={index} className="flex gap-2 items-start">
                <div className="flex-1 space-y-1.5">
                  <Input
                    value={part.code}
                    onChange={e => updatePart(index, 'code', e.target.value)}
                    placeholder="Código (ex: RLM-4520)"
                    className="h-9 text-sm"
                  />
                  <Input
                    value={part.description}
                    onChange={e => updatePart(index, 'description', e.target.value)}
                    placeholder="Descrição da peça"
                    className="h-9 text-sm"
                  />
                </div>
                {parts.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removePart(index)}
                    className="h-9 w-9 p-0 text-destructive hover:text-destructive shrink-0 mt-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
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
              <MultiPhotoUpload
                label="Fotos de Início do Serviço *"
                required
                values={photosStart}
                onChange={setPhotosStart}
              />
            </div>
            <Button
              onClick={handleStartService}
              disabled={!mechanicName || photosStart.length === 0 || (!resolvingReported && !causeIdentified.trim()) || saving}
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
            {(() => {
              const startPhotos = (os.photos_start && os.photos_start.length ? os.photos_start : (os.photo_start_url ? [os.photo_start_url] : []));
              if (startPhotos.length === 0) return null;
              return (
                <div className="border-t border-border pt-4">
                  <p className="text-xs text-muted-foreground mb-1">Fotos de Início ({startPhotos.length})</p>
                  <div className="grid grid-cols-3 gap-2">
                    {startPhotos.map((u, i) => (
                      <a key={u + i} href={u} target="_blank" rel="noreferrer">
                        <img src={u} alt={`Início ${i + 1}`} className="w-full h-24 object-cover rounded-lg border border-border" />
                      </a>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Iniciado em: {os.started_at ? new Date(os.started_at).toLocaleString('pt-BR') : '—'}
                  </p>
                </div>
              );
            })()}

            {/* Save items progress button */}
            {requestItems.length > 0 && doneCount > 0 && !allItemsDone && (
              <Button
                type="button"
                variant="outline"
                onClick={async () => { setSaving(true); await saveItemsStatus(); setSaving(false); }}
                disabled={saving}
                className="w-full gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                <CheckSquare className="w-4 h-4" /> Salvar Progresso ({doneCount}/{requestItems.length})
              </Button>
            )}

            <div className="border-t border-border pt-4">
              <p className="text-sm font-semibold flex items-center gap-2 mb-3">
                <Square className="w-4 h-4 text-success" /> Término do Serviço
              </p>
              <MultiPhotoUpload
                label="Fotos de Término do Serviço *"
                required
                values={photosEnd}
                onChange={setPhotosEnd}
              />
            </div>
            <Button
              onClick={handleCompleteService}
              disabled={photosEnd.length === 0 || !serviceExecuted.trim() || (!resolvingReported && !causeIdentified.trim()) || saving}
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
