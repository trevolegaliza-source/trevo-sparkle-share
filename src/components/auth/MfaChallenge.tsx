import { useState, useEffect } from 'react';
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Shield, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import logoTrevo from '@/assets/logo-trevo.png';

interface MfaChallengeProps {
  onVerified: () => void;
  onCancel: () => void;
}

export function MfaChallenge({ onVerified, onCancel }: MfaChallengeProps) {
  const [mode, setMode] = useState<'totp' | 'recovery'>('totp');
  const [code, setCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
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

  // SEC-024 (12/05/2026): valida recovery code. Backend marca usado e
  // remove fatores TOTP do user. UI faz signOut e força relogin — o
  // próximo login cai em forceSetup (SEC-021) pra ele re-enrolar.
  const handleVerifyRecovery = async () => {
    const normalizado = recoveryCode.replace(/[\s-]/g, '').toUpperCase();
    if (normalizado.length !== 12) {
      toast.error('Código tem 12 caracteres (com ou sem hífens).');
      return;
    }
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('Sessão expirada');
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/verify-recovery-code`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            apikey: SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ code: recoveryCode }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || `HTTP ${response.status}`);

      toast.success('Código aceito. Faça login de novo pra configurar 2FA do zero.', { duration: 8000 });
      await supabase.auth.signOut();
    } catch (e: any) {
      toast.error(e.message || 'Falha ao validar código');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    if (mode === 'totp' && code.length === 6) handleVerify();
    if (mode === 'recovery' && recoveryCode.replace(/[\s-]/g, '').length === 12) handleVerifyRecovery();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm space-y-6 text-center">
        <img src={logoTrevo} alt="Trevo Legaliza" className="h-16 mx-auto" />

        {mode === 'totp' ? (
          <>
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

            <div className="flex flex-col gap-2">
              {/* SEC-024: link de recuperação pro master. Pra outros usuários
                  a tabela não tem códigos — backend retorna 403 e a UI mostra
                  o erro. Não escondemos o link pra evitar dar pista de quem
                  é master. */}
              <button
                onClick={() => { setMode('recovery'); setCode(''); }}
                className="text-xs text-primary hover:underline transition-colors"
              >
                Não tenho meu celular — usar código de recuperação
              </button>
              <button
                onClick={onCancel}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Sair e usar outra conta
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <KeyRound className="h-10 w-10 text-primary mx-auto" />
              <h2 className="text-lg font-bold">Código de Recuperação</h2>
              <p className="text-sm text-muted-foreground">
                Digite um dos códigos gerados em Configurações.<br />
                Após validar, seu 2FA será resetado e você terá que configurar de novo.
              </p>
            </div>

            <Input
              type="text"
              maxLength={14}
              placeholder="XXXX-XXXX-XXXX"
              value={recoveryCode}
              onChange={e => setRecoveryCode(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              className="text-center text-lg tracking-[2px] font-mono mx-auto max-w-[260px]"
              autoFocus
            />

            <Button
              onClick={handleVerifyRecovery}
              disabled={loading || recoveryCode.replace(/[\s-]/g, '').length !== 12}
              className="w-full"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Validar e resetar 2FA
            </Button>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => { setMode('totp'); setRecoveryCode(''); }}
                className="text-xs text-primary hover:underline transition-colors"
              >
                Voltar para o código do autenticador
              </button>
              <button
                onClick={onCancel}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Sair e usar outra conta
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
