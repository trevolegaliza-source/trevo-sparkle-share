import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Shield, Loader2, CheckCircle2, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface MfaEnrollProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  forceSetup?: boolean;
}

export function MfaEnroll({ open, onOpenChange, onSuccess, forceSetup }: MfaEnrollProps) {
  const [step, setStep] = useState<'qr' | 'verify' | 'done'>('qr');
  const [qrUri, setQrUri] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  const startEnroll = async () => {
    setEnrolling(true);
    try {
      // Remove any pending unverified factor first
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const pendente = factors?.totp?.find((f: any) => f.status === 'unverified');
      if (pendente) {
        await supabase.auth.mfa.unenroll({ factorId: pendente.id });
      }

      let { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Trevo Legaliza',
      });

      // Fallback: if name conflict persists, enroll without friendlyName
      if (error?.message?.includes('already exists')) {
        const retry = await supabase.auth.mfa.enroll({ factorType: 'totp' });
        data = retry.data;
        error = retry.error;
      }

      if (error) throw error;
      if (data?.totp?.qr_code) {
        setQrUri(data.totp.qr_code);
        setTotpSecret(data.totp.secret || '');
        setFactorId(data.id);
        setStep('qr');
      }
    } catch (e: any) {
      toast.error('Erro ao configurar 2FA: ' + e.message);
    } finally {
      setEnrolling(false);
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6) return;
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

      setStep('done');
      toast.success('2FA ativado com sucesso!');
      onSuccess?.();
    } catch (e: any) {
      toast.error('Código inválido: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (o: boolean) => {
    if (!o && forceSetup) return; // Can't close if forced
    if (!o) {
      setStep('qr');
      setCode('');
      setQrUri('');
      setTotpSecret('');
    }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Shield className="h-4 w-4 text-primary" />
            Configurar 2FA
          </DialogTitle>
        </DialogHeader>

        {step === 'qr' && !qrUri && (
          <div className="space-y-4 text-center py-4">
            <p className="text-sm text-muted-foreground">
              A autenticação em dois fatores adiciona uma camada extra de segurança à sua conta.
            </p>
            <Button onClick={startEnroll} disabled={enrolling} className="gap-2">
              {enrolling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
              Começar Configuração
            </Button>
          </div>
        )}

        {step === 'qr' && qrUri && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Escaneie o QR Code com seu app autenticador (Google Authenticator, Authy, etc):
            </p>
            <div className="flex justify-center p-4 bg-white rounded-lg">
              <img src={qrUri} alt="QR Code 2FA" className="w-48 h-48" />
            </div>
            {totpSecret && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Ou copie o código manualmente:</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={totpSecret}
                    className="font-mono text-sm tracking-[2px] text-foreground"
                    style={{ fontSize: '14px', letterSpacing: '2px' }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1"
                    onClick={() => {
                      navigator.clipboard.writeText(totpSecret);
                      toast.success('Código copiado!');
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" /> Copiar
                  </Button>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-xs">Código de verificação</Label>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-center text-2xl tracking-[0.5em] font-mono"
                style={{ fontSize: '24px' }}
                autoFocus
              />
            </div>
            <Button onClick={handleVerify} disabled={loading || code.length !== 6} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Verificar e Ativar
            </Button>
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-4 text-center py-4">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <p className="text-sm font-medium">2FA ativado com sucesso!</p>
            <p className="text-xs text-muted-foreground">
              Sempre que fizer login, será solicitado o código do seu autenticador.
            </p>
            <Button onClick={() => handleOpen(false)}>Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
