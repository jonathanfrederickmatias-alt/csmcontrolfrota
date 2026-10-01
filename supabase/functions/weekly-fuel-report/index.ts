import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function fmtDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
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

    // Period: previous week (Monday 00:00 to Sunday 23:59, São Paulo time)
    const nowSP = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const day = nowSP.getDay(); // 1 = Monday when cron fires
    const end = new Date(nowSP); end.setDate(nowSP.getDate() - day); end.setHours(23, 59, 59, 999); // last Sunday
    const start = new Date(end); start.setDate(end.getDate() - 6); start.setHours(0, 0, 0, 0); // last Monday
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);

    // Fetch fuel records for the period (paginated)
    const records: any[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from('fuel_records')
        .select('*, combo:combo_equipment_id(name, cost_center), target:target_equipment_id(name, cost_center, type, plate)')
        .gte('date', startStr)
        .lte('date', endStr)
        .order('date', { ascending: true })
        .range(from, from + 999);
      if (error) throw error;
      if (!data || data.length === 0) break;
      records.push(...data);
      if (data.length < 1000) break;
      from += 1000;
    }

    const totalLiters = records.reduce((s, r) => s + (Number(r.liters) || 0), 0);
    const byTarget = new Map<string, { name: string; liters: number; count: number }>();
    for (const r of records) {
      const key = r.target_equipment_id || 'sem-equipamento';
      const name = r.target ? `${r.target.name}${r.target.cost_center ? ` (${r.target.cost_center})` : ''}` : 'Não identificado';
      const cur = byTarget.get(key) || { name, liters: 0, count: 0 };
      cur.liters += Number(r.liters) || 0;
      cur.count += 1;
      byTarget.set(key, cur);
    }
    const ranking = [...byTarget.values()].sort((a, b) => b.liters - a.liters);

    const rows = records.map((r) => `<tr>
      <td style="padding:6px;border-bottom:1px solid #e2e8f0;">${fmtDate(new Date(r.date + 'T12:00:00'))}</td>
      <td style="padding:6px;border-bottom:1px solid #e2e8f0;">${r.target ? `${r.target.name}${r.target.cost_center ? ` (${r.target.cost_center})` : ''}` : '—'}</td>
      <td style="padding:6px;border-bottom:1px solid #e2e8f0;">${r.combo?.name || '—'}</td>
      <td style="padding:6px;border-bottom:1px solid #e2e8f0;text-align:right;">${Number(r.liters).toLocaleString('pt-BR')} L</td>
      <td style="padding:6px;border-bottom:1px solid #e2e8f0;">${r.fuel_type || '—'}</td>
      <td style="padding:6px;border-bottom:1px solid #e2e8f0;">${r.hour_meter ?? '—'}</td>
      <td style="padding:6px;border-bottom:1px solid #e2e8f0;">${r.operator_name || '—'}</td>
    </tr>`).join('');

    const rankingRows = ranking.slice(0, 15).map((r, i) => `<tr>
      <td style="padding:6px;border-bottom:1px solid #e2e8f0;">${i + 1}º</td>
      <td style="padding:6px;border-bottom:1px solid #e2e8f0;">${r.name}</td>
      <td style="padding:6px;border-bottom:1px solid #e2e8f0;text-align:right;">${r.liters.toLocaleString('pt-BR')} L</td>
      <td style="padding:6px;border-bottom:1px solid #e2e8f0;text-align:center;">${r.count}</td>
    </tr>`).join('');

    const periodLabel = `${fmtDate(start)} a ${fmtDate(end)}`;
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório de Abastecimentos — ${periodLabel}</title></head>
<body style="font-family:Arial,sans-serif;max-width:900px;margin:0 auto;padding:24px;color:#0f172a;">
  <h1 style="font-size:20px;margin-bottom:4px;">Relatório Semanal de Abastecimentos</h1>
  <p style="color:#64748b;margin-top:0;">Período: ${periodLabel} — gerado automaticamente pelo CSMCONTROLFROTA</p>
  <div style="display:flex;gap:16px;margin:16px 0;">
    <div style="flex:1;background:#f1f5f9;border-radius:8px;padding:12px;"><div style="font-size:12px;color:#64748b;">Total de abastecimentos</div><div style="font-size:22px;font-weight:700;">${records.length}</div></div>
    <div style="flex:1;background:#f1f5f9;border-radius:8px;padding:12px;"><div style="font-size:12px;color:#64748b;">Total de litros</div><div style="font-size:22px;font-weight:700;">${totalLiters.toLocaleString('pt-BR')} L</div></div>
    <div style="flex:1;background:#f1f5f9;border-radius:8px;padding:12px;"><div style="font-size:12px;color:#64748b;">Equipamentos abastecidos</div><div style="font-size:22px;font-weight:700;">${byTarget.size}</div></div>
  </div>
  <h2 style="font-size:16px;">Ranking de consumo</h2>
  <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px;">
    <thead><tr style="background:#f1f5f9;"><th style="padding:6px;text-align:left;">#</th><th style="padding:6px;text-align:left;">Equipamento</th><th style="padding:6px;text-align:right;">Litros</th><th style="padding:6px;text-align:center;">Abastecimentos</th></tr></thead>
    <tbody>${rankingRows || '<tr><td colspan="4" style="padding:12px;text-align:center;color:#64748b;">Nenhum abastecimento no período</td></tr>'}</tbody>
  </table>
  <h2 style="font-size:16px;">Todos os registros</h2>
  <table style="width:100%;border-collapse:collapse;font-size:12px;">
    <thead><tr style="background:#f1f5f9;"><th style="padding:6px;text-align:left;">Data</th><th style="padding:6px;text-align:left;">Equipamento</th><th style="padding:6px;text-align:left;">Posto</th><th style="padding:6px;text-align:right;">Litros</th><th style="padding:6px;text-align:left;">Combustível</th><th style="padding:6px;text-align:left;">Horímetro/Km</th><th style="padding:6px;text-align:left;">Operador</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="7" style="padding:12px;text-align:center;color:#64748b;">Nenhum registro no período</td></tr>'}</tbody>
  </table>
  <p style="color:#94a3b8;font-size:11px;margin-top:24px;">CSMCONTROLFROTA — relatório gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
