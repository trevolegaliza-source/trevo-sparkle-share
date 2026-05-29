import { useState, useEffect } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Send, AlertTriangle, RefreshCw, ChevronDown, Link as LinkIcon, Eye } from 'lucide-react';
import type { ClienteFinanceiro } from '@/hooks/useFinanceiroClientes';
import { invalidateFinanceiro } from '@/hooks/useFinanceiroClientes';
import { useExtratos } from '@/hooks/useExtratos';
import { gerarExtratoPDF, fetchValoresAdicionaisMulti, fetchCompetenciaProcessos } from '@/lib/extrato-pdf';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import type { ProcessoFinanceiro } from '@/hooks/useProcessosFinanceiro';
import { fetchExtratoBlob, triggerBlobDownload } from '@/lib/extrato-download';
import { WhatsappLinkButton } from '../WhatsappLinkButton';
import { getCobrancaTokenAtiva } from '@/hooks/useFinanceiroClientes';
import { getCobrancaPublicUrl } from '@/lib/cobranca-url';
import DetalhesCobrancaModal from '../DetalhesCobrancaModal';

import { fmt, fmtDate, fmtTempoAtras, buildExtratoFilename, getExtratoIdAtual, getLancamentosDoExtrato } from './utils';
import {
  openWhatsApp,
  getNomeRemetente,
  marcarLancamentosComoEnviados,
  buildValoresAdicionaisMap,
  buildValoresAdicionaisDetalhadosMap,
  buildMensagemFromLancamentos,
} from './helpers';
import { ClienteHeaderBadges } from './ClienteHeaderBadges';
import { MoverParaMenu } from './MoverParaMenu';
import { EmptyState } from './EmptyState';
import { LancamentoRow } from './LancamentoRow';

// ══════════ TAB: ENVIAR ══════════
export function ClientesEnviar({ clientes }: { clientes: ClienteFinanceiro[] }) {
  if (clientes.length === 0) return <EmptyState text="Nenhuma cobrança aguardando envio." />;
  return (
    <Accordion type="multiple" defaultValue={[]} className="space-y-2">
      {clientes.map(c => <EnviarItem key={c.cliente_id} cliente={c} />)}
    </Accordion>
  );
}

