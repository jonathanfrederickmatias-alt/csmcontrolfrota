import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function fmtDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function fmtMoney(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
    const end = new Date(nowSP); end.setDate(nowSP.getDate() - day); end.setHours(23, 59, 59, 999);
    const start = new Date(end); start.setDate(end.getDate() - 6); start.setHours(0, 0, 0, 0);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);

    // Work orders completed in the period
    const workOrders: any[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from('work_orders')
        .select('*, equipments(name, cost_center, plate, type)')
        .eq('status', 'done')
        .gte('completed_at', start.toISOString())
        .lte('completed_at', end.toISOString())
        .order('completed_at', { ascending: true })
        .range(from, from + 999);
      if (error) throw error;
      if (!data || data.length === 0) break;
      workOrders.push(...data);
      if (data.length < 1000) break;
      from += 1000;
    }

    // Maintenance history entries in the period (includes plans executed directly)
    const history: any[] = [];
    from = 0;
    while (true) {
      const { data, error } = await supabase
        .from('maintenance_history')
        .select('*, equipments(name, cost_center, plate, type)')
        .gte('executed_at', start.toISOString())
        .lte('executed_at', end.toISOString())
        .order('executed_at', { ascending: true })
        .range(from, from + 999);
      if (error) throw error;
      if (!data || data.length === 0) break;
      history.push(...data);
      if (data.length < 1000) break;
      from += 1000;
    }

    const totalLabor = workOrders.reduce((s, w) => s + (Number(w.labor_cost) || 0), 0)
      + history.reduce((s, h) => s + (Number(h.labor_cost) || 0), 0);
    const totalParts = workOrders.reduce((s, w) => s + (Number(w.parts_cost) || 0), 0)
      + history.reduce((s, h) => s + (Number(h.parts_cost) || 0), 0);

    const equipName = (e: any) => e ? `${e.name}${e.cost_center ? ` (${e.cost_center})` : ''}` : '—';

    const osRows = workOrders.map((w) => `<tr>
      <td style="padding:6px;border-bottom:1px solid #e2e8f0;">#${w.os_number}</td>
      <td style="padding:6px;border-bottom:1px solid #e2e8f0;">${equipName(w.equipments)}</td>
      <td style="padding:6px;border-bottom:1px solid #e2e8f0;">${w.description || '—'}</td>
      <td style="padding:6px;border-bottom:1px solid #e2e8f0;">${w.mechanic_name || '—'}</td>
      <td style="padding:6px;border-bottom:1px solid #e2e8f0;">${w.completed_at ? fmtDate(new Date(w.completed_at)) : '—'}</td>
      <td style="padding:6px;border-bottom:1px solid #e2e8f0;text-align:right;">${fmtMoney((Number(w.labor_cost) || 0) + (Number(w.parts_cost) || 0))}</td>
    </tr>`).join('');

    const histRows = history.map((h) => `<tr>
      <td style="padding:6px;border-bottom:1px solid #e2e8f0;">${equipName(h.equipments)}</td>
      <td style="padding:6px;border-bottom:1px solid #e2e8f0;">${h.description || '—'}</td>
      <td style="padding:6px;border-bottom:1px solid #e2e8f0;">${h.operator_name || '—'}</td>
      <td style="padding:6px;border-bottom:1px solid #e2e8f0;">${h.hour_meter ?? '—'}</td>
      <td style="padding:6px;border-bottom:1px solid #e2e8f0;">${fmtDate(new Date(h.executed_at))}</td>
      <td style="padding:6px;border-bottom:1px solid #e2e8f0;text-align:right;">${fmtMoney((Number(h.labor_cost) || 0) + (Number(h.parts_cost) || 0))}</td>
    </tr>`).join('');

    const periodLabel = `${fmtDate(start)} a ${fmtDate(end)}`;
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório de Manutenções — ${periodLabel}</title></head>
<body style="font-family:Arial,sans-serif;max-width:900px;margin:0 auto;padding:24px;color:#0f172a;">
  <h1 style="font-size:20px;margin-bottom:4px;">Relatório Semanal de Manutenções</h1>
  <p style="color:#64748b;margin-top:0;">Período: ${periodLabel} — gerado automaticamente pelo CSMCONTROLFROTA</p>
  <div style="display:flex;gap:16px;margin:16px 0;">
    <div style="flex:1;background:#f1f5f9;border-radius:8px;padding:12px;"><div style="font-size:12px;color:#64748b;">OS concluídas</div><div style="font-size:22px;font-weight:700;">${workOrders.length}</div></div>
    <div style="flex:1;background:#f1f5f9;border-radius:8px;padding:12px;"><div style="font-size:12px;color:#64748b;">Serviços/planos realizados</div><div style="font-size:22px;font-weight:700;">${history.length}</div></div>
    <div style="flex:1;background:#f1f5f9;border-radius:8px;padding:12px;"><div style="font-size:12px;color:#64748b;">Custo total (mão de obra + peças)</div><div style="font-size:22px;font-weight:700;">${fmtMoney(totalLabor + totalParts)}</div></div>
  </div>
  <h2 style="font-size:16px;">Ordens de Serviço concluídas</h2>
  <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:24px;">
    <thead><tr style="background:#f1f5f9;"><th style="padding:6px;text-align:left;">OS</th><th style="padding:6px;text-align:left;">Equipamento</th><th style="padding:6px;text-align:left;">Descrição</th><th style="padding:6px;text-align:left;">Mecânico</th><th style="padding:6px;text-align:left;">Conclusão</th><th style="padding:6px;text-align:right;">Custo</th></tr></thead>
    <tbody>${osRows || '<tr><td colspan="6" style="padding:12px;text-align:center;color:#64748b;">Nenhuma OS concluída no período</td></tr>'}</tbody>
  </table>
  <h2 style="font-size:16px;">Serviços e planos realizados</h2>
  <table style="width:100%;border-collapse:collapse;font-size:12px;">
    <thead><tr style="background:#f1f5f9;"><th style="padding:6px;text-align:left;">Equipamento</th><th style="padding:6px;text-align:left;">Descrição</th><th style="padding:6px;text-align:left;">Responsável</th><th style="padding:6px;text-align:left;">Horímetro/Km</th><th style="padding:6px;text-align:left;">Data</th><th style="padding:6px;text-align:right;">Custo</th></tr></thead>
    <tbody>${histRows || '<tr><td colspan="6" style="padding:12px;text-align:center;color:#64748b;">Nenhum serviço no período</td></tr>'}</tbody>
  </table>
  <p style="color:#94a3b8;font-size:11px;margin-top:24px;">CSMCONTROLFROTA — relatório gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
