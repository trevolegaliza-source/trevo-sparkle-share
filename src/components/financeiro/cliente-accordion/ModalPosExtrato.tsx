import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Send, Download, CheckCircle, Loader2, MessageCircle, Share2, Link as LinkIcon, FileBadge } from 'lucide-react';
import { invalidateFinanceiro } from '@/hooks/useFinanceiroClientes';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { triggerBlobDownload } from '@/lib/extrato-download';
import { buildWhatsappUrl } from '@/lib/open-whatsapp';
import GerarAsaasModal from '../GerarAsaasModal';
import { useCobrancaAsaas } from '@/hooks/useAsaas';

import { fmt } from './utils';
import {
  getNomeRemetente,
  marcarLancamentosComoEnviados,
  buildValoresAdicionaisMap,
  buildValoresAdicionaisDetalhadosMap,
  buildMensagemFromLancamentos,
} from './helpers';
import type { ExtratoGeradoPayload } from './types';

// ══════════ MODAL PÓS-EXTRATO (lives in parent, survives re-renders) ══════════
export function ModalPosExtrato({
  extratoGerado,
  onClose
}: {
  extratoGerado: ExtratoGeradoPayload;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [clienteTelefone, setClienteTelefone] = useState('');
  const [whatsappHref, setWhatsappHref] = useState('#');
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [preparingWhatsapp, setPreparingWhatsapp] = useState(true);
  const [asaasModalOpen, setAsaasModalOpen] = useState(false);
  const { data: asaasInfo } = useCobrancaAsaas(extratoGerado.cobrancaId);

  // 27/05 noite: timeout pro spinner "Gerando Boleto/PIX". Asaas leve normalmente
  // 1-3s. 25s é folga generosa pra acomodar retry/rate limit. Se passar disso,
  // assume falha e libera botão manual.
  const [aindaGerandoAsaas, setAindaGerandoAsaas] = useState(
    !!extratoGerado.asaasGerandoAuto && !asaasInfo?.payment_id,
  );
  useEffect(() => {
    if (!extratoGerado.asaasGerandoAuto) return;
    if (asaasInfo?.payment_id) {
      setAindaGerandoAsaas(false);
      return;
    }
    setAindaGerandoAsaas(true);
    const t = setTimeout(() => setAindaGerandoAsaas(false), 25_000);
    return () => clearTimeout(t);
  }, [extratoGerado.asaasGerandoAuto, asaasInfo?.payment_id]);

  useEffect(() => {
    let active = true;

    const prepararWhatsapp = async () => {
      setPreparingWhatsapp(true);
      try {
        const { data: clienteData } = await supabase
          .from('clientes')
          .select('telefone, telefone_financeiro')
          .eq('id', extratoGerado.clienteId)
          .single();

        const telefone = ((clienteData as any)?.telefone_financeiro || (clienteData as any)?.telefone || extratoGerado.clienteTelefone || '').replace(/\D/g, '');
        const nomeRemetente = await getNomeRemetente();
        const lancsForMsg = extratoGerado.lancamentos;
        const vaMap = await buildValoresAdicionaisMap(lancsForMsg);
        const vaDetalhadoMap = await buildValoresAdicionaisDetalhadosMap(lancsForMsg);

        // 27/05 noite: usa data_vencimento da cobrança (asaas) se disponível —
        // assim a msg reflete a data que o user marcou ao gerar boleto, não
        // a data padrão do lançamento.
        let msg = buildMensagemFromLancamentos({
          lancamentos: lancsForMsg,
          vaMap,
          vaDetalhadoMap,
          diasAtraso: 0,
          nomeRemetente,
          dataVencimentoOverride: asaasInfo?.data_vencimento,
        });
        if (extratoGerado.cobrancaUrl) {
          msg += `\n\n🔗 Ver cobrança completa: ${extratoGerado.cobrancaUrl}`;
        }

        if (!active) return;
        setClienteTelefone(telefone);
        setWhatsappMessage(msg);
        setWhatsappHref(telefone ? buildWhatsappUrl(telefone, msg) : '#');
      } catch {
        if (!active) return;
        setClienteTelefone('');
        setWhatsappMessage('');
        setWhatsappHref('#');
      } finally {
        if (active) setPreparingWhatsapp(false);
      }
    };

    prepararWhatsapp();
    return () => {
      active = false;
    };
    // 27/05 noite: depende de asaasInfo?.data_vencimento pra refazer a msg
    // quando o Asaas terminar (e atualizar cobrancas.data_vencimento).
  }, [extratoGerado, asaasInfo?.data_vencimento]);

  function handleClose() {
    extratoGerado.cleanup?.();
    invalidateFinanceiro(queryClient);
    onClose();
  }

  async function handleCopiarLink() {
    if (!extratoGerado.cobrancaUrl) {
      toast.error('Link da cobrança indisponível.');
      return;
    }
    try {
      await navigator.clipboard.writeText(extratoGerado.cobrancaUrl);
      toast.success('Link copiado! Cole no WhatsApp.');
    } catch {
      toast.error('Erro ao copiar link.');
    }
  }

  async function handleMarcarEnviado() {
    const ids = extratoGerado.lancamentos
      .filter(l => l.etapa_financeiro === 'cobranca_gerada' || (l.etapa_financeiro === 'solicitacao_criada' && l.extrato_id))
      .map(l => l.id);
    const ok = await marcarLancamentosComoEnviados(ids);
    if (!ok) return;
    invalidateFinanceiro(queryClient);
    toast.success('Cobrança marcada como enviada!');
    handleClose();
  }

  async function handleCompartilhar() {
    try {
      const file = new File([extratoGerado.blob], extratoGerado.filename, { type: 'application/pdf' });
      const canShareFile = navigator.share && navigator.canShare?.({ files: [file] });

      if (canShareFile) {
        await navigator.share({ title: 'Extrato Trevo Legaliza', text: whatsappMessage, files: [file] });
        const ids = extratoGerado.lancamentos
          .filter(l => l.etapa_financeiro === 'cobranca_gerada' || (l.etapa_financeiro === 'solicitacao_criada' && l.extrato_id))
          .map(l => l.id);
        const ok = await marcarLancamentosComoEnviados(ids);
        if (!ok) return;
        invalidateFinanceiro(queryClient);
        handleClose();
        return;
      }

      triggerBlobDownload(extratoGerado.blob, extratoGerado.filename);
      toast.success('PDF baixado!');
    } catch (err: any) {
      if (err.name !== 'AbortError') toast.error('Erro ao compartilhar: ' + err.message);
    }
  }

  function handleBaixar() {
    triggerBlobDownload(extratoGerado.blob, extratoGerado.filename);
    toast.success('PDF baixado!');
  }

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent
        className="sm:max-w-sm"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-500" /> Extrato Gerado!
          </DialogTitle>
        </DialogHeader>
        <div className="text-center space-y-4 py-4">
          <div>
            <p className="font-semibold">{extratoGerado.clienteNome}</p>
            <p className="text-2xl font-bold text-primary">{fmt(extratoGerado.total)}</p>
            <p className="text-xs text-muted-foreground mt-1">honorários + taxas</p>
          </div>
          <p className="text-sm text-muted-foreground">O que deseja fazer?</p>
          <div className="space-y-2">
            {extratoGerado.cobrancaUrl && (
              <Button className="w-full gap-2 h-11" onClick={handleCopiarLink}>
                <LinkIcon className="h-4 w-4" /> Copiar Link da Cobrança
              </Button>
            )}
            {extratoGerado.cobrancaId && (() => {
              // 27/05 noite: 3 estados visuais.
              // 1) asaas_payment_id já existe → "gerado ✓ — Ver detalhes" (outline)
              // 2) aindaGerandoAsaas=true E sem payment_id → "Gerando..." disabled com spinner (max 25s)
              // 3) caso contrário → botão padrão "Gerar Boleto/PIX (Asaas)"
              const jaGerou = !!asaasInfo?.payment_id;
              const gerandoAuto = aindaGerandoAsaas && !jaGerou;
              return (
                <Button
                  variant={jaGerou ? 'outline' : 'default'}
                  className="w-full gap-2 h-11"
                  onClick={() => setAsaasModalOpen(true)}
                  disabled={gerandoAuto}
                >
                  {gerandoAuto
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <FileBadge className="h-4 w-4" />}
                  {jaGerou
                    ? 'Boleto/PIX gerado ✓ — Ver detalhes'
                    : gerandoAuto
                    ? 'Gerando Boleto/PIX no Asaas...'
                    : 'Gerar Boleto / PIX (Asaas)'}
                </Button>
              );
            })()}
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={preparingWhatsapp || !clienteTelefone || whatsappHref === '#'}
              className={cn(
                'inline-flex w-full items-center justify-center gap-2 rounded-md h-11 px-4 text-sm font-medium transition-colors',
                preparingWhatsapp || !clienteTelefone || whatsappHref === '#'
                  ? 'pointer-events-none border border-border bg-muted text-muted-foreground opacity-60'
                  : 'bg-primary text-primary-foreground hover:opacity-90'
              )}
              onClick={async () => {
                if (preparingWhatsapp || !clienteTelefone || whatsappHref === '#') {
                  toast.error('Telefone não cadastrado. Cadastre o telefone do cliente antes de enviar.');
                  return;
                }
                navigator.clipboard.writeText(whatsappMessage).catch(() => {});
                toast.success('Mensagem copiada! Abrindo WhatsApp...');
                const ids = extratoGerado.lancamentos
                  .filter(l => l.etapa_financeiro === 'cobranca_gerada' || (l.etapa_financeiro === 'solicitacao_criada' && l.extrato_id))
                  .map(l => l.id);
                const ok = await marcarLancamentosComoEnviados(ids);
                if (!ok) return;
                invalidateFinanceiro(queryClient);
                handleClose();
              }}
            >
              <MessageCircle className="h-4 w-4" /> Enviar WhatsApp
            </a>
            <Button variant="outline" className="w-full gap-2 h-11" onClick={handleCompartilhar}>
              <Share2 className="h-4 w-4" /> Compartilhar PDF
            </Button>
            <Button variant="outline" className="w-full gap-2 h-11" onClick={handleBaixar}>
              <Download className="h-4 w-4" /> Baixar PDF
            </Button>
            <Button variant="outline" className="w-full gap-2 h-11" onClick={handleMarcarEnviado}>
              <Send className="h-4 w-4" /> Marcar como enviado
            </Button>
            <Button variant="ghost" className="w-full text-muted-foreground h-11" onClick={handleClose}>
              Fazer depois
            </Button>
          </div>
        </div>
      </DialogContent>
      <GerarAsaasModal
        open={asaasModalOpen}
        onOpenChange={setAsaasModalOpen}
        cobrancaId={extratoGerado.cobrancaId}
        clienteNome={extratoGerado.clienteNome}
        total={extratoGerado.total}
        vencimentoSugerido={asaasInfo?.data_vencimento || undefined}
      />
    </Dialog>
  );
}
