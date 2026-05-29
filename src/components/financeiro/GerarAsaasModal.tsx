import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, FileBadge, Copy, ExternalLink, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useGerarAsaasCobranca, useCancelarAsaasCobranca, useCobrancaAsaas } from '@/hooks/useAsaas';
import { copyToClipboard } from '@/lib/clipboard';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cobrancaId: string | undefined;
  clienteNome: string;
  total: number;
  /** Default vencimento já existente na cobrança (ou D+3 se não houver). */
  vencimentoSugerido?: string;
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function addDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export default function GerarAsaasModal({
  open, onOpenChange, cobrancaId, clienteNome, total, vencimentoSugerido,
}: Props) {
  const [vencimento, setVencimento] = useState<string>('');
  const [resultado, setResultado] = useState<{
    boletoUrl?: string | null;
    boletoBarcode?: string | null;
    pixPayload?: string | null;
    invoiceUrl?: string | null;
    reused?: boolean;
  } | null>(null);

  const gerarMut = useGerarAsaasCobranca();
  const cancelarMut = useCancelarAsaasCobranca();
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);

  // 27/05 noite: quando modal abre com cobrança JÁ gerada, popula resultado
  // direto do banco em vez de exigir clicar gerar de novo. Permite cancelar.
  const { data: asaasInfo } = useCobrancaAsaas(open ? cobrancaId : undefined);

  // Ao abrir o modal, reseta estado. NÃO depender de vencimentoSugerido
  // aqui — ele muda depois do gerar e zeraria a tela de resultado.
  useEffect(() => {
    if (open) {
      setVencimento((prev) => prev || vencimentoSugerido || addDaysISO(3));
      setResultado(null);
      setConfirmandoCancelar(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 27/05 noite: se ja temos dados Asaas no banco, prepopula resultado
  useEffect(() => {
    if (!open) return;
    if (resultado) return;
    if (!asaasInfo?.payment_id) return;
    setResultado({
      boletoUrl: asaasInfo.boleto_url,
      boletoBarcode: asaasInfo.boleto_barcode,
      pixPayload: asaasInfo.pix_payload,
      invoiceUrl: asaasInfo.invoice_url,
      reused: true,
    });
  }, [open, asaasInfo?.payment_id, resultado]);

  const handleCancelar = async () => {
    if (!cobrancaId) return;
    try {
      await cancelarMut.mutateAsync({ cobrancaId });
      // Fecha modal após cancelar — popup vai mostrar estado atualizado
      onOpenChange(false);
    } catch {
      // toast já no hook
    }
  };

  // Visibilidade do botão cancelar: só se já foi gerado E ainda não foi pago
  const podeCancelar = !!asaasInfo?.payment_id
    && !asaasInfo.pago_em
    && asaasInfo.status !== 'DELETED'
    && asaasInfo.status !== 'CANCELLED';

  const handleGerar = async () => {
    if (!cobrancaId) { toast.error('Cobrança sem ID. Gere o extrato antes.'); return; }
    if (!vencimento) { toast.error('Defina a data de vencimento.'); return; }
    try {
      const r = await gerarMut.mutateAsync({ cobrancaId, dataVencimento: vencimento });
      setResultado({
        boletoUrl: r.boleto_url,
        boletoBarcode: r.boleto_barcode,
        pixPayload: r.pix_payload,
        invoiceUrl: r.invoice_url,
        reused: r.reused,
      });
    } catch {
      // toast já aparece no hook
    }
  };

  const copyText = async (text: string, label: string) => {
    const ok = await copyToClipboard(text);
    if (ok) toast.success(`${label} copiado!`);
    else toast.error('Não foi possível copiar.');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileBadge className="h-5 w-5 text-primary" />
            Gerar Boleto / PIX (Asaas)
          </DialogTitle>
          <DialogDescription>
            {clienteNome} — {fmtBRL(total)}
          </DialogDescription>
        </DialogHeader>

        {!resultado ? (
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="venc-asaas">Data de vencimento</Label>
              <Input
                id="venc-asaas"
                type="date"
                value={vencimento}
                onChange={(e) => setVencimento(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Multa 2% e juros 1%/mês aplicados automaticamente após vencimento.
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleGerar} disabled={gerarMut.isPending}>
                {gerarMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {gerarMut.isPending ? 'Gerando...' : 'Gerar cobrança'}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
              <p className="font-medium">
                {resultado.reused ? 'Cobrança já existia' : 'Cobrança criada com sucesso'}
              </p>
            </div>

            {resultado.invoiceUrl && (
              <div className="space-y-1">
                <Label>Página de pagamento Asaas</Label>
                <div className="flex gap-2">
                  <Input value={resultado.invoiceUrl} readOnly className="font-mono text-xs" />
                  <Button size="sm" variant="outline" onClick={() => copyText(resultado.invoiceUrl!, 'Link')}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={resultado.invoiceUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>
            )}

            {resultado.boletoBarcode && (
              <div className="space-y-1">
                <Label>Linha digitável (boleto)</Label>
                <div className="flex gap-2">
                  <Input value={resultado.boletoBarcode} readOnly className="font-mono text-xs" />
                  <Button size="sm" variant="outline" onClick={() => copyText(resultado.boletoBarcode!, 'Boleto')}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {resultado.pixPayload && (
              <div className="space-y-1">
                <Label>PIX copia-e-cola</Label>
                <div className="flex gap-2">
                  <Input value={resultado.pixPayload} readOnly className="font-mono text-xs" />
                  <Button size="sm" variant="outline" onClick={() => copyText(resultado.pixPayload!, 'PIX')}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Esses dados também aparecem automaticamente na página pública da cobrança que você
              compartilha pelo WhatsApp.
            </p>

            {/* 27/05 noite: botão cancelar cobrança Asaas (DELETE no gateway).
                Visível apenas se ja gerada E nao paga. Confirmação inline. */}
            {podeCancelar && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
                {!confirmandoCancelar ? (
                  <button
                    onClick={() => setConfirmandoCancelar(true)}
                    className="w-full text-left text-xs font-medium text-amber-700 hover:text-amber-900 underline-offset-2 hover:underline inline-flex items-center gap-1.5"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Cancelar essa cobrança Asaas (cliente para de receber lembretes)
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-amber-800 dark:text-amber-200 flex items-start gap-1.5">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>
                        Tem certeza? A cobrança será marcada como cancelada no Asaas e o cliente
                        <strong> não receberá mais notificações</strong>. Use isso quando a cobrança
                        foi gerada errada e você vai criar uma nova.
                      </span>
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setConfirmandoCancelar(false)}
                        disabled={cancelarMut.isPending}
                      >
                        Voltar
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="flex-1"
                        onClick={handleCancelar}
                        disabled={cancelarMut.isPending}
                      >
                        {cancelarMut.isPending
                          ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Cancelando...</>
                          : 'Sim, cancelar'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {asaasInfo?.status === 'DELETED' && (
              <div className="rounded-lg border border-slate-300 bg-slate-100 dark:bg-slate-900 p-3 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                Esta cobrança Asaas foi cancelada. Cliente não recebe mais notificações.
              </div>
            )}

            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Fechar</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
