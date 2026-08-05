import { useEffect, useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { onUpdateAvailable, applyUpdate } from '@/lib/pwa';

export default function UpdatePrompt() {
  const [available, setAvailable] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const off = onUpdateAvailable(() => setAvailable(true));
    return () => { off(); };
  }, []);

  if (!available) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] p-3 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-md flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg">
        <Sparkles className="w-5 h-5 text-primary flex-shrink-0" />
        <div className="flex-1 text-sm">
          <p className="font-semibold">Nova versão disponível</p>
          <p className="text-muted-foreground text-xs">Atualize para ver as novidades do sistema.</p>
        </div>
        <Button
          size="sm"
          onClick={() => { setUpdating(true); applyUpdate(); }}
          disabled={updating}
        >
          <RefreshCw className={`w-4 h-4 mr-1 ${updating ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>
    </div>
  );
}