</body></html>`;

    // Save HTML report to storage
    const fileName = `manutencoes-${startStr}_a_${endStr}.html`;
    const { error: upErr } = await supabase.storage
      .from('reports')
      .upload(fileName, new Blob([html], { type: 'text/html' }), { contentType: 'text/html', upsert: true });
    if (upErr) throw upErr;

    // Register in generated_reports (one row per tenant that had records, or default tenant)
    const tenantIds = [...new Set([...workOrders, ...history].map((r) => r.tenant_id).filter(Boolean))];
    if (tenantIds.length === 0) {
      const { data: def } = await supabase.from('tenants').select('id').eq('slug', 'minha-empresa-principal').limit(1);
      if (def?.[0]) tenantIds.push(def[0].id);
    }
    for (const tid of tenantIds) {
      await supabase.from('generated_reports').insert({
        tenant_id: tid,
        report_type: 'maintenance_weekly',
        title: `Manutenções — ${periodLabel}`,
        period_start: startStr,
        period_end: endStr,
        file_url: fileName,
        summary: {
          work_orders_done: workOrders.length,
          services_done: history.length,
          labor_cost: totalLabor,
          parts_cost: totalParts,
          total_cost: totalLabor + totalParts,
        },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      period: { start: startStr, end: endStr },
      work_orders_done: workOrders.length,
      services_done: history.length,
      total_cost: totalLabor + totalParts,
      file: fileName,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
