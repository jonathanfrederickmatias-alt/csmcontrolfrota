import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useBranding } from "@/contexts/BrandingContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Settings,
  ShieldAlert,
  Save,
  Palette,
  Building2,
  BellRing,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import logoDefault from "@/assets/logo-default.png";

const DEFAULT_PRIMARY = "#003B73";
const DEFAULT_SECONDARY = "#0F172A";
const DEFAULT_ALERT = "#DC2626";

const TIPO_EMPRESA_OPTIONS = [
  "Construtora",
  "Transportadora",
  "Locadora",
  "Pavimentação",
  "Terraplanagem",
  "Usina",
  "Outro",
];

const FUSO_OPTIONS = [
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Cuiaba",
  "America/Belem",
  "America/Fortaleza",
  "America/Recife",
  "America/Bahia",
  "America/Rio_Branco",
];

const ESTADOS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

function isHex(value: string) {
  return /^#([0-9a-fA-F]{6})$/.test(value.trim());
}
function isEmail(value: string) {
  if (!value.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
/** Validador de CNPJ com dígitos verificadores. */
function isCnpj(value: string) {
  if (!value.trim()) return true;
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 14) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  const calc = (base: string, factors: number[]) => {
    const sum = factors.reduce((acc, f, i) => acc + parseInt(base[i], 10) * f, 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const f1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const f2 = [6, ...f1];
  const d1 = calc(digits.slice(0, 12), f1);
  const d2 = calc(digits.slice(0, 13), f2);
  return d1 === parseInt(digits[12], 10) && d2 === parseInt(digits[13], 10);
}
function formatCnpj(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

type FormState = {
  // identidade
  nome_exibicao: string;
  logo_url: string;
  favicon_url: string;
  cor_primaria: string;
  cor_secundaria: string;
  cor_alerta: string;
  // dados
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  inscricao_estadual: string;
  telefone: string;
  whatsapp: string;
  email_admin: string;
  site: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
  // operação
  tipo_empresa: string;
  responsavel_principal: string;
  email_alertas: string;
  whatsapp_alertas: string;
  horario_operacao: string;
  fuso_horario: string;
  moeda: string;
  // relatórios
  relatorio_mostrar_logo: boolean;
  relatorio_mostrar_cnpj: boolean;
  relatorio_rodape: string;
  relatorio_assinatura: string;
};

const EMPTY_FORM: FormState = {
  nome_exibicao: "",
  logo_url: "",
  favicon_url: "",
  cor_primaria: DEFAULT_PRIMARY,
  cor_secundaria: DEFAULT_SECONDARY,
  cor_alerta: DEFAULT_ALERT,
  razao_social: "",
  nome_fantasia: "",
  cnpj: "",
  inscricao_estadual: "",
  telefone: "",
  whatsapp: "",
  email_admin: "",
  site: "",
  endereco: "",
  cidade: "",
  estado: "",
  cep: "",
  tipo_empresa: "",
  responsavel_principal: "",
  email_alertas: "",
  whatsapp_alertas: "",
  horario_operacao: "",
  fuso_horario: "America/Sao_Paulo",
  moeda: "BRL",
  relatorio_mostrar_logo: true,
  relatorio_mostrar_cnpj: true,
  relatorio_rodape: "",
  relatorio_assinatura: "",
};

export default function CompanySettingsPage() {
  const { isAdmin, loading: rolesLoading } = useUserRoles();
  const { branding, loading: brandingLoading, refresh } = useBranding();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!branding) return;
    setForm({
      nome_exibicao: branding.nome_exibicao || branding.name || "",
      logo_url: branding.logo_url || "",
      favicon_url: branding.favicon_url || "",
      cor_primaria: branding.cor_primaria || DEFAULT_PRIMARY,
      cor_secundaria: branding.cor_secundaria || DEFAULT_SECONDARY,
      cor_alerta: branding.cor_alerta || DEFAULT_ALERT,
      razao_social: branding.razao_social || "",
      nome_fantasia: branding.nome_fantasia || "",
      cnpj: branding.cnpj || "",
      inscricao_estadual: branding.inscricao_estadual || "",
      telefone: branding.telefone || "",
      whatsapp: branding.whatsapp || "",
      email_admin: branding.email_admin || "",
      site: branding.site || "",
      endereco: branding.endereco || "",
      cidade: branding.cidade || "",
      estado: branding.estado || "",
      cep: branding.cep || "",
      tipo_empresa: branding.tipo_empresa || "",
      responsavel_principal: branding.responsavel_principal || "",
      email_alertas: branding.email_alertas || "",
      whatsapp_alertas: branding.whatsapp_alertas || "",
      horario_operacao: branding.horario_operacao || "",
      fuso_horario: branding.fuso_horario || "America/Sao_Paulo",
      moeda: branding.moeda || "BRL",
      relatorio_mostrar_logo: branding.relatorio_mostrar_logo ?? true,
      relatorio_mostrar_cnpj: branding.relatorio_mostrar_cnpj ?? true,
      relatorio_rodape: branding.relatorio_rodape || "",
      relatorio_assinatura: branding.relatorio_assinatura || "",
    });
  }, [branding]);

  const previewLogo = useMemo(
    () => form.logo_url.trim() || logoDefault,
    [form.logo_url]
  );

  if (rolesLoading || brandingLoading) {
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
            Apenas administradores podem alterar as configurações da empresa.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!form.nome_exibicao.trim()) {
      toast.error("Informe o nome de exibição");
      return;
    }
    for (const [label, val] of [
      ["Cor primária", form.cor_primaria],
      ["Cor secundária", form.cor_secundaria],
      ["Cor de alerta", form.cor_alerta],
    ] as const) {
      if (!isHex(val)) {
        toast.error(`${label} inválida — use formato #RRGGBB`);
        return;
      }
    }
    if (!isCnpj(form.cnpj)) {
      toast.error("CNPJ inválido");
      return;
    }
    if (!isEmail(form.email_admin)) {
      toast.error("E-mail administrativo inválido");
      return;
    }
    if (!isEmail(form.email_alertas)) {
      toast.error("E-mail para alertas inválido");
      return;
    }

    setSaving(true);
    const { error } = await supabase.rpc("update_my_tenant_branding", {
      _nome_exibicao: form.nome_exibicao.trim(),
      _logo_url: form.logo_url.trim() || null,
      _favicon_url: form.favicon_url.trim() || null,
      _cor_primaria: form.cor_primaria.trim(),
      _cor_secundaria: form.cor_secundaria.trim(),
      _cor_alerta: form.cor_alerta.trim(),
      _razao_social: form.razao_social.trim() || null,
      _nome_fantasia: form.nome_fantasia.trim() || null,
      _cnpj: form.cnpj.trim() || null,
      _inscricao_estadual: form.inscricao_estadual.trim() || null,
      _telefone: form.telefone.trim() || null,
      _whatsapp: form.whatsapp.trim() || null,
      _email_admin: form.email_admin.trim() || null,
      _site: form.site.trim() || null,
      _endereco: form.endereco.trim() || null,
      _cidade: form.cidade.trim() || null,
      _estado: form.estado.trim() || null,
      _cep: form.cep.trim() || null,
      _tipo_empresa: form.tipo_empresa.trim() || null,
      _responsavel_principal: form.responsavel_principal.trim() || null,
      _email_alertas: form.email_alertas.trim() || null,
      _whatsapp_alertas: form.whatsapp_alertas.trim() || null,
      _horario_operacao: form.horario_operacao.trim() || null,
      _fuso_horario: form.fuso_horario.trim() || "America/Sao_Paulo",
      _moeda: form.moeda.trim() || "BRL",
      _relatorio_mostrar_logo: form.relatorio_mostrar_logo,
      _relatorio_mostrar_cnpj: form.relatorio_mostrar_cnpj,
      _relatorio_rodape: form.relatorio_rodape.trim() || null,
      _relatorio_assinatura: form.relatorio_assinatura.trim() || null,
    });
    setSaving(false);

    if (error) {
      toast.error(error.message || "Não foi possível salvar");
      return;
    }
    toast.success("Configurações salvas com sucesso");
    await refresh();
  };

  return (
    <div className="space-y-6 pb-28">
      <div className="flex items-center gap-3">
        <Settings className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-black tracking-tight lg:text-3xl">
            Configurações da Empresa
          </h1>
          <p className="text-sm text-muted-foreground">
            Personalize identidade, dados cadastrais, alertas e relatórios.
          </p>
        </div>
      </div>

      <Tabs defaultValue="identidade" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="identidade" className="gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Identidade visual</span>
            <span className="sm:hidden">Visual</span>
          </TabsTrigger>
          <TabsTrigger value="dados" className="gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Dados da empresa</span>
            <span className="sm:hidden">Dados</span>
          </TabsTrigger>
          <TabsTrigger value="operacao" className="gap-2">
            <BellRing className="h-4 w-4" />
            <span className="hidden sm:inline">Alertas e operação</span>
            <span className="sm:hidden">Alertas</span>
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="gap-2">
            <FileText className="h-4 w-4" />
            <span>Relatórios</span>
          </TabsTrigger>
        </TabsList>

        {/* IDENTIDADE */}
        <TabsContent value="identidade" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <Card>
              <CardHeader>
                <CardTitle>Identidade visual</CardTitle>
                <CardDescription>
                  Logo, ícone e cores exibidos no sistema.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <Field label="Nome de exibição" required>
                  <Input
                    value={form.nome_exibicao}
                    onChange={(e) => update("nome_exibicao", e.target.value)}
                    placeholder="Ex: Engenat Construções"
                  />
                </Field>
                <Field label="URL do logo" hint="Vazio = logo neutro do sistema">
                  <Input
                    value={form.logo_url}
                    onChange={(e) => update("logo_url", e.target.value)}
                    placeholder="https://exemplo.com/logo.png"
                    inputMode="url"
                  />
                </Field>
                <Field label="URL do favicon (ícone do navegador)">
                  <Input
                    value={form.favicon_url}
                    onChange={(e) => update("favicon_url", e.target.value)}
                    placeholder="https://exemplo.com/favicon.png"
                    inputMode="url"
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-3">
                  <ColorField
                    label="Cor primária"
                    value={form.cor_primaria}
                    onChange={(v) => update("cor_primaria", v)}
                  />
                  <ColorField
                    label="Cor secundária"
                    value={form.cor_secundaria}
                    onChange={(v) => update("cor_secundaria", v)}
                  />
                  <ColorField
                    label="Cor de alerta"
                    value={form.cor_alerta}
                    onChange={(v) => update("cor_alerta", v)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pré-visualização do header</CardTitle>
                <CardDescription>
                  Como aparece no topo do sistema.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  className="rounded-lg border border-border p-4"
                  style={{
                    background: `linear-gradient(135deg, ${form.cor_primaria}10, transparent)`,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={previewLogo}
                      alt="Logo"
                      className="h-12 w-16 object-contain"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = logoDefault;
                      }}
                    />
                    <div>
                      <p className="text-sm font-black leading-tight">
                        {form.nome_exibicao || "Sua empresa"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Gestão de Frota & Manutenção
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Paleta
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <Swatch label="Primária" color={form.cor_primaria} />
                    <Swatch label="Secundária" color={form.cor_secundaria} />
                    <Swatch label="Alerta" color={form.cor_alerta} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* DADOS */}
        <TabsContent value="dados" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dados cadastrais</CardTitle>
              <CardDescription>
                Informações fiscais e de contato da empresa.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 md:grid-cols-2">
              <Field label="Razão social">
                <Input
                  value={form.razao_social}
                  onChange={(e) => update("razao_social", e.target.value)}
                />
              </Field>
              <Field label="Nome fantasia">
                <Input
                  value={form.nome_fantasia}
                  onChange={(e) => update("nome_fantasia", e.target.value)}
                />
              </Field>
              <Field label="CNPJ">
                <Input
                  value={form.cnpj}
                  onChange={(e) => update("cnpj", formatCnpj(e.target.value))}
                  placeholder="00.000.000/0000-00"
                  inputMode="numeric"
                />
              </Field>
              <Field label="Inscrição estadual">
                <Input
                  value={form.inscricao_estadual}
                  onChange={(e) =>
                    update("inscricao_estadual", e.target.value)
                  }
                />
              </Field>
              <Field label="Telefone">
                <Input
                  value={form.telefone}
                  onChange={(e) => update("telefone", e.target.value)}
                  placeholder="(00) 0000-0000"
                  inputMode="tel"
                />
              </Field>
              <Field label="WhatsApp">
                <Input
                  value={form.whatsapp}
                  onChange={(e) => update("whatsapp", e.target.value)}
                  placeholder="(00) 90000-0000"
                  inputMode="tel"
                />
              </Field>
              <Field label="E-mail administrativo">
                <Input
                  value={form.email_admin}
                  onChange={(e) => update("email_admin", e.target.value)}
                  placeholder="contato@empresa.com.br"
                  inputMode="email"
                />
              </Field>
              <Field label="Site">
                <Input
                  value={form.site}
                  onChange={(e) => update("site", e.target.value)}
                  placeholder="https://www.empresa.com.br"
                  inputMode="url"
                />
              </Field>
              <Field label="Endereço completo" className="md:col-span-2">
                <Input
                  value={form.endereco}
                  onChange={(e) => update("endereco", e.target.value)}
                  placeholder="Rua, número, bairro"
                />
              </Field>
              <Field label="Cidade">
                <Input
                  value={form.cidade}
                  onChange={(e) => update("cidade", e.target.value)}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Estado">
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.estado}
                    onChange={(e) => update("estado", e.target.value)}
                  >
                    <option value="">—</option>
                    {ESTADOS.map((uf) => (
                      <option key={uf} value={uf}>
                        {uf}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="CEP">
                  <Input
                    value={form.cep}
                    onChange={(e) => update("cep", e.target.value)}
                    placeholder="00000-000"
                    inputMode="numeric"
                  />
                </Field>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* OPERAÇÃO */}
        <TabsContent value="operacao" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Alertas e operação</CardTitle>
              <CardDescription>
                Quem recebe alertas, fuso horário e moeda padrão.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 md:grid-cols-2">
              <Field label="Tipo de empresa">
                <Select
                  value={form.tipo_empresa}
                  onValueChange={(v) => update("tipo_empresa", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione…" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPO_EMPRESA_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Responsável principal">
                <Input
                  value={form.responsavel_principal}
                  onChange={(e) =>
                    update("responsavel_principal", e.target.value)
                  }
                  placeholder="Nome do gestor"
                />
              </Field>
              <Field label="E-mail para receber alertas">
                <Input
                  value={form.email_alertas}
                  onChange={(e) => update("email_alertas", e.target.value)}
                  inputMode="email"
                  placeholder="alertas@empresa.com.br"
                />
              </Field>
              <Field label="WhatsApp para alertas">
                <Input
                  value={form.whatsapp_alertas}
                  onChange={(e) => update("whatsapp_alertas", e.target.value)}
                  inputMode="tel"
                  placeholder="(00) 90000-0000"
                />
              </Field>
              <Field label="Horário padrão de operação">
                <Input
                  value={form.horario_operacao}
                  onChange={(e) => update("horario_operacao", e.target.value)}
                  placeholder="Ex: 07:00 – 17:00"
                />
              </Field>
              <Field label="Fuso horário">
                <Select
                  value={form.fuso_horario}
                  onValueChange={(v) => update("fuso_horario", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FUSO_OPTIONS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Moeda padrão">
                <Select
                  value={form.moeda}
                  onValueChange={(v) => update("moeda", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BRL">BRL — Real</SelectItem>
                    <SelectItem value="USD">USD — Dólar</SelectItem>
                    <SelectItem value="EUR">EUR — Euro</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        {/* RELATÓRIOS */}
        <TabsContent value="relatorios" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <Card>
              <CardHeader>
                <CardTitle>Documentos e relatórios</CardTitle>
                <CardDescription>
                  Configure cabeçalho e rodapé dos PDFs gerados.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <ToggleRow
                  label="Mostrar logo nos relatórios"
                  description="Exibe o logo da empresa no cabeçalho dos PDFs."
                  checked={form.relatorio_mostrar_logo}
                  onChange={(v) => update("relatorio_mostrar_logo", v)}
                />
                <ToggleRow
                  label="Mostrar CNPJ nos relatórios"
                  description="Inclui o CNPJ no cabeçalho dos documentos."
                  checked={form.relatorio_mostrar_cnpj}
                  onChange={(v) => update("relatorio_mostrar_cnpj", v)}
                />
                <Field label="Rodapé padrão para PDFs">
                  <Textarea
                    value={form.relatorio_rodape}
                    onChange={(e) => update("relatorio_rodape", e.target.value)}
                    placeholder="Ex: Documento gerado por CSMCONTROLFROTA — uso interno"
                    rows={2}
                  />
                </Field>
                <Field label="Assinatura padrão da empresa">
                  <Textarea
                    value={form.relatorio_assinatura}
                    onChange={(e) =>
                      update("relatorio_assinatura", e.target.value)
                    }
                    placeholder="Ex: Engenharia & Manutenção — Setor de Frota"
                    rows={2}
                  />
                </Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pré-visualização do relatório</CardTitle>
                <CardDescription>Cabeçalho que aparece no PDF.</CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className="rounded-md border bg-white p-4 text-black shadow-sm"
                  style={{ borderColor: form.cor_primaria + "40" }}
                >
                  <div
                    className="flex items-center gap-3 border-b pb-3"
                    style={{ borderColor: form.cor_primaria }}
                  >
                    {form.relatorio_mostrar_logo && (
                      <img
                        src={previewLogo}
                        alt="Logo"
                        className="h-10 w-14 object-contain"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src =
                            logoDefault;
                        }}
                      />
                    )}
                    <div>
                      <p
                        className="text-sm font-black"
                        style={{ color: form.cor_primaria }}
                      >
                        {form.nome_exibicao || "Sua empresa"}
                      </p>
                      {form.relatorio_mostrar_cnpj && form.cnpj && (
                        <p className="text-[10px] text-neutral-600">
                          CNPJ: {form.cnpj}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 space-y-1 text-[11px] text-neutral-600">
                    <p className="font-bold text-neutral-800">
                      Relatório de exemplo
                    </p>
                    <p>Conteúdo do relatório aqui…</p>
                  </div>
                  {form.relatorio_assinatura && (
                    <div className="mt-4 border-t pt-2 text-[10px] italic text-neutral-700">
                      {form.relatorio_assinatura}
                    </div>
                  )}
                  {form.relatorio_rodape && (
                    <div className="mt-2 text-center text-[9px] text-neutral-500">
                      {form.relatorio_rodape}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Botão fixo de salvar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 py-3 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-7xl items-center justify-end gap-3">
          <p className="hidden text-xs text-muted-foreground sm:block">
            As alterações afetam apenas a sua empresa.
          </p>
          <Button
            onClick={handleSave}
            disabled={saving}
            size="lg"
            className="gap-2"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar alterações
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-2 ${className || ""}`}>
      <Label className="text-sm">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          value={isHex(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 cursor-pointer rounded-md border border-border bg-background"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#003B73"
        />
      </div>
    </div>
  );
}

function Swatch({ label, color }: { label: string; color: string }) {
  return (
    <div className="space-y-1 text-center">
      <div
        className="h-12 w-full rounded-md border border-border"
        style={{ backgroundColor: isHex(color) ? color : "transparent" }}
      />
      <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
      <p className="text-[10px] font-mono">{color}</p>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border border-border p-3">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
