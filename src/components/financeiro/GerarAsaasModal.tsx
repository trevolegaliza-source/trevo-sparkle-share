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
import { Loader2, FileBadge, Copy, ExternalLink, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useGerarAsaasCobranca } from '@/hooks/useAsaas';

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

  // Ao abrir o modal, reseta estado. NÃO depender de vencimentoSugerido
  // aqui — ele muda depois do gerar e zeraria a tela de resultado.
  useEffect(() => {
    if (open) {
      setVencimento((prev) => prev || vencimentoSugerido || addDaysISO(3));
      setResultado(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado!`);
    } catch {
      toast.error('Não foi possível copiar.');
    }
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

            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Fechar</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
