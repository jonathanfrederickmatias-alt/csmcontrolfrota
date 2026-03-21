import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DBEquipment, DBFuelRecord } from "@/lib/supabase-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Fuel, CheckCircle, Droplets, Loader2, Plus, Edit2, Trash2, Eye, Image, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import PhotoUpload from "@/components/PhotoUpload";
import { toast } from "sonner";
import { useUserRoles } from '@/hooks/useUserRoles';

export default function FuelPage() {
  const navigate = useNavigate();
  const { isAdmin, isGestor } = useUserRoles();
  const canEdit = isAdmin || isGestor;
  const [equipments, setEquipments] = useState<DBEquipment[]>([]);
  const [records, setRecords] = useState<DBFuelRecord[]>([]);
  const [comboId, setComboId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [hourMeter, setHourMeter] = useState('');
  const [liters, setLiters] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');

  // Detail & Edit state
  const [detailRecord, setDetailRecord] = useState<DBFuelRecord | null>(null);
  const [editRecord, setEditRecord] = useState<DBFuelRecord | null>(null);
  const [editForm, setEditForm] = useState({ liters: '', operator_name: '', date: '', hour_meter: '' });

  const fetchData = async () => {
    const [eqRes, frRes] = await Promise.all([
      supabase.from('equipments').select('*').order('name'),
      supabase.from('fuel_records').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    setEquipments((eqRes.data || []) as DBEquipment[]);
    setRecords((frRes.data || []) as DBFuelRecord[]);
  };

  useEffect(() => { fetchData(); }, []);

  const combos = equipments.filter(e => e.type === 'combo');
  const targets = equipments.filter(e => e.type !== 'combo');
  const selectedCombo = equipments.find(e => e.id === comboId);

  const handleSave = async () => {
    setSaving(true);
    await supabase.from('fuel_records').insert({
      combo_equipment_id: comboId,
      target_equipment_id: targetId,
      liters: Number(liters),
      date: new Date().toISOString().split('T')[0],
      operator_name: operatorName,
      photo_url: photoUrl || null,
    } as any);
    setSaving(false);
    setSaved(true);
    fetchData();
    setTimeout(() => {
      setSaved(false);
      setComboId(''); setTargetId(''); setLiters(''); setOperatorName(''); setPhotoUrl('');
    }, 2000);
  };

  const openEdit = (r: DBFuelRecord) => {
    setEditRecord(r);
    setEditForm({ liters: String(r.liters), operator_name: r.operator_name, date: r.date });
  };

  const handleSaveEdit = async () => {
    if (!editRecord) return;
    await supabase.from('fuel_records').update({
      liters: Number(editForm.liters),
      operator_name: editForm.operator_name,
      date: editForm.date,
    }).eq('id', editRecord.id);
    toast.success('Registro atualizado!');
    setEditRecord(null);
    fetchData();
  };

  const canSave = comboId && targetId && liters && operatorName && Number(liters) > 0 && photoUrl;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-gradient">Abastecimento</h1>
          <p className="text-muted-foreground mt-1">Controle de combustível comboio → máquina</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => navigate('/reabastecimento')}>
          <Plus className="w-4 h-4" /> Reabastecer Comboio
        </Button>
      </div>

      {/* Saldo dos comboios */}
      {combos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {combos.map(c => {
            const pct = c.fuel_capacity ? ((c.current_fuel || 0) / c.fuel_capacity) * 100 : 0;
            return (
              <div key={c.id} className="glass-card rounded-xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <Droplets className="w-6 h-6 text-primary" />
                  <div>
                    <h3 className="font-bold">{c.name}</h3>
                    <p className="text-xs text-muted-foreground">{c.plate || 'Sem placa'}</p>
                  </div>
                </div>
                <div className="flex items-end justify-between mb-2">
                  <span className="text-2xl font-mono font-bold text-accent">{c.current_fuel || 0}L</span>
                  <span className="text-sm text-muted-foreground">/ {c.fuel_capacity}L</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-3">
                  <div className={`h-3 rounded-full transition-all ${pct > 30 ? 'bg-primary' : pct > 10 ? 'bg-warning' : 'bg-destructive'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {saved ? (
        <div className="glass-card rounded-xl p-12 text-center mb-8">
          <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
          <h2 className="text-xl font-bold text-success">Abastecimento Registrado!</h2>
        </div>
      ) : (
        <div className="glass-card rounded-xl p-6 mb-8">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Fuel className="w-5 h-5 text-primary" /> Registrar Abastecimento
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Comboio *</Label>
              <Select value={comboId} onValueChange={setComboId}>
                <SelectTrigger><SelectValue placeholder="Selecionar comboio..." /></SelectTrigger>
                <SelectContent>{combos.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.current_fuel || 0}L)</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Equipamento Destino *</Label>
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger><SelectValue placeholder="Selecionar máquina..." /></SelectTrigger>
                <SelectContent>{targets.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Litros *</Label>
              <Input type="number" value={liters} onChange={e => setLiters(e.target.value)} placeholder="Ex: 1000" />
              {selectedCombo && Number(liters) > (selectedCombo.current_fuel || 0) && (
                <p className="text-xs text-destructive mt-1">Quantidade maior que o disponível!</p>
              )}
            </div>
            <div><Label>Operador *</Label><Input value={operatorName} onChange={e => setOperatorName(e.target.value)} placeholder="Nome" /></div>
          </div>
          <div className="mt-4">
            <PhotoUpload label="Foto do Abastecimento" required onUploaded={setPhotoUrl} acceptFiles />
          </div>
          <Button onClick={handleSave} disabled={!canSave || saving} className="w-full mt-4 h-12 text-base font-bold">
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Registrar Abastecimento
          </Button>
        </div>
      )}

      <div className="glass-card rounded-xl p-6">
        <h2 className="text-lg font-bold mb-4">Histórico de Abastecimentos</h2>
        {records.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum abastecimento registrado.</p>
        ) : (
          <div className="space-y-2">
            {records.map(r => {
              const combo = equipments.find(e => e.id === r.combo_equipment_id);
              const target = equipments.find(e => e.id === r.target_equipment_id);
              return (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 cursor-pointer hover:bg-secondary/80 transition-colors" onClick={() => setDetailRecord(r)}>
                  <div>
                    <p className="text-sm font-medium">{combo?.name} → {target?.name}</p>
                    <p className="text-xs text-muted-foreground">{r.operator_name} — {r.date}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.photo_url && <Image className="w-3.5 h-3.5 text-muted-foreground" />}
                    <span className="text-lg font-mono font-bold text-accent">{r.liters}L</span>
                    {canEdit && (
                      <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="text-muted-foreground hover:text-primary p-1 transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canEdit && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button onClick={(e) => e.stopPropagation()} className="text-muted-foreground hover:text-destructive p-1 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
                            <AlertDialogDescription>O registro será removido. Você poderá desfazer nos próximos segundos.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={async () => {
                              const backup = { ...r };
                              await supabase.from('fuel_records').delete().eq('id', r.id);
                              fetchData();
                              toast.success('Registro excluído!', {
                                action: { label: 'Desfazer', onClick: async () => {
                                  await supabase.from('fuel_records').insert(backup as any);
                                  fetchData();
                                  toast.success('Registro restaurado!');
                                }},
                                duration: 8000,
                              });
                            }}>Excluir</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog open={!!detailRecord} onOpenChange={v => { if (!v) setDetailRecord(null); }}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader><DialogTitle>Detalhes do Abastecimento</DialogTitle></DialogHeader>
          {detailRecord && (() => {
            const combo = equipments.find(e => e.id === detailRecord.combo_equipment_id);
            const target = equipments.find(e => e.id === detailRecord.target_equipment_id);
            const targetId = target?.cost_center || target?.plate || '';
            const comboId = combo?.cost_center || combo?.plate || '';
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Origem (Comboio)</p>
                    <p className="font-medium">{combo?.name}{comboId ? ` (${comboId})` : ''}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Destino (Equipamento)</p>
                    <p className="font-medium">{target?.name}{targetId ? ` (${targetId})` : ''}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Litros</p>
                    <p className="font-bold text-lg text-accent">{detailRecord.liters}L</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Data</p>
                    <p className="font-medium">{detailRecord.date}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground text-xs">Operador</p>
                    <p className="font-medium">{detailRecord.operator_name}</p>
                  </div>
                </div>
                {detailRecord.photo_url && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-2">Foto / Arquivo</p>
                    {detailRecord.photo_url.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i) || detailRecord.photo_url.includes('/photos/') ? (
                      <a href={detailRecord.photo_url} target="_blank" rel="noopener noreferrer">
                        <img src={detailRecord.photo_url} alt="Foto do abastecimento" className="rounded-lg max-h-64 w-full object-contain border" />
                      </a>
                    ) : (
                      <a href={detailRecord.photo_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline">
                        <FileText className="w-4 h-4" /> Ver arquivo anexado
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Edit fuel record dialog */}
      <Dialog open={!!editRecord} onOpenChange={v => { if (!v) setEditRecord(null); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Editar Abastecimento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Litros *</Label><Input type="number" value={editForm.liters} onChange={e => setEditForm({...editForm, liters: e.target.value})} /></div>
            <div><Label>Operador *</Label><Input value={editForm.operator_name} onChange={e => setEditForm({...editForm, operator_name: e.target.value})} /></div>
            <div><Label>Data</Label><Input type="date" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} /></div>
            <Button onClick={handleSaveEdit} disabled={!editForm.liters || !editForm.operator_name} className="w-full">Salvar Alterações</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}