function EnviarItem({ cliente }: { cliente: ClienteFinanceiro }) {
  const qc = useQueryClient();
  const [regenerating, setRegenerating] = useState(false);
  const [loadingExtrato, setLoadingExtrato] = useState(false);
  const [whatsappMsgEnviar, setWhatsappMsgEnviar] = useState('');
  const [detalhesOpen, setDetalhesOpen] = useState(false);
  const [cobrancaIdAtiva, setCobrancaIdAtiva] = useState<string | null>(null);
  const { salvarExtrato } = useExtratos();

  // Busca o ID da cobrança mais recente do cliente pra usar no modal de detalhes.
  useEffect(() => {
    let active = true;
    (async () => {
      const extratoId = getExtratoIdAtual(cliente);
      const { data } = await supabase
        .from('cobrancas')
        .select('id')
        .eq('cliente_id', cliente.cliente_id)
        .in('status', ['ativa', 'vencida', 'paga'])
        .match(extratoId ? { extrato_id: extratoId } : {})
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (active) setCobrancaIdAtiva((data as any)?.id ?? null);
    })();
    return () => { active = false; };
  }, [cliente]);

  const hasExtratoNoSistema = cliente.lancamentos.some(l => l.extrato_id);

  // Pré-computa mensagem de WhatsApp + link da cobrança para o <WhatsappLinkButton />
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const extratoId = getExtratoIdAtual(cliente);
        const lancamentosExtrato = getLancamentosDoExtrato(cliente, extratoId).filter(l => l.processo_id);
        const vaMap = await buildValoresAdicionaisMap(lancamentosExtrato);
        const vaDetalhadoMap = await buildValoresAdicionaisDetalhadosMap(lancamentosExtrato);
        const nomeRemetente = await getNomeRemetente();
        let msg = buildMensagemFromLancamentos({ lancamentos: lancamentosExtrato, vaMap, vaDetalhadoMap, diasAtraso: 0, nomeRemetente });
        const token = await getCobrancaTokenAtiva(cliente.cliente_id, extratoId || undefined);
        if (token) msg += `\n\n🔗 Ver cobrança completa: ${getCobrancaPublicUrl(token)}`;
        if (active) setWhatsappMsgEnviar(msg);
      } catch (err) {
        // CODE-003 (17/05/2026): antes era /* noop */ silencioso. Builder
        // de msg WhatsApp falhar deixava o botão "Enviar via WhatsApp" sem
        // mensagem montada — clicar abria WhatsApp com texto vazio sem o
        // user saber. Loga pra debug; user vê empty pq estado nao mudou.
        console.error('[whatsapp-builder enviar] falhou:', err);
      }
    })();
    return () => { active = false; };
  }, [cliente]);

  async function handleCopiarLinkCobranca() {
    const extratoId = getExtratoIdAtual(cliente);
    const token = await getCobrancaTokenAtiva(cliente.cliente_id, extratoId || undefined);
    if (!token) { toast.error('Link de cobrança não encontrado.'); return; }
    await navigator.clipboard.writeText(getCobrancaPublicUrl(token));
    toast.success('🔗 Link copiado!');
  }

  async function handleCopiarMensagem() {
    const extratoId = getExtratoIdAtual(cliente);
    const lancamentosExtrato = getLancamentosDoExtrato(cliente, extratoId).filter(l => l.processo_id);
    const vaMap = await buildValoresAdicionaisMap(lancamentosExtrato);
    const vaDetalhadoMap = await buildValoresAdicionaisDetalhadosMap(lancamentosExtrato);
    const nomeRemetente = await getNomeRemetente();
    const msg = buildMensagemFromLancamentos({ lancamentos: lancamentosExtrato, vaMap, vaDetalhadoMap, diasAtraso: 0, nomeRemetente });
    await navigator.clipboard.writeText(msg);
    toast.success('✅ Mensagem copiada! Cole no WhatsApp.');
  }

  async function handleBaixarExtrato() {
    setLoadingExtrato(true);
    try {
      const lancComExtrato = cliente.lancamentos.find(l => l.extrato_id);
      const extratoId = lancComExtrato?.extrato_id || cliente.extrato_mais_recente?.id;
      if (!extratoId) {
        toast.error('Nenhum extrato encontrado. Gere novamente pela tab "Gerar Extrato".');
        return;
      }
      const result = await fetchExtratoBlob(extratoId);
      if (!result) {
        toast.error('Erro ao baixar o extrato. Tente regerar.');
        return;
      }
      triggerBlobDownload(result.blob, result.filename);
      toast.success('Extrato baixado!');
    } catch (err) {
      console.error('Erro ao baixar extrato:', err);
      toast.error('Erro ao carregar o extrato.');
    } finally {
      setLoadingExtrato(false);
    }
  }

  async function handleRegerarExtrato() {
    setRegenerating(true);
    try {
      const extratoId = getExtratoIdAtual(cliente);
      const lancamentosExtrato = getLancamentosDoExtrato(cliente, extratoId);
      const { data: clienteData } = await supabase
        .from('clientes')
        .select('nome, cnpj, apelido, valor_base, desconto_progressivo, valor_limite_desconto, telefone, email, nome_contador, dia_cobranca, dia_vencimento_mensal')
        .eq('id', cliente.cliente_id)
        .single();

      const processoIds = lancamentosExtrato.map(l => l.processo_id).filter(Boolean);
      const { data: processosData } = await supabase
        .from('processos')
        .select('*, cliente:clientes(*)')
        .in('id', processoIds);

      const { data: lancamentosData } = await supabase
        .from('lancamentos')
        .select('*, cliente:clientes(*)')
        .eq('tipo', 'receber')
        .in('processo_id', processoIds);

      const lancMap = new Map<string, any>();
      (lancamentosData || []).forEach((l: any) => { if (!lancMap.has(l.processo_id)) lancMap.set(l.processo_id, l); });

      const processosFinanceiro: ProcessoFinanceiro[] = (processosData || []).map((p: any) => ({
        ...p,
        lancamento: lancMap.get(p.id) || null,
        etapa_financeiro: lancMap.get(p.id)?.etapa_financeiro || 'solicitacao_criada',
      }));

      const [valoresAdicionais, allCompetencia] = await Promise.all([
        fetchValoresAdicionaisMulti(processoIds),
        fetchCompetenciaProcessos(cliente.cliente_id),
      ]);

      const allCompetenciaFinanceiro: ProcessoFinanceiro[] = (allCompetencia as any[]).map((p: any) => ({
        ...p,
        lancamento: lancMap.get(p.id) || null,
        etapa_financeiro: lancMap.get(p.id)?.etapa_financeiro || 'solicitacao_criada',
      }));

      const result = await gerarExtratoPDF({
        processos: processosFinanceiro,
        allCompetencia: allCompetenciaFinanceiro,
        valoresAdicionais,
        cliente: clienteData as any,
      });

      const blob = result.doc.output('blob');
      const filename = buildExtratoFilename(clienteData?.apelido || clienteData?.nome || cliente.cliente_nome);

      // Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      // Save
      const now = new Date();
      await salvarExtrato.mutateAsync({
        clienteId: cliente.cliente_id,
        pdfBlob: blob,
        filename,
        totalHonorarios: result.totalHonorarios,
        totalTaxas: result.totalTaxas,
        totalGeral: result.totalGeral,
        processoIds,
        competenciaMes: now.getMonth() + 1,
        competenciaAno: now.getFullYear(),
      });

      invalidateFinanceiro(qc);
      toast.success('Extrato gerado e salvo no sistema!');
    } catch (err: any) {
      toast.error('Erro ao gerar extrato: ' + err.message);
    } finally {
      setRegenerating(false);
    }
  }

  async function handleMarcarEnviado() {
    const extratoId = getExtratoIdAtual(cliente);
    const ids = getLancamentosDoExtrato(cliente, extratoId).filter(l =>
      l.etapa_financeiro === 'cobranca_gerada' ||
      (l.etapa_financeiro === 'solicitacao_criada' && l.extrato_id)
    ).map(l => l.id);
    const ok = await marcarLancamentosComoEnviados(ids);
    if (!ok) return;
    invalidateFinanceiro(qc);
    toast.success('Cobrança marcada como enviada!');
  }

  async function handleEnviarWhatsApp() {
    const extratoId = getExtratoIdAtual(cliente);
    const lancamentosExtrato = getLancamentosDoExtrato(cliente, extratoId).filter(l => l.processo_id);
    const vaMap = await buildValoresAdicionaisMap(lancamentosExtrato);
    const vaDetalhadoMap = await buildValoresAdicionaisDetalhadosMap(lancamentosExtrato);
    const nomeRemetente = await getNomeRemetente();
    let msg = buildMensagemFromLancamentos({ lancamentos: lancamentosExtrato, vaMap, vaDetalhadoMap, diasAtraso: 0, nomeRemetente });
    if (extratoId) {
      const { data: cob } = await supabase.from('cobrancas').select('share_token').eq('extrato_id', extratoId).eq('status', 'ativa').order('created_at', { ascending: false }).limit(1).maybeSingle();
      if ((cob as any)?.share_token) {
        const { getCobrancaPublicUrl } = await import('@/lib/cobranca-url');
        msg += `\n\n🔗 Ver cobrança completa: ${getCobrancaPublicUrl((cob as any).share_token)}`;
      }
    }
    const { data: clienteData } = await supabase.from('clientes').select('telefone, telefone_financeiro').eq('id', cliente.cliente_id).single();
    const telefone = ((clienteData as any)?.telefone_financeiro || (clienteData as any)?.telefone || '').replace(/\D/g, '');
    if (!telefone) {
      toast.error('Telefone não cadastrado. Cadastre o telefone do cliente antes de enviar.');
      return;
    }
    const tel = telefone.startsWith('55') ? telefone : '55' + telefone;
    openWhatsApp(tel, msg);
    const ids = getLancamentosDoExtrato(cliente, extratoId).filter(l =>
      l.etapa_financeiro === 'cobranca_gerada' ||
      (l.etapa_financeiro === 'solicitacao_criada' && l.extrato_id)
    ).map(l => l.id);
    const ok = await marcarLancamentosComoEnviados(ids);
    if (!ok) return;
    invalidateFinanceiro(qc);
  }

  async function handleCompartilhar() {
    try {
      const lancComExtrato = cliente.lancamentos.find(l => l.extrato_id);
      const extratoId = lancComExtrato?.extrato_id || cliente.extrato_mais_recente?.id;
      if (!extratoId) { toast.error('Nenhum extrato encontrado. Gere novamente.'); return; }
      const result = await fetchExtratoBlob(extratoId);
      if (!result) { toast.error('Erro ao carregar extrato.'); return; }
      const file = new File([result.blob], result.filename, { type: 'application/pdf' });
      const extratoIdAtual = getExtratoIdAtual(cliente);
      const lancamentosExtrato = getLancamentosDoExtrato(cliente, extratoIdAtual).filter(l => l.processo_id);
      const vaMap = await buildValoresAdicionaisMap(lancamentosExtrato);
      const vaDetalhadoMap = await buildValoresAdicionaisDetalhadosMap(lancamentosExtrato);
      const nomeRemetente = await getNomeRemetente();
      const msg = buildMensagemFromLancamentos({ lancamentos: lancamentosExtrato, vaMap, vaDetalhadoMap, diasAtraso: 0, nomeRemetente });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: 'Extrato Trevo Legaliza', text: msg, files: [file] });
      } else {
        triggerBlobDownload(result.blob, result.filename);
        toast.success('Extrato baixado!');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') toast.error('Erro ao compartilhar: ' + err.message);
    }
  }

  return (
    <AccordionItem value={cliente.cliente_id} className="border rounded-lg bg-card">
      <AccordionTrigger className="px-3 sm:px-4 py-3 hover:no-underline [&>svg]:hidden">
        <div className="flex items-center gap-2 flex-1 text-left min-w-0">
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <p className="font-semibold text-sm truncate min-w-0 flex-1">
                {cliente.cliente_apelido || cliente.cliente_nome}
                {cliente.cliente_codigo && <span className="text-muted-foreground font-mono font-normal text-xs"> · {cliente.cliente_codigo}</span>}
              </p>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {fmt(cliente.total_faturado)} · {cliente.qtd_processos} proc.
              {hasExtratoNoSistema && cliente.extrato_mais_recente && (
                <span> · Extrato {fmtDate(cliente.extrato_mais_recente.created_at)}</span>
              )}
            </p>
            <div className="flex flex-wrap gap-1 items-center">
              <ClienteHeaderBadges cliente={cliente} />
              {hasExtratoNoSistema && cliente.extrato_mais_recente ? (
                <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30 text-[10px] sm:text-xs whitespace-nowrap">
                  Extrato ✓
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-[10px] sm:text-xs whitespace-nowrap">
                  Sem extrato
                </Badge>
              )}
              {/* FIN-001 (27/05 noite): badge mostra quando cliente abriu o link.
                  Útil pra Letícia ligar no momento certo (cliente JÁ viu mas ainda
                  não pagou). */}
              {cliente.cobranca_visualizada_em && (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] sm:text-xs whitespace-nowrap">
                  📬 Aberto {fmtTempoAtras(cliente.cobranca_visualizada_em)}
                </Badge>
              )}
              {/* FIN-004 score já entra via ClienteHeaderBadges acima */}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-2">
            <MoverParaMenu cliente={cliente} />
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0" />
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
        <div className="space-y-2">
          {!hasExtratoNoSistema && (
            <div className="flex items-center gap-2 p-2 rounded bg-amber-500/10 text-amber-600 text-sm mb-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="text-xs sm:text-sm">Extrato do sistema anterior. Gere novamente para salvar.</span>
              <Button size="sm" variant="outline" onClick={handleRegerarExtrato} disabled={regenerating} className="shrink-0">
                <RefreshCw className="h-4 w-4 mr-1" />
                {regenerating ? 'Gerando...' : 'Gerar'}
              </Button>
            </div>
          )}
          {cliente.lancamentos.map(l => <LancamentoRow key={l.id} lancamento={l} />)}
          {/* 27/05 noite: grid principal enxuto. 4 botoes essenciais.
              "Compartilhar", "Copiar WhatsApp", "Baixar", "Editar vencimento"
              moveram pra dentro do "Ver cobranca" pra reduzir poluicao visual. */}
          <div className="grid grid-cols-2 sm:flex gap-2 mt-3 sm:flex-wrap">
            <WhatsappLinkButton
              phone={cliente.cliente_telefone || ''}
              message={whatsappMsgEnviar}
              label={`WhatsApp${cliente.cliente_telefone ? ` ${cliente.cliente_telefone}` : ''}`.trim()}
              variant="outline"
              onAfterClick={handleMarcarEnviado}
            />
            <Button
              size="sm"
              variant="default"
              onClick={() => setDetalhesOpen(true)}
              disabled={!cobrancaIdAtiva}
              className="h-11 sm:h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Eye className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Ver cobrança</span>
              <span className="sm:hidden">Ver</span>
            </Button>
            <Button size="sm" variant="outline" onClick={handleCopiarLinkCobranca} className="h-11 sm:h-9">
              <LinkIcon className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Copiar Link</span><span className="sm:hidden">Link</span>
            </Button>
            <Button size="sm" onClick={handleMarcarEnviado} className="bg-blue-600 hover:bg-blue-700 text-white col-span-2 h-11 sm:h-9">
              <Send className="h-4 w-4 mr-1" /> Marcar como Enviado
            </Button>
          </div>
        </div>
      </AccordionContent>
      <DetalhesCobrancaModal
        open={detalhesOpen}
        onOpenChange={setDetalhesOpen}
        cobrancaId={cobrancaIdAtiva}
        clienteNome={cliente.cliente_apelido || cliente.cliente_nome}
        clienteTelefone={cliente.cliente_telefone}
        total={cliente.total_faturado}
        onCompartilhar={handleCompartilhar}
        onCopiarMensagemWhatsapp={handleCopiarMensagem}
        onBaixarExtrato={hasExtratoNoSistema ? handleBaixarExtrato : undefined}
        baixarLoading={loadingExtrato}
      />
    </AccordionItem>
  );
}
