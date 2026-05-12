import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Webhook, Loader2, CheckCircle2, Palette, BookOpen, Lock, KeyRound, Eye, EyeOff } from 'lucide-react';
import PlanoContasTab from '@/components/configuracoes/PlanoContasTab';
import GestaoUsuarios from '@/components/configuracoes/GestaoUsuarios';
import { MfaEnroll } from '@/components/auth/MfaEnroll';
import { RecoveryCodesCard } from '@/components/auth/RecoveryCodesCard';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/usePermissions';

// FEAT-MEU-PERFIL (12/05/2026): card de trocar senha pro user logado.
// Antes só era possível via email recovery (REL-019, ainda dependendo de master
// pra Letícia/secretária quando a rota /reset-password não existia).
function TrocarSenhaCard() {
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleTrocar = async () => {
    if (pass.length < 8) { toast.error('Senha deve ter no mínimo 8 caracteres.'); return; }
    if (pass !== pass2) { toast.error('As senhas não conferem.'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pass });
      if (error) throw error;
      toast.success('Senha trocada com sucesso!');
      setPass('');
      setPass2('');
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message || 'tente novamente'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4 text-primary" />Trocar senha</CardTitle>
        <CardDescription>Defina uma nova senha (mínimo 8 caracteres). Aplica só pra você.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 max-w-md">
        <div className="space-y-1.5">
          <Label className="text-xs">Nova senha</Label>
          <div className="relative">
            <Input
              type={show ? 'text' : 'password'}
              value={pass}
              onChange={e => setPass(e.target.value)}
              placeholder="••••••••"
              minLength={8}
              className="pr-10"
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
        <div className="space-y-1.5">
          <Label className="text-xs">Confirmar nova senha</Label>
          <Input
            type="password"
            value={pass2}
            onChange={e => setPass2(e.target.value)}
            placeholder="••••••••"
            minLength={8}
          />
        </div>
        <Button onClick={handleTrocar} disabled={loading || !pass || !pass2} size="sm" className="gap-1.5">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          Trocar senha
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Configuracoes() {
  const { isMaster } = usePermissions();
  const [webhookNovo, setWebhookNovo] = useState('');
  const [webhookQsa, setWebhookQsa] = useState('');
  const [savingWebhooks, setSavingWebhooks] = useState(false);
  const [mfaOpen, setMfaOpen] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);

  useEffect(() => {
    const checkMfa = async () => {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verified = factors?.totp?.find((f: any) => f.status === 'verified');
      setMfaEnabled(!!verified);
    };
    checkMfa();
  }, []);

  useEffect(() => {
    const loadWebhooks = async () => {
      const { data } = await supabase.from('webhook_configs').select('key, url') as any;
      if (data) {
        for (const row of data) {
          if (row.key === 'novo_processo') setWebhookNovo(row.url);
          if (row.key === 'atualizar_qsa') setWebhookQsa(row.url);
        }
      }
    };
    loadWebhooks();
  }, []);

  const handleSaveWebhooks = async () => {
    setSavingWebhooks(true);
    try {
      for (const { key, url } of [
        { key: 'novo_processo', url: webhookNovo },
        { key: 'atualizar_qsa', url: webhookQsa },
      ]) {
        if (!url.trim()) continue;
        const { data: existing } = await supabase.from('webhook_configs').select('id').eq('key', key).single() as any;
        if (existing) {
          await supabase.from('webhook_configs').update({ url: url.trim(), updated_at: new Date().toISOString() } as any).eq('key', key);
        } else {
          await supabase.from('webhook_configs').insert({ key, url: url.trim() } as any);
        }
      }
      toast.success('Webhooks salvos com sucesso!');
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + e.message);
    } finally {
      setSavingWebhooks(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerenciamento do sistema</p>
      </div>

      <Tabs defaultValue="aparencia">
        <TabsList>
          <TabsTrigger value="aparencia" className="gap-1.5"><Palette className="h-3.5 w-3.5" />Aparência</TabsTrigger>
          {isMaster() && <TabsTrigger value="rbac" className="gap-1.5"><Shield className="h-3.5 w-3.5" />Usuários</TabsTrigger>}
          <TabsTrigger value="seguranca" className="gap-1.5"><Lock className="h-3.5 w-3.5" />Segurança</TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-1.5"><Webhook className="h-3.5 w-3.5" />Webhooks</TabsTrigger>
          <TabsTrigger value="plano_contas" className="gap-1.5"><BookOpen className="h-3.5 w-3.5" />Plano de Contas</TabsTrigger>
        </TabsList>

        <TabsContent value="aparencia">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Palette className="h-4 w-4 text-primary" />Aparência</CardTitle>
              <CardDescription>Personalização visual do sistema</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30 border border-border/40">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Palette className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Tema Escuro</p>
                  <p className="text-xs text-muted-foreground">O sistema opera exclusivamente em dark mode para melhor experiência visual.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>


        <TabsContent value="rbac">
          <GestaoUsuarios />
        </TabsContent>

        <TabsContent value="seguranca" className="space-y-4">
          {/* FEAT-MEU-PERFIL (12/05/2026): qualquer user logado pode trocar a
              própria senha aqui — antes só via email recovery (REL-019). */}
          <TrocarSenhaCard />

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Lock className="h-4 w-4 text-primary" />Autenticação em Dois Fatores (2FA)</CardTitle>
              <CardDescription>Proteja sua conta com uma camada extra de segurança usando um app autenticador.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30 border border-border/40">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Status do 2FA</p>
                  <p className="text-xs text-muted-foreground">
                    {mfaEnabled ? 'Autenticação em dois fatores está ativa.' : 'Ainda não configurado.'}
                  </p>
                </div>
                <Badge className={mfaEnabled ? 'bg-emerald-500/15 text-emerald-500 border-0' : 'bg-warning/15 text-warning border-0'}>
                  {mfaEnabled ? 'Ativo' : 'Desativado'}
                </Badge>
              </div>
              {!mfaEnabled && (
                <Button size="sm" onClick={() => setMfaOpen(true)} className="gap-1.5">
                  <Shield className="h-3.5 w-3.5" /> Configurar 2FA
                </Button>
              )}
              {isMaster() && !mfaEnabled && (
                <p className="text-xs text-destructive">⚠️ Obrigatório para usuários Master. Configure agora.</p>
              )}
            </CardContent>
          </Card>
          <MfaEnroll open={mfaOpen} onOpenChange={setMfaOpen} onSuccess={() => setMfaEnabled(true)} />

          {/* SEC-024 (12/05/2026): recovery codes só pra master. */}
          {isMaster() && mfaEnabled && <RecoveryCodesCard />}
        </TabsContent>

        <TabsContent value="webhooks">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Webhook className="h-4 w-4 text-primary" />Integração n8n (Webhooks)</CardTitle>
              <CardDescription>Endpoints para recebimento de dados externos. URLs são salvas automaticamente no banco.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2">
                <Label>Webhook URL (Novo Processo)</Label>
                <Input
                  placeholder="https://seu-n8n.com/webhook/novo-processo"
                  value={webhookNovo}
                  onChange={(e) => setWebhookNovo(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Webhook URL (Atualização QSA)</Label>
                <Input
                  placeholder="https://seu-n8n.com/webhook/atualizar-qsa"
                  value={webhookQsa}
                  onChange={(e) => setWebhookQsa(e.target.value)}
                />
              </div>
              <Button size="sm" className="mt-2" onClick={handleSaveWebhooks} disabled={savingWebhooks}>
                {savingWebhooks ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                Salvar Webhooks
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plano_contas">
          <PlanoContasTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
