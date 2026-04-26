import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Loader2, ArrowRightLeft, ShieldAlert, Users } from "lucide-react";
import { toast } from "sonner";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
  user_count?: number;
}

interface UserRow {
  user_id: string;
  display_name: string;
  tenant_id: string | null;
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
}

export default function TenantsPage() {
  const { isAdmin, loading: rolesLoading } = useUserRoles();

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  // create tenant dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [creating, setCreating] = useState(false);

  // assign user dialog
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignUserId, setAssignUserId] = useState<string>("");
  const [assignTenantId, setAssignTenantId] = useState<string>("");
  const [assigning, setAssigning] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [tenantsRes, profilesRes] = await Promise.all([
      supabase.rpc("list_my_tenants"),
      supabase.from("profiles").select("user_id, display_name, tenant_id"),
    ]);

    const tenantsData = (tenantsRes.data || []) as Tenant[];
    const profilesData = (profilesRes.data || []) as UserRow[];

    // Count users per tenant
    const counts = profilesData.reduce<Record<string, number>>((acc, p) => {
      if (p.tenant_id) acc[p.tenant_id] = (acc[p.tenant_id] || 0) + 1;
      return acc;
    }, {});

    setTenants(tenantsData.map((t) => ({ ...t, user_count: counts[t.id] || 0 })));
    setUsers(profilesData);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!rolesLoading) fetchData();
  }, [rolesLoading, fetchData]);

  const handleCreateTenant = async () => {
    if (!newName.trim()) {
      toast.error("Informe o nome da empresa");
      return;
    }
    const slug = newSlug.trim() || slugify(newName);
    if (!slug) {
      toast.error("Slug inválido");
      return;
    }
    setCreating(true);
    const { data, error } = await supabase.rpc("admin_create_tenant", {
      _name: newName.trim(),
      _slug: slug,
    });
    setCreating(false);

    if (error) {
      toast.error(error.message || "Não foi possível criar a empresa");
      return;
    }

    toast.success(`Empresa "${newName.trim()}" criada`);
    setCreateOpen(false);
    setNewName("");
    setNewSlug("");
    await fetchData();
  };

  const handleAssignUser = async () => {
    if (!assignUserId || !assignTenantId) {
      toast.error("Selecione usuário e empresa");
      return;
    }
    setAssigning(true);
    const { error } = await supabase.rpc("admin_assign_user_to_tenant", {
      _user_id: assignUserId,
      _tenant_id: assignTenantId,
    });
    setAssigning(false);

    if (error) {
      toast.error(error.message || "Não foi possível mover o usuário");
      return;
    }

    toast.success("Usuário movido para a nova empresa");
    setAssignOpen(false);
    setAssignUserId("");
    setAssignTenantId("");
    await fetchData();
  };

  if (rolesLoading || loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <Card className="mx-auto mt-12 max-w-lg border-destructive/40">
        <CardHeader>
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-6 w-6 text-destructive" />
            <CardTitle>Acesso restrito</CardTitle>
          </div>
          <CardDescription>
            Apenas super-administradores podem gerenciar empresas-clientes.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const tenantNameById = new Map(tenants.map((t) => [t.id, t.name]));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Building2 className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-black tracking-tight lg:text-3xl">
              Empresas-clientes
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestão multi-tenant. Cada empresa enxerga apenas os próprios dados.
          </p>
        </div>

        <div className="flex gap-2">
          <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <ArrowRightLeft className="h-4 w-4" />
                Mover usuário
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Mover usuário entre empresas</DialogTitle>
                <DialogDescription>
                  O usuário e seus papéis (perfis de acesso) serão transferidos
                  para a empresa selecionada.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Usuário</Label>
                  <Select value={assignUserId} onValueChange={setAssignUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um usuário" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.user_id} value={u.user_id}>
                          {u.display_name}
                          {u.tenant_id && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({tenantNameById.get(u.tenant_id) || "—"})
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Empresa de destino</Label>
                  <Select value={assignTenantId} onValueChange={setAssignTenantId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {tenants.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAssignOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAssignUser} disabled={assigning}>
                  {assigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Mover usuário
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Nova empresa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cadastrar nova empresa-cliente</DialogTitle>
                <DialogDescription>
                  Cria um novo tenant isolado. Os dados não serão compartilhados
                  com outras empresas.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tenant-name">Nome da empresa *</Label>
                  <Input
                    id="tenant-name"
                    placeholder="Ex: ABC Terraplanagem"
                    value={newName}
                    onChange={(e) => {
                      setNewName(e.target.value);
                      if (!newSlug) setNewSlug(slugify(e.target.value));
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tenant-slug">
                    Identificador único (slug)
                  </Label>
                  <Input
                    id="tenant-slug"
                    placeholder="abc-terraplanagem"
                    value={newSlug}
                    onChange={(e) => setNewSlug(slugify(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Gerado automaticamente a partir do nome. Apenas letras
                    minúsculas, números e hífens.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateTenant} disabled={creating}>
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar empresa
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total de empresas</CardDescription>
            <CardTitle className="text-3xl">{tenants.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Empresas ativas</CardDescription>
            <CardTitle className="text-3xl">
              {tenants.filter((t) => t.status === "ACTIVE").length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total de usuários</CardDescription>
            <CardTitle className="text-3xl">{users.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sem empresa vinculada</CardDescription>
            <CardTitle className="text-3xl">
              {users.filter((u) => !u.tenant_id).length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" /> Empresas cadastradas
          </CardTitle>
          <CardDescription>
            Cada linha é uma empresa-cliente isolada. Os usuários só veem dados
            da própria empresa.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Usuários</TableHead>
                <TableHead>Criada em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-semibold">{t.name}</TableCell>
                  <TableCell>
                    <code className="rounded bg-muted px-2 py-0.5 text-xs">
                      {t.slug}
                    </code>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={t.status === "ACTIVE" ? "default" : "secondary"}
                    >
                      {t.status === "ACTIVE" ? "Ativa" : t.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center gap-1 text-sm">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      {t.user_count ?? 0}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                </TableRow>
              ))}
              {tenants.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-8 text-center text-muted-foreground"
                  >
                    Nenhuma empresa cadastrada ainda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Usuários e suas empresas
          </CardTitle>
          <CardDescription>
            Visão de qual usuário pertence a qual empresa.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Empresa atual</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell className="font-medium">{u.display_name}</TableCell>
                  <TableCell>
                    {u.tenant_id ? (
                      <Badge variant="outline">
                        {tenantNameById.get(u.tenant_id) || "—"}
                      </Badge>
                    ) : (
                      <Badge variant="destructive">Sem empresa</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
