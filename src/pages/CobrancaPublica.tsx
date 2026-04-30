import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Loader2,
  Copy,
  Check,
  Download,
  MessageCircle,
  CheckCircle2,
  AlertCircle,
  XCircle,
  FileText,
  Calendar,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import logoTrevo from '@/assets/logo-trevo.png';
import { consolidarObservacoes } from '@/lib/observacao-processo';

interface Taxa {
  descricao: string;
  valor: number;
  categoria?: string | null;
  comprovante_url?: string | null;
}

interface LancamentoCobranca {
  id: string;
  descricao: string;
  valor: number;
  razao_social: string | null;
  tipo_processo: string | null;
  taxas: Taxa[];
  comprovante_url?: string | null;
  observacoes_processo?: string | null;
  observacoes_financeiro?: string | null;
}

interface EmpresaConfig {
  nome: string;
  cnpj: string;
  pix_chave: string;
  pix_banco: string;
  whatsapp: string;
  site: string;
}

interface AsaasInfo {
  payment_id: string | null;
  status: string | null;
  invoice_url: string | null;
  boleto_url: string | null;
  boleto_barcode: string | null;
  pix_qrcode: string | null;
  pix_payload: string | null;
  gerado_em: string | null;
  pago_em: string | null;
}

interface CobrancaData {
  id: string;
  cliente_nome: string;
  cliente_apelido: string | null;
  cliente_cnpj: string | null;
  cliente_nome_contador: string | null;
  total_honorarios: number;
  total_taxas: number;
  total_geral: number;
  data_vencimento: string | null;
  status: 'ativa' | 'vencida' | 'paga' | 'cancelada';
  created_at: string;
  lancamentos: LancamentoCobranca[];
  empresa_config: EmpresaConfig;
  pago_em?: string | null;
  extrato_id?: string | null;
  asaas?: AsaasInfo | null;
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtData = (iso: string | null | undefined) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const TIPO_BADGE: Record<string, string> = {
  abertura: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  alteracao: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  baixa: 'bg-red-500/15 text-red-400 border-red-500/30',
  avulso: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
  transformacao: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  ativa: { label: 'ATIVA', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40' },
  vencida: { label: 'VENCIDA', className: 'bg-amber-500/15 text-amber-400 border-amber-500/40' },
  paga: { label: 'PAGA', className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50' },
  cancelada: { label: 'CANCELADA', className: 'bg-zinc-600/30 text-zinc-300 border-zinc-500/40' },
};

export default function CobrancaPublica() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [cobranca, setCobranca] = useState<CobrancaData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Página pública é dark-only (lookup com cliente B2B). Mas se usuário
    // navega de volta pra app autenticado, dark mode forçado polui o estado.
    // Cleanup: remove a classe quando o componente desmonta.
    const wasAlreadyDark = document.documentElement.classList.contains('dark');
    document.documentElement.classList.add('dark');
    return () => {
      // Só remove se NÃO era dark antes (preserva preferência do app autenticado)
      if (!wasAlreadyDark) {
        document.documentElement.classList.remove('dark');
      }
    };
  }, []);

