import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import csmLogo from '@/assets/csm-logo.png';

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      setError('E-mail ou senha incorretos.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src={csmLogo} alt="CSM Construções" className="w-20 h-20 object-contain mx-auto mb-4 rounded-xl" />
          <h1 className="text-3xl font-black">
            <span className="text-gradient">CSM</span>
            <span className="text-foreground">CONTROL</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Gestão de Frota & Manutenção</p>
        </div>

        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-4">Acesso do gestor</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>E-mail</Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="gestor@empresa.com"
                required
                autoComplete="email"
              />
            </div>
            <div>
              <Label>Senha</Label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">{error}</p>
            )}

            <Button type="submit" className="w-full h-11 font-bold" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Entrar
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Operadores: acesse via QR Code do equipamento
        </p>
      </div>
    </div>
  );
}
