import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AiDecision = {
  equipmentId: string;
  summary: string;
  failureRisk: number;
  recommendation: string;
  reason: string;
  priority: "critical" | "high" | "medium" | "low";
  maintenanceType: "preventive" | "corrective";
  suggestedParts: string[];
  downtimeHours: number;
  consumptionStatus: string;
  consumptionDeviationPercent: number;
  costAnalysis: string;
  problemsIdentified: string[];
  possibleCauses: string[];
  recommendedActions: string[];
  operationalImpact?: string;
  technicalReason?: string;
  anomalyFlags?: string[];
  equipmentClassification: "good" | "medium" | "bad";
  autoCreateOS: boolean;
};

function extractJsonObject(raw: string) {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("AI response did not contain valid JSON object");
  }

  return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { equipments = [], maintenancePlans = [], maintenanceHistory = [], fuelRecords = [], workOrders = [] } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `Analise a frota e gere até 5 avaliações operacionais, práticas e objetivas para tomada de decisão.
Retorne SOMENTE JSON válido no formato {"decisions": Array<Decision>}.

Cada Decision deve conter:
- equipmentId: string
- summary: resumo geral em até 3 linhas
- failureRisk: number entre 0 e 100
- recommendation: string curta, objetiva e acionável
- reason: string explicando o risco operacional
- priority: "critical" | "high" | "medium" | "low"
- maintenanceType: "preventive" | "corrective"
- suggestedParts: string[]
- downtimeHours: number
- consumptionStatus: string com status do consumo
- consumptionDeviationPercent: number
- costAnalysis: string com análise simples de custo
- problemsIdentified: string[]
- possibleCauses: string[]
- recommendedActions: string[]
- operationalImpact: string curta com impacto na operação
- technicalReason: string curta com motivo técnico
- anomalyFlags: string[] com inconsistências, suspeitas ou fraudes detectadas
- equipmentClassification: "good" | "medium" | "bad"
- autoCreateOS: boolean

Regras de decisão:
- considerar horímetro atual vs última manutenção
- considerar km atual quando aplicável
- considerar histórico de falhas e recorrência
- considerar consumo recente anormal
- calcular desvio percentual de consumo quando houver base
- avaliar custo operacional e impacto financeiro aproximado
- sinalizar suspeita se houver dados incoerentes, consumo anormal ou horímetro inconsistente
- considerar criticidade do equipamento
- marcar priority = "critical" quando houver risco alto de parada ou impacto direto na produção
- sugerir OS automática quando a ação for clara
- usar linguagem operacional em pt-BR

Dados:
${JSON.stringify({ equipments, maintenancePlans, maintenanceHistory, fuelRecords, workOrders })}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
             content: "Você é um especialista em gestão de frota pesada, manutenção de equipamentos, operação de obra rodoviária e controle de custos. Gere uma avaliação objetiva para decisão operacional e responda apenas com JSON válido.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      const isCreditsError = aiResponse.status === 402;
      const isRateLimitError = aiResponse.status === 429;

      return new Response(JSON.stringify({
        error: errorText || "AI gateway error",
        fallback: !(isCreditsError || isRateLimitError),
        userMessage: isCreditsError
          ? "A análise operacional está indisponível no momento porque os créditos da IA acabaram."
          : isRateLimitError
            ? "A análise operacional atingiu o limite temporário de requisições. Tente novamente em instantes."
            : "Não foi possível concluir a análise operacional agora.",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await aiResponse.json();
    const content = payload?.choices?.[0]?.message?.content;
    const parsed = typeof content === "string" ? extractJsonObject(content) : content;
    const decisions = Array.isArray(parsed?.decisions) ? parsed.decisions : [];

    return new Response(JSON.stringify({ decisions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});