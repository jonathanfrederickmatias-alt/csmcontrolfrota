import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Truck, ClipboardCheck, Wrench, Fuel, QrCode, Menu, X, BarChart2, Droplets, Building2, Users, LogOut } from "lucide-react";
import { useState } from "react";
import csmLogo from "@/assets/csm-logo.png";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const allNavItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ['admin', 'gestor'] },
  { to: "/equipamentos", label: "Equipamentos", icon: Truck, roles: ['admin', 'gestor'] },
  { to: "/checklist", label: "Checklist", icon: ClipboardCheck, roles: ['admin', 'gestor'] },
  { to: "/manutencao", label: "Manutenção", icon: Wrench, roles: ['admin', 'gestor', 'mecanico'] },
  { to: "/abastecimento", label: "Abastecimento", icon: Fuel, roles: ['admin', 'gestor', 'abastecedor'] },
  { to: "/reabastecimento", label: "Reabastecimento", icon: Droplets, roles: ['admin', 'gestor'] },
  { to: "/relatorios", label: "Relatórios", icon: BarChart2, roles: ['admin', 'gestor'] },
  { to: "/obras", label: "Obras", icon: Building2, roles: ['admin', 'gestor'] },
  { to: "/qrcode", label: "QR Code", icon: QrCode, roles: ['admin', 'gestor'] },
  { to: "/usuarios", label: "Usuários", icon: Users, roles: ['admin', 'gestor'] },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { roles, loading: rolesLoading } = useUserRoles();
  const { signOut } = useAuth();

  // Filter nav items based on user roles; if no roles yet, show nothing (loading)
  const navItems = rolesLoading
    ? []
    : allNavItems.filter(item => item.roles.some(r => roles.includes(r as any)));

  return (
    <div className="min-h-screen flex">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-sidebar border-r border-sidebar-border fixed h-full z-30">
        <Link to="/" className="flex items-center gap-3 p-5 border-b border-sidebar-border hover:bg-sidebar-accent/50 transition-colors">
          <img src={csmLogo} alt="CSM Construções" className="w-36 h-24 object-contain" />
          <div>
            <h1 className="text-lg font-black tracking-tight">
              <span className="text-gradient">CSM</span>
              <span className="text-sidebar-foreground">CONTROL</span>
            </h1>
            <p className="text-[10px] text-muted-foreground">Gestão de Frota & Manutenção</p>
          </div>
        </Link>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(item => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? "bg-primary/10 text-primary glow-primary"
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
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-sidebar border-b border-sidebar-border px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-lg font-black">
          <img src={csmLogo} alt="CSM" className="w-24 h-20 object-contain" />
          <span>
            <span className="text-gradient">CSM</span>
            <span className="text-sidebar-foreground">CONTROL</span>
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
                const active = location.pathname === item.to;
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
      <main className="flex-1 lg:ml-64 pt-16 lg:pt-0">
        <div className="p-4 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
