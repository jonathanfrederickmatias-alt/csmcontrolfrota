import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEquipments } from "@/hooks/useEquipments";
import { ChecklistTemplate, loadTemplates } from "@/hooks/useChecklistTemplate";
import { CHECKLIST_CATEGORIES, ChecklistTemplateItem, defaultItemsFor, detectCategory } from "@/lib/checklist-categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClipboardList, Plus, Trash2, ArrowUp, ArrowDown, Copy, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getMyTenantId } from "@/lib/tenant";

type Draft = { id?: string; category: string; name: string; items: ChecklistTemplateItem[] };

export default function ChecklistTemplatesPage() {
  const { equipments } = useEquipments();
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newGroup, setNewGroup] = useState("");

  const refresh = () => loadTemplates().then(setTemplates);
  useEffect(() => { refresh(); }, []);

  // Somente categorias realmente presentes na frota
  const categories = useMemo(() => {
    const counts: Record<string, number> = {};
    equipments.forEach((eq) => {
      const c = detectCategory(eq);
      counts[c.key] = (counts[c.key] || 0) + 1;
    });
    return CHECKLIST_CATEGORIES.filter((c) => counts[c.key]).map((c) => ({ ...c, count: counts[c.key] }));
  }, [equipments]);

  const openEditor = (categoryKey: string) => {
    const cat = CHECKLIST_CATEGORIES.find((c) => c.key === categoryKey)!;
    const tpl = templates.find((t) => t.category === categoryKey);
    setDraft({
      id: tpl?.id,
      category: categoryKey,
      name: tpl?.name || `Checklist ${cat.label}`,
      items: (tpl?.items?.length ? tpl.items : defaultItemsFor(categoryKey)).map((i) => ({ ...i })),
    });
  };

  const duplicateInto = (from: string, to: string) => {
    const src = templates.find((t) => t.category === from);
    const cat = CHECKLIST_CATEGORIES.find((c) => c.key === to)!;
    setDraft({
      id: templates.find((t) => t.category === to)?.id,
      category: to,
      name: `Checklist ${cat.label}`,
      items: (src?.items?.length ? src.items : defaultItemsFor(from)).map((i) => ({ ...i })),
    });
  };

  const move = (idx: number, dir: -1 | 1) => {
    if (!draft) return;
    const items = [...draft.items];
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    [items[idx], items[j]] = [items[j], items[idx]];
    setDraft({ ...draft, items });
  };

  const save = async () => {
    if (!draft) return;
    if (draft.items.length === 0) { toast.error("Adicione pelo menos um item."); return; }
    setSaving(true);
    const tenant_id = await getMyTenantId();
    const payload = { tenant_id, category: draft.category, name: draft.name, items: draft.items as unknown as never };
    const { error } = draft.id
      ? await supabase.from("checklist_templates").update({ name: draft.name, items: draft.items as unknown as never }).eq("id", draft.id)
      : await supabase.from("checklist_templates").insert([payload]);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Modelo salvo!");
    setDraft(null);
    refresh();
  };

  const removeTemplate = async (id: string) => {
    const { error } = await supabase.from("checklist_templates").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Modelo removido — volta ao padrão do sistema.");
    refresh();
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-gradient">Modelos de Checklist</h1>
        <p className="text-muted-foreground mt-1">
          Cada tipo de equipamento tem seu próprio checklist, aberto automaticamente pelo QR Code.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {categories.map((cat) => {
          const tpl = templates.find((t) => t.category === cat.key);
          const items = tpl?.items?.length ? tpl.items : defaultItemsFor(cat.key);
          return (
            <div key={cat.key} className="glass-card rounded-xl p-5 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-bold flex items-center gap-2"><ClipboardList className="w-4 h-4 text-primary" />{cat.label}</h2>
                  <p className="text-xs text-muted-foreground mt-1">{cat.count} equipamento(s) • {items.length} itens</p>
                </div>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${tpl ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                  {tpl ? "Personalizado" : "Padrão"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                <Button size="sm" onClick={() => openEditor(cat.key)}>Editar</Button>
                <Button size="sm" variant="outline" onClick={() => {
                  const from = window.prompt(`Duplicar de qual categoria? (${categories.map(c => c.key).join(", ")})`);
                  if (from && CHECKLIST_CATEGORIES.some(c => c.key === from)) duplicateInto(from, cat.key);
                }}>
                  <Copy className="w-3.5 h-3.5 mr-1" />Duplicar de...
                </Button>
                {tpl && (
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeTemplate(tpl.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Modelo</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div>
                <Label>Nome do modelo</Label>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>

              <div className="space-y-2">
                {draft.items.map((item, idx) => (
                  <div key={`${item.id}-${idx}`} className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-secondary/50">
                    <Input
                      className="h-8 w-32 text-xs"
                      placeholder="Grupo"
                      value={item.group || ""}
                      onChange={(e) => {
                        const items = [...draft.items];
                        items[idx] = { ...item, group: e.target.value };
                        setDraft({ ...draft, items });
                      }}
                    />
                    <Input
                      className="h-8 flex-1 min-w-[180px] text-sm"
                      value={item.label}
                      onChange={(e) => {
                        const items = [...draft.items];
                        items[idx] = { ...item, label: e.target.value };
                        setDraft({ ...draft, items });
                      }}
                    />
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => move(idx, -1)}><ArrowUp className="w-3.5 h-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => move(idx, 1)}><ArrowDown className="w-3.5 h-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="h-8 px-2 text-destructive" onClick={() => setDraft({ ...draft, items: draft.items.filter((_, i) => i !== idx) })}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 items-end">
                <div className="w-32">
                  <Label className="text-xs">Grupo</Label>
                  <Input className="h-9" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} placeholder="Motor" />
                </div>
                <div className="flex-1 min-w-[180px]">
                  <Label className="text-xs">Novo item</Label>
                  <Input className="h-9" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Descrição do item" />
                </div>
                <Button
                  className="h-9"
                  disabled={!newLabel.trim()}
                  onClick={() => {
                    setDraft({
                      ...draft,
                      items: [...draft.items, { id: `${Date.now()}`, label: newLabel.trim(), group: newGroup.trim() || "Geral" }],
                    });
                    setNewLabel("");
                  }}
                >
                  <Plus className="w-4 h-4 mr-1" />Adicionar
                </Button>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setDraft({ ...draft, items: defaultItemsFor(draft.category).map(i => ({ ...i })) })}>
                  Restaurar padrão
                </Button>
                <Button className="flex-1" onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Salvar modelo
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
