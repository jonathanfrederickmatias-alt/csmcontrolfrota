import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DBEquipment } from "@/lib/supabase-types";
import { ClipboardCheck, Fuel, Wrench, ChevronRight, Loader2 } from "lucide-react";
import PublicLayout from "@/components/PublicLayout";

export default function QREquipamento() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [equipment, setEquipment] = useState<DBEquipment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    supabase.from('equipments').select('*').eq('id', id).single().then(({ data }) => {
      setEquipment(data as DBEquipment | null);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <PublicLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </PublicLayout>
    );
  }

  if (!equipment) {
    return (
      <PublicLayout>
        <div className="glass-card rounded-xl p-12 text-center">
          <p className="text-muted-foreground">Equipamento não encontrado.</p>
        </div>
      </PublicLayout>
    );
  }

  const actions = [
    {
      label: "Checklist Diário",
      description: "Verificação rápida antes de operar",
      icon: ClipboardCheck,
      color: "text-success",
      bg: "bg-success/10",
      border: "border-success/20",
      path: `/qr/checklist?equipment=${id}`,
    },
    {
      label: "Pedido de Manutenção",
      description: "Reportar problema ou falha",
      icon: Wrench,
      color: "text-warning",
      bg: "bg-warning/10",
      border: "border-warning/20",
      path: `/qr/pedido-manutencao?equipment=${id}`,
    },
    {
      label: "Abastecimento",
      description: "Registrar abastecimento (requer PIN)",
      icon: Fuel,
      color: "text-primary",
      bg: "bg-primary/10",
      border: "border-primary/20",
      path: `/qr/abastecimento?equipment=${id}`,
    },
  ];

  return (
    <PublicLayout>
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
          <span className="text-2xl font-black text-primary">
            {equipment.name.slice(0, 2).toUpperCase()}
          </span>
        </div>
        <h1 className="text-2xl font-black text-gradient">{equipment.name}</h1>
        {equipment.model && <p className="text-muted-foreground text-sm mt-1">{equipment.model}</p>}
        {equipment.plate && (
          <span className="inline-block mt-2 px-3 py-1 rounded-lg bg-secondary text-xs font-mono font-bold">
            {equipment.plate}
          </span>
        )}
        {equipment.current_hour_meter > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            Horímetro: <span className="font-mono font-bold text-foreground">{equipment.current_hour_meter}h</span>
          </p>
        )}
      </div>

      <div className="space-y-3">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold px-1 mb-4">
          O que você precisa fazer?
        </p>
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={() => navigate(action.path)}
            className={`w-full glass-card rounded-xl p-5 border ${action.border} flex items-center gap-4 text-left transition-all hover:scale-[1.01] active:scale-[0.99]`}
          >
            <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${action.bg} flex items-center justify-center`}>
              <action.icon className={`w-6 h-6 ${action.color}`} />
            </div>
            <div className="flex-1">
              <p className="font-bold text-foreground">{action.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          </button>
        ))}
      </div>
    </PublicLayout>
  );
}
