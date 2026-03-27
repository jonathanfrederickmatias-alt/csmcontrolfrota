import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DBEquipment, DBFuelSupplyRecord, FuelSupplyExtraItem } from '@/lib/supabase-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Truck, CheckCircle, Plus, Droplets, Edit2, Trash2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from '@/components/ui/textarea';
import PhotoUpload from '@/components/PhotoUpload';
import { toast } from 'sonner';
import { useUserRoles } from '@/hooks/useUserRoles';

export default function FuelSupplyPage() {
  const { isAdmin, isGestor } = useUserRoles();
  const canEdit = isAdmin || isGestor;
  const [combos, setCombos] = useState<DBEquipment[]>([]);
  const [records, setRecords] = useState<DBFuelSupplyRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  const [photoUrl, setPhotoUrl] = useState('');
  const [extraItems, setExtraItems] = useState<FuelSupplyExtraItem[]>([]);
  const [form, setForm] = useState({
    combo_equipment_id: '',
    liters: '',
    invoice_number: '',
    supplier: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    responsible_name: '',
  });

  // Edit state
  const [editRecord, setEditRecord] = useState<DBFuelSupplyRecord | null>(null);
  const [editExtraItems, setEditExtraItems] = useState<FuelSupplyExtraItem[]>([]);
  const [editForm, setEditForm] = useState({ liters: '', invoice_number: '', supplier: '', date: '', notes: '', responsible_name: '' });

  const fetchData = async () => {
    const [eqRes, supRes] = await Promise.all([
      supabase.from('equipments').select('*').eq('type', 'combo'),
      supabase.from('fuel_supply_records').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    setCombos((eqRes.data || []) as DBEquipment[]);
    setRecords((supRes.data || []) as unknown as DBFuelSupplyRecord[]);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    if (!form.combo_equipment_id || !form.liters || !form.responsible_name) return;
    setLoading(true);

    const { error } = await supabase.from('fuel_supply_records').insert({
      combo_equipment_id: form.combo_equipment_id,
      liters: Number(form.liters),
      invoice_number: form.invoice_number || null,
      supplier: form.supplier || null,
      date: form.date,
      notes: form.notes || null,
      responsible_name: form.responsible_name,
      photo_url: photoUrl || null,
      extra_items: extraItems.filter(i => i.name.trim()) as any,
    });

    setLoading(false);
    if (!error) {
      setSaved(true);
      setOpen(false);
      fetchData();
      setForm({ combo_equipment_id: '', liters: '', invoice_number: '', supplier: '', date: new Date().toISOString().split('T')[0], notes: '', responsible_name: '' });
      setPhotoUrl('');
      setExtraItems([]);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const openEdit = (r: DBFuelSupplyRecord) => {
    setEditRecord(r);
    setEditExtraItems(r.extra_items || []);
    setEditForm({
      liters: String(r.liters),
      invoice_number: r.invoice_number || '',
      supplier: r.supplier || '',
      date: r.date,
      notes: r.notes || '',
      responsible_name: r.responsible_name,
    });
  };

  const handleSaveEdit = async () => {
    if (!editRecord) return;
    await supabase.from('fuel_supply_records').update({
      liters: Number(editForm.liters),
      invoice_number: editForm.invoice_number || null,
      supplier: editForm.supplier || null,
      date: editForm.date,
      notes: editForm.notes || null,
      responsible_name: editForm.responsible_name,
      extra_items: editExtraItems.filter(i => i.name.trim()) as any,
    }).eq('id', editRecord.id);
    toast.success('Registro atualizado!');
    setEditRecord(null);
    fetchData();
  };

  const canSave = form.combo_equipment_id && form.liters && form.responsible_name && Number(form.liters) > 0 && photoUrl;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gradient">Reabastecimento</h1>
          <p className="text-muted-foreground mt-1">Entrada de combustível nos comboios</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> Registrar Entrada</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle>Registrar Reabastecimento</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Comboio *</Label>
                <Select value={form.combo_equipment_id} onValueChange={v => setForm({ ...form, combo_equipment_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar comboio..." /></SelectTrigger>
                  <SelectContent>
                    {combos.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name} (saldo: {c.current_fuel || 0}L / {c.fuel_capacity}L)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Litros recebidos *</Label>
                <Input type="number" value={form.liters} onChange={e => setForm({ ...form, liters: e.target.value })} placeholder="Ex: 5000" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nº Nota Fiscal</Label>
                  <Input value={form.invoice_number} onChange={e => setForm({ ...form, invoice_number: e.target.value })} placeholder="Ex: 001234" />
                </div>
                <div>
                  <Label>Data</Label>
                  <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Fornecedor</Label>
                <Input value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} placeholder="Nome do fornecedor" />
              </div>
              <div>
                <Label>Responsável *</Label>
                <Input value={form.responsible_name} onChange={e => setForm({ ...form, responsible_name: e.target.value })} placeholder="Nome do responsável" />
              </div>
              <div>
                <Label>Itens Extras (gelo, gasolina galão, etc.)</Label>
                {extraItems.map((item, idx) => (
                  <div key={idx} className="flex gap-2 mt-2">
                    <Input value={item.name} onChange={e => { const items = [...extraItems]; items[idx] = { ...items[idx], name: e.target.value }; setExtraItems(items); }} placeholder="Item (ex: Saco de gelo)" className="flex-1" />
                    <Input value={item.quantity} onChange={e => { const items = [...extraItems]; items[idx] = { ...items[idx], quantity: e.target.value }; setExtraItems(items); }} placeholder="Qtd" className="w-20" />
                    <button type="button" onClick={() => setExtraItems(extraItems.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-destructive p-1"><X className="w-4 h-4" /></button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" className="mt-2 gap-1" onClick={() => setExtraItems([...extraItems, { name: '', quantity: '' }])}>
                  <Plus className="w-3 h-3" /> Adicionar item
                </Button>
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Observações opcionais..." rows={2} />
              </div>
              <PhotoUpload label="Foto do Comprovante" required onUploaded={setPhotoUrl} acceptFiles />
              <Button onClick={handleSave} disabled={!canSave || loading} className="w-full font-bold">
                {loading ? 'Salvando...' : 'Registrar Entrada'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {saved && (
        <div className="rounded-xl p-4 bg-success/10 border border-success/30 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-success" />
          <p className="font-medium text-success">Reabastecimento registrado e saldo do comboio atualizado!</p>
        </div>
      )}

      {/* Saldo atual dos comboios */}
      {combos.length > 0 && (
        <div>
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <Droplets className="w-5 h-5 text-primary" />
            Saldo Atual dos Comboios
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {combos.map(c => {
              const pct = c.fuel_capacity ? ((c.current_fuel || 0) / c.fuel_capacity) * 100 : 0;
              const color = pct > 30 ? 'bg-success' : pct > 10 ? 'bg-warning' : 'bg-destructive';
              const textColor = pct > 30 ? 'text-success' : pct > 10 ? 'text-warning' : 'text-destructive';
              return (
                <div key={c.id} className="glass-card rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <Truck className="w-6 h-6 text-primary" />
                    <div>
                      <h3 className="font-bold">{c.name}</h3>
                      <p className="text-xs text-muted-foreground">{c.plate || 'Sem placa'}</p>
                    </div>
                  </div>
                  <div className="flex items-end justify-between mb-2">
                    <span className={`text-3xl font-mono font-black ${textColor}`}>{c.current_fuel || 0}L</span>
                    <span className="text-sm text-muted-foreground">/ {c.fuel_capacity}L</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-3 mb-1">
                    <div className={`h-3 rounded-full transition-all ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground">{pct.toFixed(0)}% de capacidade</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Histórico */}
      <div className="glass-card rounded-xl p-5">
        <h2 className="text-lg font-bold mb-4">Histórico de Entradas</h2>
        {records.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhuma entrada registrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                 <tr className="text-left text-muted-foreground border-b border-border">
                   <th className="pb-2 pr-4">Foto</th>
                   <th className="pb-2 pr-4">Data</th>
                   <th className="pb-2 pr-4">Comboio</th>
                   <th className="pb-2 pr-4">Litros</th>
                   <th className="pb-2 pr-4">Nota Fiscal</th>
                   <th className="pb-2 pr-4">Fornecedor</th>
                   <th className="pb-2 pr-4">Itens Extras</th>
                   <th className="pb-2 pr-4">Responsável</th>
                   <th className="pb-2"></th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.map(r => {
                  const combo = combos.find(c => c.id === r.combo_equipment_id);
                  return (
                     <tr key={r.id} className="hover:bg-secondary/30 transition-colors">
                       <td className="py-2 pr-4">
                         {(r as any).photo_url ? (
                           <a href={(r as any).photo_url} target="_blank" rel="noopener noreferrer">
                             <img src={(r as any).photo_url} alt="Comprovante" className="w-10 h-10 rounded object-cover border border-border hover:opacity-80 transition-opacity" />
                           </a>
                         ) : <span className="text-muted-foreground text-xs">—</span>}
                       </td>
                       <td className="py-2 pr-4 font-mono text-xs">{new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                       <td className="py-2 pr-4 font-medium">{combo?.name || '—'}</td>
                       <td className="py-2 pr-4 font-mono font-bold text-success">+{r.liters}L</td>
                       <td className="py-2 pr-4 text-muted-foreground">{r.invoice_number || '—'}</td>
                       <td className="py-2 pr-4 text-muted-foreground">{r.supplier || '—'}</td>
                       <td className="py-2 pr-4 text-xs text-muted-foreground">
                         {r.extra_items && r.extra_items.length > 0
                           ? r.extra_items.map((it, i) => <span key={i} className="inline-block bg-secondary rounded px-1.5 py-0.5 mr-1 mb-0.5">{it.name}{it.quantity ? ` (${it.quantity})` : ''}</span>)
                           : '—'}
                       </td>
                       <td className="py-2 pr-4 text-muted-foreground">{r.responsible_name}</td>
                       <td className="py-2">
                         {canEdit && (
                           <button onClick={() => openEdit(r)} className="text-muted-foreground hover:text-primary p-1 transition-colors">
                             <Edit2 className="w-3.5 h-3.5" />
                           </button>
                         )}
                         {canEdit && (
                           <AlertDialog>
                             <AlertDialogTrigger asChild>
                               <button className="text-muted-foreground hover:text-destructive p-1 transition-colors">
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
                                   await supabase.from('fuel_supply_records').delete().eq('id', r.id);
                                   fetchData();
                                   toast.success('Registro excluído!', {
                                     action: { label: 'Desfazer', onClick: async () => {
                                       await supabase.from('fuel_supply_records').insert(backup as any);
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
                       </td>
                     </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit supply record dialog */}
      <Dialog open={!!editRecord} onOpenChange={v => { if (!v) setEditRecord(null); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Editar Reabastecimento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Litros *</Label><Input type="number" value={editForm.liters} onChange={e => setEditForm({...editForm, liters: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nº Nota Fiscal</Label><Input value={editForm.invoice_number} onChange={e => setEditForm({...editForm, invoice_number: e.target.value})} /></div>
              <div><Label>Data</Label><Input type="date" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} /></div>
            </div>
            <div><Label>Fornecedor</Label><Input value={editForm.supplier} onChange={e => setEditForm({...editForm, supplier: e.target.value})} /></div>
            <div><Label>Responsável *</Label><Input value={editForm.responsible_name} onChange={e => setEditForm({...editForm, responsible_name: e.target.value})} /></div>
            <div><Label>Observações</Label><Textarea value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value})} rows={2} /></div>
            <div>
              <Label>Itens Extras</Label>
              {editExtraItems.map((item, idx) => (
                <div key={idx} className="flex gap-2 mt-2">
                  <Input value={item.name} onChange={e => { const items = [...editExtraItems]; items[idx] = { ...items[idx], name: e.target.value }; setEditExtraItems(items); }} placeholder="Item" className="flex-1" />
                  <Input value={item.quantity} onChange={e => { const items = [...editExtraItems]; items[idx] = { ...items[idx], quantity: e.target.value }; setEditExtraItems(items); }} placeholder="Qtd" className="w-20" />
                  <button type="button" onClick={() => setEditExtraItems(editExtraItems.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-destructive p-1"><X className="w-4 h-4" /></button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="mt-2 gap-1" onClick={() => setEditExtraItems([...editExtraItems, { name: '', quantity: '' }])}>
                <Plus className="w-3 h-3" /> Adicionar item
              </Button>
            </div>
            <Button onClick={handleSaveEdit} disabled={!editForm.liters || !editForm.responsible_name} className="w-full">Salvar Alterações</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}