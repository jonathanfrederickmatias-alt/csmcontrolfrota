import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DBEquipment } from "@/lib/supabase-types";
import { Plus, Trash2, Truck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type EqType = 'machine' | 'truck' | 'combo';

export default function EquipmentPage() {
  const [equipments, setEquipments] = useState<DBEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'machine' as EqType, plate: '', model: '', fuelCapacity: '', currentFuel: '' });

  const fetch = async () => {
    const { data } = await supabase.from('equipments').select('*').order('created_at');
    setEquipments((data || []) as DBEquipment[]);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const handleSave = async () => {
    setSaving(true);
    await supabase.from('equipments').insert({
      name: form.name,
      type: form.type,
      plate: form.plate || null,
      model: form.model || null,
      current_hour_meter: 0,
      fuel_capacity: form.fuelCapacity ? Number(form.fuelCapacity) : null,
      current_fuel: form.currentFuel ? Number(form.currentFuel) : 0,
      status: 'active',
    });
    setSaving(false);
    setOpen(false);
    setForm({ name: '', type: 'machine', plate: '', model: '', fuelCapacity: '', currentFuel: '' });
    fetch();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('equipments').delete().eq('id', id);
    fetch();
  };

  const typeLabels: Record<string, string> = { machine: 'Máquina', truck: 'Caminhão', combo: 'Comboio' };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-gradient">Equipamentos</h1>
          <p className="text-muted-foreground mt-1">Cadastro e gestão da frota</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> Novo</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle>Novo Equipamento</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nome *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Ex: Fresadora CAT" /></div>
              <div><Label>Tipo *</Label>
                <Select value={form.type} onValueChange={v => setForm({...form, type: v as EqType})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="machine">Máquina</SelectItem>
                    <SelectItem value="truck">Caminhão</SelectItem>
                    <SelectItem value="combo">Comboio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Placa</Label><Input value={form.plate} onChange={e => setForm({...form, plate: e.target.value})} /></div>
              <div><Label>Modelo</Label><Input value={form.model} onChange={e => setForm({...form, model: e.target.value})} /></div>
              {form.type === 'combo' && (
                <>
                  <div><Label>Capacidade (litros)</Label><Input type="number" value={form.fuelCapacity} onChange={e => setForm({...form, fuelCapacity: e.target.value})} /></div>
                  <div><Label>Combustível Atual (litros)</Label><Input type="number" value={form.currentFuel} onChange={e => setForm({...form, currentFuel: e.target.value})} /></div>
                </>
              )}
              <Button onClick={handleSave} disabled={!form.name || saving} className="w-full">
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : equipments.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <Truck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Nenhum equipamento cadastrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {equipments.map(eq => (
            <div key={eq.id} className="glass-card rounded-xl p-5 hover:border-primary/30 transition-all group">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-foreground">{eq.name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{typeLabels[eq.type]}</span>
                </div>
                <button onClick={() => handleDelete(eq.id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {eq.plate && <p className="text-xs text-muted-foreground">Placa: {eq.plate}</p>}
              {eq.model && <p className="text-xs text-muted-foreground">Modelo: {eq.model}</p>}
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Horímetro</p>
                  <p className="text-lg font-mono font-bold text-primary">{eq.current_hour_meter}h</p>
                </div>
                {eq.type === 'combo' && eq.fuel_capacity && (
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Combustível</p>
                    <p className="text-lg font-mono font-bold text-accent">{eq.current_fuel || 0}L / {eq.fuel_capacity}L</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
