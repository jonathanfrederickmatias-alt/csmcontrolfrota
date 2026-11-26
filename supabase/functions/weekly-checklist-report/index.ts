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

const LOGO_URL = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/photos/branding/logo-csm-pdf.jpg`;
let logoBytes: Uint8Array | null = null;
const NAVY = rgb(0.11, 0.2, 0.36), LIGHT = rgb(0.94, 0.95, 0.97), BORDER = rgb(0.8, 0.83, 0.87);
const GREEN = rgb(0.16, 0.6, 0.27), RED = rgb(0.85, 0.15, 0.15), GRAY = rgb(0.55, 0.58, 0.62), WHITE = rgb(1, 1, 1), INK = rgb(0.08, 0.1, 0.16);

async function buildChecklistPdf(eqLabel: string, r: any, embedPhotos: boolean) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595, H = 842, M = 30, CW = W - 2 * M;
  const safe = (s: any) => String(s ?? '—').replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '');
  const wrap = (s: string, w: number, sz: number, f = font) => {
    const words = safe(s).split(' '); const lines: string[] = []; let cur = '';
    for (const wd of words) { const t = cur ? cur + ' ' + wd : wd; if (f.widthOfTextAtSize(t, sz) > w && cur) { lines.push(cur); cur = wd; } else cur = t; }
    if (cur) lines.push(cur); return lines.length ? lines : [''];
  };
  let page = pdf.addPage([W, H]); let y = H - M;
  const T = (s: string, x: number, yy: number, sz = 9, f = font, color = INK) => page.drawText(safe(s), { x, y: yy, size: sz, font: f, color });

  // Header: logo + navy title box
  try {
    if (!logoBytes) { const lr = await fetch(LOGO_URL); if (lr.ok) logoBytes = new Uint8Array(await lr.arrayBuffer()); }
    if (logoBytes) { const lg = await pdf.embedJpg(logoBytes); const lh = 62, lw = lg.width * lh / lg.height; page.drawImage(lg, { x: M, y: y - lh, width: lw, height: lh }); }
  } catch (e) { console.error('logo', String(e)); }
  const bx = M + 240, bw = W - M - bx, bh = 62;
  page.drawRectangle({ x: bx, y: y - bh, width: bw, height: bh, color: NAVY });
  page.drawLine({ start: { x: bx - 14, y: y - 4 }, end: { x: bx - 14, y: y - bh + 4 }, thickness: 1, color: BORDER });
  const title = 'CHECKLIST'; T(title, bx + (bw - bold.widthOfTextAtSize(title, 22)) / 2, y - 28, 22, bold, WHITE);
  let sub = safe(eqLabel).toUpperCase(); let ssz = 13; while (bold.widthOfTextAtSize(sub, ssz) > bw - 16 && ssz > 7) ssz -= 0.5;
  T(sub, bx + (bw - bold.widthOfTextAtSize(sub, ssz)) / 2, y - 48, ssz, bold, WHITE);
  y -= bh + 14;

  // Info panel
  const items = Array.isArray(r.items) ? r.items : [];
  const nc = items.filter((i: any) => i?.checked === false && !i?.na).length;
  page.drawRectangle({ x: M, y: y - 52, width: CW, height: 52, color: LIGHT, borderColor: BORDER, borderWidth: 0.6 });
  const third = CW / 3;
  const info = (label: string, val: string, x: number, yy: number, color = INK) => { T(label, x, yy, 10, bold); T(val, x + bold.widthOfTextAtSize(label, 10) + 4, yy, 10, font, color); };
  info('Data:', fmt(r.date), M + 10, y - 18);
  info('Tipo:', r.type || '—', M + third + 10, y - 18);
  info('Horím./Km:', String(r.hour_meter ?? '—'), M + 2 * third + 10, y - 18);
  page.drawLine({ start: { x: M + 6, y: y - 27 }, end: { x: M + CW - 6, y: y - 27 }, thickness: 0.5, color: BORDER });
  info('Operador:', r.operator_name || '—', M + 10, y - 43);
  info('Situação:', nc ? `${nc} item(ns) NC` : 'Tudo conforme', M + CW / 2 + 10, y - 43, nc ? RED : GREEN);
  y -= 66;

  // Items table
  const cols = [{ h: 'Item', w: 40 }, { h: 'Descrição', w: 300 }, { h: 'Status', w: 60 }, { h: 'Observações', w: CW - 400 }];
  const header = () => {
    page.drawRectangle({ x: M, y: y - 18, width: CW, height: 18, color: NAVY });
    let x = M; for (const c of cols) { T(c.h, x + (c.h === 'Descrição' || c.h === 'Observações' ? 6 : (c.w - bold.widthOfTextAtSize(c.h, 9)) / 2), y - 12.5, 9, bold, WHITE); x += c.w; }
    y -= 18;
  };
  const statusIcon = (ans: string, cx: number, cy: number) => {
    const color = ans === 'C' ? GREEN : ans === 'NC' ? RED : GRAY;
    page.drawCircle({ x: cx, y: cy, size: 6.5, color });
    if (ans === 'C') { page.drawLine({ start: { x: cx - 3, y: cy }, end: { x: cx - 0.8, y: cy - 2.5 }, thickness: 1.5, color: WHITE }); page.drawLine({ start: { x: cx - 0.8, y: cy - 2.5 }, end: { x: cx + 3.2, y: cy + 2.6 }, thickness: 1.5, color: WHITE }); }
    else if (ans === 'NC') { page.drawLine({ start: { x: cx - 2.6, y: cy - 2.6 }, end: { x: cx + 2.6, y: cy + 2.6 }, thickness: 1.5, color: WHITE }); page.drawLine({ start: { x: cx - 2.6, y: cy + 2.6 }, end: { x: cx + 2.6, y: cy - 2.6 }, thickness: 1.5, color: WHITE }); }
    else { const t = ans === 'N/A' ? 'N/A' : '—'; T(t, cx - bold.widthOfTextAtSize(t, 5) / 2, cy - 1.8, 5, bold, WHITE); }
  };
  header();
  items.forEach((i: any, idx: number) => {
    const ans = itemAnswer(i);
    const desc = wrap(`${i?.group ? i.group + ' - ' : ''}${i?.label || '—'}`, cols[1].w - 12, 9);
    const obs = i?.observation ? wrap(i.observation, cols[3].w - 10, 8) : [''];
    const rh = Math.max(18, Math.max(desc.length * 11, obs.length * 10) + 7);
    if (y - rh < M) { page = pdf.addPage([W, H]); y = H - M; header(); }
    page.drawRectangle({ x: M, y: y - rh, width: CW, height: rh, borderColor: BORDER, borderWidth: 0.5, color: idx % 2 ? LIGHT : WHITE });
    let x = M; for (const c of cols.slice(0, -1)) { x += c.w; page.drawLine({ start: { x, y }, end: { x, y: y - rh }, thickness: 0.5, color: BORDER }); }
    const num = String(idx + 1).padStart(2, '0');
    T(num, M + (40 - font.widthOfTextAtSize(num, 9)) / 2, y - 12.5, 9);
    desc.forEach((l, k) => T(l, M + 46, y - 12.5 - k * 11, 9));
    statusIcon(ans, M + 340 + 30, y - rh / 2);
    obs.forEach((l, k) => T(l, M + 406, y - 12 - k * 10, 8, font, RED));
    y -= rh;
  });
  y -= 10;
  if (r.observations) {
    const lines = wrap(r.observations, CW - 20, 9);
    const h = lines.length * 11 + 22;
    if (y - h < M) { page = pdf.addPage([W, H]); y = H - M; }
    page.drawRectangle({ x: M, y: y - h, width: CW, height: h, color: LIGHT, borderColor: BORDER, borderWidth: 0.5 });
    T('Observações gerais', M + 10, y - 14, 10, bold);
    lines.forEach((l, k) => T(l, M + 10, y - 28 - k * 11, 9));
    y -= h + 10;
  }

  // Photos
  const photos: [string, string][] = SIDES.map(([k, l]) => [l, r.photos?.[k]] as [string, string]).filter(([, u]) => !!u);
  if (r.photo_url && !photos.some(([, u]) => u === r.photo_url)) photos.push(['Foto extra', r.photo_url]);
  if (photos.length) {
    if (y - 60 < M) { page = pdf.addPage([W, H]); y = H - M; }
    page.drawRectangle({ x: M, y: y - 20, width: CW, height: 20, color: NAVY });
    T('Fotos', M + 10, y - 14, 11, bold, WHITE); y -= 28;
    const cw = (CW - 12) / 2, ch = 190;
    for (let idx = 0; idx < photos.length; idx++) {
      const [label, url] = photos[idx]; const col = idx % 2;
      if (col === 0 && y - ch - 16 < M) { page = pdf.addPage([W, H]); y = H - M; }
      const x = M + col * (cw + 12);
      T(label, x, y - 9, 9, bold);
      page.drawRectangle({ x, y: y - 14 - ch, width: cw, height: ch, borderColor: BORDER, borderWidth: 0.6 });
      let drawn = false;
      if (embedPhotos) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            const buf = new Uint8Array(await res.arrayBuffer());
            const img = buf[0] === 0x89 && buf[1] === 0x50 ? await pdf.embedPng(buf) : await pdf.embedJpg(buf);
            const sc = Math.min((cw - 8) / img.width, (ch - 8) / img.height);
            const iw = img.width * sc, ih = img.height * sc;
            page.drawImage(img, { x: x + (cw - iw) / 2, y: y - 14 - ch + (ch - ih) / 2, width: iw, height: ih });
            drawn = true;
          }
        } catch (e) { console.error('foto', url, String(e)); }
      }
      if (!drawn) wrap(url, cw - 10, 6).slice(0, 4).forEach((l, k) => T(l, x + 5, y - 30 - k * 8, 6, font, rgb(0.1, 0.3, 0.8)));
      if (col === 1 || idx === photos.length - 1) y -= ch + 24;
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
    const embedPhotos = body?.embed_photos === true || (body?.embed_photos !== false && !backfill);
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
    if (body?.preview_id) {
      const { data: one } = await supabase.from('checklists').select('*, eq:equipment_id(name, cost_center, plate)').eq('id', body.preview_id).single();
      const bytes = await buildChecklistPdf(one.eq ? `${one.eq.name}${one.eq.cost_center ? ` (${one.eq.cost_center})` : ''}` : 'Sem equipamento', one, true);
      return new Response(bytes, { headers: { ...corsHeaders, 'Content-Type': 'application/pdf' } });
    }
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
