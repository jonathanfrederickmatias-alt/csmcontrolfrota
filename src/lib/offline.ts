import { supabase } from '@/integrations/supabase/client';

/**
 * Offline-first queue for checklists, maintenance requests and fuel records.
 * Records made without internet are stored in IndexedDB (payload + photos)
 * and pushed to the backend automatically as soon as the device reconnects.
 */

const DB_NAME = 'csm-offline';
const DB_VERSION = 1;
const QUEUE_STORE = 'queue';
const PHOTO_STORE = 'photos';
const EQUIP_CACHE_KEY = 'csm-offline-equipments';

export const OFFLINE_PHOTO_PREFIX = 'offline://';

export type QueueOp =
  | { kind: 'insert'; table: 'checklists' | 'maintenance_requests' | 'fuel_records'; payload: Record<string, unknown> }
  | { kind: 'hour_meter'; equipmentId: string; hourMeter: number };

export interface QueueItem {
  id: string;
  label: string;
  createdAt: string;
  attempts: number;
  lastError?: string;
  op: QueueOp;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) db.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(PHOTO_STORE)) db.createObjectStore(PHOTO_STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode);
    const request = fn(t.objectStore(store));
    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error);
    t.oncomplete = () => db.close();
  });
}

const CHANGE_EVENT = 'csm-offline-queue-changed';
function emitChange() {
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}
export function onQueueChange(cb: () => void) {
  window.addEventListener(CHANGE_EVENT, cb);
  return () => window.removeEventListener(CHANGE_EVENT, cb);
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/* ---------------- Photos ---------------- */

export async function savePhotoOffline(file: File): Promise<string> {
  const id = newId();
  await tx(PHOTO_STORE, 'readwrite', s => s.put({ id, blob: file, name: file.name, type: file.type }));
  return `${OFFLINE_PHOTO_PREFIX}${id}`;
}

async function getPhoto(id: string): Promise<{ id: string; blob: Blob; name: string } | undefined> {
  return tx(PHOTO_STORE, 'readonly', s => s.get(id));
}

async function deletePhoto(id: string) {
  await tx(PHOTO_STORE, 'readwrite', s => s.delete(id));
}

async function uploadPhoto(blob: Blob, name: string): Promise<string> {
  const ext = (name.split('.').pop() || 'jpg').toLowerCase();
  const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from('photos').upload(path, blob, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  return supabase.storage.from('photos').getPublicUrl(path).data.publicUrl;
}

/** Uploads a file right away; falls back to the offline store when there is no connection. */
export async function uploadOrQueuePhoto(file: File): Promise<string> {
  if (!navigator.onLine) return savePhotoOffline(file);
  try {
    return await uploadPhoto(file, file.name);
  } catch {
    return savePhotoOffline(file);
  }
}

export async function getOfflinePhotoUrl(ref: string): Promise<string | null> {
  if (!ref.startsWith(OFFLINE_PHOTO_PREFIX)) return ref;
  const rec = await getPhoto(ref.slice(OFFLINE_PHOTO_PREFIX.length));
  return rec ? URL.createObjectURL(rec.blob) : null;
}

/** Replaces every offline:// reference inside a payload by a real public URL. */
async function resolvePhotoRefs(value: unknown): Promise<unknown> {
  if (typeof value === 'string' && value.startsWith(OFFLINE_PHOTO_PREFIX)) {
    const id = value.slice(OFFLINE_PHOTO_PREFIX.length);
    const rec = await getPhoto(id);
    if (!rec) return null;
    const url = await uploadPhoto(rec.blob, rec.name);
    await deletePhoto(id);
    return url;
  }
  if (Array.isArray(value)) {
    const out = [];
    for (const v of value) out.push(await resolvePhotoRefs(v));
    return out;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = await resolvePhotoRefs(v);
    return out;
  }
  return value;
}

/* ---------------- Queue ---------------- */

export async function getQueue(): Promise<QueueItem[]> {
  const items = await tx<QueueItem[]>(QUEUE_STORE, 'readonly', s => s.getAll());
  return (items || []).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getPendingCount(): Promise<number> {
  return (await getQueue()).length;
}

export async function enqueue(op: QueueOp, label: string): Promise<void> {
  const item: QueueItem = { id: newId(), label, createdAt: new Date().toISOString(), attempts: 0, op };
  await tx(QUEUE_STORE, 'readwrite', s => s.put(item));
  emitChange();
}

export async function removeFromQueue(id: string) {
  await tx(QUEUE_STORE, 'readwrite', s => s.delete(id));
  emitChange();
}

async function runOp(op: QueueOp) {
  if (op.kind === 'insert') {
    const payload = (await resolvePhotoRefs(op.payload)) as Record<string, never>;
    const { error } = await supabase.from(op.table).insert([payload] as never);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from('equipments')
    .update({ current_hour_meter: op.hourMeter, updated_at: new Date().toISOString() })
    .eq('id', op.equipmentId)
    .lt('current_hour_meter', op.hourMeter);
  if (error) throw error;
}

let syncing = false;

/** Sends everything that is pending. Safe to call repeatedly. */
export async function syncQueue(): Promise<{ sent: number; failed: number }> {
  if (syncing || !navigator.onLine) return { sent: 0, failed: 0 };
  syncing = true;
  let sent = 0;
  let failed = 0;
  try {
    const items = await getQueue();
    for (const item of items) {
      try {
        await runOp(item.op);
        await tx(QUEUE_STORE, 'readwrite', s => s.delete(item.id));
        sent++;
      } catch (e) {
        failed++;
        const updated: QueueItem = {
          ...item,
          attempts: item.attempts + 1,
          lastError: e instanceof Error ? e.message : String(e),
        };
        await tx(QUEUE_STORE, 'readwrite', s => s.put(updated));
      }
    }
  } finally {
    syncing = false;
    emitChange();
  }
  return { sent, failed };
}

/**
 * Inserts a record when online, otherwise stores it locally for later sync.
 * Returns true when the record was queued instead of sent.
 */
export async function submitRecord(
  table: 'checklists' | 'maintenance_requests' | 'fuel_records',
  payload: Record<string, unknown>,
  label: string,
): Promise<{ queued: boolean }> {
  const hasOfflinePhoto = JSON.stringify(payload).includes(OFFLINE_PHOTO_PREFIX);
  if (navigator.onLine && !hasOfflinePhoto) {
    const { error } = await supabase.from(table).insert([payload] as never);
    if (!error) return { queued: false };
  }
  await enqueue({ kind: 'insert', table, payload }, label);
  if (navigator.onLine) await syncQueue();
  return { queued: !navigator.onLine };
}

export async function submitHourMeter(equipmentId: string, hourMeter: number) {
  if (navigator.onLine) {
    const { error } = await supabase
      .from('equipments')
      .update({ current_hour_meter: hourMeter, updated_at: new Date().toISOString() })
      .eq('id', equipmentId)
      .lt('current_hour_meter', hourMeter);
    if (!error) return;
  }
  await enqueue({ kind: 'hour_meter', equipmentId, hourMeter }, 'Atualização de horímetro');
}

/* ---------------- Equipment cache (so forms work offline) ---------------- */

export function cacheEquipments(list: unknown[]) {
  try {
    localStorage.setItem(EQUIP_CACHE_KEY, JSON.stringify(list));
  } catch { /* storage full — ignore */ }
}

export function getCachedEquipments<T>(): T[] {
  try {
    const raw = localStorage.getItem(EQUIP_CACHE_KEY);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch { return []; }
}

/** Loads equipments from the backend, falling back to the local cache when offline. */
export async function loadEquipments<T>(): Promise<T[]> {
  if (navigator.onLine) {
    const { data, error } = await supabase.from('equipments').select('*').order('name');
    if (!error && data) {
      cacheEquipments(data);
      return data as T[];
    }
  }
  return getCachedEquipments<T>();
}

/* ---------------- Auto sync ---------------- */

let started = false;
export function startAutoSync() {
  if (started) return;
  started = true;
  window.addEventListener('online', () => { void syncQueue(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncQueue();
  });
  setInterval(() => { void syncQueue(); }, 60_000);
  void syncQueue();
}
