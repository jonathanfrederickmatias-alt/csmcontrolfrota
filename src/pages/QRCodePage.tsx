import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DBEquipment } from "@/lib/supabase-types";
import { QRCodeSVG } from "qrcode.react";
import { QrCode, Download, ExternalLink, ClipboardCheck, Fuel, Wrench, Printer, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function QRCodePage() {
  const [equipments, setEquipments] = useState<DBEquipment[]>([]);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    supabase.from('equipments').select('*').order('name').then(({ data }) => {
      setEquipments((data || []) as DBEquipment[]);
    });
  }, []);

  const baseUrl = window.location.origin;

  const downloadQR = (equipmentId: string, equipmentName: string) => {
    const canvas = document.querySelector(`#qr-${equipmentId} canvas`) as HTMLCanvasElement;
    if (!canvas) {
      // fallback: find SVG and convert
      const svg = document.querySelector(`#qr-${equipmentId} svg`) as SVGSVGElement;
      if (!svg) return;
      const svgData = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([svgData], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `QRCode-${equipmentName.replace(/\s/g, '_')}.svg`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `QRCode-${equipmentName.replace(/\s/g, '_')}.png`;
    a.click();
  };

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-black text-gradient">QR Code</h1>
          <p className="text-muted-foreground mt-1">1 QR Code por equipamento — abre menu com Checklist, Manutenção e Abastecimento</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/qr/imprimir')} className="gap-2">
          <Printer className="w-4 h-4" /> Imprimir todos (A4)
        </Button>
      </div>

      {equipments.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <QrCode className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Cadastre equipamentos primeiro para gerar QR Codes.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {equipments.map(eq => {
            const url = `${baseUrl}/qr/equipamento/${eq.id}`;
            return (
              <div key={eq.id} className="glass-card rounded-xl p-6 text-center flex flex-col items-center gap-4">
                {/* Header */}
                <div className="w-full">
                  <h3 className="font-bold text-lg">{eq.name}</h3>
                  {eq.model && <p className="text-xs text-muted-foreground">{eq.model}</p>}
                  {eq.plate && (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded bg-secondary text-xs font-mono">{eq.plate}</span>
                  )}
                </div>

                {/* QR Code */}
                <div id={`qr-${eq.id}`} className="bg-white p-4 rounded-2xl shadow-lg">
                  <QRCodeSVG value={url} size={180} bgColor="#ffffff" fgColor="#1a1a2e" level="M" />
                </div>

                {/* Itens dentro do QR */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1 text-success"><ClipboardCheck className="w-3.5 h-3.5" /> Checklist</span>
                  <span className="flex items-center gap-1 text-warning"><Wrench className="w-3.5 h-3.5" /> Manutenção</span>
                  <span className="flex items-center gap-1 text-primary"><Fuel className="w-3.5 h-3.5" /> Combustível</span>
                </div>

                {/* Actions */}
                <div className="w-full flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => window.open(url, '_blank')}
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Testar
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => downloadQR(eq.id, eq.name)}
                  >
                    <Download className="w-3.5 h-3.5" /> Baixar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

