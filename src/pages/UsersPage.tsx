import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Key, Loader2, Users, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import type { AppRole } from '@/hooks/useUserRoles';

interface UserWithRole {
  user_id: string;
  display_name: string;
  email: string;
  roles: AppRole[];
  hasPin?: boolean;
}

const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Administrador',
  gestor: 'Gestor',
  mecanico: 'Mecânico',
  abastecedor: 'Abastecedor',
};

const ROLE_COLORS: Record<AppRole, string> = {
  admin: 'bg-destructive/20 text-destructive border-destructive/30',
  gestor: 'bg-primary/20 text-primary border-primary/30',
  mecanico: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  abastecedor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [newPin, setNewPin] = useState('');

  // New user form
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AppRole>('gestor');
  const [createPin, setCreatePin] = useState('');
  const [saving, setSaving] = useState(false);

  // Edit user form
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<AppRole>('gestor');
  const [editPassword, setEditPassword] = useState('');
  const [editPin, setEditPin] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from('profiles').select('*');
    const { data: allRoles } = await supabase.from('user_roles').select('*');
    const { data: pins } = await supabase.from('fuel_pins').select('user_id');

    if (profiles && allRoles) {
      const mapped: UserWithRole[] = profiles.map((p: any) => ({
        user_id: p.user_id,
        display_name: p.display_name,
        email: p.display_name,
        roles: allRoles.filter((r: any) => r.user_id === p.user_id).map((r: any) => r.role as AppRole),
        hasPin: !!pins?.find((pin: any) => pin.user_id === p.user_id),
      }));
      setUsers(mapped);
    }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreateUser = async () => {
    if (!email || !password || !displayName) {
      toast.error('Preencha todos os campos');
      return;
    }
    if (role === 'abastecedor' && (!createPin || createPin.length < 4)) {
      toast.error('PIN deve ter pelo menos 4 dígitos');
      return;
    }
    setSaving(true);

    const { data, error } = await supabase.functions.invoke('manage-users', {
      body: { action: 'create', email, password, displayName, role, pin: role === 'abastecedor' ? createPin : undefined },
    });

    if (error || data?.error) {
      toast.error(data?.error || 'Erro ao criar usuário');
    } else {
      toast.success('Usuário criado com sucesso!');
      setDialogOpen(false);
      setEmail(''); setPassword(''); setDisplayName(''); setRole('gestor'); setCreatePin('');
      fetchUsers();
    }
    setSaving(false);
  };

  const openEditDialog = (user: UserWithRole) => {
    setSelectedUser(user);
    setEditName(user.display_name);
    setEditRole(user.roles[0] || 'gestor');
    setEditPassword('');
    setEditPin(user.pin || '');
    setEditDialogOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!selectedUser || !editName) {
      toast.error('Nome é obrigatório');
      return;
    }
    if (editRole === 'abastecedor' && editPin && editPin.length < 4) {
      toast.error('PIN deve ter pelo menos 4 dígitos');
      return;
    }
    setSaving(true);

    const body: any = {
      action: 'update',
      userId: selectedUser.user_id,
      displayName: editName,
      role: editRole,
    };
    if (editPassword) body.password = editPassword;
    if (editRole === 'abastecedor' && editPin) body.pin = editPin;

    const { data, error } = await supabase.functions.invoke('manage-users', { body });

    if (error || data?.error) {
      toast.error(data?.error || 'Erro ao atualizar usuário');
    } else {
      toast.success('Usuário atualizado com sucesso!');
      setEditDialogOpen(false);
      fetchUsers();
    }
    setSaving(false);
  };

  const handleDeleteUser = async (userId: string, name: string) => {
    const { data, error } = await supabase.functions.invoke('manage-users', {
      body: { action: 'delete', userId },
    });

    if (error || data?.error) {
      toast.error(data?.error || 'Erro ao excluir usuário');
    } else {
      toast.success(`Usuário ${name} excluído com sucesso`);
      fetchUsers();
    }
  };

  const handleDeleteRole = async (userId: string, roleToDelete: AppRole) => {
    await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', roleToDelete);
    toast.success('Perfil removido');
    fetchUsers();
  };

  const handleUpdatePin = async () => {
    if (!selectedUser || !newPin || newPin.length < 4) {
      toast.error('PIN deve ter pelo menos 4 dígitos');
      return;
    }

    const { data: existing } = await supabase.from('fuel_pins').select('id').eq('user_id', selectedUser.user_id).maybeSingle();
    
    if (existing) {
      await supabase.from('fuel_pins').update({ pin: newPin }).eq('user_id', selectedUser.user_id);
    } else {
      const { getMyTenantId } = await import('@/lib/tenant');
      const tenant_id = await getMyTenantId();
      await supabase.from('fuel_pins').insert([{ tenant_id, user_id: selectedUser.user_id, pin: newPin }]);
    }

    toast.success('PIN atualizado!');
    setPinDialogOpen(false);
    setNewPin('');
    fetchUsers();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Gestão de Usuários
          </h1>
          <p className="text-muted-foreground text-sm">Criar, editar e atribuir perfis aos usuários</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Novo Usuário</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Novo Usuário</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Nome</Label>
                <Input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="João Silva" />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="joao@empresa.com" />
              </div>
              <div>
                <Label>Senha</Label>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" minLength={6} />
              </div>
              <div>
                <Label>Perfil</Label>
                <Select value={role} onValueChange={v => setRole(v as AppRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="gestor">Gestor</SelectItem>
                    <SelectItem value="mecanico">Mecânico</SelectItem>
                    <SelectItem value="abastecedor">Abastecedor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {role === 'abastecedor' && (
                <div>
                  <Label>PIN de Abastecimento *</Label>
                  <Input
                    value={createPin}
                    onChange={e => setCreatePin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Ex: 1234"
                    maxLength={6}
                    className="text-center text-2xl tracking-widest font-mono"
                  />
                </div>
              )}
              <Button onClick={handleCreateUser} className="w-full" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Criar Usuário
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Perfis</TableHead>
                <TableHead>PIN</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Nenhum usuário cadastrado
                  </TableCell>
                </TableRow>
              ) : users.map(u => (
                <TableRow key={u.user_id}>
                  <TableCell className="font-medium">{u.display_name}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {u.roles.map(r => (
                        <Badge key={r} variant="outline" className={`${ROLE_COLORS[r]} text-xs`}>
                          {ROLE_LABELS[r]}
                          <button
                            onClick={() => handleDeleteRole(u.user_id, r)}
                            className="ml-1 hover:text-destructive"
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                      {u.roles.length === 0 && (
                        <span className="text-xs text-muted-foreground">Sem perfil</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {u.roles.includes('abastecedor') ? (
                      <span className="text-xs font-mono">{u.pin || '----'}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(u)}
                        title="Editar usuário"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      {u.roles.includes('abastecedor') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setSelectedUser(u); setNewPin(u.pin || ''); setPinDialogOpen(true); }}
                        >
                          <Key className="w-4 h-4" />
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir <strong>{u.display_name}</strong>? Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => handleDeleteUser(u.user_id, u.display_name)}
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Nome</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nome do usuário" />
            </div>
            <div>
              <Label>Nova Senha (deixe em branco para manter)</Label>
              <Input type="password" value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder="••••••••" minLength={6} />
            </div>
            <div>
              <Label>Perfil</Label>
              <Select value={editRole} onValueChange={v => setEditRole(v as AppRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="gestor">Gestor</SelectItem>
                  <SelectItem value="mecanico">Mecânico</SelectItem>
                  <SelectItem value="abastecedor">Abastecedor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editRole === 'abastecedor' && (
              <div>
                <Label>PIN de Abastecimento</Label>
                <Input
                  value={editPin}
                  onChange={e => setEditPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Ex: 1234"
                  maxLength={6}
                  className="text-center text-2xl tracking-widest font-mono"
                />
              </div>
            )}
            <Button onClick={handleUpdateUser} className="w-full" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar Alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* PIN Dialog */}
      <Dialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar PIN - {selectedUser?.display_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Novo PIN</Label>
              <Input
                value={newPin}
                onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="1234"
                maxLength={6}
                className="text-center text-2xl tracking-widest font-mono"
              />
            </div>
            <Button onClick={handleUpdatePin} className="w-full">Salvar PIN</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