</body></html>`;

    // Save HTML report to storage
    const fileName = `abastecimentos-${startStr}_a_${endStr}.html`;
    const { error: upErr } = await supabase.storage
      .from('reports')
      .upload(fileName, new Blob([html], { type: 'text/html' }), { contentType: 'text/html', upsert: true });
    if (upErr) throw upErr;
    const fileUrl = supabase.storage.from('reports').getPublicUrl(fileName).data.publicUrl;

    // Register in generated_reports (one row per tenant that had records, or default tenant)
    const tenantIds = [...new Set(records.map((r) => r.tenant_id).filter(Boolean))];
    if (tenantIds.length === 0) {
      const { data: def } = await supabase.from('tenants').select('id').eq('slug', 'minha-empresa-principal').limit(1);
      if (def?.[0]) tenantIds.push(def[0].id);
    }
    for (const tid of tenantIds) {
      await supabase.from('generated_reports').insert({
        tenant_id: tid,
        report_type: 'fuel_weekly',
        title: `Abastecimentos — ${periodLabel}`,
        period_start: startStr,
        period_end: endStr,
        file_url: fileUrl,
        summary: { total_records: records.length, total_liters: totalLiters, equipments: byTarget.size },
      });
    }

    // Send email with summary + link
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const NOTIFY_EMAIL = Deno.env.get('NOTIFY_EMAIL');
    let emailResult: unknown = { skipped: 'email not configured' };
    if (RESEND_API_KEY && NOTIFY_EMAIL) {
      const emailBody = `<div style="font-family:sans-serif;max-width:700px;margin:0 auto;">
        <div style="background:#1d4ed8;color:white;padding:16px;border-radius:8px 8px 0 0;">
          <h2 style="margin:0;">⛽ Relatório Semanal de Abastecimentos</h2>
          <p style="margin:4px 0 0;opacity:.9;">${periodLabel}</p>
        </div>
        <div style="padding:16px;border:1px solid #e2e8f0;border-top:0;">
          <p><strong>${records.length}</strong> abastecimentos · <strong>${totalLiters.toLocaleString('pt-BR')} litros</strong> · <strong>${byTarget.size}</strong> equipamentos</p>
          <h3 style="margin-bottom:8px;">Maiores consumos</h3>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="background:#f1f5f9;"><th style="padding:6px;text-align:left;">Equipamento</th><th style="padding:6px;text-align:right;">Litros</th></tr></thead>
            <tbody>${ranking.slice(0, 10).map((r) => `<tr><td style="padding:6px;border-bottom:1px solid #e2e8f0;">${r.name}</td><td style="padding:6px;border-bottom:1px solid #e2e8f0;text-align:right;">${r.liters.toLocaleString('pt-BR')} L</td></tr>`).join('') || '<tr><td colspan="2" style="padding:8px;color:#64748b;">Sem registros no período</td></tr>'}</tbody>
          </table>
          <p style="margin-top:16px;"><a href="${fileUrl}" style="background:#1d4ed8;color:#ffffff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block;">Abrir relatório completo</a></p>
          <p style="color:#64748b;font-size:12px;margin-top:16px;">O relatório completo também fica salvo na aba Relatórios do sistema.</p>
        </div>
        <p style="color:#94a3b8;font-size:11px;">Enviado automaticamente pelo CSMCONTROLFROTA</p>
      </div>`;

      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'CSMCONTROL <notificacoes@csmcontrol.app>',
          to: [NOTIFY_EMAIL],
          subject: `⛽ Abastecimentos da semana (${periodLabel}): ${totalLiters.toLocaleString('pt-BR')} L em ${records.length} registros`,
          html: emailBody,
        }),
      });
      emailResult = await emailRes.json();
    }

    return new Response(JSON.stringify({
      success: true,
      period: { start: startStr, end: endStr },
      records: records.length,
      total_liters: totalLiters,
      file_url: fileUrl,
      email: emailResult,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
