import { useState } from "react";
import { store, generateId } from "@/lib/store";
import { FuelRecord } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Fuel, CheckCircle, Droplets } from "lucide-react";

export default function FuelPage() {
  const equipments = store.getEquipments();
  const combos = equipments.filter(e => e.type === 'combo');
  const targets = equipments.filter(e => e.type !== 'combo');
  const [records, setRecords] = useState(store.getFuelRecords());

  const [comboId, setComboId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [liters, setLiters] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [saved, setSaved] = useState(false);

  const selectedCombo = equipments.find(e => e.id === comboId);

  const handleSave = () => {
    const fr: FuelRecord = {
      id: generateId(),
      comboEquipmentId: comboId,
      targetEquipmentId: targetId,
      liters: Number(liters),
      date: new Date().toISOString().split('T')[0],
      operatorName,
      createdAt: new Date().toISOString(),
    };
    store.saveFuelRecord(fr);
    setRecords(store.getFuelRecords());
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setComboId('');
      setTargetId('');
      setLiters('');
      setOperatorName('');
    }, 2000);
  };

  const canSave = comboId && targetId && liters && operatorName && Number(liters) > 0;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-gradient">Abastecimento</h1>
        <p className="text-muted-foreground mt-1">Controle de combustível comboio → máquina</p>
      </div>

      {/* Combo fuel levels */}
      {combos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {combos.map(c => {
            const pct = c.fuelCapacity ? ((c.currentFuel || 0) / c.fuelCapacity) * 100 : 0;
            return (
              <div key={c.id} className="glass-card rounded-xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <Droplets className="w-6 h-6 text-primary" />
                  <div>
                    <h3 className="font-bold">{c.name}</h3>
                    <p className="text-xs text-muted-foreground">{c.plate || 'Sem placa'}</p>
                  </div>
                </div>
                <div className="flex items-end justify-between mb-2">
                  <span className="text-2xl font-mono font-bold text-accent">{c.currentFuel || 0}L</span>
                  <span className="text-sm text-muted-foreground">/ {c.fuelCapacity}L</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${pct > 30 ? 'bg-primary' : pct > 10 ? 'bg-warning' : 'bg-destructive'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {saved ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
          <h2 className="text-xl font-bold text-success">Abastecimento Registrado!</h2>
        </div>
      ) : (
        <div className="glass-card rounded-xl p-6 mb-8">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Fuel className="w-5 h-5 text-primary" /> Registrar Abastecimento
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Comboio *</Label>
              <Select value={comboId} onValueChange={setComboId}>
                <SelectTrigger><SelectValue placeholder="Selecionar comboio..." /></SelectTrigger>
                <SelectContent>
                  {combos.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.currentFuel || 0}L)</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Equipamento Destino *</Label>
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger><SelectValue placeholder="Selecionar máquina..." /></SelectTrigger>
                <SelectContent>
                  {targets.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Litros *</Label>
              <Input type="number" value={liters} onChange={e => setLiters(e.target.value)} placeholder="Ex: 1000" />
              {selectedCombo && Number(liters) > (selectedCombo.currentFuel || 0) && (
                <p className="text-xs text-destructive mt-1">Quantidade maior que o disponível no comboio!</p>
              )}
            </div>
            <div><Label>Operador *</Label>
              <Input value={operatorName} onChange={e => setOperatorName(e.target.value)} placeholder="Nome" />
            </div>
          </div>
          <Button onClick={handleSave} disabled={!canSave} className="w-full mt-4 h-12 text-base font-bold">
            Registrar Abastecimento
          </Button>
        </div>
      )}

      {/* History */}
      <div className="glass-card rounded-xl p-6">
        <h2 className="text-lg font-bold mb-4">Histórico de Abastecimentos</h2>
        {records.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum abastecimento registrado.</p>
        ) : (
          <div className="space-y-2">
            {records.slice().reverse().map(r => {
              const combo = equipments.find(e => e.id === r.comboEquipmentId);
              const target = equipments.find(e => e.id === r.targetEquipmentId);
              return (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                  <div>
                    <p className="text-sm font-medium">{combo?.name} → {target?.name}</p>
                    <p className="text-xs text-muted-foreground">{r.operatorName} — {r.date}</p>
                  </div>
                  <span className="text-lg font-mono font-bold text-accent">{r.liters}L</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
