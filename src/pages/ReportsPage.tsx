import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DBEquipment, DBFuelRecord, DBChecklist, DBMaintenancePlan, DBWorkOrder, DBMaintenanceHistory } from '@/lib/supabase-types';

interface Part { code: string; description: string; }
function formatParts(o: any): string {
  const parts = Array.isArray(o.parts) ? o.parts as Part[] : [];
  if (parts.length > 0) return parts.map(p => p.code + (p.description ? ` (${p.description})` : '')).join(', ');
  return o.part_code || '—';
}
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { BarChart2, Droplets, Clock, Wrench, Calendar, FileSpreadsheet, FileText, Filter, ClipboardList, Clipboard, Info, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import * as XLSX from 'xlsx';
import { exportGeneralReportsPDF } from '@/lib/pdf-export';

const COLORS = ['hsl(210,80%,45%)', 'hsl(38,92%,50%)', 'hsl(142,71%,45%)', 'hsl(0,72%,51%)', 'hsl(280,70%,60%)', 'hsl(16,80%,55%)'];

type Period = '7d' | '30d' | '90d' | 'all';

const osStatusLabels: Record<string, string> = { open: 'Aberta', in_progress: 'Em andamento', done: 'Concluída' };
const priorityLabels: Record<string, string> = { low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente' };
const checklistStatusLabels: Record<string, string> = { ok: 'OK', attention: 'Atenção', critical: 'Crítico' };

function eqLabel(eq: DBEquipment, maxLen = 30): string {
  const id = eq.cost_center || eq.plate || '';
  const full = id ? `${eq.name} (${id})` : eq.name;
  return full.length > maxLen ? full.slice(0, maxLen) + '…' : full;
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>('30d');
  const [selectedEquipment, setSelectedEquipment] = useState<string>('all');
  const [equipments, setEquipments] = useState<DBEquipment[]>([]);
  const [fuelRecords, setFuelRecords] = useState<DBFuelRecord[]>([]);
  const [checklists, setChecklists] = useState<DBChecklist[]>([]);
  const [plans, setPlans] = useState<DBMaintenancePlan[]>([]);
  const [workOrders, setWorkOrders] = useState<DBWorkOrder[]>([]);
  const [maintenanceHistory, setMaintenanceHistory] = useState<DBMaintenanceHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const cutoff = period === 'all' ? null : new Date(Date.now() - parseInt(period) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const [eqRes, frRes, clRes, mpRes, osRes, mhRes] = await Promise.all([
        supabase.from('equipments').select('*'),
        cutoff
          ? supabase.from('fuel_records').select('*').gte('date', cutoff).order('date')
          : supabase.from('fuel_records').select('*').order('date'),
        cutoff
          ? supabase.from('checklists').select('*').gte('date', cutoff).order('date')
          : supabase.from('checklists').select('*').order('date'),
        supabase.from('maintenance_plans').select('*'),
        cutoff
          ? supabase.from('work_orders').select('*').gte('created_at', cutoff + 'T00:00:00').order('created_at', { ascending: false })
          : supabase.from('work_orders').select('*').order('created_at', { ascending: false }),
        cutoff
          ? supabase.from('maintenance_history').select('*').gte('executed_at', cutoff + 'T00:00:00').order('executed_at', { ascending: false })
          : supabase.from('maintenance_history').select('*').order('executed_at', { ascending: false }),
      ]);

      setEquipments((eqRes.data || []) as DBEquipment[]);
      setFuelRecords((frRes.data || []) as DBFuelRecord[]);
      setChecklists((clRes.data || []) as unknown as DBChecklist[]);
      setPlans((mpRes.data || []) as DBMaintenancePlan[]);
      setWorkOrders((osRes.data || []) as DBWorkOrder[]);
      setMaintenanceHistory((mhRes.data || []) as DBMaintenanceHistory[]);
      setLoading(false);
    };
    fetchAll();
  }, [period]);

  // Filter data by selected equipment
  const filteredFuel = selectedEquipment === 'all' ? fuelRecords : fuelRecords.filter(r => r.target_equipment_id === selectedEquipment || r.combo_equipment_id === selectedEquipment);
  const filteredChecklists = selectedEquipment === 'all' ? checklists : checklists.filter(c => c.equipment_id === selectedEquipment);
  const filteredPlans = selectedEquipment === 'all' ? plans : plans.filter(p => p.equipment_id === selectedEquipment);
  const filteredEquipments = selectedEquipment === 'all' ? equipments : equipments.filter(e => e.id === selectedEquipment);
  const filteredOrders = selectedEquipment === 'all' ? workOrders : workOrders.filter(o => o.equipment_id === selectedEquipment);
  const filteredHistory = selectedEquipment === 'all' ? maintenanceHistory : maintenanceHistory.filter(h => h.equipment_id === selectedEquipment);

  const selectedEqFull = equipments.find(e => e.id === selectedEquipment);

  // Fuel by equipment
  const fuelByEquipment = filteredEquipments
    .filter(e => e.type !== 'combo')
    .map(eq => ({
      name: eqLabel(eq, 20),
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
        name: eqLabel(eq, 20),
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
  const eqsWithPlans = new Set(filteredPlans.map(p => p.equipment_id));
  const eqsWithoutPlans = filteredEquipments.filter(e => !eqsWithPlans.has(e.id));
  const maintenanceStatus = [
    { name: 'OK', value: filteredPlans.filter(p => p.status === 'ok').length, color: 'hsl(142,71%,45%)' },
    { name: 'Próxima', value: filteredPlans.filter(p => p.status === 'approaching').length, color: 'hsl(38,92%,50%)' },
    { name: 'Atrasada', value: filteredPlans.filter(p => p.status === 'overdue').length, color: 'hsl(0,72%,51%)' },
    { name: 'Sem Plano', value: eqsWithoutPlans.length, color: 'hsl(220,10%,60%)' },
  ];

  // OS status pie
  const osStatus = [
    { name: 'Aberta', value: filteredOrders.filter(o => o.status === 'open').length },
    { name: 'Em andamento', value: filteredOrders.filter(o => o.status === 'in_progress').length },
    { name: 'Concluída', value: filteredOrders.filter(o => o.status === 'done').length },
  ].filter(d => d.value > 0);

  const totalFuel = filteredFuel.reduce((s, r) => s + Number(r.liters), 0);
  const totalChecklists = filteredChecklists.length;
  const activeEquipments = filteredEquipments.filter(e => e.status === 'active').length;
  const totalOS = filteredOrders.length;
  const doneOS = filteredOrders.filter(o => o.status === 'done').length;

  const periodLabels: Record<Period, string> = { '7d': '7 dias', '30d': '30 dias', '90d': '90 dias', 'all': 'Todo período' };

  const selectedEqName = selectedEquipment === 'all' ? 'Todos' : equipments.find(e => e.id === selectedEquipment)?.name || '';

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const suffix = selectedEquipment === 'all' ? '' : `_${selectedEqName}`;

    const fuelSheet = XLSX.utils.json_to_sheet(
      filteredFuel.map(r => {
        const target = equipments.find(e => e.id === r.target_equipment_id);
        const combo = equipments.find(e => e.id === r.combo_equipment_id);
        return { Data: r.date, Equipamento: target?.name || '—', Comboio: combo?.name || '—', Litros: r.liters, Responsável: r.operator_name };
      })
    );
    XLSX.utils.book_append_sheet(wb, fuelSheet, 'Abastecimentos');

    const clSheet = XLSX.utils.json_to_sheet(
      filteredChecklists.map(c => {
        const eq = equipments.find(e => e.id === c.equipment_id);
        const ncItems = Array.isArray(c.items) ? (c.items as any[]).filter(i => i.checked === false) : [];
        const ncText = ncItems.map(i => i.label + (i.observation ? ` (${i.observation})` : '')).join('; ');
        return {
          Data: c.date, Equipamento: eq?.name || '—', Operador: c.operator_name, Tipo: c.type,
          Horímetro: c.hour_meter, Status: checklistStatusLabels[c.status] || c.status,
          'Não Conformidades': ncText || 'Conforme',
        };
      })
    );
    XLSX.utils.book_append_sheet(wb, clSheet, 'Checklists');

    const osSheet = XLSX.utils.json_to_sheet(
      filteredOrders.map(o => {
        const eq = equipments.find(e => e.id === o.equipment_id);
        return {
          'OS #': o.os_number, Equipamento: eq?.name || '—', Descrição: o.description,
          Prioridade: priorityLabels[o.priority] || o.priority,
          Status: osStatusLabels[o.status] || o.status,
          Mecânico: o.mechanic_name || '—',
          'Peças Trocadas': formatParts(o),
          'Data Abertura': new Date(o.created_at).toLocaleDateString('pt-BR'),
          Início: o.started_at ? new Date(o.started_at).toLocaleString('pt-BR') : '—',
          Conclusão: o.completed_at ? new Date(o.completed_at).toLocaleString('pt-BR') : '—',
        };
      })
    );
    XLSX.utils.book_append_sheet(wb, osSheet, 'Ordens de Serviço');

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

    XLSX.writeFile(wb, `CSMCONTROL_Relatorio_${period}${suffix}.xlsx`);
  };

  const exportPDF = () => {
    const selectedEq = selectedEquipment !== 'all' ? equipments.find(e => e.id === selectedEquipment) : undefined;
    exportGeneralReportsPDF({
      period: periodLabels[period],
      filterName: selectedEqName,
      totalFuel,
      totalChecklists,
      activeEquipments,
      overdueMaintenances: filteredPlans.filter(p => p.status === 'overdue').length,
      fuelByEquipment: fuelByEquipment.map(f => ({ name: f.name, litros: f.litros })),
      fuelByDay: fuelByDay.map(f => ({ date: f.date, litros: f.litros })),
      hoursByEquipment: hoursByEquipment.map(h => ({ name: h.name, horimetro: h.horímetro })),
      checklistStatus,
      maintenanceStatus: maintenanceStatus.map(s => ({ name: s.name, value: s.value, color: s.color })),
      fuelRecords: filteredFuel.map(r => {
        const target = equipments.find(e => e.id === r.target_equipment_id);
        const combo = equipments.find(e => e.id === r.combo_equipment_id);
        return { date: r.date, equipment: target ? eqLabel(target) : '—', combo: combo ? eqLabel(combo) : '—', liters: r.liters, operator: r.operator_name };
      }),
      checklistRecords: filteredChecklists.map(c => {
        const eq = equipments.find(e => e.id === c.equipment_id);
        const ncItems = Array.isArray(c.items) ? (c.items as any[]).filter(i => i.checked === false) : [];
        const ncText = ncItems.map(i => i.label + (i.observation ? ` (${i.observation})` : '')).join('; ');
        return { date: c.date, equipment: eq ? eqLabel(eq) : '—', operator: c.operator_name, hourMeter: c.hour_meter, status: checklistStatusLabels[c.status] || c.status, ncItems: ncText };
      }),
      maintenancePlans: [
        ...filteredPlans.map(p => {
          const eq = equipments.find(e => e.id === p.equipment_id);
          return { equipment: eq ? eqLabel(eq) : '—', description: p.description, interval: p.interval_hours, nextDue: p.next_due_at, status: p.status === 'ok' ? 'OK' : p.status === 'approaching' ? 'Próxima' : 'Atrasada', lastExec: p.last_executed_at ? new Date(p.last_executed_at).toLocaleDateString('pt-BR') : '—' };
        }),
        ...eqsWithoutPlans.map(eq => ({
          equipment: eqLabel(eq), description: 'Nenhum plano cadastrado', interval: 0, nextDue: 0, status: 'Sem Plano', lastExec: '—',
        })),
      ],
      osRecords: filteredOrders.map(o => {
        const eq = equipments.find(e => e.id === o.equipment_id);
        return {
          osNumber: o.os_number,
          equipment: eq ? eqLabel(eq) : '—',
          description: o.description,
          priority: priorityLabels[o.priority] || o.priority,
          status: osStatusLabels[o.status] || o.status,
          mechanic: o.mechanic_name || '—',
          parts: formatParts(o),
          date: new Date(o.created_at).toLocaleDateString('pt-BR'),
          startedAt: o.started_at ? new Date(o.started_at).toLocaleString('pt-BR') : '—',
          completedAt: o.completed_at ? new Date(o.completed_at).toLocaleString('pt-BR') : '—',
          laborCost: Number((o as any).labor_cost) || 0,
          partsCost: Number((o as any).parts_cost) || 0,
        };
      }),
      equipmentDetails: selectedEq ? {
        name: selectedEq.name,
        plate: selectedEq.plate || undefined,
        model: selectedEq.model || undefined,
        brand: selectedEq.brand || undefined,
        costCenter: selectedEq.cost_center || undefined,
        year: selectedEq.year || undefined,
        currentHourMeter: selectedEq.current_hour_meter,
      } : undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black text-gradient">Relatórios</h1>
          <p className="text-muted-foreground mt-1">Análise de frota, combustível, checklists e OS</p>
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
          <Label className="text-xs text-muted-foreground mb-1 block">Filtrar por Máquina / Caminhão</Label>
          <Select value={selectedEquipment} onValueChange={setSelectedEquipment}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="all">Todos os Equipamentos</SelectItem>
              {equipments.map(eq => {
                const id = eq.cost_center || eq.plate || '';
                const label = id ? `${eq.name} (${id})` : eq.name;
                return <SelectItem key={eq.id} value={eq.id}>{label}</SelectItem>;
              })}
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
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="glass-card rounded-xl p-4">
          <Droplets className="w-5 h-5 text-primary mb-2" />
          <p className="text-2xl font-black font-mono text-primary">{totalFuel.toLocaleString('pt-BR')}L</p>
          <p className="text-xs text-muted-foreground mt-1">Combustível consumido</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <ClipboardList className="w-5 h-5 text-success mb-2" />
          <p className="text-2xl font-black font-mono text-success">{totalChecklists}</p>
          <p className="text-xs text-muted-foreground mt-1">Checklists realizados</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <Clipboard className="w-5 h-5 text-primary mb-2" />
          <p className="text-2xl font-black font-mono text-primary">{totalOS}</p>
          <p className="text-xs text-muted-foreground mt-1">Ordens de Serviço</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <Wrench className="w-5 h-5 text-warning mb-2" />
          <p className="text-2xl font-black font-mono text-warning">{doneOS}</p>
          <p className="text-xs text-muted-foreground mt-1">OS Concluídas</p>
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
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 82%)" />
                  <XAxis dataKey="date" tick={{ fill: 'hsl(220 10% 40%)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'hsl(220 10% 40%)', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: 'white', border: '1px solid hsl(220 14% 85%)', borderRadius: 8 }} labelStyle={{ color: 'hsl(220 10% 25%)' }} itemStyle={{ color: 'hsl(210 80% 45%)' }} formatter={(v: number) => [`${v}L`, 'Litros']} />
                  <Bar dataKey="litros" fill="hsl(210 80% 45%)" radius={[4, 4, 0, 0]} />
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
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 82%)" />
                  <XAxis type="number" tick={{ fill: 'hsl(220 10% 40%)', fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={80} tick={{ fill: 'hsl(220 10% 40%)', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: 'white', border: '1px solid hsl(220 14% 85%)', borderRadius: 8 }} formatter={(v: number) => [`${v}L`, 'Litros']} />
                  <Bar dataKey="litros" fill="hsl(210 80% 45%)" radius={[0, 4, 4, 0]}>
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
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 82%)" />
                  <XAxis dataKey="name" tick={{ fill: 'hsl(220 10% 40%)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'hsl(220 10% 40%)', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: 'white', border: '1px solid hsl(220 14% 85%)', borderRadius: 8 }} formatter={(v: number) => [`${v}h`, 'Horímetro']} />
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
                  <Tooltip contentStyle={{ background: 'white', border: '1px solid hsl(220 14% 85%)', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* OS status pie */}
          <div className="glass-card rounded-xl p-5">
            <h2 className="font-bold mb-4 flex items-center gap-2">
              <Clipboard className="w-5 h-5 text-primary" />
              Status das Ordens de Serviço
            </h2>
            {osStatus.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhuma OS no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={osStatus} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {osStatus.map((_, i) => (<Cell key={i} fill={['hsl(220,10%,55%)', 'hsl(210,80%,56%)', 'hsl(142,71%,45%)'][i]} />))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'white', border: '1px solid hsl(220 14% 85%)', borderRadius: 8 }} />
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
                      <div className="h-2 rounded-full transition-all" style={{ width: maintenanceStatus.reduce((a, b) => a + b.value, 0) ? `${(s.value / maintenanceStatus.reduce((a, b) => a + b.value, 0)) * 100}%` : '0%', background: s.color }} />
                    </div>
                  </div>
                </div>
              ))}
              {filteredPlans.length === 0 && eqsWithoutPlans.length === 0 && <p className="text-muted-foreground text-sm">Nenhum plano cadastrado.</p>}
            </div>
          </div>

          {/* ===== TABELA CHECKLISTS ===== */}
          <div className="glass-card rounded-xl p-5 lg:col-span-2">
            <h2 className="font-bold mb-4 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-success" />
              Registros de Checklists
            </h2>
            {filteredChecklists.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum checklist no período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-border">
                      <th className="pb-2 pr-4">Data</th>
                      <th className="pb-2 pr-4">Equipamento</th>
                      <th className="pb-2 pr-4">Operador</th>
                      <th className="pb-2 pr-4">Tipo</th>
                      <th className="pb-2 pr-4">Horímetro</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2">Não Conformidades</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredChecklists.map(c => {
                      const eq = equipments.find(e => e.id === c.equipment_id);
                      const ncItems = Array.isArray(c.items) ? (c.items as any[]).filter(i => i.checked === false) : [];
                      return (
                        <tr key={c.id} className="hover:bg-secondary/30 transition-colors align-top">
                          <td className="py-2 pr-4">{new Date(c.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                          <td className="py-2 pr-4 font-medium">{eq?.name || '—'}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{c.operator_name}</td>
                          <td className="py-2 pr-4 capitalize">{c.type === 'daily' ? 'Diário' : c.type === 'corrective' ? 'Corretivo' : 'Preventivo'}</td>
                          <td className="py-2 pr-4 font-mono">{c.hour_meter}h</td>
                          <td className="py-2 pr-4">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.status === 'ok' ? 'bg-success/15 text-success' : c.status === 'attention' ? 'bg-warning/15 text-warning' : 'bg-destructive/15 text-destructive'}`}>
                              {checklistStatusLabels[c.status] || c.status}
                            </span>
                          </td>
                          <td className="py-2 text-xs">
                            {ncItems.length === 0 ? (
                              <span className="text-success">Conforme</span>
                            ) : (
                              <div className="space-y-0.5">
                                {ncItems.map((item: any, idx: number) => (
                                  <div key={idx} className="text-destructive">
                                    <span className="font-medium">• {item.label}</span>
                                    {item.observation && <span className="text-muted-foreground ml-1">({item.observation})</span>}
                                  </div>
                                ))}
                              </div>
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

          {/* ===== TABELA ABASTECIMENTOS ===== */}
          <div className="glass-card rounded-xl p-5 lg:col-span-2">
            <h2 className="font-bold mb-4 flex items-center gap-2">
              <Droplets className="w-5 h-5 text-primary" />
              Registros de Abastecimento
            </h2>
            {filteredFuel.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum abastecimento no período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-border">
                      <th className="pb-2 pr-4">Data</th>
                      <th className="pb-2 pr-4">Equipamento</th>
                      <th className="pb-2 pr-4">Comboio</th>
                      <th className="pb-2 pr-4">Litros</th>
                      <th className="pb-2">Responsável</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredFuel.map(r => {
                      const target = equipments.find(e => e.id === r.target_equipment_id);
                      const combo = equipments.find(e => e.id === r.combo_equipment_id);
                      return (
                        <tr key={r.id} className="hover:bg-secondary/30 transition-colors">
                          <td className="py-2 pr-4">{new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                          <td className="py-2 pr-4 font-medium">{target?.name || '—'}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{combo?.name || '—'}</td>
                          <td className="py-2 pr-4 font-mono font-bold">{Number(r.liters).toLocaleString('pt-BR')}L</td>
                          <td className="py-2 text-muted-foreground">{r.operator_name}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ===== TABELA ORDENS DE SERVIÇO ===== */}
          <div className="glass-card rounded-xl p-5 lg:col-span-2">
            <h2 className="font-bold mb-4 flex items-center gap-2">
              <Clipboard className="w-5 h-5 text-primary" />
              Ordens de Serviço
            </h2>
            {filteredOrders.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhuma OS no período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-border">
                      <th className="pb-2 pr-4">OS #</th>
                      <th className="pb-2 pr-4">Equipamento</th>
                      <th className="pb-2 pr-4">Descrição</th>
                      <th className="pb-2 pr-4">Prioridade</th>
                      <th className="pb-2 pr-4">Mecânico</th>
                      <th className="pb-2 pr-4">Peças Trocadas</th>
                      <th className="pb-2 pr-4">Início</th>
                      <th className="pb-2 pr-4">Conclusão</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredOrders.map(o => {
                      const eq = equipments.find(e => e.id === o.equipment_id);
                      const partsText = formatParts(o);
                      return (
                        <tr key={o.id} className="hover:bg-secondary/30 transition-colors">
                          <td className="py-2 pr-4 font-mono font-bold">#{o.os_number}</td>
                          <td className="py-2 pr-4 font-medium">{eq?.name || '—'}</td>
                          <td className="py-2 pr-4 text-muted-foreground max-w-[200px] truncate">{o.description}</td>
                          <td className="py-2 pr-4">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${o.priority === 'urgent' ? 'bg-destructive/15 text-destructive' : o.priority === 'high' ? 'bg-warning/15 text-warning' : o.priority === 'medium' ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                              {priorityLabels[o.priority] || o.priority}
                            </span>
                          </td>
                          <td className="py-2 pr-4 text-muted-foreground">{o.mechanic_name || '—'}</td>
                          <td className="py-2 pr-4 text-muted-foreground text-xs">{partsText}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{o.started_at ? new Date(o.started_at).toLocaleString('pt-BR') : '—'}</td>
                          <td className="py-2 pr-4">{o.completed_at ? <span className="text-success">{new Date(o.completed_at).toLocaleString('pt-BR')}</span> : '—'}</td>
                          <td className="py-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${o.status === 'done' ? 'bg-success/15 text-success' : o.status === 'in_progress' ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                              {osStatusLabels[o.status] || o.status}
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

          {/* Histórico de planos */}
          <div className="glass-card rounded-xl p-5 lg:col-span-2">
            <h2 className="font-bold mb-4 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-primary" />
              Planos de Manutenção Preventiva
            </h2>
            {filteredPlans.length === 0 && eqsWithoutPlans.length === 0 ? (
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
                          <td className="py-2 pr-4 font-medium">{eq ? eqLabel(eq) : '—'}</td>
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
                    {eqsWithoutPlans.map(eq => (
                      <tr key={`no-plan-${eq.id}`} className="hover:bg-secondary/30 transition-colors opacity-60">
                        <td className="py-2 pr-4 font-medium">{eqLabel(eq)}</td>
                        <td className="py-2 pr-4 text-muted-foreground italic" colSpan={4}>Nenhum plano de manutenção cadastrado</td>
                        <td className="py-2">
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-secondary text-muted-foreground">Sem Plano</span>
                        </td>
                      </tr>
                    ))}
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
