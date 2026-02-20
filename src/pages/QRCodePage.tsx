import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DBEquipment } from "@/lib/supabase-types";
import { QRCodeSVG } from "qrcode.react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { QrCode, ClipboardCheck, Fuel, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function QRCodePage() {
  const [equipments, setEquipments] = useState<DBEquipment[]>([]);
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    supabase.from('equipments').select('*').order('name').then(({ data }) => {
      setEquipments((data || []) as DBEquipment[]);
    });
  }, []);

  const selectedEquipment = equipments.find(e => e.id === selectedId);
  const baseUrl = window.location.origin;

  const qrItems = selectedId ? [
    { label: "Checklist", icon: ClipboardCheck, url: `${baseUrl}/qr/checklist?equipment=${selectedId}`, color: "text-success", bg: "bg-success/10", border: "border-success/20", description: "Operador preenche sem login" },
    { label: "Abastecimento", icon: Fuel, url: `${baseUrl}/qr/abastecimento?equipment=${selectedId}`, color: "text-primary", bg: "bg-primary/10", border: "border-primary/20", description: "Acesso com PIN — só responsável" },
    { label: "Pedido de Manutenção", icon: Wrench, url: `${baseUrl}/qr/pedido-manutencao?equipment=${selectedId}`, color: "text-warning", bg: "bg-warning/10", border: "border-warning/20", description: "Operador preenche sem login" },
  ] : [];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-gradient">QR Code</h1>
        <p className="text-muted-foreground mt-1">Um QR Code por função — escaneie para acesso rápido</p>
      </div>
      <div className="glass-card rounded-xl p-6 mb-8">
        <Label>Selecionar Equipamento</Label>
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger className="max-w-md mt-1"><SelectValue placeholder="Selecionar equipamento..." /></SelectTrigger>
          <SelectContent>{equipments.map(eq => <SelectItem key={eq.id} value={eq.id}>{eq.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {selectedEquipment && (
        <div>
          <h2 className="text-xl font-bold mb-4">{selectedEquipment.name}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {qrItems.map(item => (
              <div key={item.label} className={`glass-card rounded-xl p-6 text-center border ${item.border}`}>
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${item.bg} mb-3`}>
                  <item.icon className={`w-6 h-6 ${item.color}`} />
                </div>
                <h3 className="font-bold mb-1">{item.label}</h3>
                <p className={`text-xs mb-4 ${item.color}`}>{item.description}</p>
                <div className="bg-white p-4 rounded-xl inline-block shadow-lg">
                  <QRCodeSVG value={item.url} size={160} bgColor="#ffffff" fgColor="#1a1a2e" />
                </div>
                <p className="text-xs text-muted-foreground mt-3 break-all">{item.url}</p>
                <Button variant="outline" size="sm" className="mt-3 w-full gap-2" onClick={() => window.open(item.url, '_blank')}>
                  Testar Link
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
      {equipments.length === 0 && (
        <div className="glass-card rounded-xl p-12 text-center">
          <QrCode className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Cadastre equipamentos primeiro para gerar QR Codes.</p>
        </div>
      )}
    </div>
  );
}
