import { useEffect, useState, useCallback } from 'react';
import { getQueue, onQueueChange, syncQueue, QueueItem } from '@/lib/offline';

export function useOfflineQueue() {
  const [online, setOnline] = useState(navigator.onLine);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    setItems(await getQueue());
  }, []);

  useEffect(() => {
    void refresh();
    const off = onQueueChange(() => { void refresh(); });
    const on = () => setOnline(true);
    const offline = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', offline);
    return () => {
      off();
      window.removeEventListener('online', on);
      window.removeEventListener('offline', offline);
    };
  }, [refresh]);

  const sync = useCallback(async () => {
    setSyncing(true);
    const res = await syncQueue();
    setSyncing(false);
    await refresh();
    return res;
  }, [refresh]);

  return { online, items, pending: items.length, syncing, sync, refresh };
}
