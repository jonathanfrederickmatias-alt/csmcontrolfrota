import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useBranding } from "@/contexts/BrandingContext";
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
import { Loader2, Palette, ShieldAlert, Save } from "lucide-react";
import { toast } from "sonner";
import logoDefault from "@/assets/logo-default.png";

const DEFAULT_PRIMARY = "#003B73";
const DEFAULT_SECONDARY = "#0F172A";
const DEFAULT_ALERT = "#DC2626";

function isHex(value: string) {
  return /^#([0-9a-fA-F]{6})$/.test(value.trim());
}

export default function CompanySettingsPage() {
  const { isAdmin, loading: rolesLoading } = useUserRoles();
  const { branding, loading: brandingLoading, refresh } = useBranding();

  const [nomeExibicao, setNomeExibicao] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [corPrimaria, setCorPrimaria] = useState(DEFAULT_PRIMARY);
  const [corSecundaria, setCorSecundaria] = useState(DEFAULT_SECONDARY);
  const [corAlerta, setCorAlerta] = useState(DEFAULT_ALERT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!branding) return;
    setNomeExibicao(branding.nome_exibicao || branding.name || "");
    setLogoUrl(branding.logo_url || "");
    setCorPrimaria(branding.cor_primaria || DEFAULT_PRIMARY);
    setCorSecundaria(branding.cor_secundaria || DEFAULT_SECONDARY);
    setCorAlerta(branding.cor_alerta || DEFAULT_ALERT);
  }, [branding]);

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
            Apenas administradores podem alterar a identidade visual da empresa.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const handleSave = async () => {
    if (!nomeExibicao.trim()) {
      toast.error("Informe um nome de exibição");
      return;
    }
    for (const [label, val] of [
      ["Cor primária", corPrimaria],
      ["Cor secundária", corSecundaria],
      ["Cor de alerta", corAlerta],
    ] as const) {
      if (!isHex(val)) {
        toast.error(`${label} inválida — use formato #RRGGBB`);
        return;
      }
    }

    setSaving(true);
    const { error } = await supabase.rpc("update_my_tenant_branding", {
      _nome_exibicao: nomeExibicao.trim(),
      _logo_url: logoUrl.trim() || null,
      _cor_primaria: corPrimaria.trim(),
      _cor_secundaria: corSecundaria.trim(),
      _cor_alerta: corAlerta.trim(),
    });
    setSaving(false);

    if (error) {
      toast.error(error.message || "Não foi possível salvar");
      return;
    }
    toast.success("Identidade visual atualizada");
    await refresh();
  };

  const previewLogo = logoUrl.trim() || logoDefault;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Palette className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-black tracking-tight lg:text-3xl">
            Configurações da Empresa
          </h1>
          <p className="text-sm text-muted-foreground">
            Personalize o nome, logo e cores que serão exibidos no sistema.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Identidade visual</CardTitle>
            <CardDescription>
              Estas alterações afetam apenas a sua empresa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="nome-exibicao">Nome de exibição</Label>
              <Input
                id="nome-exibicao"
                value={nomeExibicao}
                onChange={(e) => setNomeExibicao(e.target.value)}
                placeholder="Ex: Engenat Construções"
              />
              <p className="text-xs text-muted-foreground">
                Aparece no topo do sistema. Se vazio, usa o nome da empresa.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="logo-url">URL do logo</Label>
              <Input
                id="logo-url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://exemplo.com/logo.png"
                inputMode="url"
              />
              <p className="text-xs text-muted-foreground">
                Cole a URL pública do logotipo. Se vazio, usa um logo neutro.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <ColorField
                id="cor-primaria"
                label="Cor primária"
                value={corPrimaria}
                onChange={setCorPrimaria}
              />
              <ColorField
                id="cor-secundaria"
                label="Cor secundária"
                value={corSecundaria}
                onChange={setCorSecundaria}
              />
              <ColorField
                id="cor-alerta"
                label="Cor de alerta"
                value={corAlerta}
                onChange={setCorAlerta}
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salvar alterações
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pré-visualização</CardTitle>
            <CardDescription>
              Como a sua marca vai aparecer no header.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <img
                  src={previewLogo}
                  alt={nomeExibicao || "Logo"}
                  className="h-12 w-16 object-contain"
                  loading="lazy"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = logoDefault;
                  }}
                />
                <div>
                  <p className="text-sm font-black leading-tight">
                    {nomeExibicao.trim() || branding?.name || "Sua empresa"}
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
                <Swatch label="Primária" color={corPrimaria} />
                <Swatch label="Secundária" color={corSecundaria} />
                <Swatch label="Alerta" color={corAlerta} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ColorField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          value={isHex(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 cursor-pointer rounded-md border border-border bg-background"
        />
        <Input
          id={id}
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
