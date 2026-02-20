import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DBEquipment, DBFuelSupplyRecord } from '@/lib/supabase-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Truck, CheckCircle, Plus, Droplets } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

export default function FuelSupplyPage() {
  const [combos, setCombos] = useState<DBEquipment[]>([]);
  const [records, setRecords] = useState<DBFuelSupplyRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    combo_equipment_id: '',
    liters: '',
    invoice_number: '',
    supplier: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    responsible_name: '',
  });

  const fetchData = async () => {
    const [eqRes, supRes] = await Promise.all([
      supabase.from('equipments').select('*').eq('type', 'combo'),
      supabase.from('fuel_supply_records').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    setCombos((eqRes.data || []) as DBEquipment[]);
    setRecords((supRes.data || []) as DBFuelSupplyRecord[]);
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
    });

    setLoading(false);
    if (!error) {
      setSaved(true);
      setOpen(false);
      fetchData();
      setForm({ combo_equipment_id: '', liters: '', invoice_number: '', supplier: '', date: new Date().toISOString().split('T')[0], notes: '', responsible_name: '' });
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const canSave = form.combo_equipment_id && form.liters && form.responsible_name && Number(form.liters) > 0;

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
                <Label>Observações</Label>
                <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Observações opcionais..." rows={2} />
              </div>
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
                  <th className="pb-2 pr-4">Data</th>
                  <th className="pb-2 pr-4">Comboio</th>
                  <th className="pb-2 pr-4">Litros</th>
                  <th className="pb-2 pr-4">Nota Fiscal</th>
                  <th className="pb-2 pr-4">Fornecedor</th>
                  <th className="pb-2">Responsável</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.map(r => {
                  const combo = combos.find(c => c.id === r.combo_equipment_id);
                  return (
                    <tr key={r.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="py-2 pr-4 font-mono text-xs">{new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                      <td className="py-2 pr-4 font-medium">{combo?.name || '—'}</td>
                      <td className="py-2 pr-4 font-mono font-bold text-success">+{r.liters}L</td>
                      <td className="py-2 pr-4 text-muted-foreground">{r.invoice_number || '—'}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{r.supplier || '—'}</td>
                      <td className="py-2 text-muted-foreground">{r.responsible_name}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
