import { useState } from "react";
import { store } from "@/lib/store";
import { QRCodeSVG } from "qrcode.react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { QrCode, ClipboardCheck, Fuel, Wrench } from "lucide-react";

export default function QRCodePage() {
  const equipments = store.getEquipments();
  const [selectedId, setSelectedId] = useState('');
  const selectedEquipment = equipments.find(e => e.id === selectedId);

  // Base URL - in production this would be the real domain
  const baseUrl = window.location.origin;

  const qrItems = selectedId ? [
    { label: "Checklist", icon: ClipboardCheck, url: `${baseUrl}/checklist?equipment=${selectedId}`, color: "text-success" },
    { label: "Abastecimento", icon: Fuel, url: `${baseUrl}/abastecimento?equipment=${selectedId}`, color: "text-primary" },
    { label: "Pedido de Manutenção", icon: Wrench, url: `${baseUrl}/pedido-manutencao?equipment=${selectedId}`, color: "text-warning" },
  ] : [];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-gradient">QR Code</h1>
        <p className="text-muted-foreground mt-1">Gere QR Codes para acesso rápido por equipamento</p>
      </div>

      <div className="glass-card rounded-xl p-6 mb-8">
        <Label>Selecionar Equipamento</Label>
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger className="max-w-md"><SelectValue placeholder="Selecionar equipamento..." /></SelectTrigger>
          <SelectContent>
            {equipments.map(eq => (
              <SelectItem key={eq.id} value={eq.id}>{eq.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedEquipment && (
        <div>
          <h2 className="text-xl font-bold mb-4">{selectedEquipment.name}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {qrItems.map(item => (
              <div key={item.label} className="glass-card rounded-xl p-6 text-center">
                <item.icon className={`w-8 h-8 ${item.color} mx-auto mb-3`} />
                <h3 className="font-bold mb-4">{item.label}</h3>
                <div className="bg-foreground p-4 rounded-xl inline-block">
                  <QRCodeSVG
                    value={item.url}
                    size={180}
                    bgColor="hsl(40, 10%, 92%)"
                    fgColor="hsl(220, 20%, 10%)"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-3 break-all">{item.url}</p>
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
