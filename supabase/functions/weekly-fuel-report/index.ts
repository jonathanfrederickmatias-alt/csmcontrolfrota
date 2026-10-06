import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

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

    // Build PDF (A4 landscape)
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const W = 842, H = 595, M = 36;
    const safe = (s: any) => String(s ?? '—').replace(/[^\x20-\x7E\u00A0-\u00FF—–]/g, '');
    const fit = (s: string, w: number) => {
      let t = safe(s);
      while (t.length > 1 && font.widthOfTextAtSize(t, 9) > w) t = t.slice(0, -1);
      return t;
    };
    let page = pdf.addPage([W, H]);
    let y = H - M;
    const newPage = () => { page = pdf.addPage([W, H]); y = H - M; };
    const text = (s: string, x: number, sz = 9, f = font, color = rgb(0.06, 0.09, 0.16)) =>
      page.drawText(safe(s), { x, y, size: sz, font: f, color });
    text('Relatório Semanal de Abastecimentos', M, 16, bold); y -= 18;
    text(`Período: ${periodLabel} — CSMCONTROLFROTA`, M, 10, font, rgb(0.4, 0.45, 0.53)); y -= 22;
    text(`Abastecimentos: ${records.length}    Total de litros: ${totalLiters.toLocaleString('pt-BR')} L    Equipamentos: ${byTarget.size}`, M, 11, bold); y -= 24;
    const table = (title: string, cols: { h: string; w: number; right?: boolean }[], data: string[][]) => {
      if (y < M + 60) newPage();
      text(title, M, 12, bold); y -= 16;
      const header = () => {
        page.drawRectangle({ x: M, y: y - 4, width: W - 2 * M, height: 14, color: rgb(0.945, 0.96, 0.976) });
        let x = M + 3;
        for (const c of cols) { text(c.h, x, 9, bold); x += c.w; }
        y -= 15;
      };
      header();
      if (data.length === 0) { text('Nenhum registro no período', M + 3); y -= 13; }
      for (const row of data) {
        if (y < M + 14) { newPage(); header(); }
        let x = M + 3;
        row.forEach((cell, i) => {
          const c = cols[i];
          const t = fit(cell, c.w - 6);
          const tx = c.right ? x + c.w - 6 - font.widthOfTextAtSize(t, 9) : x;
          page.drawText(t, { x: tx, y, size: 9, font });
          x += c.w;
        });
        y -= 13;
      }
      y -= 14;
    };
    table('Ranking de consumo', [{ h: '#', w: 40 }, { h: 'Equipamento', w: 470 }, { h: 'Litros', w: 120, right: true }, { h: 'Abastecimentos', w: 100 }],
      ranking.slice(0, 15).map((r, i) => [`${i + 1}º`, r.name, `${r.liters.toLocaleString('pt-BR')} L`, String(r.count)]));
    table('Todos os registros', [{ h: 'Data', w: 70 }, { h: 'Equipamento', w: 220 }, { h: 'Posto', w: 140 }, { h: 'Litros', w: 70, right: true }, { h: 'Combustível', w: 80 }, { h: 'Horím./Km', w: 70 }, { h: 'Operador', w: 120 }],
      records.map((r) => [fmtDate(new Date(r.date + 'T12:00:00')), r.target ? `${r.target.name}${r.target.cost_center ? ` (${r.target.cost_center})` : ''}` : '—', r.combo?.name || '—', `${Number(r.liters).toLocaleString('pt-BR')} L`, r.fuel_type || '—', String(r.hour_meter ?? '—'), r.operator_name || '—']));
    const pdfBytes = await pdf.save();

    // Save PDF report to storage
    const fileName = `abastecimentos-${startStr}_a_${endStr}.pdf`;
    const { error: upErr } = await supabase.storage
      .from('reports')
      .upload(fileName, new Blob([pdfBytes], { type: 'application/pdf' }), { contentType: 'application/pdf', upsert: true });
    if (upErr) throw upErr;
    // Signed URL valid for 7 days (used in the email; the app regenerates on demand)
    const { data: signed, error: signErr } = await supabase.storage
      .from('reports')
      .createSignedUrl(fileName, 60 * 60 * 24 * 7);
    if (signErr) throw signErr;
    const fileUrl = signed.signedUrl;

    // Copy to OneDrive — folder is configurable via report_settings('onedrive_folder')
    let onedriveStatus = 'skipped';
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const ONEDRIVE_KEY = Deno.env.get('MICROSOFT_ONEDRIVE_API_KEY');
    if (LOVABLE_API_KEY && ONEDRIVE_KEY) {
      let odFolder = 'CSMCONTROLFROTA/Relatorios Abastecimento';
      const { data: setting } = await supabase
        .from('report_settings')
        .select('value')
        .eq('key', 'onedrive_folder')
        .maybeSingle();
      if (setting?.value?.trim()) odFolder = setting.value.trim().replace(/^\/+|\/+$/g, '');

      const GATEWAY = 'https://connector-gateway.lovable.dev/microsoft_onedrive/v1.0';
      const encPath = (p: string) => p.split('/').filter(Boolean).map(encodeURIComponent).join('/');

      // Ensure the folder chain exists (create any missing folder along the way)
      const segments = odFolder.split('/').filter(Boolean);
      for (let i = 1; i <= segments.length; i++) {
        const partial = segments.slice(0, i).join('/');
        const check = await fetch(`${GATEWAY}/me/drive/root:/${encPath(partial)}`, {
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'X-Connection-Api-Key': ONEDRIVE_KEY },
        });
        if (check.ok) continue;
        const parentPath = segments.slice(0, i - 1).join('/');
        const createUrl = parentPath
          ? `${GATEWAY}/me/drive/root:/${encPath(parentPath)}:/children`
          : `${GATEWAY}/me/drive/root/children`;
        const createRes = await fetch(createUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            'X-Connection-Api-Key': ONEDRIVE_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: segments[i - 1], folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }),
        });
        if (!createRes.ok) {
          const createBody = await createRes.text();
          console.error(`OneDrive folder create failed [${createRes.status}]: ${createBody}`);
          onedriveStatus = `error ${createRes.status}`;
          break;
        }
      }

      if (onedriveStatus !== `error`) {
        const odRes = await fetch(`${GATEWAY}/me/drive/root:/${encPath(`${odFolder}/${fileName}`)}:/content`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            'X-Connection-Api-Key': ONEDRIVE_KEY,
            'Content-Type': 'application/pdf',
          },
          body: pdfBytes,
        });
        const odBody = await odRes.text();
        onedriveStatus = odRes.ok ? `ok (${odFolder})` : `error ${odRes.status}`;
        if (!odRes.ok) console.error(`OneDrive upload failed [${odRes.status}]: ${odBody}`);
      }
    }
    console.log('OneDrive:', onedriveStatus);

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
        file_url: fileName,
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
