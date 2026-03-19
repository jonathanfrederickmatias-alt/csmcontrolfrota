import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEquipments } from "@/hooks/useEquipments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, ShieldCheck, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format, differenceInDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface InsuranceRecord {
  id: string;
  equipment_id: string;
  insurance_company: string;
  policy_number: string | null;
  start_date: string;
  end_date: string;
  notes: string | null;
  created_at: string;
}

export default function SegurosPage() {
  const { equipments } = useEquipments();
  const [records, setRecords] = useState<InsuranceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<InsuranceRecord | null>(null);

  const [equipmentId, setEquipmentId] = useState("");
  const [company, setCompany] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");

  const fetchRecords = useCallback(async () => {
    const { data } = await supabase
      .from("insurance_records")
      .select("*")
      .order("end_date", { ascending: true });
    if (data) setRecords(data as InsuranceRecord[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const resetForm = () => {
    setEquipmentId("");
    setCompany("");
    setPolicyNumber("");
    setStartDate("");
    setEndDate("");
    setNotes("");
    setEditing(null);
  };

  const openEdit = (r: InsuranceRecord) => {
    setEditing(r);
    setEquipmentId(r.equipment_id);
    setCompany(r.insurance_company);
    setPolicyNumber(r.policy_number || "");
    setStartDate(r.start_date);
    setEndDate(r.end_date);
    setNotes(r.notes || "");
    setOpen(true);
  };

  const handleSave = async () => {
    if (!equipmentId || !company || !startDate || !endDate) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }

    const payload = {
      equipment_id: equipmentId,
      insurance_company: company,
      policy_number: policyNumber || null,
      start_date: startDate,
      end_date: endDate,
      notes: notes || null,
    };

    if (editing) {
      const { error } = await supabase.from("insurance_records").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Erro ao atualizar", variant: "destructive" }); return; }
      toast({ title: "Seguro atualizado" });
    } else {
      const { error } = await supabase.from("insurance_records").insert(payload);
      if (error) { toast({ title: "Erro ao salvar", variant: "destructive" }); return; }
      toast({ title: "Seguro cadastrado" });
    }

    setOpen(false);
    resetForm();
    fetchRecords();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este seguro?")) return;
    await supabase.from("insurance_records").delete().eq("id", id);
    fetchRecords();
  };

  const getEquipmentName = (id: string) => equipments.find(e => e.id === id)?.name || "—";

  const getStatusBadge = (endDate: string) => {
    const days = differenceInDays(parseISO(endDate), new Date());
    if (days < 0) return <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" /> Vencido</Badge>;
    if (days <= 15) return <Badge className="bg-yellow-500 hover:bg-yellow-600 gap-1"><AlertTriangle className="w-3 h-3" /> Vence em {days}d</Badge>;
    return <Badge className="bg-green-600 hover:bg-green-700 gap-1"><ShieldCheck className="w-3 h-3" /> Vigente</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Seguros</h1>
          <p className="text-muted-foreground text-sm">Controle de seguros dos equipamentos</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Novo Seguro</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Seguro" : "Novo Seguro"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Equipamento *</Label>
                <Select value={equipmentId} onValueChange={setEquipmentId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {equipments.filter(e => e.type !== 'combo').map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Seguradora *</Label>
                <Input value={company} onChange={e => setCompany(e.target.value)} placeholder="Nome da seguradora" />
              </div>
              <div>
                <Label>Nº da Apólice</Label>
                <Input value={policyNumber} onChange={e => setPolicyNumber(e.target.value)} placeholder="Opcional" />
              </div>
              <div className="grid grid-cols-2 gap-4">
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
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
              <Button onClick={handleSave} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : records.length === 0 ? (
        <p className="text-muted-foreground">Nenhum seguro cadastrado.</p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Equipamento</TableHead>
                <TableHead>Seguradora</TableHead>
                <TableHead>Apólice</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{getEquipmentName(r.equipment_id)}</TableCell>
                  <TableCell>{r.insurance_company}</TableCell>
                  <TableCell>{r.policy_number || "—"}</TableCell>
                  <TableCell className="text-sm">
                    {format(parseISO(r.start_date), "dd/MM/yy")} — {format(parseISO(r.end_date), "dd/MM/yy")}
                  </TableCell>
                  <TableCell>{getStatusBadge(r.end_date)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
