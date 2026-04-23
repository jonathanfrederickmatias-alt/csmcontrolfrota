import { type ReactNode, useState } from "react";
import { Building2, CalendarClock, ChevronRight, ClipboardList, Eye, PlayCircle, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
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
import { DBEquipment, DBWorkOrder } from "@/lib/supabase-types";

type PriorityOption = {
  label: string;
  bg: string;
};

type StatusOption = {
  label: string;
  bg: string;
};

type PremiumOsWorkspaceProps = {
  equipments: DBEquipment[];
  filteredOrders: DBWorkOrder[];
  canEdit: boolean;
  osFilter: string;
  osStatusFilter: string;
  onOsFilterChange: (value: string) => void;
  onOsStatusFilterChange: (value: string) => void;
  onOpenExecution: (order: DBWorkOrder) => void;
  onOpenEdit: (order: DBWorkOrder) => void;
  onAssignMechanic: (order: DBWorkOrder) => void;
  priorityConfig: Record<string, PriorityOption>;
  osStatusConfig: Record<string, StatusOption>;
  renderToolbar: ReactNode;
};

function eqLabel(eq: DBEquipment) {
  const id = eq.cost_center || eq.plate || "";
  return id ? `${eq.name} (${id})` : eq.name;
}

export function PremiumOsWorkspace({
  equipments,
  filteredOrders,
  canEdit,
  osFilter,
  osStatusFilter,
  onOsFilterChange,
  onOsStatusFilterChange,
  onOpenExecution,
  onOpenEdit,
  onAssignMechanic,
  priorityConfig,
  osStatusConfig,
  renderToolbar,
}: PremiumOsWorkspaceProps) {
  const [selectedOrder, setSelectedOrder] = useState<DBWorkOrder | null>(null);

  const totalOrders = filteredOrders.length;
  const openOrders = filteredOrders.filter((order) => order.status === "open").length;
  const inProgressOrders = filteredOrders.filter((order) => order.status === "in_progress").length;
  const criticalOrders = filteredOrders.filter((order) => order.priority === "high" || order.priority === "urgent").length;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border/70 bg-card px-4 py-4 shadow-sm sm:px-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-primary">
              <ClipboardList className="h-3.5 w-3.5" /> Centro de ordens de serviço
            </div>
            <div>
              <h2 className="text-xl font-black text-foreground">Fila híbrida com leitura executiva e ação imediata</h2>
              <p className="text-sm text-muted-foreground">Tabela principal para gestão rápida e cards operacionais para despacho e acompanhamento em campo.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[520px]">
            <Card className="border-border/70 shadow-none"><CardContent className="p-4"><p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Na fila</p><p className="mt-2 text-2xl font-black text-foreground">{totalOrders}</p></CardContent></Card>
            <Card className="border-border/70 shadow-none"><CardContent className="p-4"><p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Abertas</p><p className="mt-2 text-2xl font-black text-warning">{openOrders}</p></CardContent></Card>
            <Card className="border-border/70 shadow-none"><CardContent className="p-4"><p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Em execução</p><p className="mt-2 text-2xl font-black text-primary">{inProgressOrders}</p></CardContent></Card>
            <Card className="border-border/70 shadow-none"><CardContent className="p-4"><p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Críticas</p><p className="mt-2 text-2xl font-black text-destructive">{criticalOrders}</p></CardContent></Card>
          </div>
        </div>
      </div>

      <div className="sticky top-16 z-20 space-y-3 rounded-lg border border-border/70 bg-background/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:top-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Select value={osFilter} onValueChange={onOsFilterChange}>
              <SelectTrigger className="w-full sm:w-64"><SelectValue placeholder="Filtrar por equipamento" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os equipamentos</SelectItem>
                {equipments.map((eq) => <SelectItem key={eq.id} value={eq.id}>{eqLabel(eq)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={osStatusFilter} onValueChange={onOsStatusFilterChange}>
              <SelectTrigger className="w-full sm:w-52"><SelectValue placeholder="Filtrar por status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="open">Aberta</SelectItem>
                <SelectItem value="in_progress">Em andamento</SelectItem>
                <SelectItem value="done">Concluída</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">{renderToolbar}</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm">
        <div className="hidden lg:block">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/30 hover:bg-secondary/30">
                <TableHead>OS</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Equipamento</TableHead>
                <TableHead>Problema</TableHead>
                <TableHead>Mecânico</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => {
                const equipment = equipments.find((eq) => eq.id === order.equipment_id);
                const priority = priorityConfig[order.priority] || priorityConfig.medium;
                const status = osStatusConfig[order.status] || osStatusConfig.open;

                return (
                  <TableRow key={order.id} className="hover:bg-secondary/20">
                    <TableCell className="font-mono font-bold text-foreground">#{order.os_number}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className={status.bg}>{status.label}</Badge>
                        <Badge variant="outline" className={priority.bg}>{priority.label}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">{equipment ? eqLabel(equipment) : "—"}</TableCell>
                    <TableCell className="max-w-[360px]"><p className="line-clamp-2 text-sm text-muted-foreground">{order.description}</p></TableCell>
                    <TableCell>{order.mechanic_name || "Sem mecânico"}</TableCell>
                    <TableCell>{new Date(order.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant={order.status === "open" ? "default" : "outline"} onClick={() => onOpenExecution(order)}>
                          {order.status === "open" ? "Iniciar serviço" : "Ver detalhes"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setSelectedOrder(order)}>Painel lateral</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-3 p-3 lg:hidden">
          {filteredOrders.map((order) => {
            const equipment = equipments.find((eq) => eq.id === order.equipment_id);
            const priority = priorityConfig[order.priority] || priorityConfig.medium;
            const status = osStatusConfig[order.status] || osStatusConfig.open;

            return (
              <div key={order.id} className="rounded-lg border border-border/70 bg-card p-4 shadow-sm">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="border-border bg-secondary/40 text-foreground">OS #{order.os_number}</Badge>
                    <Badge variant="outline" className={status.bg}>{status.label}</Badge>
                    <Badge variant="outline" className={priority.bg}>{priority.label}</Badge>
                  </div>
                  <div>
                    <p className="text-base font-black text-foreground">{equipment ? eqLabel(equipment) : "—"}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{order.description}</p>
                  </div>
                  <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                    <div className="flex items-center gap-2"><UserRound className="h-3.5 w-3.5 text-primary" />{order.mechanic_name || "Sem mecânico"}</div>
                    <div className="flex items-center gap-2"><CalendarClock className="h-3.5 w-3.5 text-primary" />{new Date(order.created_at).toLocaleDateString("pt-BR")}</div>
                    <div className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5 text-primary" />{equipment?.plate || equipment?.cost_center || "Sem identificação"}</div>
                  </div>
                  <div className="grid gap-2">
                    <Button className="h-12 justify-between" onClick={() => onOpenExecution(order)}>
                      <span className="inline-flex items-center gap-2"><PlayCircle className="h-4 w-4" /> {order.status === "open" ? "Iniciar serviço" : "Ver detalhes"}</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" className="h-11 justify-between" onClick={() => onAssignMechanic(order)}>
                        <span className="inline-flex items-center gap-2"><UserRound className="h-4 w-4" /> Atribuir</span>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button variant="secondary" className="h-11 justify-between" onClick={() => setSelectedOrder(order)}>
                        <span className="inline-flex items-center gap-2"><Eye className="h-4 w-4" /> Painel</span>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Drawer open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DrawerContent className="max-h-[88vh]">
          {selectedOrder && (
            <div className="mx-auto w-full max-w-3xl">
              <DrawerHeader>
                <DrawerTitle>OS #{selectedOrder.os_number}</DrawerTitle>
                <DrawerDescription>Detalhes rápidos, contexto do equipamento e ações sem sair da fila.</DrawerDescription>
              </DrawerHeader>
              <div className="space-y-4 px-4 pb-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Card className="border-border/70 shadow-sm"><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Equipamento</p><p className="mt-2 text-base font-black text-foreground">{equipments.find((eq) => eq.id === selectedOrder.equipment_id)?.name || "—"}</p><p className="mt-1 text-sm text-muted-foreground">{selectedOrder.description}</p></CardContent></Card>
                  <Card className="border-border/70 shadow-sm"><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Execução</p><div className="mt-2 flex flex-wrap gap-2"><Badge variant="outline" className={(osStatusConfig[selectedOrder.status] || osStatusConfig.open).bg}>{(osStatusConfig[selectedOrder.status] || osStatusConfig.open).label}</Badge><Badge variant="outline" className={(priorityConfig[selectedOrder.priority] || priorityConfig.medium).bg}>{(priorityConfig[selectedOrder.priority] || priorityConfig.medium).label}</Badge></div><p className="mt-3 text-sm text-muted-foreground">Mecânico: {selectedOrder.mechanic_name || "Não atribuído"}</p></CardContent></Card>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Card className="border-border/70 shadow-sm"><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Data de abertura</p><p className="mt-2 text-sm font-semibold text-foreground">{new Date(selectedOrder.created_at).toLocaleString("pt-BR")}</p></CardContent></Card>
                  <Card className="border-border/70 shadow-sm"><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Identificação</p><p className="mt-2 text-sm font-semibold text-foreground">{equipments.find((eq) => eq.id === selectedOrder.equipment_id)?.plate || equipments.find((eq) => eq.id === selectedOrder.equipment_id)?.cost_center || "—"}</p></CardContent></Card>
                  <Card className="border-border/70 shadow-sm"><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Situação</p><p className="mt-2 text-sm font-semibold text-foreground">{selectedOrder.started_at ? "Com rastreabilidade ativa" : "Aguardando início"}</p></CardContent></Card>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button className="h-12 justify-between" onClick={() => { onOpenExecution(selectedOrder); setSelectedOrder(null); }}>
                    <span className="inline-flex items-center gap-2"><PlayCircle className="h-4 w-4" /> Abrir execução</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  {canEdit ? (
                    <Button variant="outline" className="h-12 justify-between" onClick={() => { onOpenEdit(selectedOrder); setSelectedOrder(null); }}>
                      <span className="inline-flex items-center gap-2"><UserRound className="h-4 w-4" /> Atribuir/editar</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button variant="outline" className="h-12 justify-between" onClick={() => { onAssignMechanic(selectedOrder); setSelectedOrder(null); }}>
                      <span className="inline-flex items-center gap-2"><UserRound className="h-4 w-4" /> Ver responsável</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}