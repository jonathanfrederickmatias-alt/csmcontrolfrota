import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChecklistTemplateItem, defaultItemsFor, detectCategory } from '@/lib/checklist-categories';
import { DBEquipment } from '@/lib/supabase-types';

const CACHE_KEY = 'csm_checklist_templates';

export type ChecklistTemplate = {
  id: string;
  category: string;
  name: string;
  items: ChecklistTemplateItem[];
};

export async function loadTemplates(): Promise<ChecklistTemplate[]> {
  try {
    const { data, error } = await supabase.from('checklist_templates').select('id, category, name, items');
    if (error) throw error;
    const list = (data || []) as unknown as ChecklistTemplate[];
    localStorage.setItem(CACHE_KEY, JSON.stringify(list));
    return list;
  } catch {
    try {
      return JSON.parse(localStorage.getItem(CACHE_KEY) || '[]') as ChecklistTemplate[];
    } catch {
      return [];
    }
  }
}

/** Retorna os itens do checklist correto para o equipamento informado. */
export function useChecklistTemplate(equipment?: DBEquipment | null) {
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplates().then((t) => {
      setTemplates(t);
      setLoading(false);
    });
  }, []);

  const category = equipment ? detectCategory(equipment) : null;
  const template = category ? templates.find((t) => t.category === category.key) : null;
  const items: ChecklistTemplateItem[] = category
    ? template?.items?.length
      ? template.items
      : defaultItemsFor(category.key)
    : [];

  return {
    loading,
    category,
    templateName: template?.name || (category ? `Checklist ${category.label}` : ''),
    items,
    templates,
  };
}
