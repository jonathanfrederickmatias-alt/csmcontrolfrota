import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, ShieldCheck, FileText, Wrench, Check } from "lucide-react";
import { toast } from "sonner";
import { calculateMaintenanceStatus } from "@/lib/maintenance-utils";

const DOC_TIPOS = [
  "CRLV", "ANTT/RNTRC", "Licenciamento", "Seguro Obrigatório (DPVAT)",
  "Tacógrafo", "AET (Autorização Especial de Trânsito)", "Cronotacógrafo",
  "Certificado de Inspeção", "Outro",
];

interface PolicyOption {
  id: string;
  insurance_company: string;
  policy_number: string | null;
  end_date: string;
  equipment_ids: string[];
}

interface PlanRow {
  description: string;
  planType: 'km' | 'horimetro' | 'tempo';
  interval: string;
  lastDone: string;
}

interface Props {
  equipmentId: string;
  equipmentName: string;
  equipmentType: string;
  currentHourMeter: number;
  open: boolean;
  onClose: () => void;
}

export default function NewAssetWizard({ equipmentId, equipmentName, equipmentType, currentHourMeter, open, onClose }: Props) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Seguro
  const [insuranceMode, setInsuranceMode] = useState<'none' | 'existing' | 'new'>('none');
  const [policies, setPolicies] = useState<PolicyOption[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<string>("");
  const [company, setCompany] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [insNotes, setInsNotes] = useState("");

  // Documentos
  const [controlDocs, setControlDocs] = useState(false);
  const [docs, setDocs] = useState<{ type: string; expiry: string }[]>([]);

  // Planos
  const [plans, setPlans] = useState<PlanRow[]>([]);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    supabase.from("insurance_records").select("*").order("end_date", { ascending: false }).then(({ data }) => {
      setPolicies((data || []).map((r: any) => ({
        id: r.id,
        insurance_company: r.insurance_company,
        policy_number: r.policy_number,
        end_date: r.end_date,
        equipment_ids: Array.isArray(r.equipment_ids) ? r.equipment_ids : [],
      })));
    });
  }, [open]);

  const toggleDoc = (type: string) => {
    setDocs(prev => prev.some(d => d.type === type)
      ? prev.filter(d => d.type !== type)
      : [...prev, { type, expiry: "" }]);
  };

  const setDocExpiry = (type: string, expiry: string) => {
    setDocs(prev => prev.map(d => d.type === type ? { ...d, expiry } : d));
  };

  const addPlan = () => setPlans(p => [...p, { description: "", planType: equipmentType === 'truck' ? 'km' : 'horimetro', interval: "", lastDone: "" }]);
  const updatePlan = (i: number, patch: Partial<PlanRow>) => setPlans(p => p.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const removePlan = (i: number) => setPlans(p => p.filter((_, idx) => idx !== i));

  const finish = async () => {
    setSaving(true);
    try {
      const { getMyTenantId } = await import('@/lib/tenant');
      const tenant_id = await getMyTenantId();

      // 1. Seguro
      if (insuranceMode === 'existing' && selectedPolicy) {
        const pol = policies.find(p => p.id === selectedPolicy);
        if (pol) {
          const ids = Array.from(new Set([...pol.equipment_ids, equipmentId]));
          const { error } = await supabase.from("insurance_records").update({ equipment_ids: ids }).eq("id", pol.id);
          if (error) throw error;
        }
      } else if (insuranceMode === 'new') {
        if (!company || !startDate || !endDate) {
          toast.error("Preencha seguradora, início e vencimento do seguro");
          setSaving(false);
          return;
        }
        const { error } = await supabase.from("insurance_records").insert([{
          tenant_id,
          equipment_ids: [equipmentId],
          insurance_company: company,
          policy_number: policyNumber || null,
          start_date: startDate,
          end_date: endDate,
          notes: insNotes || null,
        }]);
        if (error) throw error;
      }

      // 2. Documentos
      if (controlDocs && docs.length > 0) {
        const { error } = await supabase.from("equipment_documents").insert(
          docs.map(d => ({
            tenant_id,
            equipment_id: equipmentId,
            document_type: d.type,
            expiry_date: d.expiry || null,
          }))
        );
        if (error) throw error;
      }

      // 3. Planos de manutenção
      const validPlans = plans.filter(p => p.description && Number(p.interval) > 0);
      if (validPlans.length > 0) {
        const payloads = validPlans.map(p => {
          if (p.planType === 'tempo') {
            const days = Number(p.interval);
            const lastDate = p.lastDone ? new Date(p.lastDone) : new Date();
            const nextDate = new Date(lastDate.getTime() + days * 86400000);
            const diffDays = (nextDate.getTime() - Date.now()) / 86400000;
            return {
              tenant_id,
              equipment_id: equipmentId,
              description: p.description,
              plan_type: 'tempo',
              interval_hours: 0,
              last_done_at: 0,
              next_due_at: 0,
              interval_days: days,
              last_done_date: lastDate.toISOString(),
              next_due_date: nextDate.toISOString(),
              status: diffDays <= 0 ? 'overdue' : diffDays <= 7 ? 'approaching' : 'ok',
            };
          }
          const lastDone = Number(p.lastDone || currentHourMeter || 0);
          const interval = Number(p.interval);
          const nextDue = lastDone + interval;
          return {
            tenant_id,
            equipment_id: equipmentId,
            description: p.description,
            plan_type: p.planType,
            interval_hours: interval,
            last_done_at: lastDone,
            next_due_at: nextDue,
            interval_days: null,
            last_done_date: null,
            next_due_date: null,
            status: calculateMaintenanceStatus(nextDue - (currentHourMeter || 0), equipmentType),
          };
        });
        const { error } = await supabase.from("maintenance_plans").insert(payloads as any);
        if (error) throw error;
      }

      toast.success("Cadastro do ativo concluído!");
      onClose();
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e?.message || "tente novamente"));
    } finally {
      setSaving(false);
    }
  };

  const StepHeader = ({ icon: Icon, title, desc }: any) => (
    <div className="flex items-start gap-3 mb-4">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar ativo: {equipmentName}</DialogTitle>
          <p className="text-xs text-muted-foreground">Etapa {step} de 3</p>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <StepHeader icon={ShieldCheck} title="Seguro" desc="Este ativo já possui seguro?" />
            <div className="space-y-2">
              {[
                { v: 'none', label: 'Ainda não tem seguro' },
                { v: 'existing', label: 'Faz parte de uma apólice/frota já cadastrada' },
                { v: 'new', label: 'Possui seguro individual (cadastrar agora)' },
              ].map(o => (
                <label key={o.v} className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer text-sm ${insuranceMode === o.v ? 'border-primary bg-primary/5' : 'border-border'}`}>
                  <input type="radio" name="ins" checked={insuranceMode === o.v} onChange={() => setInsuranceMode(o.v as any)} />
                  {o.label}
                </label>
              ))}
            </div>

            {insuranceMode === 'existing' && (
              <div>
                <Label>Apólice existente</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={selectedPolicy}
                  onChange={e => setSelectedPolicy(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {policies.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.insurance_company}{p.policy_number ? ` — ${p.policy_number}` : ''} ({p.equipment_ids.length} ativos)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {insuranceMode === 'new' && (
              <div className="space-y-3">
                <div>
                  <Label>Seguradora *</Label>
                  <Input value={company} onChange={e => setCompany(e.target.value)} />
                </div>
                <div>
                  <Label>Nº da Apólice</Label>
                  <Input value={policyNumber} onChange={e => setPolicyNumber(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Início *</Label>
                    <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  </div>
                  <div>
                    <Label>Vencimento *</Label>
                    <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>Observações</Label>
                  <Textarea value={insNotes} onChange={e => setInsNotes(e.target.value)} />
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <StepHeader icon={FileText} title="Documentos" desc="Precisa controlar documentos deste ativo?" />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={controlDocs} onCheckedChange={(v) => setControlDocs(!!v)} />
              Sim, quero controlar documentos e vencimentos
            </label>
            {controlDocs && (
              <ScrollArea className="h-64 rounded-md border p-2">
                {DOC_TIPOS.map(t => {
                  const sel = docs.find(d => d.type === t);
                  return (
                    <div key={t} className="py-1.5 px-1 border-b last:border-0">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox checked={!!sel} onCheckedChange={() => toggleDoc(t)} />
                        {t}
                      </label>
                      {sel && (
                        <div className="mt-1 ml-6">
                          <Label className="text-xs">Vencimento</Label>
                          <Input type="date" value={sel.expiry} onChange={e => setDocExpiry(t, e.target.value)} className="h-8" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </ScrollArea>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <StepHeader icon={Wrench} title="Planos de manutenção" desc="Quais planos preventivos este ativo terá?" />
            {plans.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum plano adicionado. Você pode pular esta etapa.</p>
            )}
            <div className="space-y-3">
              {plans.map((p, i) => (
                <div key={i} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input placeholder="Descrição (ex: Troca de óleo)" value={p.description} onChange={e => updatePlan(i, { description: e.target.value })} />
                    <Button size="icon" variant="ghost" onClick={() => removePlan(i)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">Tipo</Label>
                      <select
                        className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                        value={p.planType}
                        onChange={e => updatePlan(i, { planType: e.target.value as any })}
                      >
                        <option value="horimetro">Horímetro</option>
                        <option value="km">KM</option>
                        <option value="tempo">Tempo (dias)</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs">{p.planType === 'tempo' ? 'Dias' : 'Intervalo'}</Label>
                      <Input inputMode="decimal" value={p.interval} onChange={e => updatePlan(i, { interval: e.target.value })} className="h-9" />
                    </div>
                    <div>
                      <Label className="text-xs">{p.planType === 'tempo' ? 'Última execução' : 'Última (atual)'}</Label>
                      <Input
                        type={p.planType === 'tempo' ? 'date' : 'text'}
                        inputMode={p.planType === 'tempo' ? undefined : 'decimal'}
                        value={p.lastDone}
                        onChange={e => updatePlan(i, { lastDone: e.target.value })}
                        className="h-9"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" onClick={addPlan} className="w-full"><Plus className="w-4 h-4 mr-2" /> Adicionar plano</Button>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {step > 1 && <Button variant="outline" onClick={() => setStep(step - 1)}>Voltar</Button>}
          <Button variant="ghost" onClick={onClose} className="ml-auto">Pular</Button>
          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)}>Continuar</Button>
          ) : (
            <Button onClick={finish} disabled={saving}>
              <Check className="w-4 h-4 mr-2" /> {saving ? "Salvando..." : "Concluir"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
