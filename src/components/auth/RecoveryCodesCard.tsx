import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { KeyRound, Loader2, Copy, Download, Printer, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// SEC-024 (12/05/2026): recovery codes só pra master.
// O backend tem RLS pra leitura por user_id (ele lê os próprios pra
// mostrar status), mas codigo plain nunca é guardado — só hash SHA-256.
// Plain text só aparece na resposta do POST /gerar-recovery-codes (única
// vez) e a UI força o user a salvar antes de fechar o modal.

interface CodeRow {
  id: string;
  used_at: string | null;
  created_at: string;
}

export function RecoveryCodesCard() {
  const [status, setStatus] = useState<{ total: number; disponiveis: number; gerados_em: string | null }>({ total: 0, disponiveis: 0, gerados_em: null });
  const [loading, setLoading] = useState(true);
  const [confirmGerar, setConfirmGerar] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [codigosNovos, setCodigosNovos] = useState<string[] | null>(null);
  const [salvouCheckbox, setSalvouCheckbox] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('mfa_recovery_codes' as any)
      .select('id, used_at, created_at');
    setLoading(false);
    if (error) {
      // Provavelmente RLS bloqueando ou tabela ainda nao existe.
      console.warn('[RecoveryCodes] erro ao carregar status:', error);
      return;
    }
    const rows = (data || []) as unknown as CodeRow[];
    const disponiveis = rows.filter(r => !r.used_at).length;
    const geradosEm = rows[0]?.created_at ?? null;
    setStatus({ total: rows.length, disponiveis, gerados_em: geradosEm });
  };

  useEffect(() => { loadStatus(); }, []);

  const handleGerar = async () => {
    setGerando(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('Sessão expirada');
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/gerar-recovery-codes`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            apikey: SUPABASE_PUBLISHABLE_KEY,
          },
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || `HTTP ${response.status}`);
      setCodigosNovos(result.codigos);
      setSalvouCheckbox(false);
      setConfirmGerar(false);
      await loadStatus();
    } catch (e: any) {
      toast.error('Erro: ' + (e.message || 'tente novamente'));
    } finally {
      setGerando(false);
    }
  };

  const copyTodos = async () => {
    if (!codigosNovos) return;
    const txt = codigosNovos.join('\n');
    await navigator.clipboard.writeText(txt);
    toast.success('8 códigos copiados.');
  };

  const baixarTxt = () => {
    if (!codigosNovos) return;
    const header = `Trevo Legaliza — Códigos de Recuperação 2FA\nGerados em: ${new Date().toLocaleString('pt-BR')}\n\nUSE UMA VEZ CADA. Não compartilhe. Guarde fora do navegador.\n\n`;
    const body = codigosNovos.map((c, i) => `${i + 1}. ${c}`).join('\n');
    const blob = new Blob([header + body + '\n'], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trevo-recovery-codes-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const imprimir = () => {
    if (!codigosNovos) return;
    const w = window.open('', '_blank');
    if (!w) {
      toast.error('Popup bloqueado pelo navegador. Use Baixar .txt e imprima o arquivo.');
      return;
    }
    w.document.write(`<!DOCTYPE html><html><head><title>Recovery Codes — Trevo Legaliza</title>
      <style>body{font-family:monospace;padding:32px;max-width:600px;margin:auto;color:#000;background:#fff}
      h1{font-size:18px;margin:0 0 4px}h2{font-size:12px;color:#666;margin:0 0 24px;font-weight:normal}
      ol{padding-left:24px}li{font-size:20px;padding:8px 0;letter-spacing:2px}
      .aviso{margin-top:24px;padding:12px;border:1px solid #c00;color:#c00;font-size:12px}
      </style></head><body>
      <h1>Trevo Legaliza — Códigos de Recuperação 2FA</h1>
      <h2>Gerados em ${new Date().toLocaleString('pt-BR')}</h2>
      <ol>${codigosNovos.map(c => `<li>${c}</li>`).join('')}</ol>
      <div class="aviso">⚠️ Cada código funciona UMA VEZ. Guarde em local seguro fora do computador. Não compartilhe.</div>
      </body></html>`);
    w.document.close();
    w.print();
  };

  const fecharModal = () => {
    if (!salvouCheckbox) return;
    setCodigosNovos(null);
    setSalvouCheckbox(false);
  };

  const naoTemCodigos = status.disponiveis === 0;
  const poucosCodigos = status.disponiveis > 0 && status.disponiveis <= 2;

  return (
    <>
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4 text-primary" />Códigos de Recuperação</CardTitle>
          <CardDescription>
            Use se você perder o celular do autenticador. Cada código funciona uma vez. Guarde fora do navegador.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30 border border-border/40">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${naoTemCodigos ? 'bg-destructive/15' : poucosCodigos ? 'bg-amber-500/15' : 'bg-emerald-500/15'}`}>
              {naoTemCodigos ? <AlertTriangle className="h-5 w-5 text-destructive" /> : <CheckCircle2 className={`h-5 w-5 ${poucosCodigos ? 'text-amber-500' : 'text-emerald-500'}`} />}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">
                {loading ? 'Carregando...' :
                 naoTemCodigos ? 'Nenhum código disponível' :
                 `${status.disponiveis} de ${status.total} disponíveis`}
              </p>
              <p className="text-xs text-muted-foreground">
                {status.gerados_em
                  ? `Gerados em ${new Date(status.gerados_em).toLocaleDateString('pt-BR')}`
                  : 'Nunca gerados'}
              </p>
            </div>
            <Badge className={naoTemCodigos ? 'bg-destructive/15 text-destructive border-0' : poucosCodigos ? 'bg-amber-500/15 text-amber-500 border-0' : 'bg-emerald-500/15 text-emerald-500 border-0'}>
              {naoTemCodigos ? 'Sem códigos' : poucosCodigos ? 'Acabando' : 'OK'}
            </Badge>
          </div>
          <Button size="sm" onClick={() => setConfirmGerar(true)} className="gap-1.5" disabled={gerando}>
            <KeyRound className="h-3.5 w-3.5" />
            {status.total === 0 ? 'Gerar códigos' : 'Regenerar códigos'}
          </Button>
        </CardContent>
      </Card>

      {/* Confirmação antes de regenerar */}
      <AlertDialog open={confirmGerar} onOpenChange={setConfirmGerar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{status.total === 0 ? 'Gerar' : 'Regenerar'} códigos de recuperação?</AlertDialogTitle>
            <AlertDialogDescription>
              {status.total > 0 && <span className="block mb-2 text-destructive">⚠️ Os códigos anteriores serão invalidados imediatamente, mesmo os não usados.</span>}
              Serão gerados <strong>8 códigos</strong>. Eles só aparecem uma vez — você precisa salvá-los antes de fechar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={gerando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleGerar} disabled={gerando}>
              {gerando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <KeyRound className="h-4 w-4 mr-2" />}
              {status.total === 0 ? 'Gerar' : 'Sim, regenerar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal mostrando códigos novos — UMA vez */}
      <Dialog open={!!codigosNovos} onOpenChange={(o) => { if (!o) fecharModal(); }}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => !salvouCheckbox && e.preventDefault()} onEscapeKeyDown={(e) => !salvouCheckbox && e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4 text-primary" />
              Seus 8 códigos de recuperação
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-500">
              ⚠️ Esta é a <strong>única vez</strong> que estes códigos aparecem. Salve antes de fechar.
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4 font-mono text-sm space-y-1.5">
              {codigosNovos?.map((c, i) => (
                <div key={c} className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs w-6">{i + 1}.</span>
                  <span className="tracking-[2px]">{c}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={copyTodos} className="gap-1.5 flex-1">
                <Copy className="h-3.5 w-3.5" /> Copiar
              </Button>
              <Button size="sm" variant="outline" onClick={baixarTxt} className="gap-1.5 flex-1">
                <Download className="h-3.5 w-3.5" /> Baixar .txt
              </Button>
              <Button size="sm" variant="outline" onClick={imprimir} className="gap-1.5 flex-1">
                <Printer className="h-3.5 w-3.5" /> Imprimir
              </Button>
            </div>
            <div className="flex items-start gap-2 pt-2">
              <Checkbox id="salvei" checked={salvouCheckbox} onCheckedChange={(c) => setSalvouCheckbox(c === true)} />
              <label htmlFor="salvei" className="text-xs leading-snug cursor-pointer">
                Confirmo que <strong>salvei os 8 códigos em local seguro</strong> fora deste navegador. Entendo que eles não aparecem de novo.
              </label>
            </div>
            <Button onClick={fecharModal} disabled={!salvouCheckbox} className="w-full">
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
