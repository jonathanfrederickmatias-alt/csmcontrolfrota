import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Truck, ClipboardCheck, Wrench, AlertTriangle, Fuel, Activity,
  RefreshCw, TrendingUp, CheckCircle2, XCircle, Droplets
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, AreaChart, Area
} from "recharts";

const COLORS = {
  ok: "hsl(142, 71%, 45%)",
  warning: "hsl(38, 92%, 50%)",
  critical: "hsl(0, 72%, 51%)",
  primary: "hsl(0, 80%, 50%)",
  muted: "hsl(220, 14%, 30%)",
  blue: "hsl(210, 70%, 50%)",
  teal: "hsl(170, 60%, 45%)",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [data, setData] = useState({
    equipments: [] as any[],
    checklists: [] as any[],
    plans: [] as any[],
    fuelRecords: [] as any[],
    requests: [] as any[],
    combos: [] as any[],
    workOrders: [] as any[],
  });

  const fetchData = useCallback(async () => {
    setIsRefreshing(true);
    const [eqRes, clRes, plRes, frRes, reqRes, woRes] = await Promise.all([
      supabase.from('equipments').select('*'),
      supabase.from('checklists').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('maintenance_plans').select('*'),
      supabase.from('fuel_records').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('maintenance_requests').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('work_orders').select('*').order('created_at', { ascending: false }).limit(100),
    ]);
    const equipments = eqRes.data || [];
    setData({
      equipments,
      checklists: clRes.data || [],
      plans: plRes.data || [],
      fuelRecords: frRes.data || [],
      requests: reqRes.data || [],
      combos: equipments.filter((e: any) => e.type === 'combo'),
      workOrders: woRes.data || [],
    });
    setIsRefreshing(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const today = new Date().toISOString().split('T')[0];
  const todayStr = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

  // Computed stats
  const stats = useMemo(() => {
    const overdue = data.plans.filter((p: any) => p.status === 'overdue');
    const approaching = data.plans.filter((p: any) => p.status === 'approaching');
    const okPlans = data.plans.filter((p: any) => p.status === 'ok');
    const openRequests = data.requests.filter((r: any) => r.status === 'open');
    const inProgressRequests = data.requests.filter((r: any) => r.status === 'in_progress');
    const resolvedRequests = data.requests.filter((r: any) => r.status === 'resolved');
    const activeEquipments = data.equipments.filter((e: any) => e.status === 'active');
    const inactiveEquipments = data.equipments.filter((e: any) => e.status !== 'active');
    const todayChecklists = data.checklists.filter((c: any) => c.date === today);
    const totalFuelToday = data.fuelRecords.filter((f: any) => f.date === today).reduce((s: number, f: any) => s + Number(f.liters), 0);

    // Checklists by status
    const clOk = data.checklists.filter((c: any) => c.status === 'ok').length;
    const clAttention = data.checklists.filter((c: any) => c.status === 'attention').length;
    const clCritical = data.checklists.filter((c: any) => c.status === 'critical').length;
    const clTotal = clOk + clAttention + clCritical || 1;
    const checklistScore = ((clOk / clTotal) * 100).toFixed(1);

    // Fuel last 7 days
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });
    const fuelByDay = last7.map(day => {
      const liters = data.fuelRecords.filter((f: any) => f.date === day).reduce((s: number, f: any) => s + Number(f.liters), 0);
      const label = new Date(day + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short' });
      return { day: label, litros: liters };
    });

    // Top 5 equipments by fuel consumption
    const fuelByEquip: Record<string, number> = {};
    data.fuelRecords.forEach((f: any) => {
      fuelByEquip[f.target_equipment_id] = (fuelByEquip[f.target_equipment_id] || 0) + Number(f.liters);
    });
    const topFuelEquip = Object.entries(fuelByEquip)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, liters]) => {
        const eq = data.equipments.find((e: any) => e.id === id);
        return { name: eq?.name?.substring(0, 15) || 'N/A', litros: liters };
      });

    // OS status
    const osOpen = data.workOrders.filter((w: any) => w.status === 'open').length;
    const osProgress = data.workOrders.filter((w: any) => w.status === 'in_progress').length;
    const osDone = data.workOrders.filter((w: any) => w.status === 'completed').length;

    // Maintenance trend last 3 months (by week)
    const now = new Date();
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const weeks: { label: string; pedidos: number; os: number; concluidas: number }[] = [];
    const weekStart = new Date(threeMonthsAgo);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // align to Sunday
    while (weekStart < now) {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const wLabel = `${weekStart.getDate().toString().padStart(2, '0')}/${(weekStart.getMonth() + 1).toString().padStart(2, '0')}`;
      const pedidos = data.requests.filter((r: any) => {
        const d = new Date(r.created_at);
        return d >= weekStart && d < weekEnd;
      }).length;
      const os = data.workOrders.filter((w: any) => {
        const d = new Date(w.created_at);
        return d >= weekStart && d < weekEnd;
      }).length;
      const concluidas = data.workOrders.filter((w: any) => {
        if (w.status !== 'completed' || !w.completed_at) return false;
        const d = new Date(w.completed_at);
        return d >= weekStart && d < weekEnd;
      }).length;
      weeks.push({ label: wLabel, pedidos, os, concluidas });
      weekStart.setDate(weekStart.getDate() + 7);
    }

    return {
      overdue, approaching, okPlans, openRequests, inProgressRequests, resolvedRequests,
      activeEquipments, inactiveEquipments, todayChecklists, totalFuelToday,
      clOk, clAttention, clCritical, checklistScore,
      fuelByDay, topFuelEquip, osOpen, osProgress, osDone, maintenanceTrend: weeks,
    };
  }, [data, today]);

  const urgencyLevel = stats.overdue.length > 0 ? 'critical' : stats.approaching.length > 0 || stats.openRequests.length > 0 ? 'warning' : 'ok';

  // Chart data
  const checklistDonut = [
    { name: 'OK', value: stats.clOk, color: COLORS.ok },
    { name: 'Atenção', value: stats.clAttention, color: COLORS.warning },
    { name: 'Crítico', value: stats.clCritical, color: COLORS.critical },
  ].filter(d => d.value > 0);

  const maintenanceDonut = [
    { name: 'Em dia', value: stats.okPlans.length, color: COLORS.ok },
    { name: 'Próxima', value: stats.approaching.length, color: COLORS.warning },
    { name: 'Atrasada', value: stats.overdue.length, color: COLORS.critical },
  ].filter(d => d.value > 0);

  const equipmentDonut = [
    { name: 'Ativos', value: stats.activeEquipments.length, color: COLORS.ok },
    { name: 'Inativos', value: stats.inactiveEquipments.length, color: COLORS.muted },
  ].filter(d => d.value > 0);

  const osDonut = [
    { name: 'Aberta', value: stats.osOpen, color: COLORS.warning },
    { name: 'Andamento', value: stats.osProgress, color: COLORS.blue },
    { name: 'Concluída', value: stats.osDone, color: COLORS.ok },
  ].filter(d => d.value > 0);

  const renderDonutChart = (
    chartData: { name: string; value: number; color: string }[],
    centerLabel: string,
    centerValue: string,
    title: string,
    onClick?: () => void
  ) => (
    <button onClick={onClick} className="glass-card rounded-xl p-5 hover:border-primary/40 transition-all text-left w-full">
      <h3 className="text-sm font-bold text-foreground mb-3">{title}</h3>
      <div className="flex items-center gap-4">
        <div className="relative w-[120px] h-[120px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData.length > 0 ? chartData : [{ name: '-', value: 1, color: COLORS.muted }]}
                cx="50%" cy="50%"
                innerRadius={35} outerRadius={55}
                dataKey="value" stroke="none"
              >
                {(chartData.length > 0 ? chartData : [{ name: '-', value: 1, color: COLORS.muted }]).map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-black font-mono text-foreground">{centerValue}</span>
            <span className="text-[9px] text-muted-foreground">{centerLabel}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 min-w-0">
          {chartData.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
              <span className="text-xs text-muted-foreground truncate">{d.name}</span>
              <span className="text-xs font-mono font-bold text-foreground ml-auto">{d.value}</span>
            </div>
          ))}
        </div>
      </div>
    </button>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-black text-gradient">Dashboard</h1>
          <p className="text-muted-foreground mt-1 capitalize text-sm">{todayStr}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
          <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground text-xs">Sair</Button>
        </div>
      </div>

      {/* Status banner */}
      {urgencyLevel === 'critical' && (
        <div className="rounded-xl p-4 bg-destructive/10 border border-destructive/30 flex items-center gap-3">
          <XCircle className="w-6 h-6 text-destructive shrink-0" />
          <div>
            <p className="font-bold text-destructive">Atenção Urgente!</p>
            <p className="text-sm text-muted-foreground">{stats.overdue.length} manutenção(ões) atrasada(s).</p>
          </div>
          <Button size="sm" variant="destructive" className="ml-auto" onClick={() => navigate('/manutencao')}>Ver agora</Button>
        </div>
      )}
      {urgencyLevel === 'warning' && (
        <div className="rounded-xl p-4 bg-warning/10 border border-warning/30 flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-warning shrink-0" />
          <p className="font-bold text-warning">Itens requerem atenção. Revise os alertas abaixo.</p>
        </div>
      )}
      {urgencyLevel === 'ok' && (
        <div className="rounded-xl p-4 bg-success/10 border border-success/30 flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-success shrink-0" />
          <p className="font-bold text-success">Tudo sob controle! Frota em dia.</p>
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Equipamentos', value: data.equipments.length, icon: Truck, color: 'text-primary', sub: `${stats.activeEquipments.length} ativos`, to: '/equipamentos' },
          { label: 'Checklists Hoje', value: stats.todayChecklists.length, icon: ClipboardCheck, color: 'text-success', sub: `Score: ${stats.checklistScore}%`, to: '/checklist' },
          { label: 'Pedidos Abertos', value: stats.openRequests.length, icon: Activity, color: 'text-warning', sub: `${stats.inProgressRequests.length} em andamento`, to: '/manutencao' },
          { label: 'Litros Hoje', value: `${stats.totalFuelToday}L`, icon: Fuel, color: 'text-warning', sub: 'abastecidos', to: '/abastecimento' },
          { label: 'OS Abertas', value: stats.osOpen + stats.osProgress, icon: Wrench, color: 'text-primary', sub: `${stats.osDone} concluídas`, to: '/manutencao' },
        ].map(card => (
          <button key={card.label} onClick={() => navigate(card.to)} className="glass-card rounded-xl p-4 text-left hover:border-primary/40 hover:scale-[1.02] transition-all">
            <div className="flex items-center gap-2 mb-2">
              <card.icon className={`w-4 h-4 ${card.color}`} />
              <span className="text-xs text-muted-foreground font-medium">{card.label}</span>
            </div>
            <p className={`text-2xl font-black font-mono ${card.color}`}>{card.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
          </button>
        ))}
      </div>

      {/* Donut Charts Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {renderDonutChart(checklistDonut, 'Score', `${stats.checklistScore}%`, 'Pontuação de Checklist', () => navigate('/checklist'))}
        {renderDonutChart(maintenanceDonut, 'Planos', `${data.plans.length}`, 'Status Manutenção Preventiva', () => navigate('/manutencao'))}
        {renderDonutChart(equipmentDonut, 'Total', `${data.equipments.length}`, 'Frota de Equipamentos', () => navigate('/equipamentos'))}
        {renderDonutChart(osDonut, 'Total', `${data.workOrders.length}`, 'Ordens de Serviço', () => navigate('/manutencao'))}
      </div>

      {/* Bar Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Fuel last 7 days */}
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Fuel className="w-4 h-4 text-warning" /> Consumo de Combustível (Última Semana)
            </h3>
            <button onClick={() => navigate('/abastecimento')} className="text-xs text-primary hover:underline">Ver mais →</button>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.fuelByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 20%)" />
                <XAxis dataKey="day" tick={{ fill: 'hsl(220, 10%, 55%)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(220, 10%, 55%)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(220, 18%, 14%)', border: '1px solid hsl(220, 14%, 22%)', borderRadius: '8px', color: 'hsl(40, 10%, 92%)' }}
                  formatter={(value: number) => [`${value}L`, 'Litros']}
                />
                <Bar dataKey="litros" fill={COLORS.warning} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top 5 equipment fuel consumption */}
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Top 5 — Maior Consumo (Litros)
            </h3>
            <button onClick={() => navigate('/relatorios')} className="text-xs text-primary hover:underline">Relatórios →</button>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.topFuelEquip} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 20%)" horizontal={false} />
                <XAxis type="number" tick={{ fill: 'hsl(220, 10%, 55%)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: 'hsl(220, 10%, 55%)', fontSize: 11 }} width={100} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(220, 18%, 14%)', border: '1px solid hsl(220, 14%, 22%)', borderRadius: '8px', color: 'hsl(40, 10%, 92%)' }}
                  formatter={(value: number) => [`${value}L`, 'Total']}
                />
                <Bar dataKey="litros" fill={COLORS.primary} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Maintenance trend 3 months */}
      <div className="glass-card rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Tendência de Manutenções (Últimos 3 Meses)
          </h3>
          <button onClick={() => navigate('/manutencao')} className="text-xs text-primary hover:underline">Manutenção →</button>
        </div>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.maintenanceTrend}>
              <defs>
                <linearGradient id="gradPedidos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.warning} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.warning} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradOS" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradConcluidas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.ok} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.ok} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 20%)" />
              <XAxis dataKey="label" tick={{ fill: 'hsl(220, 10%, 55%)', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: 'hsl(220, 10%, 55%)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(220, 18%, 14%)', border: '1px solid hsl(220, 14%, 22%)', borderRadius: '8px', color: 'hsl(40, 10%, 92%)' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="pedidos" name="Pedidos" stroke={COLORS.warning} fill="url(#gradPedidos)" strokeWidth={2} />
              <Area type="monotone" dataKey="os" name="OS Abertas" stroke={COLORS.blue} fill="url(#gradOS)" strokeWidth={2} />
              <Area type="monotone" dataKey="concluidas" name="Concluídas" stroke={COLORS.ok} fill="url(#gradConcluidas)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Combo fuel + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Combo fuel levels */}
        {data.combos.length > 0 && (
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Droplets className="w-4 h-4 text-primary" /> Saldo Comboios
              </h3>
              <button onClick={() => navigate('/reabastecimento')} className="text-xs text-primary hover:underline">Reabastecer →</button>
            </div>
            <div className="space-y-3">
              {data.combos.map((c: any) => {
                const pct = c.fuel_capacity ? ((c.current_fuel || 0) / c.fuel_capacity) * 100 : 0;
                const color = pct > 30 ? 'bg-success' : pct > 10 ? 'bg-warning' : 'bg-destructive';
                const textColor = pct > 30 ? 'text-success' : pct > 10 ? 'text-warning' : 'text-destructive';
                return (
                  <div key={c.id} className="rounded-lg bg-secondary/40 p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="font-semibold text-sm truncate">{c.name}</p>
                      <span className={`text-sm font-mono font-bold ${textColor}`}>{c.current_fuel || 0}L / {c.fuel_capacity}L</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent alerts */}
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" /> Alertas Recentes
            </h3>
            <button onClick={() => navigate('/manutencao')} className="text-xs text-primary hover:underline">Ver todos →</button>
          </div>
          {stats.overdue.length === 0 && stats.approaching.length === 0 && stats.openRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <CheckCircle2 className="w-8 h-8 mb-2 text-success" />
              <p className="text-sm">Nenhum alerta no momento</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[260px] overflow-y-auto">
              {stats.overdue.slice(0, 4).map((p: any) => {
                const eq = data.equipments.find((e: any) => e.id === p.equipment_id);
                return (
                  <button key={p.id} onClick={() => navigate('/manutencao')} className="flex items-center gap-3 p-3 rounded-lg w-full text-left bg-destructive/10 border border-destructive/20 hover:bg-destructive/20 transition-colors">
                    <XCircle className="w-4 h-4 text-destructive shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate text-destructive">{p.description}</p>
                      <p className="text-xs text-muted-foreground">{eq?.name} — Atrasada</p>
                    </div>
                    <span className="text-xs font-mono text-destructive shrink-0">{p.next_due_at}h</span>
                  </button>
                );
              })}
              {stats.approaching.slice(0, 3).map((p: any) => {
                const eq = data.equipments.find((e: any) => e.id === p.equipment_id);
                return (
                  <button key={p.id} onClick={() => navigate('/manutencao')} className="flex items-center gap-3 p-3 rounded-lg w-full text-left bg-warning/10 border border-warning/20 hover:bg-warning/20 transition-colors">
                    <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate text-warning">{p.description}</p>
                      <p className="text-xs text-muted-foreground">{eq?.name} — Próxima</p>
                    </div>
                    <span className="text-xs font-mono text-warning shrink-0">{p.next_due_at}h</span>
                  </button>
                );
              })}
              {stats.openRequests.slice(0, 3).map((r: any) => {
                const eq = data.equipments.find((e: any) => e.id === r.equipment_id);
                return (
                  <button key={r.id} onClick={() => navigate('/manutencao')} className="flex items-center gap-3 p-3 rounded-lg w-full text-left bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-colors">
                    <Activity className="w-4 h-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate text-primary">{r.description}</p>
                      <p className="text-xs text-muted-foreground">{eq?.name} — Pedido aberto</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
