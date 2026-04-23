import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Truck, ClipboardCheck, ClipboardList, Wrench, Fuel, QrCode, Menu, X, BarChart2, Droplets, Building2, Users, LogOut, ShieldCheck, BrainCircuit, FileStack } from "lucide-react";
import { useState } from "react";
import csmLogo from "@/assets/csm-logo.png";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const allNavItems = [
  { to: "/", match: ["/"], label: "Dashboard", icon: LayoutDashboard, roles: ['admin', 'gestor', 'abastecedor'] },
  { to: "/equipamentos", match: ["/equipamentos"], label: "Equipamentos", icon: Truck, roles: ['admin', 'gestor'] },
  { to: "/manutencao?tab=os", match: ["/manutencao?tab=os"], label: "OS", icon: FileStack, roles: ['admin', 'gestor', 'abastecedor'] },
  { to: "/checklist", match: ["/checklist"], label: "Checklist", icon: ClipboardCheck, roles: ['admin', 'gestor'] },
  { to: "/checklists", match: ["/checklists"], label: "Checklists Realizados", icon: ClipboardList, roles: ['admin', 'gestor', 'abastecedor'] },
  { to: "/manutencao", match: ["/manutencao", "/manutencao?tab=plans", "/manutencao?tab=requests", "/manutencao?tab=history"], label: "Manutenção", icon: Wrench, roles: ['admin', 'gestor', 'abastecedor'] },
  { to: "/mecanico", match: ["/mecanico"], label: "Painel Mecânico", icon: Wrench, roles: ['mecanico'] },
  { to: "/abastecimento", match: ["/abastecimento", "/reabastecimento"], label: "Consumo", icon: Fuel, roles: ['admin', 'gestor', 'abastecedor'] },
  { to: "/reabastecimento", match: ["/reabastecimento"], label: "Reabastecimento", icon: Droplets, roles: ['admin', 'gestor'] },
  { to: "/?focus=ai", match: ["/?focus=ai"], label: "IA", icon: BrainCircuit, roles: ['admin', 'gestor', 'abastecedor'] },
  { to: "/seguros", match: ["/seguros"], label: "Seguros", icon: ShieldCheck, roles: ['admin', 'gestor'] },
  { to: "/relatorios", match: ["/relatorios"], label: "Relatórios", icon: BarChart2, roles: ['admin', 'gestor'] },
  { to: "/executivo", label: "Dashboard Executivo", icon: BarChart2, roles: ['admin', 'gestor'] },
  { to: "/obras", label: "Obras", icon: Building2, roles: ['admin', 'gestor', 'abastecedor'] },
  { to: "/qrcode", label: "QR Code", icon: QrCode, roles: ['admin', 'gestor'] },
  { to: "/usuarios", label: "Usuários", icon: Users, roles: ['admin', 'gestor'] },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { roles, loading: rolesLoading } = useUserRoles();
  const { signOut } = useAuth();
  const currentLocation = `${location.pathname}${location.search}`;

  // Filter nav items based on user roles; if no roles yet, show nothing (loading)
  const navItems = rolesLoading
    ? []
    : allNavItems.filter(item => item.roles.some(r => roles.includes(r as any)));

  return (
    <div className="min-h-screen bg-background/80 lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex lg:h-screen lg:sticky lg:top-0 lg:flex-col border-r border-sidebar-border bg-sidebar/80 backdrop-blur-xl">
        <Link to="/" className="flex items-center gap-3 border-b border-sidebar-border bg-background/95 p-5 transition-colors hover:bg-background">
          <img src={csmLogo} alt="CSM Construções" className="w-16 h-12 object-contain" />
          <div>
            <h1 className="text-base font-black tracking-tight leading-tight">
              <span className="text-gradient">CSM</span>
              <span className="text-logo-blue">CONTROLFROTA</span>
            </h1>
            <p className="text-[10px] text-muted-foreground">Gestão de Frota & Manutenção</p>
          </div>
        </Link>
        <div className="border-b border-sidebar-border px-5 py-4">
          <div className="rounded-lg border border-border/70 bg-card/90 p-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Central operacional</p>
            <p className="mt-2 text-sm font-semibold text-foreground">ERP de frota, manutenção pesada e tomada de decisão rápida.</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {navItems.map(item => {
            const active = (item.match || [item.to]).includes(currentLocation) || (item.match || [item.to]).includes(location.pathname);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all ${
                  active
                    ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-sidebar-border">
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={signOut}>
            <LogOut className="w-4 h-4 mr-2" /> Sair
          </Button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-background border-b border-border px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-lg font-black">
          <img src={csmLogo} alt="CSM" className="w-12 h-10 object-contain" />
          <span>
            <span className="text-gradient">CSM</span>
            <span className="text-logo-blue">CONTROLFROTA</span>
          </span>
        </Link>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="text-sidebar-foreground p-2">
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile nav overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-30 bg-background/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)}>
          <div className="bg-sidebar w-64 h-full p-4 pt-20 space-y-1 overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex-1 space-y-1">
              {navItems.map(item => {
                const active = (item.match || [item.to]).includes(currentLocation) || (item.match || [item.to]).includes(location.pathname);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-sidebar-foreground hover:bg-sidebar-accent"
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
            <div className="pt-4 border-t border-sidebar-border">
              <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={signOut}>
                <LogOut className="w-4 h-4 mr-2" /> Sair
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 pt-16 lg:pt-0">
        <div className="mx-auto max-w-[1600px] p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
