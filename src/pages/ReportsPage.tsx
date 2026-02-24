import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DBEquipment, DBFuelRecord, DBChecklist, DBMaintenancePlan } from '@/lib/supabase-types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { BarChart2, Droplets, Clock, Wrench, Calendar, FileSpreadsheet, FileText, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import * as XLSX from 'xlsx';
import { exportElementToPDF } from '@/lib/pdf-export';

const COLORS = ['hsl(0,80%,50%)', 'hsl(38,92%,50%)', 'hsl(142,71%,45%)', 'hsl(210,80%,56%)', 'hsl(280,70%,60%)', 'hsl(16,80%,55%)'];

type Period = '7d' | '30d' | '90d' | 'all';

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>('30d');
  const [selectedEquipment, setSelectedEquipment] = useState<string>('all');
  const [equipments, setEquipments] = useState<DBEquipment[]>([]);
  const [fuelRecords, setFuelRecords] = useState<DBFuelRecord[]>([]);
  const [checklists, setChecklists] = useState<DBChecklist[]>([]);
  const [plans, setPlans] = useState<DBMaintenancePlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const cutoff = period === 'all' ? null : new Date(Date.now() - parseInt(period) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const [eqRes, frRes, clRes, mpRes] = await Promise.all([
        supabase.from('equipments').select('*'),
        cutoff
          ? supabase.from('fuel_records').select('*').gte('date', cutoff).order('date')
          : supabase.from('fuel_records').select('*').order('date'),
        cutoff
          ? supabase.from('checklists').select('*').gte('date', cutoff).order('date')
          : supabase.from('checklists').select('*').order('date'),
        supabase.from('maintenance_plans').select('*'),
      ]);

      setEquipments((eqRes.data || []) as DBEquipment[]);
      setFuelRecords((frRes.data || []) as DBFuelRecord[]);
      setChecklists((clRes.data || []) as unknown as DBChecklist[]);
      setPlans((mpRes.data || []) as DBMaintenancePlan[]);
      setLoading(false);
    };
    fetchAll();
  }, [period]);

  // Filter data by selected equipment
  const filteredFuel = selectedEquipment === 'all' ? fuelRecords : fuelRecords.filter(r => r.target_equipment_id === selectedEquipment || r.combo_equipment_id === selectedEquipment);
  const filteredChecklists = selectedEquipment === 'all' ? checklists : checklists.filter(c => c.equipment_id === selectedEquipment);
  const filteredPlans = selectedEquipment === 'all' ? plans : plans.filter(p => p.equipment_id === selectedEquipment);
  const filteredEquipments = selectedEquipment === 'all' ? equipments : equipments.filter(e => e.id === selectedEquipment);

  // Fuel by equipment
  const fuelByEquipment = filteredEquipments
    .filter(e => e.type !== 'combo')
    .map(eq => ({
      name: eq.name.length > 12 ? eq.name.slice(0, 12) + '…' : eq.name,
      litros: filteredFuel
        .filter(r => r.target_equipment_id === eq.id)
        .reduce((s, r) => s + Number(r.liters), 0),
    }))
    .filter(d => d.litros > 0)
    .sort((a, b) => b.litros - a.litros);

  // Fuel by day
  const fuelByDay = (() => {
    const map: Record<string, number> = {};
    filteredFuel.forEach(r => {
      map[r.date] = (map[r.date] || 0) + Number(r.liters);
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-20)
      .map(([date, litros]) => ({
        date: new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        litros,
      }));
  })();

  // Hours worked
  const hoursByEquipment = filteredEquipments
    .filter(e => e.type !== 'combo')
    .map(eq => {
      const eqChecklists = filteredChecklists
        .filter(c => c.equipment_id === eq.id)
        .sort((a, b) => a.date.localeCompare(b.date));
      const horasRegistradas = eqChecklists.length >= 2
        ? eqChecklists[eqChecklists.length - 1].hour_meter - eqChecklists[0].hour_meter
        : 0;
      return {
        name: eq.name.length > 12 ? eq.name.slice(0, 12) + '…' : eq.name,
        horas: Math.max(0, horasRegistradas),
        horímetro: eq.current_hour_meter,
      };
    })
    .filter(d => d.horímetro > 0);

  // Checklist status pie
  const checklistStatus = [
    { name: 'OK', value: filteredChecklists.filter(c => c.status === 'ok').length },
    { name: 'Atenção', value: filteredChecklists.filter(c => c.status === 'attention').length },
    { name: 'Crítico', value: filteredChecklists.filter(c => c.status === 'critical').length },
  ].filter(d => d.value > 0);

  // Maintenance status
  const maintenanceStatus = [
    { name: 'OK', value: filteredPlans.filter(p => p.status === 'ok').length, color: 'hsl(142,71%,45%)' },
    { name: 'Próxima', value: filteredPlans.filter(p => p.status === 'approaching').length, color: 'hsl(38,92%,50%)' },
    { name: 'Atrasada', value: filteredPlans.filter(p => p.status === 'overdue').length, color: 'hsl(0,72%,51%)' },
  ];

  const totalFuel = filteredFuel.reduce((s, r) => s + Number(r.liters), 0);
  const totalChecklists = filteredChecklists.length;
  const activeEquipments = filteredEquipments.filter(e => e.status === 'active').length;

  const periodLabels: Record<Period, string> = { '7d': '7 dias', '30d': '30 dias', '90d': '90 dias', 'all': 'Todo período' };

  const selectedEqName = selectedEquipment === 'all' ? 'Todos' : equipments.find(e => e.id === selectedEquipment)?.name || '';

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const suffix = selectedEquipment === 'all' ? '' : `_${selectedEqName}`;

    const fuelSheet = XLSX.utils.json_to_sheet(
      filteredEquipments.filter(e => e.type !== 'combo').map(eq => ({
        Equipamento: eq.name,
        'Litros consumidos': filteredFuel.filter(r => r.target_equipment_id === eq.id).reduce((s, r) => s + Number(r.liters), 0),
        'Horímetro atual': eq.current_hour_meter,
      }))
    );
    XLSX.utils.book_append_sheet(wb, fuelSheet, 'Combustível');

    const clSheet = XLSX.utils.json_to_sheet(
      filteredChecklists.map(c => {
        const eq = equipments.find(e => e.id === c.equipment_id);
        return {
          Data: c.date, Equipamento: eq?.name || '—', Operador: c.operator_name,
          Horímetro: c.hour_meter, Status: c.status === 'ok' ? 'OK' : c.status === 'attention' ? 'Atenção' : 'Crítico',
        };
      })
    );
    XLSX.utils.book_append_sheet(wb, clSheet, 'Checklists');

    const mpSheet = XLSX.utils.json_to_sheet(
      filteredPlans.map(p => {
        const eq = equipments.find(e => e.id === p.equipment_id);
        return {
          Equipamento: eq?.name || '—', Descrição: p.description,
          'Intervalo (h)': p.interval_hours, 'Próxima (h)': p.next_due_at,
          Status: p.status === 'ok' ? 'OK' : p.status === 'approaching' ? 'Próxima' : 'Atrasada',
          'Última execução': p.last_executed_at ? new Date(p.last_executed_at).toLocaleDateString('pt-BR') : '—',
        };
      })
    );
    XLSX.utils.book_append_sheet(wb, mpSheet, 'Manutenções');

    const fdSheet = XLSX.utils.json_to_sheet(
      filteredFuel.map(r => {
        const target = equipments.find(e => e.id === r.target_equipment_id);
        const combo = equipments.find(e => e.id === r.combo_equipment_id);
        return { Data: r.date, Equipamento: target?.name || '—', Comboio: combo?.name || '—', Litros: r.liters, Responsável: r.operator_name };
      })
    );
    XLSX.utils.book_append_sheet(wb, fdSheet, 'Abastecimentos');

    XLSX.writeFile(wb, `CSMCONTROL_Relatorio_${period}${suffix}.xlsx`);
  };

  const exportPDF = () => { exportElementToPDF('reports-content', `CSMCONTROL_Relatorio_${period}.pdf`); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black text-gradient">Relatórios</h1>
          <p className="text-muted-foreground mt-1">Análise de frota, combustível e manutenções</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-1">
            {(['7d', '30d', '90d', 'all'] as Period[]).map(p => (
              <Button key={p} size="sm" variant={period === p ? 'default' : 'outline'} onClick={() => setPeriod(p)}>
                {periodLabels[p]}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={exportExcel} className="gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-success" /> Excel
            </Button>
            <Button size="sm" variant="outline" onClick={exportPDF} className="gap-1.5">
              <FileText className="w-4 h-4 text-primary" /> PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Equipment filter */}
      <div className="glass-card rounded-xl p-4 flex items-center gap-4 flex-wrap">
        <Filter className="w-5 h-5 text-primary shrink-0" />
        <div className="flex-1 min-w-[200px] max-w-xs">
          <Label className="text-xs text-muted-foreground mb-1 block">Filtrar por Máquina</Label>
          <Select value={selectedEquipment} onValueChange={setSelectedEquipment}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="all">Todos os Equipamentos</SelectItem>
              {equipments.filter(e => e.type !== 'combo').map(eq => (
                <SelectItem key={eq.id} value={eq.id}>{eq.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedEquipment !== 'all' && (
          <Button variant="ghost" size="sm" onClick={() => setSelectedEquipment('all')} className="text-muted-foreground">
            Limpar filtro
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass-card rounded-xl p-4">
          <Droplets className="w-5 h-5 text-primary mb-2" />
          <p className="text-2xl font-black font-mono text-primary">{totalFuel.toLocaleString('pt-BR')}L</p>
          <p className="text-xs text-muted-foreground mt-1">Combustível consumido</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <BarChart2 className="w-5 h-5 text-success mb-2" />
          <p className="text-2xl font-black font-mono text-success">{totalChecklists}</p>
          <p className="text-xs text-muted-foreground mt-1">Checklists realizados</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <Wrench className="w-5 h-5 text-warning mb-2" />
          <p className="text-2xl font-black font-mono text-warning">{filteredPlans.filter(p => p.status === 'overdue').length}</p>
          <p className="text-xs text-muted-foreground mt-1">Manutenções atrasadas</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <Clock className="w-5 h-5 text-accent mb-2" />
          <p className="text-2xl font-black font-mono text-accent">{activeEquipments}</p>
          <p className="text-xs text-muted-foreground mt-1">Equipamentos ativos</p>
        </div>
      </div>

      <div id="reports-content">
      {loading ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <p className="text-muted-foreground">Carregando dados...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Combustível por dia */}
          <div className="glass-card rounded-xl p-5 lg:col-span-2">
            <h2 className="font-bold mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Consumo de Combustível por Dia (L)
            </h2>
            {fuelByDay.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum registro no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={fuelByDay} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 22%)" />
                  <XAxis dataKey="date" tick={{ fill: 'hsl(220 10% 55%)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'hsl(220 10% 55%)', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: 'hsl(220 18% 14%)', border: '1px solid hsl(220 14% 22%)', borderRadius: 8 }} labelStyle={{ color: 'hsl(40 10% 92%)' }} itemStyle={{ color: 'hsl(0 80% 50%)' }} formatter={(v: number) => [`${v}L`, 'Litros']} />
                  <Bar dataKey="litros" fill="hsl(0 80% 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Combustível por equipamento */}
          <div className="glass-card rounded-xl p-5">
            <h2 className="font-bold mb-4 flex items-center gap-2">
              <Droplets className="w-5 h-5 text-primary" />
              Combustível por Equipamento (L)
            </h2>
            {fuelByEquipment.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum abastecimento no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={fuelByEquipment} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 22%)" />
                  <XAxis type="number" tick={{ fill: 'hsl(220 10% 55%)', fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={80} tick={{ fill: 'hsl(220 10% 55%)', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: 'hsl(220 18% 14%)', border: '1px solid hsl(220 14% 22%)', borderRadius: 8 }} formatter={(v: number) => [`${v}L`, 'Litros']} />
                  <Bar dataKey="litros" fill="hsl(0 80% 50%)" radius={[0, 4, 4, 0]}>
                    {fuelByEquipment.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Horímetro */}
          <div className="glass-card rounded-xl p-5">
            <h2 className="font-bold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-warning" />
              Horímetro Atual por Equipamento
            </h2>
            {hoursByEquipment.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum equipamento com horas registradas.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={hoursByEquipment} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 22%)" />
                  <XAxis dataKey="name" tick={{ fill: 'hsl(220 10% 55%)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'hsl(220 10% 55%)', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: 'hsl(220 18% 14%)', border: '1px solid hsl(220 14% 22%)', borderRadius: 8 }} formatter={(v: number) => [`${v}h`, 'Horímetro']} />
                  <Bar dataKey="horímetro" fill="hsl(38 92% 50%)" radius={[4, 4, 0, 0]}>
                    {hoursByEquipment.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Checklist status pie */}
          <div className="glass-card rounded-xl p-5">
            <h2 className="font-bold mb-4 flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-success" />
              Status dos Checklists
            </h2>
            {checklistStatus.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum checklist no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={checklistStatus} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {checklistStatus.map((_, i) => (<Cell key={i} fill={['hsl(142,71%,45%)', 'hsl(38,92%,50%)', 'hsl(0,72%,51%)'][i]} />))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'hsl(220 18% 14%)', border: '1px solid hsl(220 14% 22%)', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Maintenance status */}
          <div className="glass-card rounded-xl p-5">
            <h2 className="font-bold mb-4 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-warning" />
              Status dos Planos de Manutenção
            </h2>
            <div className="space-y-3 mt-6">
              {maintenanceStatus.map(s => (
                <div key={s.name} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: s.color }} />
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{s.name}</span>
                      <span className="font-mono text-muted-foreground">{s.value}</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div className="h-2 rounded-full transition-all" style={{ width: filteredPlans.length ? `${(s.value / filteredPlans.length) * 100}%` : '0%', background: s.color }} />
                    </div>
                  </div>
                </div>
              ))}
              {filteredPlans.length === 0 && <p className="text-muted-foreground text-sm">Nenhum plano cadastrado.</p>}
            </div>
          </div>

          {/* Histórico de planos */}
          <div className="glass-card rounded-xl p-5 lg:col-span-2">
            <h2 className="font-bold mb-4 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-primary" />
              Histórico de Planos de Manutenção
            </h2>
            {filteredPlans.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum plano cadastrado.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-border">
                      <th className="pb-2 pr-4">Equipamento</th>
                      <th className="pb-2 pr-4">Descrição</th>
                      <th className="pb-2 pr-4">Intervalo</th>
                      <th className="pb-2 pr-4">Próxima (h)</th>
                      <th className="pb-2 pr-4">Última execução</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredPlans.map(p => {
                      const eq = equipments.find(e => e.id === p.equipment_id);
                      return (
                        <tr key={p.id} className="hover:bg-secondary/30 transition-colors">
                          <td className="py-2 pr-4 font-medium">{eq?.name || '—'}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{p.description}</td>
                          <td className="py-2 pr-4 font-mono">{p.interval_hours}h</td>
                          <td className="py-2 pr-4 font-mono">{p.next_due_at}h</td>
                          <td className="py-2 pr-4 text-muted-foreground">
                            {p.last_executed_at ? new Date(p.last_executed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td className="py-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.status === 'ok' ? 'bg-success/15 text-success' : p.status === 'approaching' ? 'bg-warning/15 text-warning' : 'bg-destructive/15 text-destructive'}`}>
                              {p.status === 'ok' ? 'OK' : p.status === 'approaching' ? 'Próxima' : 'Atrasada'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
