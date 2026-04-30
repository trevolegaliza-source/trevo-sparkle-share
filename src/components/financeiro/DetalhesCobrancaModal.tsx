import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Copy,
  FileBadge,
  MessageCircle,
  Download,
  ExternalLink,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getCobrancaPublicUrl } from '@/lib/cobranca-url';
import { useCobrancaAsaas, useGerarAsaasCobranca } from '@/hooks/useAsaas';
import GerarAsaasModal from './GerarAsaasModal';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** ID da cobrança (tabela `cobrancas`). */
  cobrancaId: string | null;
  clienteNome: string;
  clienteTelefone?: string | null;
  total: number;
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function DetalhesCobrancaModal({
  open, onOpenChange, cobrancaId, clienteNome, clienteTelefone, total,
}: Props) {
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [dataExpiracao, setDataExpiracao] = useState<string | null>(null);
  const [loadingToken, setLoadingToken] = useState(false);
  const [rotatingToken, setRotatingToken] = useState(false);
  const [asaasModalOpen, setAsaasModalOpen] = useState(false);
  // C19/C20 — confirm() nativo bloqueia main thread + UX inconsistente
  const [rotateConfirmOpen, setRotateConfirmOpen] = useState(false);
  const { data: asaasInfo, isLoading: loadingAsaas } = useCobrancaAsaas(cobrancaId);

  useEffect(() => {
    if (!open || !cobrancaId) {
      setShareToken(null);
      setDataExpiracao(null);
      return;
    }
    let cancel = false;
    setLoadingToken(true);
    supabase
      .from('cobrancas')
      .select('share_token, data_expiracao')
      .eq('id', cobrancaId)
      .single()
      .then(({ data }) => {
        if (cancel) return;
        setShareToken((data as any)?.share_token ?? null);
        setDataExpiracao((data as any)?.data_expiracao ?? null);
        setLoadingToken(false);
      });
    return () => { cancel = true; };
  }, [open, cobrancaId]);

  const publicUrl = shareToken ? getCobrancaPublicUrl(shareToken) : null;
  const expiracaoFmt = dataExpiracao
    ? new Date(dataExpiracao).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : null;
  const expirado =
    dataExpiracao !== null && new Date(dataExpiracao).getTime() < Date.now();

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado!`);
    } catch {
      toast.error('Não foi possível copiar.');
    }
  };

  const rotacionarToken = async () => {
    if (!cobrancaId) return;
    setRotateConfirmOpen(false);

    setRotatingToken(true);
    try {
      const { data, error } = await supabase.rpc(
        'rotacionar_cobranca_token' as any,
        { p_cobranca_id: cobrancaId }
      );
      if (error) throw error;
      const novoToken = typeof data === 'string' ? data : (data as any);
      if (!novoToken) throw new Error('RPC não retornou token');
      setShareToken(novoToken);
      // Rebusca data_expiracao (trigger recalculou)
      const { data: refreshed } = await supabase
        .from('cobrancas')
        .select('data_expiracao')
        .eq('id', cobrancaId)
        .single();
      setDataExpiracao((refreshed as any)?.data_expiracao ?? null);
      toast.success('Link antigo invalidado. Novo link gerado.');
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao invalidar link.');
    } finally {
      setRotatingToken(false);
    }
  };

  if (!cobrancaId) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="sm:max-w-md text-zinc-100 max-h-[85vh] overflow-y-auto p-0 border-2"
          style={{
            backgroundColor: '#0d1310',
            borderColor: '#2a3530',
            isolation: 'isolate',
            zIndex: 60,
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.04)',
          }}
        >
          <div className="p-6 space-y-4" style={{ backgroundColor: '#0d1310' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-zinc-50">
              <FileBadge className="h-5 w-5 text-emerald-400" />
              Detalhes da cobrança
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              {clienteNome} — <span className="font-semibold text-zinc-200">{fmtBRL(total)}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Link público */}
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                Link da cobrança
              </p>
              {loadingToken ? (
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
                </div>
              ) : publicUrl ? (
                <>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyText(publicUrl, 'Link')}
                      className="flex-1 h-10 rounded-md border border-zinc-700 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-100 text-sm font-medium inline-flex items-center justify-center gap-2"
                    >
                      <Copy className="h-4 w-4" /> Copiar link
                    </button>
                    <a
                      href={publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Abrir link"
                      title="Abrir em nova aba"
                      className="h-10 w-10 shrink-0 rounded-md border border-zinc-700 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 inline-flex items-center justify-center"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                  <div className="flex items-center justify-between text-[11px] px-1">
                    {expiracaoFmt ? (
                      <span className={expirado ? 'text-rose-400' : 'text-zinc-500'}>
                        {expirado ? 'Link expirado em' : 'Expira em'} {expiracaoFmt}
                      </span>
                    ) : (
                      <span className="text-zinc-500">Sem expiração definida</span>
                    )}
                    <button
                      onClick={() => setRotateConfirmOpen(true)}
                      disabled={rotatingToken}
                      className="inline-flex items-center gap-1 text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
                      title="Invalidar link atual e gerar um novo"
                    >
                      {rotatingToken ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3 w-3" />
                      )}
                      Invalidar e gerar novo
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-xs text-zinc-500">Link indisponível.</p>
              )}
            </div>

            {/* Asaas */}
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                Cobrança Asaas (boleto/PIX)
              </p>

              {loadingAsaas ? (
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
                </div>
              ) : asaasInfo?.payment_id ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-emerald-400">
                    <FileBadge className="h-4 w-4" />
                    <span>
                      Boleto/PIX gerado
                      {asaasInfo.status && <span className="text-zinc-500"> · {asaasInfo.status}</span>}
                    </span>
                  </div>

                  {asaasInfo.pix_payload && (
                    <button
                      onClick={() => copyText(asaasInfo.pix_payload!, 'PIX copia-e-cola')}
                      className="w-full h-11 rounded-md border border-zinc-700 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-100 text-sm font-medium inline-flex items-center justify-center gap-2"
                    >
                      <Copy className="h-4 w-4" /> Copiar PIX copia-e-cola
                    </button>
                  )}

                  {asaasInfo.boleto_barcode && (
                    <button
                      onClick={() => copyText(asaasInfo.boleto_barcode!, 'Linha digitável')}
                      className="w-full h-11 rounded-md border border-zinc-700 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-100 text-sm font-medium inline-flex items-center justify-center gap-2"
                    >
                      <Copy className="h-4 w-4" /> Copiar linha digitável boleto
                    </button>
                  )}

                  {asaasInfo.boleto_url && (
                    <a
                      href={asaasInfo.boleto_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full h-11 rounded-md border border-zinc-700 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-100 text-sm font-medium inline-flex items-center justify-center gap-2"
                    >
                      <Download className="h-4 w-4" /> Baixar boleto PDF
                    </a>
                  )}

                  {asaasInfo.invoice_url && (
                    <a
                      href={asaasInfo.invoice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-center text-xs text-zinc-400 hover:text-zinc-200 pt-1"
                    >
                      Ver página oficial Asaas →
                    </a>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setAsaasModalOpen(true)}
                  className="w-full h-11 rounded-md bg-emerald-500 hover:bg-emerald-600 text-emerald-950 text-sm font-semibold inline-flex items-center justify-center gap-2"
                >
                  <FileBadge className="h-4 w-4" /> Gerar Boleto / PIX (Asaas)
                </button>
              )}
            </div>

            {/* WhatsApp */}
            {publicUrl && clienteTelefone && (
              <div className="space-y-1.5 pt-3 border-t border-zinc-800">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                  Enviar ao cliente
                </p>
                <a
                  href={`https://wa.me/${(clienteTelefone || '').replace(/\D/g, '').replace(/^/, '55').replace(/^5555/, '55')}?text=${encodeURIComponent(
                    `Olá! Segue o link da cobrança: ${publicUrl}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full h-11 rounded-md bg-emerald-500 hover:bg-emerald-600 text-emerald-950 text-sm font-semibold inline-flex items-center justify-center gap-2"
                >
                  <MessageCircle className="h-4 w-4" /> Abrir WhatsApp
                </a>
              </div>
            )}
          </div>
          </div>
        </DialogContent>
      </Dialog>

      <GerarAsaasModal
        open={asaasModalOpen}
        onOpenChange={setAsaasModalOpen}
        cobrancaId={cobrancaId}
        clienteNome={clienteNome}
        total={total}
        vencimentoSugerido={asaasInfo?.data_vencimento || undefined}
      />

      <AlertDialog open={rotateConfirmOpen} onOpenChange={setRotateConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Invalidar link atual?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai invalidar o link atual e gerar um novo. Qualquer pessoa
              que tenha o link antigo perderá acesso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={rotacionarToken}>
              Invalidar e gerar novo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
