import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DBEquipment } from '@/lib/supabase-types';
import { getMyTenantId } from '@/lib/tenant';

export function useEquipments() {
  const [equipments, setEquipments] = useState<DBEquipment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const { data } = await supabase.from('equipments').select('*').order('created_at', { ascending: true });
    if (data) setEquipments(data as DBEquipment[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const save = async (eq: Omit<DBEquipment, 'id' | 'created_at' | 'updated_at' | 'tenant_id'>) => {
    const tenant_id = await getMyTenantId();
    const { error } = await supabase.from('equipments').insert([{ ...eq, tenant_id }]);
    if (!error) fetch();
    return error;
  };

  const update = async (id: string, eq: Partial<DBEquipment>) => {
    const { error } = await supabase.from('equipments').update(eq).eq('id', id);
    if (!error) fetch();
    return error;
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('equipments').delete().eq('id', id);
    if (!error) fetch();
    return error;
  };

  return { equipments, loading, refresh: fetch, save, update, remove };
}
