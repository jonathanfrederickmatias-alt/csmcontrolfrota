import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AiDecision = {
  equipmentId: string;
  recommendation: string;
  reason: string;
  priority: "high" | "medium" | "low";
  maintenanceType: "preventive" | "corrective";
  suggestedParts: string[];
  downtimeHours: number;
  autoCreateOS: boolean;
};

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

    const prompt = `Analise a frota e gere até 5 decisões automáticas de manutenção.
Retorne SOMENTE JSON válido no formato {"decisions": Array<Decision>}.

Cada Decision deve conter:
- equipmentId: string
- recommendation: string curta, objetiva e acionável
- reason: string explicando o risco operacional
- priority: "high" | "medium" | "low"
- maintenanceType: "preventive" | "corrective"
- suggestedParts: string[]
- downtimeHours: number
- autoCreateOS: boolean

Regras de decisão:
- considerar horímetro atual vs última manutenção
- considerar histórico de falhas e recorrência
- considerar consumo recente anormal
- considerar criticidade do equipamento
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
            content: "Você é um especialista nível concessionária em manutenção de equipamentos pesados. Responda apenas com JSON válido.",
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
      return new Response(JSON.stringify({ error: errorText || "AI gateway error" }), {
        status: aiResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await aiResponse.json();
    const content = payload?.choices?.[0]?.message?.content;
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
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