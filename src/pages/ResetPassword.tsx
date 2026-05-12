import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff, Lock, CheckCircle, AlertTriangle } from 'lucide-react';
import logoTrevo from '@/assets/logo-trevo.png';

// REL-019 (12/05/2026): rota /reset-password que faltava. Link do email
// de recovery do Supabase cai aqui com um hash `#access_token=...&type=recovery`.
// supabase-js detecta automaticamente e cria uma sessão temporária — basta
// chamar updateUser({ password }) pra concluir a troca.
export default function ResetPassword() {
  const navigate = useNavigate();
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [hasSession, setHasSession] = useState<'checking' | 'ok' | 'invalid'>('checking');

  useEffect(() => {
    // Quando o user clica no link do email, supabase-js detecta o hash e
    // cria sessão automaticamente. Verificamos se tem sessão.
    let cancelled = false;
    (async () => {
      // Pequena espera pro detectSessionInUrl processar o hash
      await new Promise(r => setTimeout(r, 300));
      if (cancelled) return;
      const { data } = await supabase.auth.getSession();
      setHasSession(data.session ? 'ok' : 'invalid');
    })();
    return () => { cancelled = true; };
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pass.length < 8) {
      toast.error('Senha deve ter no mínimo 8 caracteres.');
      return;
    }
    if (pass !== pass2) {
      toast.error('As senhas não conferem.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pass });
      if (error) throw error;
      setDone(true);
      // Aguarda 2s e volta pro login (com signOut pra forçar entrar com a nova senha)
      setTimeout(async () => {
        await supabase.auth.signOut();
        navigate('/');
      }, 2000);
    } catch (err: any) {
      toast.error('Erro ao redefinir: ' + (err?.message || 'tente novamente'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="text-center mb-8">
          <img src={logoTrevo} alt="Trevo Legaliza" className="h-20 mx-auto" />
        </div>

        <div className="glass-card-wrapper">
          <div className="glass-card-inner" style={{ padding: '32px' }}>
            <h2 className="text-lg font-bold text-center mb-2 flex items-center justify-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Redefinir senha
            </h2>

            {hasSession === 'checking' && (
              <div className="text-center py-8 space-y-2">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Validando link…</p>
              </div>
            )}

            {hasSession === 'invalid' && (
              <div className="text-center py-6 space-y-3">
                <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
                <p className="text-sm font-medium">Link inválido ou expirado</p>
                <p className="text-xs text-muted-foreground">
                  O link de recuperação só funciona uma vez e expira após 1 hora.
                  Solicite um novo em "Esqueci minha senha".
                </p>
                <Button variant="outline" onClick={() => navigate('/')} className="mt-2">
                  Voltar ao login
                </Button>
              </div>
            )}

            {hasSession === 'ok' && done && (
              <div className="text-center py-6 space-y-3">
                <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto" />
                <p className="text-sm font-medium">Senha redefinida com sucesso!</p>
                <p className="text-xs text-muted-foreground">
                  Te levando de volta ao login…
                </p>
              </div>
            )}

            {hasSession === 'ok' && !done && (
              <form onSubmit={handleReset} className="space-y-4 mt-4">
                <p className="text-xs text-muted-foreground text-center">
                  Defina sua nova senha (mínimo 8 caracteres).
                </p>
                <div className="space-y-2">
                  <Label className="text-foreground/70">Nova senha</Label>
                  <div className="relative">
                    <Input
                      type={show ? 'text' : 'password'}
                      value={pass}
                      onChange={e => setPass(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={8}
                      autoFocus
                      className="bg-foreground/5 border-foreground/10 pr-10"
                      style={{ fontSize: '16px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShow(!show)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={show ? 'Esconder senha' : 'Mostrar senha'}
                    >
                      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground/70">Confirmar nova senha</Label>
                  <Input
                    type="password"
                    value={pass2}
                    onChange={e => setPass2(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    className="bg-foreground/5 border-foreground/10"
                    style={{ fontSize: '16px' }}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                  Redefinir senha
                </Button>
              </form>
            )}
          </div>
          <div className="glass-card-glow" style={{ background: 'rgba(34, 197, 94, 0.15)' }} />
          <div className="glass-card-shine" />
        </div>

        <p className="text-center text-xs text-muted-foreground/50 mt-8">
          Trevo Legaliza · Assessoria Societária Nacional
        </p>
      </div>
    </div>
  );
}
