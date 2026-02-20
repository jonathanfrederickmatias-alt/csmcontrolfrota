import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Truck, ClipboardCheck, Wrench, AlertTriangle, Fuel, Activity,
  RefreshCw, QrCode, TrendingUp, Clock, CheckCircle2, XCircle, ChevronRight, Droplets, BarChart2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [data, setData] = useState({
    equipments: [] as any[],
    checklists: [] as any[],
    plans: [] as any[],
    fuelRecords: [] as any[],
    requests: [] as any[],
    combos: [] as any[],
  });

  const fetchData = useCallback(async () => {
    setIsRefreshing(true);
    const today = new Date().toISOString().split('T')[0];

    const [eqRes, clRes, plRes, frRes, reqRes] = await Promise.all([
      supabase.from('equipments').select('*'),
      supabase.from('checklists').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('maintenance_plans').select('*'),
      supabase.from('fuel_records').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('maintenance_requests').select('*').order('created_at', { ascending: false }).limit(50),
    ]);

    const equipments = eqRes.data || [];
    setData({
      equipments,
      checklists: clRes.data || [],
      plans: plRes.data || [],
      fuelRecords: frRes.data || [],
      requests: reqRes.data || [],
      combos: equipments.filter((e: any) => e.type === 'combo'),
    });
    setIsRefreshing(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const today = new Date().toISOString().split('T')[0];
  const overdue = data.plans.filter((p: any) => p.status === 'overdue');
  const approaching = data.plans.filter((p: any) => p.status === 'approaching');
  const openRequests = data.requests.filter((r: any) => r.status === 'open');
  const inProgressRequests = data.requests.filter((r: any) => r.status === 'in_progress');
  const todayChecklists = data.checklists.filter((c: any) => c.date === today);
  const criticalChecklists = data.checklists.filter((c: any) => c.status === 'critical');
  const totalFuelToday = data.fuelRecords.filter((f: any) => f.date === today).reduce((s: number, f: any) => s + Number(f.liters), 0);
  const activeEquipments = data.equipments.filter((e: any) => e.status === 'active');

  const urgencyLevel = overdue.length > 0 ? 'critical' : approaching.length > 0 || openRequests.length > 0 ? 'warning' : 'ok';
  const todayStr = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-black text-gradient">Dashboard</h1>
          <p className="text-muted-foreground mt-1 capitalize">{todayStr}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
          <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground text-xs">
            Sair
          </Button>
        </div>
      </div>

      {/* Status banner */}
      {urgencyLevel === 'critical' && (
        <div className="rounded-xl p-4 bg-destructive/10 border border-destructive/30 flex items-center gap-3">
          <XCircle className="w-6 h-6 text-destructive shrink-0" />
          <div>
            <p className="font-bold text-destructive">Atenção Urgente!</p>
            <p className="text-sm text-muted-foreground">{overdue.length} manutenção(ões) atrasada(s).</p>
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

      {/* Cards linha 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Equipamentos', value: data.equipments.length, sub: `${activeEquipments.length} ativos`, icon: Truck, color: 'text-primary', to: '/equipamentos' },
          { label: 'Checklists Hoje', value: todayChecklists.length, sub: criticalChecklists.length > 0 ? `${criticalChecklists.length} críticos` : 'tudo ok', icon: ClipboardCheck, color: 'text-success', to: '/checklist' },
          { label: 'Manutenções Próximas', value: approaching.length, sub: approaching.length > 0 ? '⚠ Agendar' : 'ok', icon: Wrench, color: 'text-warning', to: '/manutencao' },
          { label: 'Atrasadas', value: overdue.length, sub: overdue.length > 0 ? '🚨 Urgente!' : 'nenhuma', icon: AlertTriangle, color: overdue.length > 0 ? 'text-destructive' : 'text-muted-foreground', to: '/manutencao' },
        ].map(card => (
          <button key={card.label} onClick={() => navigate(card.to)} className="glass-card rounded-xl p-4 text-left hover:border-primary/40 hover:scale-[1.02] transition-all group">
            <div className="flex items-center justify-between mb-2">
              <card.icon className={`w-5 h-5 ${card.color}`} />
              <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className={`text-3xl font-black font-mono ${card.color}`}>{card.value}</p>
            <p className="text-xs text-muted-foreground font-medium mt-1">{card.label}</p>
            <p className="text-xs mt-1 text-muted-foreground">{card.sub}</p>
          </button>
        ))}
      </div>

      {/* Cards linha 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Pedidos Abertos', value: openRequests.length, sub: inProgressRequests.length > 0 ? `${inProgressRequests.length} em andamento` : '', icon: Activity, color: 'text-primary', to: '/manutencao' },
          { label: 'Litros Hoje', value: `${totalFuelToday}L`, sub: 'abastecidos', icon: Fuel, color: 'text-warning', to: '/abastecimento' },
          { label: 'Total Combustível', value: `${data.fuelRecords.reduce((s: number, r: any) => s + Number(r.liters), 0)}L`, sub: 'histórico', icon: TrendingUp, color: 'text-primary', to: '/abastecimento' },
          { label: 'Relatórios', value: '→', sub: 'Análises e gráficos', icon: BarChart2, color: 'text-primary', to: '/relatorios' },
        ].map(card => (
          <button key={card.label} onClick={() => navigate(card.to)} className="glass-card rounded-xl p-4 text-left hover:border-primary/40 hover:scale-[1.02] transition-all group">
            <div className="flex items-center justify-between mb-2">
              <card.icon className={`w-5 h-5 ${card.color}`} />
              <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className={`text-3xl font-black font-mono ${card.color}`}>{card.value}</p>
            <p className="text-xs text-muted-foreground font-medium mt-1">{card.label}</p>
            <p className="text-xs mt-1 text-muted-foreground">{card.sub}</p>
          </button>
        ))}
      </div>

      {/* Saldo comboios */}
      {data.combos.length > 0 && (
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Droplets className="w-5 h-5 text-primary" /> Saldo de Combustível — Comboios
            </h2>
            <button onClick={() => navigate('/reabastecimento')} className="text-xs text-primary hover:underline">Reabastecer →</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.combos.map((c: any) => {
              const pct = c.fuel_capacity ? ((c.current_fuel || 0) / c.fuel_capacity) * 100 : 0;
              const color = pct > 30 ? 'bg-success' : pct > 10 ? 'bg-warning' : 'bg-destructive';
              const textColor = pct > 30 ? 'text-success' : pct > 10 ? 'text-warning' : 'text-destructive';
              return (
                <div key={c.id} className="rounded-lg bg-secondary/40 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-sm truncate">{c.name}</p>
                    <span className={`text-sm font-mono font-bold ${textColor}`}>{c.current_fuel || 0}L</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2 mb-1">
                    <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground text-right">{pct.toFixed(0)}% de {c.fuel_capacity}L</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Alertas + Pedidos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {(overdue.length > 0 || approaching.length > 0) && (
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-warning" /> Alertas de Manutenção
              </h2>
              <button onClick={() => navigate('/manutencao')} className="text-xs text-primary hover:underline">Ver todos →</button>
            </div>
            <div className="space-y-2">
              {[...overdue.slice(0, 4).map((p: any) => ({ ...p, _type: 'overdue' })), ...approaching.slice(0, 3).map((p: any) => ({ ...p, _type: 'approaching' }))].map((p: any) => {
                const eq = data.equipments.find((e: any) => e.id === p.equipment_id);
                return (
                  <button key={p.id} onClick={() => navigate('/manutencao')} className={`flex items-center gap-3 p-3 rounded-lg w-full text-left transition-colors ${p._type === 'overdue' ? 'bg-destructive/10 border border-destructive/20 hover:bg-destructive/20' : 'bg-warning/10 border border-warning/20 hover:bg-warning/20'}`}>
                    <AlertTriangle className={`w-4 h-4 shrink-0 ${p._type === 'overdue' ? 'text-destructive' : 'text-warning'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${p._type === 'overdue' ? 'text-destructive' : 'text-warning'}`}>{p.description}</p>
                      <p className="text-xs text-muted-foreground">{eq?.name}</p>
                    </div>
                    <span className={`text-xs font-mono shrink-0 ${p._type === 'overdue' ? 'text-destructive' : 'text-warning'}`}>{p.next_due_at}h</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" /> Pedidos de Manutenção
            </h2>
            <button onClick={() => navigate('/manutencao')} className="text-xs text-primary hover:underline">Gerenciar →</button>
          </div>
          {openRequests.length === 0 && inProgressRequests.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum pedido aberto.</p>
          ) : (
            <div className="space-y-2">
              {[...openRequests, ...inProgressRequests].slice(0, 5).map((r: any) => {
                const eq = data.equipments.find((e: any) => e.id === r.equipment_id);
                const priorityColor = r.priority === 'urgent' ? 'text-destructive bg-destructive/10' : r.priority === 'high' ? 'text-warning bg-warning/10' : 'text-primary bg-primary/10';
                return (
                  <button key={r.id} onClick={() => navigate('/manutencao')} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 w-full text-left hover:bg-secondary/80 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.description}</p>
                      <p className="text-xs text-muted-foreground">{eq?.name} — {r.operator_name}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${priorityColor}`}>
                      {r.priority === 'urgent' ? 'Urgente' : r.priority === 'high' ? 'Alta' : r.priority === 'medium' ? 'Média' : 'Baixa'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Últimos checklists */}
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-success" /> Últimos Checklists
            </h2>
            <button onClick={() => navigate('/checklist')} className="text-xs text-primary hover:underline">Ver todos →</button>
          </div>
          {data.checklists.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum checklist registrado.</p>
          ) : (
            <div className="space-y-2">
              {data.checklists.slice(0, 5).map((cl: any) => {
                const eq = data.equipments.find((e: any) => e.id === cl.equipment_id);
                return (
                  <div key={cl.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{eq?.name || 'Equipamento'}</p>
                      <p className="text-xs text-muted-foreground">{cl.operator_name} — {cl.date}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-mono text-primary">{cl.hour_meter}h</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${cl.status === 'ok' ? 'bg-success/20 text-success' : cl.status === 'attention' ? 'bg-warning/20 text-warning' : 'bg-destructive/20 text-destructive'}`}>
                        {cl.status === 'ok' ? 'OK' : cl.status === 'attention' ? 'ATENÇÃO' : 'CRÍTICO'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Últimos abastecimentos */}
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Fuel className="w-5 h-5 text-warning" /> Últimos Abastecimentos
            </h2>
            <button onClick={() => navigate('/abastecimento')} className="text-xs text-primary hover:underline">Ver todos →</button>
          </div>
          {data.fuelRecords.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum abastecimento registrado.</p>
          ) : (
            <div className="space-y-2">
              {data.fuelRecords.slice(0, 5).map((r: any) => {
                const combo = data.equipments.find((e: any) => e.id === r.combo_equipment_id);
                const target = data.equipments.find((e: any) => e.id === r.target_equipment_id);
                return (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{combo?.name} → {target?.name}</p>
                      <p className="text-xs text-muted-foreground">{r.operator_name} — {r.date}</p>
                    </div>
                    <span className="text-lg font-mono font-bold text-warning shrink-0">{r.liters}L</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Ações rápidas */}
      <div className="glass-card rounded-xl p-5">
        <h2 className="text-base font-bold mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" /> Ações Rápidas
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: "Equipamentos", icon: Truck, to: "/equipamentos", color: "text-primary" },
            { label: "Checklist", icon: ClipboardCheck, to: "/checklist", color: "text-success" },
            { label: "Manutenção", icon: Wrench, to: "/manutencao", color: "text-warning" },
            { label: "Abastecer", icon: Fuel, to: "/abastecimento", color: "text-warning" },
            { label: "Reabastecimento", icon: Droplets, to: "/reabastecimento", color: "text-primary" },
            { label: "Relatórios", icon: BarChart2, to: "/relatorios", color: "text-primary" },
            { label: "QR Codes", icon: QrCode, to: "/qrcode", color: "text-primary" },
          ].map(action => (
            <button key={action.label} onClick={() => navigate(action.to)} className="flex flex-col items-center gap-2 p-3 rounded-lg bg-secondary/50 hover:bg-secondary/80 hover:scale-[1.03] transition-all text-center group">
              <div className="p-2 rounded-lg bg-secondary group-hover:bg-primary/10 transition-colors">
                <action.icon className={`w-5 h-5 ${action.color}`} />
              </div>
              <span className="text-xs font-medium leading-tight">{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
