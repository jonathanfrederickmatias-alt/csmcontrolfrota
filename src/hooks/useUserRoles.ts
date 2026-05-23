import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type AppRole = 'admin' | 'gestor' | 'mecanico' | 'abastecedor';

export function useUserRoles() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }

    const fetchRoles = async () => {
      const { data, error } = await supabase.rpc('get_my_roles');

      if (!error && data && data.length > 0) {
        setRoles(data as AppRole[]);
        setLoading(false);
        return;
      }

      const { data: directRoles, error: directError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (!directError && directRoles) {
        setRoles(directRoles.map((item) => item.role as AppRole));
      } else {
        setRoles([]);
      }

      setLoading(false);
    };

    fetchRoles();
  }, [user]);

  const hasRole = (role: AppRole) => roles.includes(role);
  const isAdmin = hasRole('admin');
  const isGestor = hasRole('gestor');
  const isMecanico = hasRole('mecanico');
  const isAbastecedor = hasRole('abastecedor');

  return { roles, loading, hasRole, isAdmin, isGestor, isMecanico, isAbastecedor };
}
