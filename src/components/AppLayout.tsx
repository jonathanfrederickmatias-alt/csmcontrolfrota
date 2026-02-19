import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Truck, ClipboardCheck, Wrench, Fuel, QrCode, Menu, X } from "lucide-react";
import { useState } from "react";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/equipamentos", label: "Equipamentos", icon: Truck },
  { to: "/checklist", label: "Checklist", icon: ClipboardCheck },
  { to: "/manutencao", label: "Manutenção", icon: Wrench },
  { to: "/abastecimento", label: "Abastecimento", icon: Fuel },
  { to: "/qrcode", label: "QR Code", icon: QrCode },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-sidebar border-r border-sidebar-border fixed h-full z-30">
        <div className="p-6 border-b border-sidebar-border">
          <h1 className="text-xl font-black tracking-tight">
            <span className="text-gradient">PAVI</span>
            <span className="text-sidebar-foreground">CONTROL</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Gestão de Frota & Manutenção</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
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
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-sidebar border-b border-sidebar-border px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-black">
          <span className="text-gradient">PAVI</span>
          <span className="text-sidebar-foreground">CONTROL</span>
        </h1>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="text-sidebar-foreground p-2">
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile nav overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-30 bg-background/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)}>
          <div className="bg-sidebar w-64 h-full p-4 pt-20 space-y-1" onClick={e => e.stopPropagation()}>
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
