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

const SIDES: [string, string][] = [['frente', 'Frente'], ['tras', 'Trás'], ['esquerdo', 'Lado esquerdo'], ['direito', 'Lado direito']];

async function buildChecklistPdf(eqLabel: string, r: any, embedPhotos: boolean) {
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
  const items = Array.isArray(r.items) ? r.items : [];
  const nc = items.filter((i: any) => i?.checked === false && !i?.na).length;
  text('Checklist - ' + eqLabel, M, 15, bold); y -= 18;
  text(`Data: ${fmt(r.date)}   Tipo: ${r.type || '—'}   Horím./Km: ${r.hour_meter ?? '—'}`, M, 10); y -= 14;
  text(`Operador: ${r.operator_name || '—'}   Situação: ${nc ? nc + ' item(ns) NC' : 'Tudo conforme'}`, M, 10, bold, nc ? rgb(0.8, 0.1, 0.1) : rgb(0.1, 0.5, 0.2)); y -= 20;
  for (const i of items) {
    const ans = itemAnswer(i);
    const lines = wrap(`${i?.group ? i.group + ' - ' : ''}${i?.label || '—'}${i?.observation ? ' (Obs: ' + i.observation + ')' : ''}`, W - 2 * M - 50, 9);
    ensure(lines.length * 11 + 2);
    page.drawText(ans, { x: M + 4, y, size: 9, font: bold, color: ans === 'NC' ? rgb(0.8, 0.1, 0.1) : ans === 'C' ? rgb(0.1, 0.55, 0.2) : rgb(0.4, 0.45, 0.53) });
    for (const l of lines) { page.drawText(l, { x: M + 40, y, size: 9, font }); y -= 11; }
  }
  y -= 6;
  if (r.observations) { for (const l of wrap('Observações: ' + r.observations, W - 2 * M, 9)) { ensure(11); text(l, M, 9); y -= 11; } }
  const photos: [string, string][] = SIDES.map(([k, l]) => [l, r.photos?.[k]] as [string, string]).filter(([, u]) => !!u);
  if (r.photo_url && !photos.some(([, u]) => u === r.photo_url)) photos.push(['Foto extra', r.photo_url]);
  if (photos.length) {
    y -= 10; ensure(20); text('Fotos', M, 12, bold); y -= 16;
    const cw = (W - 2 * M - 12) / 2, ch = 200;
    for (let idx = 0; idx < photos.length; idx++) {
      const [label, url] = photos[idx];
      const col = idx % 2;
      if (col === 0) ensure(ch + 20);
      const x = M + col * (cw + 12);
      page.drawText(safe(label), { x, y, size: 9, font: bold });
      let drawn = false;
      if (embedPhotos) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            const buf = new Uint8Array(await res.arrayBuffer());
            const isPng = buf[0] === 0x89 && buf[1] === 0x50;
            const img = isPng ? await pdf.embedPng(buf) : await pdf.embedJpg(buf);
            const sc = Math.min(cw / img.width, (ch - 14) / img.height);
            page.drawImage(img, { x, y: y - 12 - img.height * sc, width: img.width * sc, height: img.height * sc });
            drawn = true;
          }
        } catch (e) { console.error('foto', url, String(e)); }
      }
      if (!drawn) page.drawText(safe(url).slice(0, 90), { x, y: y - 12, size: 6, font, color: rgb(0.1, 0.3, 0.8) });
      if (col === 1 || idx === photos.length - 1) y -= (drawn || embedPhotos ? ch : 22) + 8;
    }
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

    if (body?.cleanup_root_pdfs === true) {
      // Removes the old per-asset PDFs left directly in the main folder (per-checklist files live in subfolders)
      const lr = await fetch(`${GATEWAY}/me/drive/root:/${encPath(folder)}:/children?$top=999&$select=id,name,file`, { headers: auth });
      const lj = await lr.json();
      const files = (lj.value || []).filter((f: any) => f.file && / - checklists .*\.pdf$/.test(f.name));
      let removed = 0;
      for (const f of files) { const d = await fetch(`${GATEWAY}/me/drive/items/${f.id}`, { method: 'DELETE', headers: auth }); await d.text(); if (d.ok) removed++; }
      return new Response(JSON.stringify({ removed }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

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

    // One PDF per checklist, inside a subfolder per asset
    const embedPhotos = body?.embed_photos !== false && !backfill;
    const gs = Number(body?.offset) || 0;
    const gc = Number(body?.limit) || 100000;
    const batch = records.slice(gs, gs + gc);
    const madeFolders = new Set<string>();
    const ensureFolder = async (path: string) => {
      if (madeFolders.has(path)) return;
      const chk = await fetch(`${GATEWAY}/me/drive/root:/${encPath(path)}`, { headers: auth }); await chk.text();
      if (!chk.ok) {
        const parent = path.split('/').slice(0, -1).join('/');
        const res = await fetch(`${GATEWAY}/me/drive/root:/${encPath(parent)}:/children`, {
          method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: path.split('/').pop(), folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }),
        });
        const b = await res.text();
        if (!res.ok && res.status !== 409) throw new Error(`Falha ao criar pasta [${res.status}]: ${b}`);
      }
      madeFolders.add(path);
    };
    const uploaded: string[] = []; const failed: string[] = [];
    for (const r of batch) {
      const eq = r.eq;
      const label = eq ? `${eq.name}${eq.cost_center ? ` (${eq.cost_center})` : ''}` : 'Sem equipamento';
      const sub = `${folder}/${fileSafe(label)}`;
      await ensureFolder(sub);
      const time = new Date(r.created_at).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
      const name = fileSafe(`${r.date.slice(0, 10)} ${time} - ${label} - ${r.type || 'checklist'} - ${String(r.id).slice(0, 6)}`) + '.pdf';
      const bytes = await buildChecklistPdf(label, r, embedPhotos);
      const res = await fetch(`${GATEWAY}/me/drive/root:/${encPath(`${sub}/${name}`)}:/content`, {
        method: 'PUT', headers: { ...auth, 'Content-Type': 'application/pdf' }, body: bytes,
      });
      const b = await res.text();
      if (res.ok) uploaded.push(name); else { failed.push(name); console.error(`Upload falhou [${res.status}]: ${b}`); }
    }
    const periodLabel = `${fmt(startStr)} a ${fmt(endStr)}`;

    // Delete old checklists from the system (OneDrive copies are kept). Only if every upload of this run worked.
    let deleted = 0;
    if (!skipDelete && failed.length === 0) {
      const { count, error } = await supabase.from('checklists').delete({ count: 'exact' }).lt('date', cutoffStr);
      if (error) throw error;
      deleted = count || 0;
    }

    return new Response(JSON.stringify({ success: failed.length === 0, folder, period: periodLabel, checklists: records.length,  files: uploaded.length, failed, deleted_older_than: cutoffStr, deleted }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
