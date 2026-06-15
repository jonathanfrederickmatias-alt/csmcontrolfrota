import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DBEquipment, DBChecklist, ChecklistItemDB } from "@/lib/supabase-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ClipboardList, Loader2, Edit2, Trash2, ShieldCheck, ShieldX, AlertTriangle, Search, ChevronDown, ChevronUp, CheckCircle, XCircle, MinusCircle, Camera, Download } from "lucide-react";
import { toast } from "sonner";
import { useUserRoles } from "@/hooks/useUserRoles";
import { exportChecklistPDF, ChecklistPDFData } from "@/lib/pdf-export";

const statusConfig = {
  ok: { label: 'OK', icon: ShieldCheck, color: 'text-success', bg: 'bg-success/10' },
  attention: { label: 'Atenção', icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10' },
  critical: { label: 'Crítico', icon: ShieldX, color: 'text-destructive', bg: 'bg-destructive/10' },
};

const typeLabels = { daily: 'Diário', corrective: 'Corretivo', preventive: 'Preventivo' };

export default function ChecklistListPage() {
  const { isAdmin, isGestor, isAbastecedor } = useUserRoles();
  const canEdit = isAdmin || isGestor || isAbastecedor;
  const [checklists, setChecklists] = useState<DBChecklist[]>([]);
  const [equipments, setEquipments] = useState<DBEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterEquipment, setFilterEquipment] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Edit state
  const [editChecklist, setEditChecklist] = useState<DBChecklist | null>(null);
  const [editForm, setEditForm] = useState({
    operator_name: '',
    hour_meter: '',
    date: '',
    observations: '',
    status: 'ok' as string,
  });

  const fetchData = async () => {
    setLoading(true);
    const [clRes, eqRes] = await Promise.all([
      supabase.from('checklists').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('equipments').select('*').order('name'),
    ]);
    setChecklists((clRes.data || []) as unknown as DBChecklist[]);
    setEquipments((eqRes.data || []) as DBEquipment[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const eqLabel = (eq: DBEquipment) => {
    const id = eq.cost_center || eq.plate || '';
    return id ? `${eq.name} (${id})` : eq.name;
  };

  const eqName = (eqId: string) => {
    const eq = equipments.find(e => e.id === eqId);
    return eq ? eqLabel(eq) : '—';
  };

  const openEdit = (cl: DBChecklist) => {
    setEditChecklist(cl);
    // Extract observations from items or general
    const obs = (cl as any).observations || '';
    setEditForm({
      operator_name: cl.operator_name,
      hour_meter: String(cl.hour_meter),
      date: cl.date,
      observations: obs,
      status: cl.status,
    });
  };

  const handleSaveEdit = async () => {
    if (!editChecklist) return;
    await supabase.from('checklists').update({
      operator_name: editForm.operator_name,
      hour_meter: Number(editForm.hour_meter),
      date: editForm.date,
      status: editForm.status,
      observations: editForm.observations || null,
    }).eq('id', editChecklist.id);
    toast.success('Checklist atualizado!');
    setEditChecklist(null);
    fetchData();
  };

  const filtered = checklists.filter(cl => {
    if (filterEquipment !== 'all' && cl.equipment_id !== filterEquipment) return false;
    if (filterStatus !== 'all' && cl.status !== filterStatus) return false;
    if (search) {
      const s = search.toLowerCase();
      const eqNameStr = eqName(cl.equipment_id).toLowerCase();
      if (!cl.operator_name.toLowerCase().includes(s) && !eqNameStr.includes(s)) return false;
    }
    return true;
  });

  const getItemsSummary = (items: ChecklistItemDB[]) => {
    const ok = items.filter(i => i.checked && !i.na).length;
    const nc = items.filter(i => !i.checked && !i.na).length;
    const na = items.filter(i => i.na).length;
    return { ok, nc, na, total: items.length };
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-gradient">Checklists</h1>
          <p className="text-muted-foreground mt-1">Histórico de checklists realizados</p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card rounded-xl p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por operador ou equipamento..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <Select value={filterEquipment} onValueChange={setFilterEquipment}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Equipamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos equipamentos</SelectItem>
              {equipments.map(eq => (
                <SelectItem key={eq.id} value={eq.id}>{eqLabel(eq)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ok">OK</SelectItem>
              <SelectItem value="attention">Atenção</SelectItem>
              <SelectItem value="critical">Crítico</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-bold">Nenhum checklist encontrado</h2>
          <p className="text-muted-foreground text-sm mt-1">Nenhum registro corresponde aos filtros aplicados.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{filtered.length} registro{filtered.length !== 1 ? 's' : ''}</p>
          {filtered.map(cl => {
            const sc = statusConfig[cl.status] || statusConfig.ok;
            const StatusIcon = sc.icon;
            const summary = getItemsSummary(cl.items || []);
            return (
              <div key={cl.id} className="glass-card rounded-xl overflow-hidden">
                <div
                  className="p-4 cursor-pointer hover:bg-secondary/30 transition-colors"
                  onClick={() => setExpandedId(expandedId === cl.id ? null : cl.id)}
                >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-sm">{eqName(cl.equipment_id)}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${sc.bg} ${sc.color}`}>
                        <StatusIcon className="w-3 h-3 inline mr-0.5" />
                        {sc.label}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium">
                        {typeLabels[cl.type] || cl.type}
                      </span>
                      {expandedId === cl.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                      <span>Operador: {cl.operator_name}</span>
                      <span>Horímetro: {cl.hour_meter}h</span>
                      <span>Data: {new Date(cl.date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                      <span>Itens: {summary.ok}✓ {summary.nc > 0 ? `${summary.nc}✗` : ''}{summary.na > 0 ? ` ${summary.na}⊘` : ''} / {summary.total}</span>
                    </div>
                    {(cl as any).observations && (
                      <p className="text-xs text-muted-foreground italic mt-1">Obs: {(cl as any).observations}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          const eq = equipments.find(e => e.id === cl.equipment_id);
                          exportChecklistPDF({
                            equipmentName: eq ? eqLabel(eq) : '—',
                            plate: eq?.plate || undefined,
                            model: eq?.model || undefined,
                            brand: eq?.brand || undefined,
                            costCenter: eq?.cost_center || undefined,
                            year: eq?.year || undefined,
                            operatorName: cl.operator_name,
                            hourMeter: cl.hour_meter,
                            date: cl.date,
                            type: cl.type,
                            status: cl.status,
                            observations: (cl as any).observations || undefined,
                            photoUrl: cl.photo_url || undefined,
                            items: (cl.items || []).map((i: any) => ({ label: i.label, checked: i.checked, observation: i.observation })),
                          });
                        }}
                        className="text-muted-foreground hover:text-primary p-1.5 transition-colors"
                        title="Baixar PDF"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      {canEdit && (
                        <>
                          <button onClick={() => openEdit(cl)} className="text-muted-foreground hover:text-primary p-1.5 transition-colors">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button className="text-muted-foreground hover:text-destructive p-1.5 transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir checklist?</AlertDialogTitle>
                                <AlertDialogDescription>O registro será removido. Você poderá desfazer nos próximos segundos.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={async () => {
                                  const backup = { ...cl };
                                  await supabase.from('checklists').delete().eq('id', cl.id);
                                  fetchData();
                                  toast.success('Checklist excluído!', {
                                    action: { label: 'Desfazer', onClick: async () => {
                                      await supabase.from('checklists').insert(backup as any);
                                      fetchData();
                                      toast.success('Checklist restaurado!');
                                    }},
                                    duration: 8000,
                                  });
                                }}>Excluir</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                </div>
                </div>

                {/* Expanded detail */}
                {expandedId === cl.id && (
                  <div className="border-t border-border px-4 py-3 bg-secondary/20">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {(cl.items || []).map((item: any) => (
                        <div key={item.id} className="flex items-start gap-2 text-xs py-1">
                          {item.na ? (
                            <MinusCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                          ) : item.checked ? (
                            <CheckCircle className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                          )}
                          <div>
                            <span className={item.na ? 'text-muted-foreground line-through' : item.checked ? 'text-foreground' : 'text-destructive font-medium'}>{item.label}</span>
                            {item.observation && (
                              <p className="text-muted-foreground italic mt-0.5">"{item.observation}"</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {cl.photo_url && (
                      <div className="mt-3 pt-2 border-t border-border">
                        <a href={cl.photo_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                          <Camera className="w-3.5 h-3.5" /> Ver foto anexada
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editChecklist} onOpenChange={v => { if (!v) setEditChecklist(null); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Editar Checklist</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Operador *</Label><Input value={editForm.operator_name} onChange={e => setEditForm({...editForm, operator_name: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Horímetro *</Label><Input type="number" value={editForm.hour_meter} onChange={e => setEditForm({...editForm, hour_meter: e.target.value})} /></div>
              <div><Label>Data</Label><Input type="date" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} /></div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={v => setEditForm({...editForm, status: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ok">OK</SelectItem>
                  <SelectItem value="attention">Atenção</SelectItem>
                  <SelectItem value="critical">Crítico</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Observações</Label><Textarea value={editForm.observations} onChange={e => setEditForm({...editForm, observations: e.target.value})} rows={2} /></div>
            <Button onClick={handleSaveEdit} disabled={!editForm.operator_name || !editForm.hour_meter} className="w-full">Salvar Alterações</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
