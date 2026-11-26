import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const RETENTION_DAYS = 30;
const DEFAULT_FOLDER = 'SERVIDOR/ENGENHARIA/OBRAS E LOCAÇÕES ATIVAS/ÁLYA - EGTC/CHECK-LIST VEÍCULOS E EQUIPAMENTOS';
const GATEWAY = 'https://connector-gateway.lovable.dev/microsoft_onedrive/v1.0';
const fmt = (s: string) => { const [y, m, d] = s.slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
const fileSafe = (s: string) => s.replace(/[\\/:*?"<>|#%]/g, '-').replace(/\s+/g, ' ').trim();
const encPath = (p: string) => p.split('/').filter(Boolean).map(encodeURIComponent).join('/');

function itemAnswer(i: any): string {
  if (i?.na) return 'N/A';
  if (i?.checked === true) return 'C';
  if (i?.checked === false) return 'NC';
  return '—';
}

async function buildAssetPdf(eqLabel: string, periodLabel: string, list: any[]) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595, H = 842, M = 36;
  const safe = (s: any) => String(s ?? '—').replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '');
  const wrap = (s: string, w: number, sz: number) => {
    const words = safe(s).split(' '); const lines: string[] = []; let cur = '';
    for (const wd of words) { const t = cur ? cur + ' ' + wd : wd; if (font.widthOfTextAtSize(t, sz) > w && cur) { lines.push(cur); cur = wd; } else cur = t; }
    if (cur) lines.push(cur); return lines.length ? lines : ['—'];
  };
  let page = pdf.addPage([W, H]); let y = H - M;
  const ensure = (h: number) => { if (y - h < M) { page = pdf.addPage([W, H]); y = H - M; } };
  const text = (s: string, x: number, sz = 9, f = font, color = rgb(0.06, 0.09, 0.16)) => page.drawText(safe(s), { x, y, size: sz, font: f, color });
  text('Checklists - ' + eqLabel, M, 15, bold); y -= 17;
  text(`Período: ${periodLabel} - ${list.length} checklist(s) - CSMCONTROLFROTA`, M, 10, font, rgb(0.4, 0.45, 0.53)); y -= 22;
  for (const r of list) {
    const items = Array.isArray(r.items) ? r.items : [];
    const nc = items.filter((i: any) => i?.checked === false && !i?.na).length;
    ensure(50);
    page.drawRectangle({ x: M, y: y - 5, width: W - 2 * M, height: 18, color: nc ? rgb(1, 0.93, 0.93) : rgb(0.93, 0.97, 0.94) });
    text(`${fmt(r.date)}  |  ${r.type || 'checklist'}  |  Horím./Km: ${r.hour_meter ?? '—'}  |  Operador: ${r.operator_name || '—'}  |  ${nc ? nc + ' NC' : 'Tudo conforme'}`, M + 4, 9, bold); y -= 20;
    for (const i of items) {
      const ans = itemAnswer(i);
      const lines = wrap(`${i?.group ? i.group + ' - ' : ''}${i?.label || '—'}${i?.observation ? ' (Obs: ' + i.observation + ')' : ''}`, W - 2 * M - 50, 8);
      ensure(lines.length * 10 + 2);
      page.drawText(ans, { x: M + 4, y, size: 8, font: bold, color: ans === 'NC' ? rgb(0.8, 0.1, 0.1) : ans === 'C' ? rgb(0.1, 0.55, 0.2) : rgb(0.4, 0.45, 0.53) });
      for (const l of lines) { page.drawText(l, { x: M + 40, y, size: 8, font }); y -= 10; }
    }
    if (r.observations) { for (const l of wrap('Observações: ' + r.observations, W - 2 * M - 8, 8)) { ensure(10); text(l, M + 4, 8); y -= 10; } }
    if (r.photo_url) { ensure(10); text('Foto: ' + r.photo_url, M + 4, 7, font, rgb(0.1, 0.3, 0.8)); y -= 10; }
    y -= 10;
  }
  return await pdf.save();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body = await req.json().catch(() => ({}));
    const backfill = body?.backfill === true; // one-time export of everything older than the retention window
    const skipDelete = body?.skip_delete === true;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const ONEDRIVE_KEY = Deno.env.get('MICROSOFT_ONEDRIVE_API_KEY');
    if (!LOVABLE_API_KEY || !ONEDRIVE_KEY) throw new Error('OneDrive não conectado');
    const auth = { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'X-Connection-Api-Key': ONEDRIVE_KEY };

    const { data: setting } = await supabase.from('report_settings').select('value').eq('key', 'onedrive_checklist_folder').maybeSingle();
    const folder = (setting?.value?.trim() || DEFAULT_FOLDER).replace(/^\/+|\/+$/g, '');

    const todaySP = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const t = new Date(todaySP + 'T12:00:00Z');
    const day = (n: number) => { const d = new Date(t); d.setUTCDate(t.getUTCDate() - n); return d.toISOString().slice(0, 10); };
    const cutoffStr = day(RETENTION_DAYS); // checklists with date < cutoff are deleted
    const isDate = (v: any) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
    const startStr = isDate(body?.start) ? body.start : backfill ? '2000-01-01' : day(7);
    const endStr = isDate(body?.end) ? body.end : backfill ? day(RETENTION_DAYS + 1) : day(1);

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

    // Ensure folder chain
    const segs = folder.split('/').filter(Boolean);
    for (let i = 1; i <= segs.length; i++) {
      const partial = segs.slice(0, i).join('/');
      const chk = await fetch(`${GATEWAY}/me/drive/root:/${encPath(partial)}`, { headers: auth });
      await chk.text();
      if (chk.ok) continue;
      const parent = segs.slice(0, i - 1).join('/');
      const res = await fetch(parent ? `${GATEWAY}/me/drive/root:/${encPath(parent)}:/children` : `${GATEWAY}/me/drive/root/children`, {
        method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: segs[i - 1], folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }),
      });
      const b = await res.text();
      if (!res.ok && res.status !== 409) throw new Error(`Falha ao criar pasta [${res.status}]: ${b}`);
    }

    // Group per asset and upload one PDF each
    const groups = new Map<string, any[]>();
    for (const r of records) { const k = r.equipment_id || 'sem'; if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(r); }
    const firstDate = records[0]?.date?.slice(0, 10) || startStr;
    const periodLabel = backfill && !isDate(body?.start) ? `${fmt(firstDate)} a ${fmt(endStr)}` : `${fmt(startStr)} a ${fmt(endStr)}`;
    const uploaded: string[] = []; const failed: string[] = [];
    const gs = Number(body?.group_start) || 0;
    const gc = Number(body?.group_count) || 9999;
    const ordered = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(gs, gs + gc).map((e) => e[1]);
    for (const list of ordered) {
      const eq = list[0].eq;
      const label = eq ? `${eq.name}${eq.cost_center ? ` (${eq.cost_center})` : ''}` : 'Sem equipamento';
      const bytes = await buildAssetPdf(label, periodLabel, list);
      const name = fileSafe(`${label} - checklists ${periodLabel.replaceAll('/', '-')}`) + '.pdf';
      const res = await fetch(`${GATEWAY}/me/drive/root:/${encPath(`${folder}/${name}`)}:/content`, {
        method: 'PUT', headers: { ...auth, 'Content-Type': 'application/pdf' }, body: bytes,
      });
      const b = await res.text();
      if (res.ok) uploaded.push(name); else { failed.push(name); console.error(`Upload falhou [${res.status}]: ${b}`); }
    }

    // Delete old checklists from the system (OneDrive copies are kept). Only if every upload of this run worked.
    let deleted = 0;
    if (!skipDelete && failed.length === 0) {
      const { count, error } = await supabase.from('checklists').delete({ count: 'exact' }).lt('date', cutoffStr);
      if (error) throw error;
      deleted = count || 0;
    }

    return new Response(JSON.stringify({ success: failed.length === 0, folder, period: periodLabel, checklists: records.length, total_assets: groups.size, files: uploaded.length, failed, deleted_older_than: cutoffStr, deleted }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
