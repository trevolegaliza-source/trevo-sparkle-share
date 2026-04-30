import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { LogIn, Loader2, UserPlus, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import logoTrevo from '@/assets/logo-trevo.png';

function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function validateCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  return digits.length === 11;
}

export default function Login() {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');

  // Login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Register state
  const [regNome, setRegNome] = useState('');
  const [regCpf, setRegCpf] = useState('');
  const [regNascimento, setRegNascimento] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regSuccess, setRegSuccess] = useState(false);

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  // audit fix #31 — mensagens raw do Supabase (PGRST*, AuthApiError códigos
  // técnicos) eram mostradas direto ao usuário. Agora mapeamos pra
  // português user-friendly. Erros não mapeados mostram fallback genérico
  // + mensagem original vai pro console (Thales/admin debugam pelo F12).
  const friendlyAuthError = (raw: string): string => {
    const msg = raw.toLowerCase();
    if (msg.includes('invalid login credentials')) return 'Email ou senha incorretos';
    if (msg.includes('email not confirmed')) return 'Confirme seu email antes de entrar (verifique a caixa de entrada)';
    if (msg.includes('user not found')) return 'Usuário não encontrado';
    if (msg.includes('email rate limit') || msg.includes('over_email_send_rate_limit')) return 'Muitas tentativas. Aguarde alguns minutos.';
    if (msg.includes('too many requests') || msg.includes('rate limit')) return 'Muitas tentativas. Aguarde antes de tentar de novo.';
    if (msg.includes('network') || msg.includes('failed to fetch')) return 'Sem conexão. Verifique sua internet.';
    if (msg.includes('already registered') || msg.includes('user already registered')) return 'Este email já está cadastrado. Use "Entrar".';
    if (msg.includes('password should be') || msg.includes('weak password')) return 'Senha muito fraca. Use no mínimo 8 caracteres.';
    return 'Não foi possível concluir a operação. Tente novamente em instantes.';
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error('Informe email e senha');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.warn('[Login] auth error original:', error.message);
      toast.error(friendlyAuthError(error.message));
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      console.warn('[Login] google oauth error original:', result.error.message);
      toast.error(friendlyAuthError(result.error.message || ''));
    }
    if (result.redirected) return;
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!regNome.trim()) { toast.error('Informe seu nome completo'); return; }
    if (!validateCPF(regCpf)) { toast.error('CPF inválido. Formato: 000.000.000-00'); return; }
    if (!regNascimento) { toast.error('Informe sua data de nascimento'); return; }
    if (!regEmail.trim()) { toast.error('Informe seu email'); return; }
    if (!regEmail.toLowerCase().endsWith('@trevolegaliza.com.br')) {
      toast.error('Apenas emails corporativos @trevolegaliza.com.br são aceitos. Solicite seu email corporativo ao administrador.');
      return;
    }
    if (regPassword.length < 8) { toast.error('A senha deve ter no mínimo 8 caracteres'); return; }
    if (regPassword !== regConfirmPassword) { toast.error('As senhas não conferem'); return; }

    setRegLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: regEmail.trim(),
        password: regPassword,
        options: {
          data: {
            full_name: regNome.trim(),
            nome: regNome.trim(),
            cpf: regCpf.replace(/\D/g, ''),
            data_nascimento: regNascimento,
          },
        },
      });

      if (error) throw error;

      // Update profile with CPF and birth date (the trigger creates it)
      if (data.user) {
        // Small delay for trigger to fire
        await new Promise(r => setTimeout(r, 1000));
        await supabase.from('profiles').update({
          cpf: regCpf.replace(/\D/g, ''),
          data_nascimento: regNascimento,
          nome: regNome.trim(),
        } as any).eq('id', data.user.id);

        // Create notification for admin
        try {
          const { data: masterProfile } = await supabase
            .from('profiles')
            .select('empresa_id')
            .eq('role', 'master')
            .limit(1)
            .single();

          if (masterProfile) {
            await supabase.from('notificacoes').insert({
              tipo: 'aprovacao',
              titulo: '👤 NOVO USUÁRIO AGUARDANDO APROVAÇÃO',
              mensagem: `${regNome.trim()} (${regEmail.trim()}) solicitou acesso ao sistema. Vá em Configurações → Gestão de Usuários para aprovar.`,
              empresa_id: masterProfile.empresa_id,
            } as any);
          }
        } catch {
          // Notification is best-effort
        }
      }

      setRegSuccess(true);
      // Sign out immediately so they can't access anything
      await supabase.auth.signOut();
    } catch (e: any) {
      console.warn('[Login] signUp error original:', e?.message);
      toast.error(friendlyAuthError(e?.message || ''));
    } finally {
      setRegLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) { toast.error('Informe seu email'); return; }
    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setForgotSent(true);
    } catch (e: any) {
      console.warn('[Login] forgot password error original:', e?.message);
      toast.error(friendlyAuthError(e?.message || ''));
    } finally {
      setForgotLoading(false);
    }
  };

  const renderBackground = () => (
    <>
      <div className="fixed inset-0 opacity-[0.03] dark:opacity-[0.03]" style={{
        backgroundImage: 'radial-gradient(circle at 25% 25%, hsl(var(--primary)) 1px, transparent 1px), radial-gradient(circle at 75% 75%, hsl(var(--primary)) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />
      <div className="absolute inset-0 pointer-events-none">
        <div className="glass-ambient w-[500px] h-[500px] bg-emerald-500 top-1/3 left-1/3" />
        <div className="glass-ambient w-[400px] h-[400px] bg-blue-500 bottom-1/4 right-1/4" style={{ opacity: 'calc(var(--glass-glow-opacity) * 0.5)' }} />
      </div>
    </>
  );

  // Registration success screen
  if (regSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
        {renderBackground()}
        <div className="relative z-10 w-full max-w-md mx-4 text-center space-y-6">
          <img src={logoTrevo} alt="Trevo Legaliza" className="h-20 mx-auto logo-pulse" />
          <div className="glass-card-wrapper">
            <div className="glass-card-inner" style={{ padding: '32px' }}>
              <div className="space-y-4">
                <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
                  <UserPlus className="h-8 w-8 text-emerald-500" />
                </div>
                <h2 className="text-lg font-bold text-foreground">Solicitação Enviada!</h2>
                <p className="text-sm text-muted-foreground">
                  Sua solicitação de acesso foi registrada com sucesso. O administrador será notificado e aprovará seu acesso em breve.
                </p>
                <p className="text-xs text-muted-foreground/60">
                  Você receberá acesso assim que o administrador aprovar. Tente fazer login mais tarde.
                </p>
                <Button variant="outline" onClick={() => { setRegSuccess(false); setMode('login'); }} className="mt-4">
                  Voltar para Login
                </Button>
              </div>
            </div>
            <div className="glass-card-glow" style={{ background: 'rgba(34, 197, 94, 0.15)' }} />
            <div className="glass-card-shine" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
      {renderBackground()}

      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="text-center mb-8">
          <img src={logoTrevo} alt="Trevo Legaliza" className="h-20 mx-auto logo-pulse" />
        </div>

        <div className="glass-card-wrapper">
          <div className="glass-card-inner" style={{ padding: '32px' }}>
            <p className="text-sm text-muted-foreground text-center mb-6">
              Sistema de Gestão Societária
            </p>

            {/* ═══ LOGIN MODE ═══ */}
            {mode === 'login' && (
              <>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-foreground/70">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="bg-foreground/5 border-foreground/10 text-foreground placeholder:text-muted-foreground/50"
                      style={{ fontSize: '16px' }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-foreground/70">Senha</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="bg-foreground/5 border-foreground/10 text-foreground placeholder:text-muted-foreground/50 pr-10"
                        style={{ fontSize: '16px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogIn className="h-4 w-4 mr-2" />}
                    Entrar
                  </Button>
                </form>

                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setForgotEmail(email); }}
                  className="text-xs text-muted-foreground/60 hover:text-primary transition-colors block mx-auto mt-3"
                >
                  Esqueci minha senha
                </button>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-foreground/10" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-background px-4 text-muted-foreground/50">ou</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2 bg-foreground/5 border-foreground/10 hover:bg-foreground/10"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Entrar com Google
                </Button>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-foreground/10" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-background px-4 text-muted-foreground/50">novo por aqui?</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                  onClick={() => setMode('register')}
                >
                  <UserPlus className="h-4 w-4" />
                  Solicitar Acesso
                </Button>
              </>
            )}

            {/* ═══ REGISTER MODE ═══ */}
            {mode === 'register' && (
              <>
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
                >
                  <ArrowLeft className="h-3 w-3" /> Voltar para login
                </button>

                <h3 className="text-sm font-semibold mb-4 text-center">Solicitar Acesso</h3>

                <form onSubmit={handleRegister} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-foreground/70">Nome completo *</Label>
                    <Input
                      value={regNome}
                      onChange={e => setRegNome(e.target.value)}
                      placeholder="Seu nome completo"
                      required
                      className="bg-foreground/5 border-foreground/10"
                      style={{ fontSize: '16px' }}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-foreground/70">CPF *</Label>
                    <Input
                      value={regCpf}
                      onChange={e => setRegCpf(formatCPF(e.target.value))}
                      placeholder="000.000.000-00"
                      required
                      className="bg-foreground/5 border-foreground/10"
                      style={{ fontSize: '16px' }}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-foreground/70">Data de nascimento *</Label>
                    <Input
                      type="date"
                      value={regNascimento}
                      onChange={e => setRegNascimento(e.target.value)}
                      required
                      className="bg-foreground/5 border-foreground/10"
                      style={{ fontSize: '16px' }}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-foreground/70">Email corporativo *</Label>
                    <Input
                      type="email"
                      value={regEmail}
                      onChange={e => setRegEmail(e.target.value)}
                      placeholder="seu.nome@trevolegaliza.com.br"
                      required
                      className="bg-foreground/5 border-foreground/10"
                      style={{ fontSize: '16px' }}
                    />
                    <p className="text-[10px] text-muted-foreground/60">
                      Apenas emails @trevolegaliza.com.br são aceitos
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-foreground/70">Senha * (mínimo 8 caracteres)</Label>
                    <div className="relative">
                      <Input
                        type={showRegPassword ? 'text' : 'password'}
                        value={regPassword}
                        onChange={e => setRegPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        minLength={8}
                        className="bg-foreground/5 border-foreground/10 pr-10"
                        style={{ fontSize: '16px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-foreground/70">Confirmar senha *</Label>
                    <Input
                      type="password"
                      value={regConfirmPassword}
                      onChange={e => setRegConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="bg-foreground/5 border-foreground/10"
                      style={{ fontSize: '16px' }}
                    />
                  </div>

                  <Button type="submit" className="w-full gap-2 mt-2" disabled={regLoading}>
                    {regLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                    Solicitar Acesso
                  </Button>
                </form>
              </>
            )}

            {/* ═══ FORGOT PASSWORD MODE ═══ */}
            {mode === 'forgot' && (
              <>
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
                >
                  <ArrowLeft className="h-3 w-3" /> Voltar para login
                </button>

                {forgotSent ? (
                  <div className="text-center space-y-3 py-4">
                    <p className="text-sm font-medium text-foreground">Email enviado!</p>
                    <p className="text-xs text-muted-foreground">
                      Se o email estiver cadastrado, você receberá um link para redefinir sua senha.
                    </p>
                    <Button variant="outline" onClick={() => { setForgotSent(false); setMode('login'); }}>
                      Voltar para Login
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <h3 className="text-sm font-semibold text-center">Esqueci minha senha</h3>
                    <p className="text-xs text-muted-foreground text-center">
                      Informe seu email para receber o link de redefinição.
                    </p>
                    <div className="space-y-2">
                      <Label className="text-foreground/70">E-mail</Label>
                      <Input
                        type="email"
                        value={forgotEmail}
                        onChange={e => setForgotEmail(e.target.value)}
                        placeholder="seu@email.com"
                        required
                        className="bg-foreground/5 border-foreground/10"
                        style={{ fontSize: '16px' }}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={forgotLoading}>
                      {forgotLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Enviar Link de Reset
                    </Button>
                  </form>
                )}
              </>
            )}

            <p className="text-[10px] text-muted-foreground/50 text-center mt-6">
              Trevo Engine v10 · © {new Date().getFullYear()} Trevo Legaliza
            </p>
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
