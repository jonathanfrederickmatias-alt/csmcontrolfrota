import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { requestId } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get maintenance request details
    const { data: request, error: reqErr } = await supabase
      .from('maintenance_requests')
      .select('*, equipments(name, plate)')
      .eq('id', requestId)
      .single();

    if (reqErr || !request) {
      return new Response(JSON.stringify({ error: 'Request not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Only send for urgent/high priority
    if (!['urgent', 'high'].includes(request.priority)) {
      return new Response(JSON.stringify({ skipped: true, reason: 'Not urgent/high priority' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const NOTIFY_EMAIL = Deno.env.get('NOTIFY_EMAIL');

    if (!RESEND_API_KEY || !NOTIFY_EMAIL) {
      console.log('Email not configured, skipping notification');
      return new Response(JSON.stringify({ skipped: true, reason: 'Email not configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const priorityLabel = request.priority === 'urgent' ? '🚨 URGENTE' : '⚠️ ALTA';
    const equipName = (request as any).equipments?.name || 'Equipamento';
    const equipPlate = (request as any).equipments?.plate || '';

    const emailBody = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #ef4444; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 20px;">${priorityLabel} — Pedido de Manutenção</h1>
        </div>
        <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #64748b; font-size: 14px;">Equipamento</td><td style="padding: 8px 0; font-weight: 700;">${equipName}${equipPlate ? ` (${equipPlate})` : ''}</td></tr>
            <tr><td style="padding: 8px 0; color: #64748b; font-size: 14px;">Prioridade</td><td style="padding: 8px 0; font-weight: 700; color: #ef4444;">${request.priority === 'urgent' ? 'Urgente' : 'Alta'}</td></tr>
            <tr><td style="padding: 8px 0; color: #64748b; font-size: 14px;">Operador</td><td style="padding: 8px 0;">${request.operator_name}</td></tr>
            <tr><td style="padding: 8px 0; color: #64748b; font-size: 14px;">Descrição</td><td style="padding: 8px 0;">${request.description}</td></tr>
            <tr><td style="padding: 8px 0; color: #64748b; font-size: 14px;">Data/Hora</td><td style="padding: 8px 0;">${new Date(request.created_at).toLocaleString('pt-BR')}</td></tr>
          </table>
          <div style="margin-top: 20px; padding: 12px; background: #fef2f2; border-radius: 6px; border-left: 4px solid #ef4444;">
            <p style="margin: 0; font-size: 13px; color: #991b1b;">Acesse o CSMCONTROL para atualizar o status deste pedido.</p>
          </div>
        </div>
      </div>
    `;

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'CSMCONTROL <notificacoes@csmcontrol.app>',
        to: [NOTIFY_EMAIL],
        subject: `${priorityLabel} — Pedido de manutenção: ${equipName}`,
        html: emailBody,
      }),
    });

    const emailData = await emailRes.json();
    console.log('Email sent:', emailData);

    return new Response(JSON.stringify({ success: true, email: emailData }), {
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
