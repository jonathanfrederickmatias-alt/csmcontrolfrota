/**
 * Guarded service-worker registration.
 * Never registers inside Lovable preview, iframes or dev — only in the published app.
 */
const SW_URL = '/sw.js';

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
  if (new URLSearchParams(window.location.search).has('sw') &&
      new URLSearchParams(window.location.search).get('sw') === 'off') return true;
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
    navigator.serviceWorker.register(SW_URL).catch(() => { /* ignore */ });
  });
}
