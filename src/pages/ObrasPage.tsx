import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DBObra } from "@/lib/supabase-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Plus, Loader2, MapPin, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function ObrasPage() {
  const [obras, setObras] = useState<DBObra[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingObra, setEditingObra] = useState<DBObra | null>(null);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchObras = async () => {
    setLoading(true);
    const { data } = await supabase.from('obras').select('*').order('name');
    setObras((data || []) as DBObra[]);
    setLoading(false);
  };

  useEffect(() => { fetchObras(); }, []);

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
    fetchObras();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('obras').delete().eq('id', id);
    fetchObras();
  };

  const handleToggleStatus = async (obra: DBObra) => {
    await supabase.from('obras').update({ status: obra.status === 'active' ? 'inactive' : 'active' }).eq('id', obra.id);
    fetchObras();
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
          {obras.map(obra => (
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
                <p className="text-sm text-muted-foreground flex items-center gap-1 mb-4">
                  <MapPin className="w-3 h-3" /> {obra.location}
                </p>
              )}
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
          ))}
        </div>
      )}
    </div>
  );
}
