import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEquipments } from "@/hooks/useEquipments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, FileText, Trash2, Pencil, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DocRow {
  id: string;
  equipment_id: string;
  document_type: string;
  document_name: string | null;
  document_number: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  notes: string | null;
  photo_url: string | null;
  created_at: string;
}

const TIPOS = [
  "CRLV", "ANTT/RNTRC", "Licenciamento", "Seguro Obrigatório (DPVAT)",
  "Tacógrafo", "AET (Autorização Especial de Trânsito)", "Cronotacógrafo",
  "Certificado de Inspeção", "Outro",
];

export default function DocumentosPage() {
  const { equipments } = useEquipments();
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DocRow | null>(null);
  const [filterEq, setFilterEq] = useState<string>("all");

  const empty = {
    equipment_id: "",
    document_type: TIPOS[0],
    document_name: "",
    document_number: "",
    issue_date: "",
    expiry_date: "",
    notes: "",
  };
  const [form, setForm] = useState(empty);

  const fetchDocs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("equipment_documents")
      .select("*")
      .order("expiry_date", { ascending: true, nullsFirst: false });
    if (error) toast.error("Erro ao carregar documentos");
    setDocs((data as DocRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchDocs(); }, []);

  const eqMap = useMemo(() => {
    const m = new Map<string, string>();
    equipments.forEach(e => {
      const prefix = e.cost_center || e.plate;
      m.set(e.id, prefix ? `${prefix} · ${e.name}` : e.name);
    });
    return m;
  }, [equipments]);

  const filtered = filterEq === "all" ? docs : docs.filter(d => d.equipment_id === filterEq);

  const handleOpen = (doc?: DocRow) => {
    if (doc) {
      setEditing(doc);
      setForm({
        equipment_id: doc.equipment_id,
        document_type: doc.document_type,
        document_name: doc.document_name || "",
        document_number: doc.document_number || "",
        issue_date: doc.issue_date || "",
        expiry_date: doc.expiry_date || "",
        notes: doc.notes || "",
      });
    } else {
      setEditing(null);
      setForm(empty);
    }
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.equipment_id) return toast.error("Selecione o equipamento");
    if (!form.document_type) return toast.error("Informe o tipo");

    const payload = {
      equipment_id: form.equipment_id,
      document_type: form.document_type,
      document_name: form.document_name || null,
      document_number: form.document_number || null,
      issue_date: form.issue_date || null,
      expiry_date: form.expiry_date || null,
      notes: form.notes || null,
    };

    const { error } = editing
      ? await supabase.from("equipment_documents").update(payload).eq("id", editing.id)
      : await supabase.from("equipment_documents").insert([payload]);

    if (error) return toast.error(error.message);
    toast.success(editing ? "Documento atualizado" : "Documento cadastrado");
    setOpen(false);
    fetchDocs();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este documento?")) return;
    const { error } = await supabase.from("equipment_documents").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Documento excluído");
    fetchDocs();
  };

  const expiryStatus = (expiry: string | null) => {
    if (!expiry) return { label: "Sem prazo", variant: "secondary" as const, days: null as number | null };
    const days = differenceInDays(parseISO(expiry), new Date());
    if (days < 0) return { label: `Vencido há ${Math.abs(days)}d`, variant: "destructive" as const, days };
    if (days <= 15) return { label: `Vence em ${days}d`, variant: "destructive" as const, days };
    if (days <= 30) return { label: `Vence em ${days}d`, variant: "default" as const, days };
    return { label: `${days}d restantes`, variant: "secondary" as const, days };
  };

  const expiringSoon = docs.filter(d => {
    if (!d.expiry_date) return false;
    const days = differenceInDays(parseISO(d.expiry_date), new Date());
    return days <= 30;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="w-7 h-7 text-primary" />
            Documentos
          </h1>
          <p className="text-muted-foreground">Documentos e prazos de renovação dos equipamentos e veículos</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpen()}>
              <Plus className="w-4 h-4 mr-2" /> Novo documento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar documento" : "Novo documento"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Equipamento / Veículo *</Label>
                <select
                  className="w-full border rounded-md h-10 px-3 bg-background"
                  value={form.equipment_id}
                  onChange={e => setForm({ ...form, equipment_id: e.target.value })}
                >
                  <option value="">Selecione...</option>
                  {equipments.map(e => (
                    <option key={e.id} value={e.id}>
                      {(e.cost_center || e.plate) ? `${e.cost_center || e.plate} · ` : ""}{e.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Tipo de documento *</Label>
                <select
                  className="w-full border rounded-md h-10 px-3 bg-background"
                  value={form.document_type}
                  onChange={e => setForm({ ...form, document_type: e.target.value })}
                >
                  {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <Label>Nome / Descrição</Label>
                <Input value={form.document_name} onChange={e => setForm({ ...form, document_name: e.target.value })} />
              </div>
              <div>
                <Label>Número do documento</Label>
                <Input value={form.document_number} onChange={e => setForm({ ...form, document_number: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Emissão</Label>
                  <Input type="date" value={form.issue_date} onChange={e => setForm({ ...form, issue_date: e.target.value })} />
                </div>
                <div>
                  <Label>Vencimento</Label>
                  <Input type="date" value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {expiringSoon.length > 0 && (
        <Card className="border-destructive/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              {expiringSoon.length} documento(s) vencendo em até 30 dias
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {expiringSoon.map(d => {
              const s = expiryStatus(d.expiry_date);
              return (
                <div key={d.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                  <span>
                    <span className="text-primary font-medium">{eqMap.get(d.equipment_id) || "—"}</span>
                    {" · "}{d.document_type}
                  </span>
                  <Badge variant={s.variant}>{s.label}</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle>Todos os documentos</CardTitle>
            <select
              className="border rounded-md h-9 px-3 bg-background text-sm"
              value={filterEq}
              onChange={e => setFilterEq(e.target.value)}
            >
              <option value="all">Todos os equipamentos</option>
              {equipments.map(e => (
                <option key={e.id} value={e.id}>
                  {(e.cost_center || e.plate) ? `${e.cost_center || e.plate} · ` : ""}{e.name}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum documento cadastrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Equipamento</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Número</TableHead>
                    <TableHead>Emissão</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(d => {
                    const s = expiryStatus(d.expiry_date);
                    return (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">{eqMap.get(d.equipment_id) || "—"}</TableCell>
                        <TableCell>{d.document_type}</TableCell>
                        <TableCell>{d.document_number || "—"}</TableCell>
                        <TableCell>{d.issue_date ? format(parseISO(d.issue_date), "dd/MM/yyyy", { locale: ptBR }) : "—"}</TableCell>
                        <TableCell>{d.expiry_date ? format(parseISO(d.expiry_date), "dd/MM/yyyy", { locale: ptBR }) : "—"}</TableCell>
                        <TableCell><Badge variant={s.variant}>{s.label}</Badge></TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleOpen(d)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(d.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