  useEffect(() => {
    if (!cobranca) return;
    const title = `Cobrança — ${cobranca.cliente_apelido || cobranca.cliente_nome} — Trevo Legaliza`;
    const description = `Cobrança oficial no valor de R$ ${Number(cobranca.total_geral).toFixed(2).replace('.', ',')}. Pague via PIX ou boleto com segurança.`;
    const image = 'https://cobranca.trevolegaliza.com/og-cobranca.png';

    document.title = title;

    const setMeta = (key: 'property' | 'name', value: string, content: string) => {
      let tag = document.querySelector(`meta[${key}="${value}"]`) as HTMLMetaElement | null;
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(key, value);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
    };

    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:image', image);
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:site_name', 'Trevo Legaliza');
    setMeta('name', 'description', description);
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', image);
  }, [cobranca]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const { data, error: rpcError } = await supabase.rpc(
          'get_cobranca_por_token' as any,
          { p_token: token }
        );
        if (cancelled) return;
        if (rpcError) throw rpcError;
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) {
          setError('not_found');
        } else {
          setCobranca(row as CobrancaData);
          // marca como visualizada (fire-and-forget)
          supabase.rpc('mark_cobranca_visualizada' as any, { p_token: token }).then(() => {});
        }
      } catch (e) {
        if (!cancelled) setError('not_found');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [token]);

  const copiarPix = async () => {
    if (!cobranca) return;
    try {
      await navigator.clipboard.writeText(cobranca.empresa_config.pix_chave);
      setCopied(true);
      toast.success('Chave PIX copiada!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Não foi possível copiar.');
    }
  };

  const abrirWhatsApp = () => {
    if (!cobranca) return;
    const msg = encodeURIComponent(
      `Olá! Tenho uma dúvida sobre a cobrança ${cobranca.cliente_nome}`
    );
    window.open(`https://wa.me/${cobranca.empresa_config.whatsapp}?text=${msg}`, '_blank');
  };

  const baixarExtrato = async () => {
    if (!token) return;
    try {
      toast.info('Baixando PDF...');
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cobranca-pdf?token=${encodeURIComponent(token)}`;
      const resp = await fetch(fnUrl, {
        headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      });
      if (!resp.ok) {
        toast.error('PDF indisponível. Fale com a gente pelo WhatsApp.');
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cobranca-${cobranca?.cliente_nome || token}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      toast.success('PDF baixado!');
    } catch {
      toast.error('Erro ao baixar PDF.');
    }
  };

  if (loading) {
    return (
      <div className="dark min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error === 'not_found' || !cobranca) {
    return (
      <div className="dark min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-destructive/40">
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <h1 className="text-xl font-bold text-foreground">Link inválido ou expirado</h1>
            <p className="text-muted-foreground text-sm">
              Não encontramos esta cobrança. Entre em contato conosco para ajuda.
            </p>
            <Button onClick={() => window.open('https://wa.me/5511934927001', '_blank')} className="gap-2">
              <MessageCircle className="h-4 w-4" /> Falar no WhatsApp
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (cobranca.status === 'cancelada') {
    return (
      <div className="dark min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <XCircle className="h-12 w-12 text-muted-foreground mx-auto" />
            <h1 className="text-xl font-bold text-foreground">Cobrança cancelada</h1>
            <p className="text-muted-foreground text-sm">Esta cobrança foi cancelada.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusInfo = STATUS_BADGE[cobranca.status] ?? STATUS_BADGE.ativa;
  const isPaga = cobranca.status === 'paga';
  const empresa = cobranca.empresa_config;
  const saudacao = cobranca.cliente_apelido || cobranca.cliente_nome;

  // Dias até vencimento (ou atraso)
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const venc = cobranca.data_vencimento ? new Date(cobranca.data_vencimento + 'T00:00:00') : null;
  const diffDias = venc ? Math.floor((venc.getTime() - hoje.getTime()) / 86400000) : null;
  const vencimentoLabel = !venc
    ? null
    : diffDias === 0 ? 'Vence hoje'
    : diffDias === 1 ? 'Vence amanhã'
    : diffDias > 1 ? `Vence em ${diffDias} dias`
    : diffDias === -1 ? 'Vencido há 1 dia'
    : `Vencido há ${Math.abs(diffDias!)} dias`;
  const vencimentoCls = diffDias == null ? ''
    : diffDias < 0 ? 'text-red-400'
    : diffDias <= 2 ? 'text-amber-400'
    : 'text-emerald-400';

  const temAsaas = !!cobranca.asaas?.pix_payload;
  const pixValueToCopy = cobranca.asaas?.pix_payload || empresa.pix_chave;

  const copyPix = async () => {
    try {
      await navigator.clipboard.writeText(pixValueToCopy);
      setCopied(true);
      toast.success(temAsaas ? 'PIX copia-e-cola copiado!' : 'Chave PIX copiada!');
      setTimeout(() => setCopied(false), 3000);
    } catch { toast.error('Não foi possível copiar.'); }
  };

  const copyBoleto = async () => {
    try {
      await navigator.clipboard.writeText(cobranca.asaas!.boleto_barcode!);
      toast.success('Linha digitável copiada!');
    } catch { toast.error('Não foi possível copiar.'); }
  };

  return (
    <div className="dark min-h-screen bg-background text-foreground font-sans relative overflow-hidden">
      {/* Background ambient — glow verde intenso no topo */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[800px] pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 90% 60% at 50% 0%, hsl(142 71% 45% / 0.22) 0%, hsl(142 71% 45% / 0.08) 35%, transparent 75%)',
        }}
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[400px] pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 40% 30% at 50% 0%, hsl(142 71% 60% / 0.25) 0%, transparent 80%)',
        }}
      />

      {/* Hero Header — identidade forte */}
      <header className="relative border-b border-emerald-500/20 bg-gradient-to-b from-emerald-950/60 to-transparent">
        <div className="max-w-xl mx-auto px-5 pt-10 pb-8 text-center space-y-4">
          <img
            src={logoTrevo}
            alt="Trevo Legaliza"
            className="h-28 sm:h-32 mx-auto"
            style={{ filter: 'drop-shadow(0 0 24px rgba(34,197,94,0.45)) drop-shadow(0 6px 16px rgba(34,197,94,0.25))' }}
          />
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 shadow-[0_0_20px_rgba(34,197,94,0.25)]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <p className="text-[10px] uppercase tracking-[0.22em] text-emerald-200 font-semibold">
                Cobrança Digital Oficial
              </p>
            </div>
            <p className="text-xs text-muted-foreground/70 pt-0.5">
              {empresa.nome} · CNPJ {empresa.cnpj}
            </p>
          </div>
        </div>
      </header>

      <main className="relative max-w-xl mx-auto px-5 py-8 space-y-8">
        {/* HERO — valor gigante + saudação */}
        <section className="text-center space-y-3 pt-2">
          <p className="text-sm text-muted-foreground">
            Olá, <span className="font-medium text-foreground">{saudacao}</span>
          </p>
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground/70 font-semibold">
            {isPaga ? 'Valor pago' : 'Valor a pagar'}
          </p>
          <h1
            className="text-5xl sm:text-6xl font-bold tabular-nums tracking-tight text-primary leading-none"
            style={{
              textShadow:
                '0 0 12px hsl(142 71% 55% / 0.6), 0 0 36px hsl(142 71% 45% / 0.4), 0 0 70px hsl(142 71% 40% / 0.3)',
            }}
          >
            {fmtBRL(cobranca.total_geral)}
          </h1>
          {!isPaga && vencimentoLabel && (
            <div className="inline-flex items-center gap-2 mt-2">
              <div className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold',
                diffDias != null && diffDias < 0
                  ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                  : diffDias != null && diffDias <= 2
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              )}>
                <Calendar className="h-3 w-3" />
                {vencimentoLabel}
              </div>
              <span className="text-xs text-muted-foreground">
                · {fmtData(cobranca.data_vencimento)}
              </span>
            </div>
          )}
          {isPaga && (
            <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-sm font-semibold">
              <CheckCircle2 className="h-4 w-4" />
              Pagamento confirmado{cobranca.pago_em && ` em ${fmtData(cobranca.pago_em)}`}
            </div>
          )}
        </section>

        {/* Botão principal PIX — dominante, impossível de errar */}
        {!isPaga && (
          <section className="space-y-3">
            <button
              onClick={copyPix}
              className={cn(
                'w-full h-16 rounded-xl font-bold text-base transition-all',
                'flex items-center justify-center gap-2',
                'bg-primary text-primary-foreground hover:opacity-95 active:scale-[0.99]',
                'shadow-[0_0_0_1px_hsl(var(--primary)/0.3),0_8px_24px_-6px_hsl(var(--primary)/0.35)]',
                copied && 'bg-emerald-600 text-emerald-50'
              )}
            >
              {copied ? (
                <><Check className="h-5 w-5" /> Código PIX copiado!</>
              ) : (
                <><Copy className="h-5 w-5" /> {temAsaas ? 'Copiar PIX copia-e-cola' : 'Copiar chave PIX'}</>
              )}
            </button>
            <p className="text-xs text-center text-muted-foreground">
              {temAsaas
                ? 'Cole no app do seu banco · pagamento instantâneo'
                : 'Após copiar a chave, informe o valor no app do banco'}
            </p>
          </section>
        )}

        {/* QR Code colapsável — alternativa discreta */}
        {!isPaga && (
          <details className="group border-t border-border/30 pt-4">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-2 select-none">
              <span>Preferir QR Code?</span>
              <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
            </summary>
            <div className="mt-5 flex flex-col items-center gap-3">
              <div className="bg-white p-4 rounded-2xl shadow-sm">
                {cobranca.asaas?.pix_qrcode ? (
                  <img
                    src={`data:image/png;base64,${cobranca.asaas.pix_qrcode}`}
                    alt="QR Code PIX"
                    className="h-[200px] w-[200px]"
                  />
                ) : (
                  <QRCodeSVG value={pixValueToCopy} size={200} level="M" />
                )}
              </div>
              {!temAsaas && (
                <p className="text-[11px] text-amber-400/90 text-center max-w-xs">
                  QR estático — você precisará digitar o valor manualmente no app.
                </p>
              )}
            </div>
          </details>
        )}

        {/* Processos cobrados — lista limpa, sem accordion */}
        <section className="border-t border-border/30 pt-6 space-y-3">
          <h2 className="text-[11px] uppercase tracking-widest text-muted-foreground/70 font-semibold">
            Processos cobrados
          </h2>
          <div className="divide-y divide-border/40 border border-border/40 rounded-xl bg-card/50">
            {cobranca.lancamentos.map((l) => {
              const tipoCls = TIPO_BADGE[l.tipo_processo || 'avulso'] ?? TIPO_BADGE.avulso;
              const temTaxas = l.taxas && l.taxas.length > 0;
              return (
                <div key={l.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm leading-snug">
                        {l.razao_social || l.descricao}
                      </p>
                      {l.tipo_processo && (
                        <Badge variant="outline" className={cn('text-[10px] mt-1.5 border', tipoCls)}>
                          {l.tipo_processo}
                        </Badge>
                      )}
                    </div>
                    <span className="font-semibold tabular-nums shrink-0 text-sm">
                      {fmtBRL(l.valor)}
                    </span>
                  </div>
                  {temTaxas && (
                    <div className="pt-2 pl-3 space-y-0.5 border-l-2 border-border/40">
                      {l.taxas.map((t, i) => (
                        <div key={i} className="flex justify-between text-[11px] text-muted-foreground">
                          <span>+ {t.descricao}</span>
                          <span className="tabular-nums">{fmtBRL(t.valor)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {(() => {
                    const obs = consolidarObservacoes(l.observacoes_processo, l.observacoes_financeiro);
                    if (!obs) return null;
                    return (
                      <div className="mt-2 pl-3 border-l-2 border-primary/40 bg-primary/5 rounded-r px-2 py-1.5">
                        <p className="text-[10px] uppercase tracking-wider text-primary/80 font-semibold mb-0.5">
                          📝 Observações
                        </p>
                        <p className="text-[11px] text-foreground/85 whitespace-pre-line leading-snug">
                          {obs}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>

          {/* Totais */}
          <div className="pt-2 space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Honorários</span>
              <span className="tabular-nums">{fmtBRL(cobranca.total_honorarios)}</span>
            </div>
            {cobranca.total_taxas > 0 && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Taxas / Reembolsos</span>
                <span className="tabular-nums">{fmtBRL(cobranca.total_taxas)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 mt-2 border-t border-border/40">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Total</span>
              <span className="text-xl font-bold tabular-nums">{fmtBRL(cobranca.total_geral)}</span>
            </div>
          </div>
        </section>

        {/* Boleto — secundário, só se Asaas gerou */}
        {!isPaga && cobranca.asaas?.boleto_url && (
          <section className="border-t border-border/30 pt-6 space-y-3">
            <h2 className="text-[11px] uppercase tracking-widest text-muted-foreground/70 font-semibold">
              Preferir boleto bancário?
            </h2>
            <div className="space-y-2.5">
              <a
                href={cobranca.asaas.boleto_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 h-12 rounded-xl border border-border bg-card hover:bg-accent transition-colors text-sm font-medium"
              >
                <Download className="h-4 w-4" /> Baixar boleto em PDF
              </a>
              {cobranca.asaas.boleto_barcode && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
                    Linha digitável
                  </p>
                  <div className="flex items-center gap-2 bg-background/50 border border-border/60 rounded-lg p-3">
                    <code className="flex-1 text-[11px] font-mono break-all leading-relaxed text-muted-foreground">
                      {cobranca.asaas.boleto_barcode}
                    </code>
                    <button
                      onClick={copyBoleto}
                      className="shrink-0 h-8 w-8 rounded-md hover:bg-accent flex items-center justify-center"
                      aria-label="Copiar linha digitável"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
              {cobranca.asaas.invoice_url && (
                <a
                  href={cobranca.asaas.invoice_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center text-xs text-muted-foreground hover:text-foreground pt-1"
                >
                  Ver página oficial Asaas →
                </a>
              )}
            </div>
          </section>
        )}

        {/* Aviso pra quem não tem boleto ainda */}
        {!isPaga && !cobranca.asaas?.boleto_url && (
          <section className="border-t border-border/30 pt-6">
            <p className="text-xs text-muted-foreground text-center">
              Precisa de <strong className="text-foreground">boleto bancário</strong>? Fale com a gente pelo WhatsApp.
            </p>
          </section>
        )}

        {/* Ações secundárias */}
        <section className="border-t border-border/30 pt-6 grid grid-cols-2 gap-3">
          <button
            onClick={baixarExtrato}
            className="flex items-center justify-center gap-2 h-11 rounded-lg border border-border bg-card hover:bg-accent transition-colors text-sm"
          >
            <Download className="h-4 w-4" /> Baixar extrato
          </button>
          <button
            onClick={abrirWhatsApp}
            className="flex items-center justify-center gap-2 h-11 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors text-sm font-medium"
          >
            <MessageCircle className="h-4 w-4" /> Tirar dúvida
          </button>
        </section>

        {/* Seção Dani — IA da Trevo (primeira pessoa, personalizada) */}
        <section className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/50 via-background to-emerald-950/30 p-5 shadow-[0_0_40px_rgba(34,197,94,0.15)]">
          <div
            aria-hidden
            className="absolute -right-24 -top-24 w-72 h-72 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none"
          />
          <div className="relative flex items-start gap-4">
            <div className="shrink-0">
              <div className="relative">
                <div
                  className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-700 flex items-center justify-center text-2xl shadow-[0_0_20px_rgba(34,197,94,0.45)]"
                >
                  🤖
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-emerald-500 rounded-full border-2 border-background flex items-center justify-center">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                </span>
              </div>
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-emerald-300 text-base">Dani</h3>
                <span className="text-[10px] uppercase tracking-wider bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-semibold">
                  IA da Trevo
                </span>
              </div>
              <p className="text-sm text-foreground/90 leading-relaxed">
                {cobranca.cliente_nome_contador ? (
                  <>Olá, <strong className="text-emerald-300">{cobranca.cliente_nome_contador}</strong>! </>
                ) : (
                  <>Olá! </>
                )}
                Sou a <strong className="text-emerald-300">Dani</strong>, inteligência artificial da Trevo Legaliza.
                Fui eu quem gerou esta cobrança automaticamente e estou acompanhando seu processo 24 horas por dia.
                Qualquer dúvida, chama a gente no WhatsApp que eu sigo cuidando de tudo por aqui. 🍀
              </p>
              <p className="text-[11px] text-emerald-400/80">
                Trevo Legaliza · Assessoria societária com tecnologia de ponta
              </p>
            </div>
          </div>
        </section>

        {/* Siga a Trevo */}
        <section className="text-center space-y-3 border-t border-border/30 pt-6">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-semibold">
            Siga a Trevo Legaliza
          </p>
          <div className="flex items-center justify-center gap-3">
            <a
              href="https://instagram.com/trevolegaliza"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram Trevo Legaliza"
              className="w-11 h-11 rounded-full border border-border/50 bg-card hover:bg-accent hover:border-emerald-500/30 transition-colors flex items-center justify-center"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
              </svg>
            </a>
            <a
              href="https://wa.me/5511934927001"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp Trevo Legaliza"
              className="w-11 h-11 rounded-full border border-border/50 bg-card hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-400 transition-colors flex items-center justify-center"
            >
              <MessageCircle className="h-5 w-5" />
            </a>
            <a
              href={`https://${empresa.site}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Site Trevo Legaliza"
              className="w-11 h-11 rounded-full border border-border/50 bg-card hover:bg-accent hover:border-emerald-500/30 transition-colors flex items-center justify-center"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z" />
              </svg>
            </a>
          </div>
          <p className="text-xs text-muted-foreground/70">
            <strong className="text-foreground">12 anos</strong> · <strong className="text-foreground">24+ estados</strong> · <strong className="text-foreground">100% digital</strong>
          </p>
        </section>

        {/* Dados de emissão */}
        <section className="border-t border-border/30 pt-4 grid grid-cols-2 gap-4 text-xs">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold">Emissão</p>
            <p className="mt-1">{fmtData(cobranca.created_at)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold">Vencimento</p>
            <p className="mt-1">{fmtData(cobranca.data_vencimento)}</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/30 mt-4">
        <div className="max-w-xl mx-auto px-5 py-6 text-center space-y-1.5">
          <p className="text-xs text-muted-foreground">
            Esta cobrança é oficial da <strong className="text-foreground">{empresa.nome}</strong>
          </p>
          <a
            href={`https://${empresa.site}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline inline-block"
          >
            {empresa.site}
          </a>
        </div>
      </footer>
    </div>
  );
}
