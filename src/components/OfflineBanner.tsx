import { CloudOff, RefreshCw, UploadCloud } from 'lucide-react';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function OfflineBanner() {
  const { online, pending, syncing, sync } = useOfflineQueue();

  if (online && pending === 0) return null;

  const handleSync = async () => {
    const res = await sync();
    if (res.sent > 0) toast.success(`${res.sent} registro(s) enviados.`);
    if (res.failed > 0) toast.error(`${res.failed} registro(s) ainda pendentes.`);
  };

  return (
    <div
      className={`sticky top-0 z-40 flex items-center gap-2 px-4 py-2 text-sm ${
        online ? 'bg-warning/15 text-warning-foreground' : 'bg-destructive/15 text-destructive'
      }`}
    >
      {online ? <UploadCloud className="w-4 h-4 flex-shrink-0" /> : <CloudOff className="w-4 h-4 flex-shrink-0" />}
      <span className="flex-1">
        {online
          ? `${pending} registro(s) aguardando envio.`
          : `Sem internet — os registros ficam salvos no aparelho${pending ? ` (${pending} pendente(s))` : ''}.`}
      </span>
      {online && (
        <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing} className="h-7">
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${syncing ? 'animate-spin' : ''}`} />
          Enviar agora
        </Button>
      )}
    </div>
  );
}
