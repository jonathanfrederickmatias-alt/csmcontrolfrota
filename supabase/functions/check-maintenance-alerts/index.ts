import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Threshold: truck = 1000h/km, machine/combo = 50h
function getThreshold(equipmentType: string): number {
  return equipmentType === 'truck' ? 1000 : 50;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch all plans with their equipment
    const { data: plans, error: plansErr } = await supabase
      .from('maintenance_plans')
      .select('*, equipments(name, plate, current_hour_meter, type)');

    if (plansErr) {
      console.error('Error fetching plans:', plansErr);
      return new Response(JSON.stringify({ error: plansErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!plans || plans.length === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: 'No plans found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Recalculate status based on type-specific thresholds
    const alertPlans: any[] = [];
    for (const p of plans) {
      const eq = (p as any).equipments;
      const planType = (p as any).plan_type || 'horimetro';
      let status: string;
      let remaining = 0;
      let threshold = 0;
      let eqType = eq?.type || 'machine';

      if (planType === 'tempo') {
        const nextDate = (p as any).next_due_date ? new Date((p as any).next_due_date).getTime() : 0;
        if (!nextDate) continue;
        remaining = Math.ceil((nextDate - Date.now()) / 86400000);
        threshold = 7;
        if (remaining <= 0) status = 'overdue';
        else if (remaining <= threshold) status = 'approaching';
        else status = 'ok';
      } else {
        const currentHM = eq?.current_hour_meter || 0;
        remaining = p.next_due_at - currentHM;
        threshold = getThreshold(eqType);
        if (remaining <= 0) status = 'overdue';
        else if (remaining <= threshold) status = 'approaching';
        else status = 'ok';
      }

      // Update status in DB if changed
      if (status !== p.status) {
        await supabase.from('maintenance_plans').update({ status }).eq('id', p.id);
      }

      if (status === 'overdue' || status === 'approaching') {
        alertPlans.push({ ...p, status, _remaining: remaining, _threshold: threshold, _eqType: eqType, _planType: planType });
      }

    }

    if (alertPlans.length === 0) {
      console.log('No approaching/overdue plans found');
      return new Response(JSON.stringify({ skipped: true, reason: 'No alerts needed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const NOTIFY_EMAIL = Deno.env.get('NOTIFY_EMAIL');

    if (!RESEND_API_KEY || !NOTIFY_EMAIL) {
      console.log('Email not configured, skipping');
      return new Response(JSON.stringify({ skipped: true, reason: 'Email not configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const overdueItems = alertPlans.filter((p) => p.status === 'overdue');
    const approachingItems = alertPlans.filter((p) => p.status === 'approaching');

    const buildRow = (p: any) => {
      const eq = p.equipments;
      const eqName = eq?.name || 'Equipamento';
      const currentHM = eq?.current_hour_meter || 0;
      const remaining = p.next_due_at - currentHM;
      const unit = p._eqType === 'truck' ? 'km' : 'h';
      const thresholdLabel = `${p._threshold}${unit}`;
      const statusLabel = p.status === 'overdue' ? '🔴 Atrasada' : '🟡 Próxima';
      const remainingLabel = remaining <= 0 ? `Atrasada ${Math.abs(remaining)}${unit}` : `Faltam ${remaining}${unit}`;
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">${eqName}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${p.description}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:center;">${p.interval_hours}${unit}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:center;">${p.next_due_at}${unit}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:center;">${currentHM}${unit}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:700;color:${p.status === 'overdue' ? '#dc2626' : '#f59e0b'};">${remainingLabel}</td>
      </tr>`;
    };

    const tableHeader = `<table style="width:100%;border-collapse:collapse;font-size:14px;">
      <thead><tr style="background:#f1f5f9;">
        <th style="padding:8px;text-align:left;">Equipamento</th>
        <th style="padding:8px;text-align:left;">Manutenção</th>
        <th style="padding:8px;text-align:center;">Intervalo</th>
        <th style="padding:8px;text-align:center;">Próxima em</th>
        <th style="padding:8px;text-align:center;">Horímetro Atual</th>
        <th style="padding:8px;text-align:center;">Status</th>
      </tr></thead><tbody>`;

    let body = `<div style="font-family:sans-serif;max-width:700px;margin:0 auto;">`;
    body += `<p style="color:#64748b;font-size:12px;margin-bottom:12px;">Limites de alerta: Caminhão = 1.000 km | Máquina = 50 horas</p>`;

    if (overdueItems.length > 0) {
      body += `<div style="background:#dc2626;color:white;padding:16px;border-radius:8px 8px 0 0;">
        <h2 style="margin:0;">🚨 ${overdueItems.length} Manutenção(ões) Atrasada(s)</h2>
      </div>
      <div style="padding:16px;border:1px solid #e2e8f0;border-top:0;margin-bottom:20px;overflow-x:auto;">
        ${tableHeader}${overdueItems.map(buildRow).join('')}</tbody></table>
      </div>`;
    }

    if (approachingItems.length > 0) {
      body += `<div style="background:#f59e0b;color:white;padding:16px;border-radius:8px 8px 0 0;">
        <h2 style="margin:0;">⚠️ ${approachingItems.length} Manutenção(ões) Próxima(s)</h2>
      </div>
      <div style="padding:16px;border:1px solid #e2e8f0;border-top:0;margin-bottom:20px;overflow-x:auto;">
        ${tableHeader}${approachingItems.map(buildRow).join('')}</tbody></table>
      </div>`;
    }

    body += `<p style="color:#64748b;font-size:12px;margin-top:16px;">Enviado automaticamente pelo CSMCONTROL — ${new Date().toLocaleString('pt-BR')}</p></div>`;

    const subject = overdueItems.length > 0
      ? `🚨 ${overdueItems.length} manutenção(ões) atrasada(s) + ${approachingItems.length} próxima(s)`
      : `⚠️ ${approachingItems.length} manutenção(ões) próxima(s) do vencimento`;

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'CSMCONTROL <notificacoes@csmcontrol.app>',
        to: [NOTIFY_EMAIL],
        subject,
        html: body,
      }),
    });

    const emailData = await emailRes.json();
    console.log('Alert email sent:', emailData);

    return new Response(JSON.stringify({
      success: true,
      overdue: overdueItems.length,
      approaching: approachingItems.length,
      email: emailData,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
