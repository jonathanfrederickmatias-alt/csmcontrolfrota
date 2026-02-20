import { store } from "@/lib/store";
import { Truck, ClipboardCheck, Wrench, AlertTriangle, Fuel, Activity } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();

  const data = useMemo(() => {
    const equipments = store.getEquipments();
    const checklists = store.getChecklists();
    const plans = store.getMaintenancePlans();
    const fuelRecords = store.getFuelRecords();
    const requests = store.getMaintenanceRequests();

    const approaching = plans.filter(p => p.status === 'approaching');
    const overdue = plans.filter(p => p.status === 'overdue');
    const openRequests = requests.filter(r => r.status === 'open' || r.status === 'in_progress');
    const todayChecklists = checklists.filter(c => c.date === new Date().toISOString().split('T')[0]);
    const totalFuelToday = fuelRecords
      .filter(f => f.date === new Date().toISOString().split('T')[0])
      .reduce((sum, f) => sum + f.liters, 0);

    return { equipments, approaching, overdue, openRequests, todayChecklists, totalFuelToday, checklists };
  }, []);

  const stats = [
    { label: "Equipamentos", value: data.equipments.length, icon: Truck, color: "text-primary", to: "/equipamentos", hint: "Ver todos" },
    { label: "Checklists Hoje", value: data.todayChecklists.length, icon: ClipboardCheck, color: "text-success", to: "/checklist", hint: "Fazer checklist" },
    { label: "Manutenções Próximas", value: data.approaching.length, icon: Wrench, color: "text-warning", to: "/manutencao", hint: data.approaching.length > 0 ? "Atenção necessária!" : "Ver planos" },
    { label: "Manutenções Atrasadas", value: data.overdue.length, icon: AlertTriangle, color: "text-destructive", to: "/manutencao", hint: data.overdue.length > 0 ? "Ação urgente!" : "Ver planos" },
    { label: "Pedidos Abertos", value: data.openRequests.length, icon: Activity, color: "text-primary", to: "/manutencao", hint: data.openRequests.length > 0 ? "Ver pedidos" : "Sem pedidos" },
    { label: "Litros Hoje", value: `${data.totalFuelToday}L`, icon: Fuel, color: "text-warning", to: "/abastecimento", hint: "Ver abastecimentos" },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-gradient">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Visão geral da frota e manutenção</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {stats.map(stat => (
          <button
            key={stat.label}
            onClick={() => navigate(stat.to)}
            className="glass-card rounded-xl p-5 hover:border-primary/40 hover:scale-[1.02] transition-all text-left group cursor-pointer w-full"
          >
            <div className="flex items-center justify-between mb-3">
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
              <span className={`text-3xl font-black font-mono ${stat.color}`}>{stat.value}</span>
            </div>
            <p className="text-sm text-muted-foreground font-medium">{stat.label}</p>
            <p className={`text-xs mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${stat.color}`}>
              {stat.hint} →
            </p>
          </button>
        ))}
      </div>

      {/* Alerts section */}
      {(data.overdue.length > 0 || data.approaching.length > 0) && (
        <div className="glass-card rounded-xl p-6 mb-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            Alertas de Manutenção
          </h2>
          <div className="space-y-3">
            {data.overdue.map(p => {
              const eq = data.equipments.find(e => e.id === p.equipmentId);
              return (
                <button
                  key={p.id}
                  onClick={() => navigate('/manutencao')}
                  className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 w-full text-left hover:bg-destructive/20 transition-colors"
                >
                  <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-destructive">{p.description}</p>
                    <p className="text-xs text-muted-foreground">{eq?.name || 'Equipamento'} — Atrasada!</p>
                  </div>
                  <span className="text-xs font-mono text-destructive">{p.nextDueAt}h</span>
                </button>
              );
            })}
            {data.approaching.map(p => {
              const eq = data.equipments.find(e => e.id === p.equipmentId);
              return (
                <button
                  key={p.id}
                  onClick={() => navigate('/manutencao')}
                  className="flex items-center gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20 w-full text-left hover:bg-warning/20 transition-colors"
                >
                  <Wrench className="w-4 h-4 text-warning shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-warning">{p.description}</p>
                    <p className="text-xs text-muted-foreground">{eq?.name || 'Equipamento'} — Próxima</p>
                  </div>
                  <span className="text-xs font-mono text-warning">{p.nextDueAt}h</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent checklists */}
      <div className="glass-card rounded-xl p-6">
        <h2 className="text-lg font-bold mb-4">Últimos Checklists</h2>
        {data.checklists.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum checklist registrado ainda.</p>
        ) : (
          <div className="space-y-2">
            {data.checklists.slice(-5).reverse().map(cl => {
              const eq = data.equipments.find(e => e.id === cl.equipmentId);
              return (
                <div key={cl.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                  <div>
                    <p className="text-sm font-medium">{eq?.name || 'Equipamento'}</p>
                    <p className="text-xs text-muted-foreground">{cl.operatorName} — {cl.date}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-mono text-primary">{cl.hourMeter}h</span>
                    <span className={`ml-3 text-xs px-2 py-0.5 rounded-full ${
                      cl.status === 'ok' ? 'bg-success/20 text-success' :
                      cl.status === 'attention' ? 'bg-warning/20 text-warning' :
                      'bg-destructive/20 text-destructive'
                    }`}>{cl.status.toUpperCase()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
