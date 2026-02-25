import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type AppRole = 'admin' | 'gestor' | 'mecanico' | 'abastecedor';

export function useUserRoles() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }

    supabase.rpc('get_my_roles').then(({ data, error }) => {
      if (!error && data) {
        setRoles(data as AppRole[]);
      }
      setLoading(false);
    });
  }, [user]);

  const hasRole = (role: AppRole) => roles.includes(role);
  const isAdmin = hasRole('admin');
  const isGestor = hasRole('gestor');
  const isMecanico = hasRole('mecanico');
  const isAbastecedor = hasRole('abastecedor');

  return { roles, loading, hasRole, isAdmin, isGestor, isMecanico, isAbastecedor };
}
