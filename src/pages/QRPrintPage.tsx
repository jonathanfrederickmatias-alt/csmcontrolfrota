import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DBEquipment } from "@/lib/supabase-types";
import { QRCodeSVG } from "qrcode.react";
import { Printer, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function QRPrintPage() {
  const [equipments, setEquipments] = useState<DBEquipment[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.from('equipments').select('*').order('name').then(({ data }) => {
      setEquipments((data || []) as DBEquipment[]);
    });
  }, []);

  const baseUrl = window.location.origin;

  return (
    <>
      {/* Toolbar - hidden on print */}
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-background/95 border-b border-border px-6 py-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/qrcode')} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
        <span className="text-sm font-semibold text-muted-foreground">Layout A4 — Impressão</span>
        <Button size="sm" onClick={() => window.print()} className="gap-2">
          <Printer className="w-4 h-4" /> Imprimir
        </Button>
      </div>

      {/* Print content */}
      <div className="print-container pt-16">
        <style>{`
          @media print {
            .no-print { display: none !important; }
            .print-container { padding-top: 0 !important; }
            body { background: white !important; color: black !important; }
            @page { size: A4; margin: 15mm; }
          }
          .qr-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 24px;
            max-width: 800px;
            margin: 0 auto;
            padding: 24px;
          }
          .qr-card {
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            page-break-inside: avoid;
            background: white;
          }
          .qr-card-title {
            font-size: 16px;
            font-weight: 800;
            color: #0f172a;
            text-align: center;
          }
          .qr-card-sub {
            font-size: 11px;
            color: #64748b;
            text-align: center;
            margin-top: -8px;
          }
          .qr-card-plate {
            font-size: 11px;
            font-weight: 700;
            background: #f1f5f9;
            padding: 3px 10px;
            border-radius: 6px;
            color: #334155;
            font-family: monospace;
          }
          .qr-wrapper {
            background: white;
            padding: 12px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          .qr-url {
            font-size: 9px;
            color: #94a3b8;
            word-break: break-all;
            text-align: center;
            max-width: 200px;
          }
          .qr-actions {
            display: flex;
            gap: 8px;
            width: 100%;
            font-size: 10px;
            color: #64748b;
            justify-content: center;
            border-top: 1px solid #e2e8f0;
            padding-top: 10px;
          }
          .qr-action-item {
            display: flex;
            align-items: center;
            gap: 4px;
          }
          .dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
          }
          .print-header {
            text-align: center;
            padding: 20px 24px 8px;
            max-width: 800px;
            margin: 0 auto;
          }
          .print-header h1 {
            font-size: 22px;
            font-weight: 900;
            color: #0f172a;
          }
          .print-header p {
            font-size: 12px;
            color: #64748b;
            margin-top: 4px;
          }
        `}</style>

        <div className="print-header">
          <h1>CSMCONTROL — QR Codes de Equipamentos</h1>
          <p>Imprima e afixe em cada equipamento. Escaneie para acessar Checklist, Manutenção e Abastecimento.</p>
        </div>

        <div className="qr-grid">
          {equipments.map(eq => {
            const url = `${baseUrl}/qr/equipamento/${eq.id}`;
            return (
              <div key={eq.id} className="qr-card">
                <div className="qr-card-title">{eq.name}</div>
                {eq.model && <div className="qr-card-sub">{eq.model}</div>}
                {eq.plate && <div className="qr-card-plate">{eq.plate}</div>}

                <div className="qr-wrapper">
                  <QRCodeSVG value={url} size={160} bgColor="#ffffff" fgColor="#0f172a" level="M" />
                </div>

                <div className="qr-actions">
                  <div className="qr-action-item">
                    <div className="dot" style={{ background: '#22c55e' }} />
                    Checklist
                  </div>
                  <div className="qr-action-item">
                    <div className="dot" style={{ background: '#f59e0b' }} />
                    Manutenção
                  </div>
                  <div className="qr-action-item">
                    <div className="dot" style={{ background: '#ef4444' }} />
                    Combustível
                  </div>
                </div>

                <div className="qr-url">{url}</div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
