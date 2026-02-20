import { store } from "@/lib/store";
import {
  Truck, ClipboardCheck, Wrench, AlertTriangle, Fuel, Activity,
  RefreshCw, QrCode, Plus, TrendingUp, Clock, CheckCircle2, XCircle, ChevronRight, Droplets
} from "lucide-react";
import { useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => {
      setRefreshKey(k => k + 1);
      setIsRefreshing(false);
    }, 500);
  }, []);

  const data = useMemo(() => {
    const equipments = store.getEquipments();
    const checklists = store.getChecklists();
    const plans = store.getMaintenancePlans();
    const fuelRecords = store.getFuelRecords();
    const requests = store.getMaintenanceRequests();

    const today = new Date().toISOString().split('T')[0];
    const approaching = plans.filter(p => p.status === 'approaching');
    const overdue = plans.filter(p => p.status === 'overdue');
    const openRequests = requests.filter(r => r.status === 'open');
    const inProgressRequests = requests.filter(r => r.status === 'in_progress');
    const todayChecklists = checklists.filter(c => c.date === today);
    const criticalChecklists = checklists.filter(c => c.status === 'critical');
    const totalFuelToday = fuelRecords
      .filter(f => f.date === today)
      .reduce((sum, f) => sum + f.liters, 0);
    const combos = equipments.filter(e => e.type === 'combo');
    const activeEquipments = equipments.filter(e => e.status === 'active');
    const maintenanceEquipments = equipments.filter(e => e.status === 'maintenance');

    return {
      equipments, checklists, plans, fuelRecords, requests,
      approaching, overdue, openRequests, inProgressRequests,
      todayChecklists, criticalChecklists, totalFuelToday, combos,
      activeEquipments, maintenanceEquipments
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

  const urgencyLevel = data.overdue.length > 0 ? 'critical'
    : data.approaching.length > 0 || data.openRequests.length > 0 ? 'warning'
    : 'ok';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gradient">Dashboard</h1>
          <p className="text-muted-foreground mt-1 capitalize">{today}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          className="shrink-0 gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Status geral */}
      {urgencyLevel === 'critical' && (
        <div className="rounded-xl p-4 bg-destructive/10 border border-destructive/30 flex items-center gap-3">
          <XCircle className="w-6 h-6 text-destructive shrink-0" />
          <div>
            <p className="font-bold text-destructive">Atenção Urgente Necessária!</p>
            <p className="text-sm text-muted-foreground">{data.overdue.length} manutenção(ões) atrasada(s). Clique nos alertas abaixo para agir.</p>
          </div>
        </div>
      )}
      {urgencyLevel === 'warning' && (
        <div className="rounded-xl p-4 bg-warning/10 border border-warning/30 flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-warning shrink-0" />
          <div>
            <p className="font-bold text-warning">Atenção Requerida</p>
            <p className="text-sm text-muted-foreground">Existem itens que precisam de ação. Revise os alertas abaixo.</p>
          </div>
        </div>
      )}
      {urgencyLevel === 'ok' && (
        <div className="rounded-xl p-4 bg-success/10 border border-success/30 flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-success shrink-0" />
          <p className="font-bold text-success">Tudo sob controle! Frota em dia.</p>
        </div>
      )}

      {/* Cards principais — linha 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Equipamentos */}
        <button
          onClick={() => navigate('/equipamentos')}
          className="glass-card rounded-xl p-4 text-left hover:border-primary/40 hover:scale-[1.02] transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <Truck className="w-5 h-5 text-primary" />
            <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <p className="text-3xl font-black font-mono text-primary">{data.equipments.length}</p>
          <p className="text-xs text-muted-foreground font-medium mt-1">Equipamentos</p>
          <div className="mt-2 flex gap-2 flex-wrap">
            <span className="text-xs px-1.5 py-0.5 rounded bg-success/15 text-success">{data.activeEquipments.length} ativos</span>
            {data.maintenanceEquipments.length > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-warning/15 text-warning">{data.maintenanceEquipments.length} em manutenção</span>
            )}
          </div>
        </button>

        {/* Checklists hoje */}
        <button
          onClick={() => navigate('/checklist')}
          className="glass-card rounded-xl p-4 text-left hover:border-success/40 hover:scale-[1.02] transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <ClipboardCheck className="w-5 h-5 text-success" />
            <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <p className="text-3xl font-black font-mono text-success">{data.todayChecklists.length}</p>
          <p className="text-xs text-muted-foreground font-medium mt-1">Checklists Hoje</p>
          {data.criticalChecklists.length > 0 && (
            <span className="mt-2 inline-block text-xs px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">{data.criticalChecklists.length} críticos</span>
          )}
        </button>

        {/* Manutenções próximas */}
        <button
          onClick={() => navigate('/manutencao')}
          className={`glass-card rounded-xl p-4 text-left hover:scale-[1.02] transition-all group ${data.approaching.length > 0 ? 'hover:border-warning/40' : ''}`}
        >
          <div className="flex items-center justify-between mb-2">
            <Wrench className="w-5 h-5 text-warning" />
            <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <p className="text-3xl font-black font-mono text-warning">{data.approaching.length}</p>
          <p className="text-xs text-muted-foreground font-medium mt-1">Manutenções Próximas</p>
          {data.approaching.length > 0 && (
            <p className="mt-2 text-xs text-warning font-semibold">⚠ Agendar agora</p>
          )}
        </button>

        {/* Manutenções atrasadas */}
        <button
          onClick={() => navigate('/manutencao')}
          className={`glass-card rounded-xl p-4 text-left hover:scale-[1.02] transition-all group ${data.overdue.length > 0 ? 'border-destructive/30 hover:border-destructive/50' : ''}`}
        >
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className={`w-5 h-5 ${data.overdue.length > 0 ? 'text-destructive animate-pulse' : 'text-muted-foreground'}`} />
            <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <p className={`text-3xl font-black font-mono ${data.overdue.length > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{data.overdue.length}</p>
          <p className="text-xs text-muted-foreground font-medium mt-1">Manutenções Atrasadas</p>
          {data.overdue.length > 0 && (
            <p className="mt-2 text-xs text-destructive font-bold">🚨 Ação urgente!</p>
          )}
        </button>
      </div>

      {/* Cards linha 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Pedidos abertos */}
        <button
          onClick={() => navigate('/manutencao')}
          className="glass-card rounded-xl p-4 text-left hover:border-primary/40 hover:scale-[1.02] transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <Activity className="w-5 h-5 text-primary" />
            <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <p className="text-3xl font-black font-mono text-primary">{data.openRequests.length}</p>
          <p className="text-xs text-muted-foreground font-medium mt-1">Pedidos Abertos</p>
          {data.inProgressRequests.length > 0 && (
            <span className="mt-2 inline-block text-xs px-1.5 py-0.5 rounded bg-primary/15 text-primary">{data.inProgressRequests.length} em andamento</span>
          )}
        </button>

        {/* Combustível hoje */}
        <button
          onClick={() => navigate('/abastecimento')}
          className="glass-card rounded-xl p-4 text-left hover:border-warning/40 hover:scale-[1.02] transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <Fuel className="w-5 h-5 text-warning" />
            <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <p className="text-3xl font-black font-mono text-warning">{data.totalFuelToday}<span className="text-base">L</span></p>
          <p className="text-xs text-muted-foreground font-medium mt-1">Litros Abastecidos Hoje</p>
        </button>

        {/* Total histórico */}
        <button
          onClick={() => navigate('/abastecimento')}
          className="glass-card rounded-xl p-4 text-left hover:border-primary/40 hover:scale-[1.02] transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <p className="text-3xl font-black font-mono text-primary">{data.fuelRecords.reduce((s, r) => s + r.liters, 0)}<span className="text-base">L</span></p>
          <p className="text-xs text-muted-foreground font-medium mt-1">Total Combustível</p>
        </button>

        {/* QR Codes */}
        <button
          onClick={() => navigate('/qrcode')}
          className="glass-card rounded-xl p-4 text-left hover:border-primary/40 hover:scale-[1.02] transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <QrCode className="w-5 h-5 text-primary" />
            <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <p className="text-3xl font-black font-mono text-primary">{data.equipments.length}</p>
          <p className="text-xs text-muted-foreground font-medium mt-1">QR Codes Disponíveis</p>
          <p className="mt-2 text-xs text-primary">Ver / Imprimir →</p>
        </button>
      </div>

      {/* Saldo dos comboios */}
      {data.combos.length > 0 && (
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Droplets className="w-5 h-5 text-primary" />
              Saldo de Combustível — Comboios
            </h2>
            <button onClick={() => navigate('/abastecimento')} className="text-xs text-primary hover:underline">Ver abastecimento →</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.combos.map(c => {
              const pct = c.fuelCapacity ? ((c.currentFuel || 0) / c.fuelCapacity) * 100 : 0;
              const color = pct > 30 ? 'bg-success' : pct > 10 ? 'bg-warning' : 'bg-destructive';
              const textColor = pct > 30 ? 'text-success' : pct > 10 ? 'text-warning' : 'text-destructive';
              return (
                <div key={c.id} className="rounded-lg bg-secondary/40 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-sm truncate">{c.name}</p>
                    <span className={`text-sm font-mono font-bold ${textColor}`}>{c.currentFuel || 0}L</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2 mb-1">
                    <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground text-right">{pct.toFixed(0)}% de {c.fuelCapacity}L</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alertas */}
        {(data.overdue.length > 0 || data.approaching.length > 0) && (
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-warning" />
                Alertas de Manutenção
              </h2>
              <button onClick={() => navigate('/manutencao')} className="text-xs text-primary hover:underline">Ver todos →</button>
            </div>
            <div className="space-y-2">
              {data.overdue.slice(0, 4).map(p => {
                const eq = data.equipments.find(e => e.id === p.equipmentId);
                return (
                  <button
                    key={p.id}
                    onClick={() => navigate('/manutencao')}
                    className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 w-full text-left hover:bg-destructive/20 transition-colors"
                  >
                    <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-destructive truncate">{p.description}</p>
                      <p className="text-xs text-muted-foreground">{eq?.name || 'Equipamento'} — Atrasada!</p>
                    </div>
                    <span className="text-xs font-mono text-destructive shrink-0">{p.nextDueAt}h</span>
                  </button>
                );
              })}
              {data.approaching.slice(0, 3).map(p => {
                const eq = data.equipments.find(e => e.id === p.equipmentId);
                return (
                  <button
                    key={p.id}
                    onClick={() => navigate('/manutencao')}
                    className="flex items-center gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20 w-full text-left hover:bg-warning/20 transition-colors"
                  >
                    <Wrench className="w-4 h-4 text-warning shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-warning truncate">{p.description}</p>
                      <p className="text-xs text-muted-foreground">{eq?.name || 'Equipamento'} — Próxima</p>
                    </div>
                    <span className="text-xs font-mono text-warning shrink-0">{p.nextDueAt}h</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Pedidos de manutenção abertos */}
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Pedidos de Manutenção
            </h2>
            <button onClick={() => navigate('/manutencao')} className="text-xs text-primary hover:underline">Gerenciar →</button>
          </div>
          {data.openRequests.length === 0 && data.inProgressRequests.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum pedido aberto.</p>
          ) : (
            <div className="space-y-2">
              {[...data.openRequests, ...data.inProgressRequests].slice(0, 5).map(r => {
                const eq = data.equipments.find(e => e.id === r.equipmentId);
                const priorityColor = r.priority === 'urgent' ? 'text-destructive bg-destructive/10' : r.priority === 'high' ? 'text-warning bg-warning/10' : 'text-primary bg-primary/10';
                const statusColor = r.status === 'in_progress' ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground';
                return (
                  <button
                    key={r.id}
                    onClick={() => navigate('/manutencao')}
                    className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 w-full text-left hover:bg-secondary/80 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.description}</p>
                      <p className="text-xs text-muted-foreground">{eq?.name || 'Equipamento'} — {r.operatorName}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${priorityColor}`}>{r.priority === 'urgent' ? 'Urgente' : r.priority === 'high' ? 'Alta' : r.priority === 'medium' ? 'Média' : 'Baixa'}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor}`}>{r.status === 'in_progress' ? 'Em andamento' : 'Aberto'}</span>
                    </div>
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
              <ClipboardCheck className="w-5 h-5 text-success" />
              Últimos Checklists
            </h2>
            <button onClick={() => navigate('/checklist')} className="text-xs text-primary hover:underline">Ver todos →</button>
          </div>
          {data.checklists.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum checklist registrado ainda.</p>
          ) : (
            <div className="space-y-2">
              {data.checklists.slice(-5).reverse().map(cl => {
                const eq = data.equipments.find(e => e.id === cl.equipmentId);
                return (
                  <div key={cl.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{eq?.name || 'Equipamento'}</p>
                      <p className="text-xs text-muted-foreground">{cl.operatorName} — {cl.date}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-mono text-primary">{cl.hourMeter}h</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        cl.status === 'ok' ? 'bg-success/20 text-success' :
                        cl.status === 'attention' ? 'bg-warning/20 text-warning' :
                        'bg-destructive/20 text-destructive'
                      }`}>{cl.status === 'ok' ? 'OK' : cl.status === 'attention' ? 'ATENÇÃO' : 'CRÍTICO'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Histórico recente de abastecimentos */}
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Fuel className="w-5 h-5 text-warning" />
              Últimos Abastecimentos
            </h2>
            <button onClick={() => navigate('/abastecimento')} className="text-xs text-primary hover:underline">Ver todos →</button>
          </div>
          {data.fuelRecords.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum abastecimento registrado.</p>
          ) : (
            <div className="space-y-2">
              {data.fuelRecords.slice(-5).reverse().map(r => {
                const combo = data.equipments.find(e => e.id === r.comboEquipmentId);
                const target = data.equipments.find(e => e.id === r.targetEquipmentId);
                return (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{combo?.name} → {target?.name}</p>
                      <p className="text-xs text-muted-foreground">{r.operatorName} — {r.date}</p>
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
          <Clock className="w-5 h-5 text-primary" />
          Ações Rápidas
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Novo Equipamento", icon: Truck, to: "/equipamentos", color: "text-primary" },
            { label: "Fazer Checklist", icon: ClipboardCheck, to: "/checklist", color: "text-success" },
            { label: "Plano Manutenção", icon: Wrench, to: "/manutencao", color: "text-warning" },
            { label: "Pedido Manutenção", icon: Activity, to: "/pedido-manutencao", color: "text-primary" },
            { label: "Abastecer", icon: Fuel, to: "/abastecimento", color: "text-warning" },
            { label: "QR Codes", icon: QrCode, to: "/qrcode", color: "text-primary" },
          ].map(action => (
            <button
              key={action.label}
              onClick={() => navigate(action.to)}
              className="flex flex-col items-center gap-2 p-4 rounded-lg bg-secondary/50 hover:bg-secondary/80 hover:scale-[1.03] transition-all text-center group"
            >
              <div className={`p-2 rounded-lg bg-secondary group-hover:bg-primary/10 transition-colors`}>
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
