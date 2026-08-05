import { registerSW } from 'virtual:pwa-register';

/**
 * Registro protegido do service worker e atualização controlada do PWA.
 * Nunca registra em preview Lovable, iframes ou dev — apenas no app publicado.
 */
const SW_URL = '/sw.js';

type UpdateListener = () => void;
const updateListeners = new Set<UpdateListener>();
let updateReady = false;
let installUpdate: ((reloadPage?: boolean) => Promise<void>) | null = null;

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

/** Ativa o novo service worker e recarrega somente após ele assumir o app. */
export async function applyUpdate() {
  if (!installUpdate) {
    window.location.reload();
    return;
  }
  await installUpdate(true);
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

  installUpdate = registerSW({
    immediate: true,
    onNeedRefresh: notifyUpdate,
    onRegisteredSW: (_swUrl, registration) => {
      if (!registration) return;

      // Checa atualizações ao abrir, a cada 15 min e ao voltar para o app.
      const check = () => { registration.update().catch(() => {}); };
      check();
      window.setInterval(check, 15 * 60 * 1000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
    onRegisterError: () => { /* funcionamento online continua disponível */ },
  });
}
