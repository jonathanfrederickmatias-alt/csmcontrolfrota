import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DBEquipment } from "@/lib/supabase-types";
import { Plus, Trash2, Truck, Loader2, Pencil, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

type EqType = 'machine' | 'truck' | 'combo';
type OwnershipType = 'own' | 'third_party';

const emptyForm = { name: '', type: 'machine' as EqType, plate: '', model: '', brand: '', costCenter: '', fuelCapacity: '', currentFuel: '', hourMeter: '', year: '', chassis: '' };

export default function EquipmentPage() {
  const [equipments, setEquipments] = useState<DBEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedEq, setSelectedEq] = useState<DBEquipment | null>(null);
  const [activeTab, setActiveTab] = useState<OwnershipType>('own');

  const fetchData = async () => {
    const { data } = await supabase.from('equipments').select('*').order('created_at');
    setEquipments((data || []) as DBEquipment[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filteredEquipments = equipments
    .filter(eq => (eq.ownership || 'own') === activeTab)
    .filter(eq => !search || eq.name.toLowerCase().includes(search.toLowerCase()) || eq.plate?.toLowerCase().includes(search.toLowerCase()));

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (eq: DBEquipment) => {
    setEditingId(eq.id);
    setForm({
      name: eq.name,
      type: eq.type,
      plate: eq.plate || '',
      model: eq.model || '',
      brand: eq.brand || '',
      costCenter: eq.cost_center || '',
      fuelCapacity: eq.fuel_capacity?.toString() || '',
      currentFuel: eq.current_fuel?.toString() || '',
      hourMeter: eq.current_hour_meter?.toString() || '0',
      year: eq.year?.toString() || '',
      chassis: eq.chassis || '',
    });
    setOpen(true);
    setSelectedEq(null);
  };

  const handleSave = async () => {
    setSaving(true);
    if (editingId) {
      const { error } = await supabase.from('equipments').update({
        name: form.name,
        type: form.type,
        plate: form.plate || null,
        model: form.model || null,
        brand: form.brand || null,
        cost_center: form.costCenter || null,
        current_hour_meter: form.hourMeter ? Number(form.hourMeter) : 0,
        fuel_capacity: form.fuelCapacity ? Number(form.fuelCapacity) : null,
        current_fuel: form.currentFuel ? Number(form.currentFuel) : 0,
        year: form.year ? Number(form.year) : null,
        chassis: form.chassis || null,
      }).eq('id', editingId);
      if (error) toast.error("Erro ao atualizar");
      else toast.success("Equipamento atualizado!");
    } else {
      const { getMyTenantId } = await import('@/lib/tenant');
      const tenant_id = await getMyTenantId();
      const { error } = await supabase.from('equipments').insert([{
        tenant_id,
        name: form.name,
        type: form.type,
        plate: form.plate || null,
        model: form.model || null,
        brand: form.brand || null,
        cost_center: form.costCenter || null,
        current_hour_meter: 0,
        fuel_capacity: form.fuelCapacity ? Number(form.fuelCapacity) : null,
        current_fuel: form.currentFuel ? Number(form.currentFuel) : 0,
        year: form.year ? Number(form.year) : null,
        chassis: form.chassis || null,
        status: 'active',
        ownership: activeTab,
      }]);
      if (error) toast.error("Erro ao criar");
      else toast.success("Equipamento criado!");
    }
    setSaving(false);
    setOpen(false);
    setForm(emptyForm);
    setEditingId(null);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este equipamento?")) return;
    await supabase.from('equipments').delete().eq('id', id);
    setSelectedEq(null);
    toast.success("Equipamento excluído");
    fetchData();
  };

  const handlePrint = () => {
    const title = activeTab === 'own' ? 'Equipamentos Próprios' : 'Equipamentos Terceiros';
    const rows = filteredEquipments.map(eq => `
      <tr>
        <td>${eq.name}</td>
        <td>${typeLabels[eq.type] || eq.type}</td>
        <td>${eq.plate || '-'}</td>
        <td>${eq.brand || '-'}</td>
        <td>${eq.model || '-'}</td>
        <td>${eq.year || '-'}</td>
        <td>${eq.chassis || '-'}</td>
        <td>${eq.cost_center || '-'}</td>
        <td style="text-align:right">${eq.current_hour_meter}h</td>
        <td>${statusLabels[eq.status] || eq.status}</td>
      </tr>
    `).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:20px;color:#111}
        h1{font-size:18px;margin:0 0 4px}
        .sub{font-size:11px;color:#555;margin-bottom:16px}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}
        th{background:#f1f5f9}
        tr:nth-child(even) td{background:#fafafa}
        @page{size:A4 landscape;margin:12mm}
      </style></head><body>
      <h1>CSMCONTROLFROTA — ${title}</h1>
      <div class="sub">Gerado em ${new Date().toLocaleString('pt-BR')} · Total: ${filteredEquipments.length}</div>
      <table>
        <thead><tr>
          <th>Nome</th><th>Tipo</th><th>Placa/Série</th><th>Marca</th><th>Modelo</th>
          <th>Ano</th><th>Chassi</th><th>C. Custo</th><th>Horímetro</th><th>Status</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <script>window.onload=()=>{window.print();}<\/script>
      </body></html>`;
    const w = window.open('', '_blank');
    if (!w) { toast.error('Permita pop-ups para imprimir'); return; }
    w.document.write(html);
    w.document.close();
  };


  const typeLabels: Record<string, string> = { machine: 'Máquina', truck: 'Caminhão', combo: 'Comboio' };
  const statusLabels: Record<string, string> = { active: 'Ativo', maintenance: 'Em Manutenção', inactive: 'Inativo' };
  const statusColors: Record<string, string> = { active: 'bg-green-500/10 text-green-500', maintenance: 'bg-yellow-500/10 text-yellow-500', inactive: 'bg-red-500/10 text-red-500' };

  const tabLabel = activeTab === 'own' ? 'Equipamento' : 'Equipamento Terceiro';

  const renderEquipmentGrid = (eqs: DBEquipment[]) => (
    eqs.length === 0 ? (
      <div className="glass-card rounded-xl p-12 text-center">
        <Truck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Nenhum equipamento cadastrado.</p>
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {eqs.map(eq => (
          <div
            key={eq.id}
            onClick={() => setSelectedEq(eq)}
            className="glass-card rounded-xl p-5 hover:border-primary/30 transition-all group cursor-pointer"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-foreground">{eq.name}</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{typeLabels[eq.type]}</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[eq.status] || ''}`}>
                {statusLabels[eq.status] || eq.status}
              </span>
            </div>
            {eq.plate && <p className="text-xs text-muted-foreground">Placa/Série: {eq.plate}</p>}
            {eq.model && <p className="text-xs text-muted-foreground">Modelo: {eq.model}</p>}
            {eq.brand && <p className="text-xs text-muted-foreground">Marca: {eq.brand}</p>}
            {eq.chassis && <p className="text-xs text-muted-foreground">Chassi: {eq.chassis}</p>}
            {eq.year && <p className="text-xs text-muted-foreground">Ano: {eq.year}</p>}
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
    )
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-gradient">Equipamentos</h1>
          <p className="text-muted-foreground mt-1">Cadastro e gestão da frota</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => handlePrint()}>
            <Printer className="w-4 h-4" /> Imprimir
          </Button>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(emptyForm); } }}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={openNew}><Plus className="w-4 h-4" /> Novo</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle>{editingId ? `Editar ${tabLabel}` : `Novo ${tabLabel}`}</DialogTitle></DialogHeader>
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
              <div><Label>Placa/Série</Label><Input value={form.plate} onChange={e => setForm({...form, plate: e.target.value})} /></div>
              <div><Label>Modelo</Label><Input value={form.model} onChange={e => setForm({...form, model: e.target.value})} /></div>
              <div><Label>Marca</Label><Input value={form.brand} onChange={e => setForm({...form, brand: e.target.value})} /></div>
              <div><Label>Centro de Custo</Label><Input value={form.costCenter} onChange={e => setForm({...form, costCenter: e.target.value})} /></div>
              <div><Label>Ano</Label><Input type="number" value={form.year} onChange={e => setForm({...form, year: e.target.value})} placeholder="Ex: 2024" /></div>
              <div><Label>Chassi</Label><Input value={form.chassis} onChange={e => setForm({...form, chassis: e.target.value})} placeholder="Ex: 9BW..." /></div>
              {editingId && (
                <div><Label>Horímetro</Label><Input type="number" value={form.hourMeter} onChange={e => setForm({...form, hourMeter: e.target.value})} /></div>
              )}
              {form.type === 'combo' && (
                <>
                  <div><Label>Capacidade (litros)</Label><Input type="number" value={form.fuelCapacity} onChange={e => setForm({...form, fuelCapacity: e.target.value})} /></div>
                  <div><Label>Combustível Atual (litros)</Label><Input type="number" value={form.currentFuel} onChange={e => setForm({...form, currentFuel: e.target.value})} /></div>
                </>
              )}
              <Button onClick={handleSave} disabled={!form.name || saving} className="w-full">
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingId ? 'Atualizar' : 'Salvar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Detail Panel */}
      <Dialog open={!!selectedEq} onOpenChange={(v) => { if (!v) setSelectedEq(null); }}>
        <DialogContent className="bg-card border-border max-w-md">
          {selectedEq && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedEq.name}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[selectedEq.status] || ''}`}>
                    {statusLabels[selectedEq.status] || selectedEq.status}
                  </span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Tipo</p>
                    <p className="font-semibold text-foreground">{typeLabels[selectedEq.type]}</p>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Horímetro</p>
                    <p className="font-mono font-bold text-primary text-lg">{selectedEq.current_hour_meter}h</p>
                  </div>
                  {selectedEq.plate && (
                    <div className="bg-secondary/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Placa/Série</p>
                      <p className="font-mono font-semibold text-foreground">{selectedEq.plate}</p>
                    </div>
                  )}
                  {selectedEq.model && (
                    <div className="bg-secondary/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Modelo</p>
                      <p className="font-semibold text-foreground">{selectedEq.model}</p>
                    </div>
                  )}
                  {selectedEq.brand && (
                    <div className="bg-secondary/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Marca</p>
                      <p className="font-semibold text-foreground">{selectedEq.brand}</p>
                    </div>
                  )}
                  {selectedEq.cost_center && (
                    <div className="bg-secondary/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Centro de Custo</p>
                      <p className="font-semibold text-foreground">{selectedEq.cost_center}</p>
                    </div>
                  )}
                  {selectedEq.year && (
                    <div className="bg-secondary/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Ano</p>
                      <p className="font-semibold text-foreground">{selectedEq.year}</p>
                    </div>
                  )}
                  {selectedEq.chassis && (
                    <div className="bg-secondary/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Chassi</p>
                      <p className="font-mono font-semibold text-foreground">{selectedEq.chassis}</p>
                    </div>
                  )}
                  {selectedEq.type === 'combo' && selectedEq.fuel_capacity && (
                    <div className="col-span-2 bg-secondary/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Combustível</p>
                      <p className="font-mono font-bold text-accent text-lg">{selectedEq.current_fuel || 0}L / {selectedEq.fuel_capacity}L</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button onClick={() => openEdit(selectedEq)} className="flex-1 gap-2">
                    <Pencil className="w-4 h-4" /> Editar
                  </Button>
                  <Button variant="destructive" onClick={() => handleDelete(selectedEq.id)} className="gap-2">
                    <Trash2 className="w-4 h-4" /> Excluir
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as OwnershipType)}>
          <div className="flex items-center gap-4 mb-6 flex-wrap">
            <TabsList>
              <TabsTrigger value="own">Próprios</TabsTrigger>
              <TabsTrigger value="third_party">Terceiros</TabsTrigger>
            </TabsList>
            <Input
              placeholder="Buscar por nome ou placa..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="max-w-xs"
            />
          </div>
          <TabsContent value="own">
            {renderEquipmentGrid(filteredEquipments)}
          </TabsContent>
          <TabsContent value="third_party">
            {renderEquipmentGrid(filteredEquipments)}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
