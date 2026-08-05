/**
 * Guarded service-worker registration + checagem automática de versão.
 * Nunca registra em preview Lovable, iframes ou dev — apenas no app publicado.
 */
const SW_URL = '/sw.js';

type UpdateListener = () => void;
const updateListeners = new Set<UpdateListener>();
let updateReady = false;

export function onUpdateAvailable(listener: UpdateListener) {
  updateListeners.add(listener);
  if (updateReady) listener();
  return () => updateListeners.delete(listener);
}

function notifyUpdate() {
  if (updateReady) return;
  updateReady = true;
  updateListeners.forEach((l) => l());
}

/** Recarrega o app aplicando a versão nova. */
export function applyUpdate() {
  window.location.reload();
}

function isBlockedContext(): boolean {
  if (!import.meta.env.PROD) return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname;
  if (host.startsWith('id-preview--') || host.startsWith('preview--')) return true;
  if (host === 'lovableproject.com' || host.endsWith('.lovableproject.com')) return true;
  if (host === 'lovableproject-dev.com' || host.endsWith('.lovableproject-dev.com')) return true;
  if (host === 'beta.lovable.dev' || host.endsWith('.beta.lovable.dev')) return true;
  if (new URLSearchParams(window.location.search).get('sw') === 'off') return true;
  return false;
}

async function unregisterApp() {
  if (!('serviceWorker' in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    regs
      .filter(r => (r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || '').endsWith(SW_URL))
      .map(r => r.unregister()),
  );
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (isBlockedContext()) {
    void unregisterApp();
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(SW_URL).then((reg) => {
      // Já existe versão nova esperando
      if (reg.waiting && navigator.serviceWorker.controller) notifyUpdate();

      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          // Instalou uma versão nova sobre uma já existente
          if (sw.state === 'installed' && navigator.serviceWorker.controller) notifyUpdate();
        });
      });

      // Checa atualizações ao abrir, a cada 15 min e ao voltar para o app
      const check = () => { reg.update().catch(() => {}); };
      check();
      setInterval(check, 15 * 60 * 1000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    }).catch(() => { /* ignore */ });
  });
}
