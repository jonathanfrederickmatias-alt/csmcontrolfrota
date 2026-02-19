import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { store, generateId } from "@/lib/store";
import { MaintenanceRequest } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, Wrench } from "lucide-react";

export default function MaintenanceRequestPage() {
  const [searchParams] = useSearchParams();
  const preselected = searchParams.get('equipment') || '';
  const equipments = store.getEquipments();

  const [equipmentId, setEquipmentId] = useState(preselected);
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<MaintenanceRequest['priority']>('medium');
  const [operatorName, setOperatorName] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    const mr: MaintenanceRequest = {
      id: generateId(),
      equipmentId,
      description,
      priority,
      status: 'open',
      operatorName,
      createdAt: new Date().toISOString(),
    };
    store.saveMaintenanceRequest(mr);
    setSaved(true);
  };

  if (saved) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="glass-card rounded-xl p-12 text-center max-w-md">
          <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
          <h2 className="text-xl font-bold text-success">Pedido Enviado!</h2>
          <p className="text-muted-foreground mt-2">O pedido de manutenção foi registrado com sucesso.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-gradient">Pedido de Manutenção</h1>
        <p className="text-muted-foreground mt-1">Solicitar serviço de manutenção</p>
      </div>

      <div className="glass-card rounded-xl p-6 max-w-lg">
        <div className="space-y-4">
          <div>
            <Label>Equipamento *</Label>
            <Select value={equipmentId} onValueChange={setEquipmentId}>
              <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                {equipments.map(eq => <SelectItem key={eq.id} value={eq.id}>{eq.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Operador *</Label>
            <Input value={operatorName} onChange={e => setOperatorName(e.target.value)} placeholder="Seu nome" />
          </div>
          <div>
            <Label>Descrição do Problema *</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descreva o problema..." rows={4} />
          </div>
          <div>
            <Label>Prioridade</Label>
            <Select value={priority} onValueChange={v => setPriority(v as MaintenanceRequest['priority'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Baixa</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSave} disabled={!equipmentId || !description || !operatorName} className="w-full h-12 text-base font-bold">
            <Wrench className="w-5 h-5 mr-2" /> Enviar Pedido
          </Button>
        </div>
      </div>
    </div>
  );
}
