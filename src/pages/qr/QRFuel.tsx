import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DBEquipment } from "@/lib/supabase-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Fuel, CheckCircle, Lock, Loader2 } from "lucide-react";
import PublicLayout from "@/components/PublicLayout";
import PhotoUpload from "@/components/PhotoUpload";

// PIN is now validated against fuel_pins table

export default function QRFuel() {
  const [searchParams] = useSearchParams();
  const preselected = searchParams.get('equipment') || '';
  const [equipments, setEquipments] = useState<DBEquipment[]>([]);
  const [pin, setPin] = useState('');
  const [pinVerified, setPinVerified] = useState(false);
  const [pinError, setPinError] = useState(false);
  const [comboId, setComboId] = useState('');
  const [targetId, setTargetId] = useState(preselected);
  const [liters, setLiters] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [hourMeter, setHourMeter] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');

  useEffect(() => {
    supabase.from('equipments').select('*').order('name').then(({ data }) => {
      setEquipments((data || []) as DBEquipment[]);
    });
  }, []);

  const combos = equipments.filter(e => e.type === 'combo');
  const targets = equipments.filter(e => e.type !== 'combo');
  const selectedCombo = equipments.find(e => e.id === comboId);
  const selectedTarget = equipments.find(e => e.id === targetId);

  const handleVerifyPin = async () => {
    const { data } = await supabase.from('fuel_pins').select('pin').eq('pin', pin).maybeSingle();
    if (data) { setPinVerified(true); setPinError(false); }
    else setPinError(true);
  };

  const handleSave = async () => {
    setSaving(true);
    await supabase.from('fuel_records').insert({
      combo_equipment_id: comboId,
      target_equipment_id: targetId,
      liters: Number(liters),
      date: new Date().toISOString().split('T')[0],
      operator_name: operatorName,
      photo_url: photoUrl || null,
    } as any);
    if (hourMeter && Number(hourMeter) > 0 && targetId) {
      await supabase.from('equipments').update({
        current_hour_meter: Number(hourMeter),
        updated_at: new Date().toISOString(),
      }).eq('id', targetId).lt('current_hour_meter', Number(hourMeter));
    }
    setSaving(false);
    setSaved(true);
  };

  const canSave = comboId && targetId && liters && operatorName && Number(liters) > 0 && photoUrl;

  if (saved) {
    return (
      <PublicLayout>
        <div className="glass-card rounded-xl p-12 text-center">
          <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
          <h2 className="text-xl font-bold text-success">Abastecimento Registrado!</h2>
          <p className="text-muted-foreground mt-2">{liters}L registrados com sucesso.</p>
          <Button variant="outline" className="mt-6" onClick={() => window.history.back()}>
            Voltar ao Equipamento
          </Button>
        </div>
      </PublicLayout>
    );
  }

  if (!pinVerified) {
    return (
      <PublicLayout>
        <div className="glass-card rounded-xl p-8 text-center">
          <Lock className="w-12 h-12 text-primary mx-auto mb-4" />
          <h1 className="text-2xl font-black text-gradient mb-2">Abastecimento</h1>
          <p className="text-muted-foreground text-sm mb-6">Acesso restrito. Digite o PIN para continuar.</p>
          {selectedTarget && <p className="text-sm font-medium text-primary mb-4">Equipamento: {selectedTarget.name}</p>}
          <div className="space-y-3 max-w-xs mx-auto">
            <Input type="password" value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleVerifyPin()} placeholder="PIN de acesso" className="text-center text-lg tracking-widest h-12" maxLength={6} />
            {pinError && <p className="text-destructive text-sm">PIN incorreto.</p>}
            <Button onClick={handleVerifyPin} className="w-full h-12 font-bold">Acessar</Button>
          </div>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Fuel className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-black text-gradient">Abastecimento</h1>
        </div>
        {selectedTarget && <p className="text-muted-foreground text-sm">{selectedTarget.name}</p>}
      </div>
      {combos.length > 0 && (
        <div className="space-y-2 mb-4">
          {combos.map(c => {
            const pct = c.fuel_capacity ? ((c.current_fuel || 0) / c.fuel_capacity) * 100 : 0;
            return (
              <div key={c.id} className="glass-card rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm">{c.name}</span>
                  <span className="font-mono text-primary font-bold">{c.current_fuel || 0}L / {c.fuel_capacity}L</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div className={`h-2 rounded-full ${pct > 30 ? 'bg-primary' : pct > 10 ? 'bg-warning' : 'bg-destructive'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="glass-card rounded-xl p-5 space-y-4">
        <div>
          <Label>Comboio *</Label>
          <select
            value={comboId}
            onChange={e => setComboId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 mt-1"
          >
            <option value="">Selecionar comboio...</option>
            {combos.map(c => <option key={c.id} value={c.id}>{c.name} ({c.current_fuel || 0}L)</option>)}
          </select>
        </div>
        {!preselected && (
          <div>
            <Label>Equipamento Destino *</Label>
            <select
              value={targetId}
              onChange={e => setTargetId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 mt-1"
            >
              <option value="">Selecionar máquina...</option>
              {targets.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <Label>Litros *</Label>
          <Input type="number" inputMode="decimal" value={liters} onChange={e => setLiters(e.target.value)} placeholder="Ex: 200" />
          {selectedCombo && Number(liters) > (selectedCombo.current_fuel || 0) && (
            <p className="text-xs text-destructive mt-1">Quantidade maior que o disponível!</p>
          )}
        </div>
        <div>
          <Label>Horímetro Atual (opcional)</Label>
          <Input type="number" inputMode="decimal" value={hourMeter} onChange={e => setHourMeter(e.target.value)} placeholder="Ex: 4520" />
          {selectedTarget && hourMeter && Number(hourMeter) < (selectedTarget.current_hour_meter || 0) && (
            <p className="text-xs text-warning mt-1">Valor menor que o horímetro atual ({selectedTarget.current_hour_meter}h)</p>
          )}
        </div>
        <div><Label>Responsável *</Label><Input value={operatorName} onChange={e => setOperatorName(e.target.value)} placeholder="Nome do responsável" /></div>
        <PhotoUpload label="Foto do Abastecimento" required onUploaded={setPhotoUrl} />
        <Button onClick={handleSave} disabled={!canSave || saving} className="w-full h-12 text-base font-bold">
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Registrar Abastecimento
        </Button>
      </div>
    </PublicLayout>
  );
}
