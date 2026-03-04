import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DBObra, DBEquipment } from "@/lib/supabase-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Plus, Loader2, MapPin, Pencil, Trash2, Truck, X, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export default function ObrasPage() {
  const [obras, setObras] = useState<DBObra[]>([]);
  const [equipments, setEquipments] = useState<DBEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingObra, setEditingObra] = useState<DBObra | null>(null);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [manageObraId, setManageObraId] = useState<string | null>(null);
  const [addingEquipment, setAddingEquipment] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [obrasRes, eqRes] = await Promise.all([
      supabase.from('obras').select('*').order('name'),
      supabase.from('equipments').select('*').order('name'),
    ]);
    setObras((obrasRes.data || []) as DBObra[]);
    setEquipments((eqRes.data || []) as DBEquipment[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditingObra(null);
    setName('');
    setLocation('');
    setDialogOpen(true);
  };

  const openEdit = (obra: DBObra) => {
    setEditingObra(obra);
    setName(obra.name);
    setLocation(obra.location || '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    if (editingObra) {
      await supabase.from('obras').update({ name, location: location || null }).eq('id', editingObra.id);
    } else {
      await supabase.from('obras').insert({ name, location: location || null });
    }
    setSaving(false);
    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    // Remove obra_id from equipments linked to this obra
    await supabase.from('equipments').update({ obra_id: null }).eq('obra_id', id);
    await supabase.from('obras').delete().eq('id', id);
    fetchData();
  };

  const handleToggleStatus = async (obra: DBObra) => {
    await supabase.from('obras').update({ status: obra.status === 'active' ? 'inactive' : 'active' }).eq('id', obra.id);
    fetchData();
  };

  const assignEquipment = async (equipmentId: string, obraId: string) => {
    await supabase.from('equipments').update({ obra_id: obraId }).eq('id', equipmentId);
    toast.success('Máquina adicionada à obra');
    fetchData();
  };

  const removeEquipmentFromObra = async (equipmentId: string) => {
    await supabase.from('equipments').update({ obra_id: null }).eq('id', equipmentId);
    toast.success('Máquina removida da obra');
    fetchData();
  };

  const getObraEquipments = (obraId: string) => equipments.filter(e => e.obra_id === obraId);
  const getAvailableEquipments = (obraId: string) => equipments.filter(e => e.obra_id !== obraId);

  const eqIdentifier = (eq: DBEquipment) => {
    const id = eq.cost_center || eq.plate || '';
    return id ? `${eq.name} (${id})` : eq.name;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-gradient">Obras</h1>
          <p className="text-muted-foreground mt-1">Gerencie canteiros e projetos</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Nova Obra</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingObra ? 'Editar Obra' : 'Nova Obra'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div><Label>Nome *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Obra BR-101" /></div>
              <div><Label>Localização</Label><Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Ex: São Paulo, SP" /></div>
              <Button onClick={handleSave} disabled={!name || saving} className="w-full">
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingObra ? 'Salvar' : 'Criar Obra'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Manage equipments dialog */}
      <Dialog open={!!manageObraId} onOpenChange={open => { if (!open) { setManageObraId(null); setAddingEquipment(false); } }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary" />
              Máquinas na Obra: {obras.find(o => o.id === manageObraId)?.name}
            </DialogTitle>
          </DialogHeader>
          {manageObraId && (
            <div className="space-y-4 mt-2">
              {/* Current equipments */}
              {getObraEquipments(manageObraId).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma máquina vinculada a esta obra.</p>
              ) : (
                <div className="space-y-2">
                  {getObraEquipments(manageObraId).map(eq => (
                    <div key={eq.id} className="flex items-center justify-between bg-secondary/50 rounded-lg px-3 py-2.5">
                      <div>
                        <p className="text-sm font-medium">{eq.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {[eq.cost_center && `CC: ${eq.cost_center}`, eq.plate && `Placa: ${eq.plate}`, eq.model].filter(Boolean).join(' • ')}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => removeEquipmentFromObra(eq.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add equipment */}
              {!addingEquipment ? (
                <Button variant="outline" className="w-full gap-2" onClick={() => setAddingEquipment(true)}>
                  <Plus className="w-4 h-4" /> Adicionar Máquina
                </Button>
              ) : (
                <div className="border border-border rounded-lg p-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Selecione a máquina</p>
                  {getAvailableEquipments(manageObraId).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-2">Todas as máquinas já estão nesta obra.</p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {getAvailableEquipments(manageObraId).map(eq => (
                        <button
                          key={eq.id}
                          onClick={() => { assignEquipment(eq.id, manageObraId); setAddingEquipment(false); }}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-primary/10 transition-colors text-left"
                        >
                          <div>
                            <p className="text-sm font-medium">{eq.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {[eq.cost_center && `CC: ${eq.cost_center}`, eq.plate && `Placa: ${eq.plate}`, eq.obra_id && `Obra: ${obras.find(o => o.id === eq.obra_id)?.name || '—'}`].filter(Boolean).join(' • ')}
                            </p>
                          </div>
                          <Check className="w-4 h-4 text-primary shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setAddingEquipment(false)} className="w-full text-muted-foreground">
                    Cancelar
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
        </div>
      ) : obras.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-bold">Nenhuma obra cadastrada</h2>
          <p className="text-muted-foreground text-sm mt-1">Crie sua primeira obra para organizar equipamentos por canteiro.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {obras.map(obra => {
            const obraEquipments = getObraEquipments(obra.id);
            return (
              <div key={obra.id} className={`glass-card rounded-xl p-5 transition-all ${obra.status === 'inactive' ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-primary" />
                    <h3 className="font-bold text-lg">{obra.name}</h3>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${obra.status === 'active' ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'}`}>
                    {obra.status === 'active' ? 'Ativa' : 'Inativa'}
                  </span>
                </div>
                {obra.location && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mb-2">
                    <MapPin className="w-3 h-3" /> {obra.location}
                  </p>
                )}

                {/* Equipments count and preview */}
                <button
                  onClick={() => setManageObraId(obra.id)}
                  className="w-full text-left mt-1 mb-3 p-2.5 rounded-lg bg-secondary/40 hover:bg-secondary/70 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Truck className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold">{obraEquipments.length} máquina{obraEquipments.length !== 1 ? 's' : ''}</span>
                  </div>
                  {obraEquipments.length > 0 ? (
                    <div className="space-y-0.5">
                      {obraEquipments.slice(0, 3).map(eq => (
                        <p key={eq.id} className="text-xs text-muted-foreground truncate">• {eqIdentifier(eq)}</p>
                      ))}
                      {obraEquipments.length > 3 && (
                        <p className="text-xs text-primary font-medium">+ {obraEquipments.length - 3} mais...</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Clique para adicionar máquinas</p>
                  )}
                </button>

                <div className="flex gap-2 mt-auto">
                  <Button variant="outline" size="sm" onClick={() => openEdit(obra)} className="gap-1">
                    <Pencil className="w-3 h-3" /> Editar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleToggleStatus(obra)} className="gap-1">
                    {obra.status === 'active' ? 'Desativar' : 'Ativar'}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir obra?</AlertDialogTitle>
                        <AlertDialogDescription>Essa ação não pode ser desfeita. Equipamentos vinculados ficarão sem obra.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(obra.id)}>Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
