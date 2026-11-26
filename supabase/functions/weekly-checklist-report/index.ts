import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const RETENTION_DAYS = 30;
const fmt = (s: string) => { const [y, m, d] = s.slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
const statusLabel = (s: string) => ({ ok: 'OK', approved: 'OK', conforme: 'OK', nc: 'Com NC', issues: 'Com NC', rejected: 'Com NC' } as Record<string, string>)[String(s).toLowerCase()] || s || '—';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Period: the 7 days before today (São Paulo time)
    const todaySP = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const t = new Date(todaySP + 'T12:00:00Z');
    const endD = new Date(t); endD.setUTCDate(t.getUTCDate() - 1);
    const startD = new Date(t); startD.setUTCDate(t.getUTCDate() - 7);
    const startStr = startD.toISOString().slice(0, 10);
    const endStr = endD.toISOString().slice(0, 10);
    const periodLabel = `${fmt(startStr)} a ${fmt(endStr)}`;

    const records: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from('checklists')
        .select('*, eq:equipment_id(name, cost_center, plate)')
        .gte('date', startStr).lte('date', endStr)
        .order('date', { ascending: true }).range(from, from + 999);
      if (error) throw error;
      records.push(...(data || []));
      if (!data || data.length < 1000) break;
    }

    const ncItems = (r: any) => (Array.isArray(r.items) ? r.items : []).filter((i: any) => {
      const v = String(i?.status ?? i?.value ?? i?.answer ?? '').toLowerCase();
      return v === 'nc' || v === 'nao_conforme' || v === 'não conforme' || i?.ok === false || i?.checked === false && i?.na !== true;
    });
    const withNC = records.filter((r) => ncItems(r).length > 0).length;

    // PDF (A4 landscape)
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const W = 842, H = 595, M = 36;
    const safe = (s: any) => String(s ?? '—').replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '');
    const fit = (s: string, w: number, sz = 9) => { let x = safe(s); while (x.length > 1 && font.widthOfTextAtSize(x, sz) > w) x = x.slice(0, -1); return x; };
    let page = pdf.addPage([W, H]); let y = H - M;
    const newPage = () => { page = pdf.addPage([W, H]); y = H - M; };
    const text = (s: string, x: number, sz = 9, f = font, color = rgb(0.06, 0.09, 0.16)) => page.drawText(safe(s), { x, y, size: sz, font: f, color });
    text('Relatório Semanal de Checklists', M, 16, bold); y -= 18;
    text(`Período: ${periodLabel} - CSMCONTROLFROTA`, M, 10, font, rgb(0.4, 0.45, 0.53)); y -= 22;
    text(`Checklists: ${records.length}    Com não conformidade: ${withNC}    Equipamentos: ${new Set(records.map((r) => r.equipment_id)).size}`, M, 11, bold); y -= 24;

    const cols = [{ h: 'Data', w: 65 }, { h: 'Equipamento', w: 210 }, { h: 'Tipo', w: 80 }, { h: 'Horím./Km', w: 70 }, { h: 'Operador', w: 120 }, { h: 'Situação', w: 60 }, { h: 'Itens NC / Observações', w: 165 }];
    const header = () => {
      page.drawRectangle({ x: M, y: y - 4, width: W - 2 * M, height: 14, color: rgb(0.945, 0.96, 0.976) });
      let x = M + 3; for (const c of cols) { text(c.h, x, 9, bold); x += c.w; } y -= 15;
    };
    header();
    if (records.length === 0) { text('Nenhum checklist no período', M + 3); y -= 13; }
    for (const r of records) {
      if (y < M + 14) { newPage(); header(); }
      const nc = ncItems(r).map((i: any) => i?.label || i?.name || i?.item || i?.description).filter(Boolean).join('; ');
      const row = [fmt(r.date), r.eq ? `${r.eq.name}${r.eq.cost_center ? ` (${r.eq.cost_center})` : ''}` : '—', r.type || '—', String(r.hour_meter ?? '—'), r.operator_name || '—', nc ? 'Com NC' : statusLabel(r.status), nc || r.observations || '—'];
      let x = M + 3;
      row.forEach((cell, i) => { page.drawText(fit(cell, cols[i].w - 6), { x, y, size: 9, font }); x += cols[i].w; });
      y -= 13;
    }
    const pdfBytes = await pdf.save();

    const fileName = `checklists/checklists-${startStr}_a_${endStr}.pdf`;
    const { error: upErr } = await supabase.storage.from('reports')
      .upload(fileName, new Blob([pdfBytes], { type: 'application/pdf' }), { contentType: 'application/pdf', upsert: true });
    if (upErr) throw upErr;

    const tenantIds = [...new Set(records.map((r) => r.tenant_id).filter(Boolean))];
    if (tenantIds.length === 0) {
      const { data: def } = await supabase.from('tenants').select('id').eq('slug', 'minha-empresa-principal').limit(1);
      if (def?.[0]) tenantIds.push(def[0].id);
    }
    for (const tid of tenantIds) {
      await supabase.from('generated_reports').delete().eq('tenant_id', tid).eq('report_type', 'checklist_weekly').eq('file_url', fileName);
      await supabase.from('generated_reports').insert({
        tenant_id: tid, report_type: 'checklist_weekly', title: `Checklists — ${periodLabel}`,
        period_start: startStr, period_end: endStr, file_url: fileName,
        summary: { total_records: records.length, with_nc: withNC },
      });
    }

    // Cleanup: saved checklist reports older than 30 days (the checklists themselves are kept)
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400000).toISOString();
    const { data: old } = await supabase.from('generated_reports').select('id, file_url')
      .eq('report_type', 'checklist_weekly').lt('created_at', cutoff);
    const oldFiles = [...new Set((old || []).map((o) => o.file_url).filter(Boolean))] as string[];
    if (oldFiles.length) await supabase.storage.from('reports').remove(oldFiles);
    if (old?.length) await supabase.from('generated_reports').delete().in('id', old.map((o) => o.id));

    return new Response(JSON.stringify({ success: true, period: { start: startStr, end: endStr }, records: records.length, with_nc: withNC, file: fileName, deleted_old: old?.length || 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
