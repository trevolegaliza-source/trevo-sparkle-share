import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Shield } from 'lucide-react';
import { toast } from 'sonner';
import logoTrevo from '@/assets/logo-trevo.png';

interface MfaChallengeProps {
  onVerified: () => void;
  onCancel: () => void;
}

export function MfaChallenge({ onVerified, onCancel }: MfaChallengeProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [factorId, setFactorId] = useState('');

  useEffect(() => {
    const getFactors = async () => {
      const { data } = await supabase.auth.mfa.listFactors();
      const totp = data?.totp?.[0];
      if (totp) setFactorId(totp.id);
    };
    getFactors();
  }, []);

  const handleVerify = async () => {
    if (code.length !== 6 || !factorId) return;
    setLoading(true);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });
      if (verifyError) throw verifyError;

      onVerified();
    } catch (e: any) {
      toast.error('Código inválido. Tente novamente.');
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && code.length === 6) handleVerify();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm space-y-6 text-center">
        <img src={logoTrevo} alt="Trevo Legaliza" className="h-16 mx-auto" />

        <div className="space-y-2">
          <Shield className="h-10 w-10 text-primary mx-auto" />
          <h2 className="text-lg font-bold">Verificação em 2 Fatores</h2>
          <p className="text-sm text-muted-foreground">
            Digite o código do seu autenticador<br />
            (Google Authenticator, Authy, etc)
          </p>
        </div>

        <Input
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={handleKeyDown}
          className="text-center text-2xl tracking-[0.5em] font-mono mx-auto max-w-[200px]"
          style={{ fontSize: '24px' }}
          autoFocus
        />

        <Button
          onClick={handleVerify}
          disabled={loading || code.length !== 6}
          className="w-full"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Verificar
        </Button>

        <button
          onClick={onCancel}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Sair e usar outra conta
        </button>
      </div>
    </div>
  );
}
