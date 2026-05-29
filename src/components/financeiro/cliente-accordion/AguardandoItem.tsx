import { useState, useEffect, useRef } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CheckCircle, AlertTriangle, Loader2, Upload, X, File as FileIcon, ChevronDown, Link as LinkIcon, Eye } from 'lucide-react';
import { empresaPath } from '@/lib/storage-path';
import type { ClienteFinanceiro } from '@/hooks/useFinanceiroClientes';
import { isLancamentoVencidoReal, invalidateFinanceiro, getCobrancaTokenAtiva } from '@/hooks/useFinanceiroClientes';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { fetchExtratoBlob, triggerBlobDownload } from '@/lib/extrato-download';
import { WhatsappLinkButton } from '../WhatsappLinkButton';
import { getCobrancaPublicUrl } from '@/lib/cobranca-url';
import DetalhesCobrancaModal from '../DetalhesCobrancaModal';

import { fmt, fmtDate, diasParaVencer, getExtratoIdAtual } from './utils';
import {
  openWhatsApp,
  getNomeRemetente,
  buildMensagemFromLancamentos,
} from './helpers';
import { ClienteHeaderBadges } from './ClienteHeaderBadges';
import { MoverParaMenu } from './MoverParaMenu';
import { EmptyState } from './EmptyState';
import { LancamentoRow } from './LancamentoRow';

// ══════════ TAB: AGUARDANDO ══════════
export function ClientesAguardando({ clientes, contestarLancamento }: { clientes: ClienteFinanceiro[]; contestarLancamento?: any }) {
  if (clientes.length === 0) return <EmptyState text="Nenhum pagamento pendente." />;
  return (
    <Accordion type="multiple" defaultValue={[]} className="space-y-2">
      {clientes.map(c => <AguardandoItem key={c.cliente_id} cliente={c} contestarLancamento={contestarLancamento} />)}
    </Accordion>
  );
}

function AguardandoItem({ cliente, contestarLancamento }: { cliente: ClienteFinanceiro; contestarLancamento?: any }) {
  const [showPago, setShowPago] = useState(false);
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().split('T')[0]);
  const [loadingExtrato, setLoadingExtrato] = useState(false);
  const [selectedPagar, setSelectedPagar] = useState<Set<string>>(new Set());
  const [detalhesOpen, setDetalhesOpen] = useState(false);
  const [cobrancaIdAtiva, setCobrancaIdAtiva] = useState<string | null>(null);

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
  const [contestarModal, setContestarModal] = useState<string | null>(null);
  const [contestarMotivo, setContestarMotivo] = useState('');
  const [contestarAnexo, setContestarAnexo] = useState<File | null>(null);
  const [contestarAnexoPreview, setContestarAnexoPreview] = useState<string | null>(null);
  const [uploadingAnexo, setUploadingAnexo] = useState(false);
  const [whatsappMsgAguardando, setWhatsappMsgAguardando] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const vencimento = cliente.lancamentos[0]?.data_vencimento;
  const dias = vencimento ? diasParaVencer(vencimento) : 0;

  const lancVencidos = cliente.lancamentos.filter(l => isLancamentoVencidoReal(l));
  const temVencidos = lancVencidos.length > 0;
  const maiorAtraso = temVencidos
    ? Math.max(...lancVencidos.map(l => {
        const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
        const venc = new Date(l.data_vencimento + 'T00:00:00');
        return Math.floor((hoje.getTime() - venc.getTime()) / 86400000);
      }))
    : 0;

  // Pré-computa mensagem de WhatsApp + link da cobrança para o <WhatsappLinkButton />
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const lancsParaMsg = temVencidos ? lancVencidos : cliente.lancamentos;
        if (lancsParaMsg.length === 0) return;
        const processoIds = [...new Set(lancsParaMsg.map(l => l.processo_id).filter(Boolean))] as string[];
        const vaMap: Record<string, number> = {};
        const vaDetalhadoMap: Record<string, Array<{ descricao: string; valor: number }>> = {};
        if (processoIds.length > 0) {
          const { data: vas } = await supabase.from('valores_adicionais').select('processo_id, descricao, valor').in('processo_id', processoIds);
          if (vas) {
            for (const va of vas) {
              // CODE-008 (17/05/2026): valor adicional com valor NULL/0 entrava
              // na msg de WhatsApp como "Taxa R$ 0,00" — confundia cliente.
              // Skip se não há valor real a cobrar.
              const vaValor = Number(va.valor);
              if (!Number.isFinite(vaValor) || vaValor <= 0) continue;
              vaMap[va.processo_id] = (vaMap[va.processo_id] || 0) + vaValor;
              if (!vaDetalhadoMap[va.processo_id]) vaDetalhadoMap[va.processo_id] = [];
              vaDetalhadoMap[va.processo_id].push({ descricao: (va as any).descricao || 'Taxa', valor: vaValor });
            }
          }
        }
        const nomeRemetente = await getNomeRemetente();
        let msg = buildMensagemFromLancamentos({ lancamentos: lancsParaMsg, vaMap, vaDetalhadoMap, diasAtraso: maiorAtraso, nomeRemetente });
        const extratoIds = [...new Set(lancsParaMsg.map(l => l.extrato_id).filter(Boolean))] as string[];
        const extratoId = extratoIds[0];
        const token = await getCobrancaTokenAtiva(cliente.cliente_id, extratoId || undefined);
        if (token) msg += `\n\n🔗 Ver cobrança completa: ${getCobrancaPublicUrl(token)}`;
        if (active) setWhatsappMsgAguardando(msg);
      } catch (err) {
        // CODE-003 (17/05/2026): antes /* noop */ — ver comentario do builder
        // enviar acima. Mesma classe de bug.
        console.error('[whatsapp-builder aguardando] falhou:', err);
      }
    })();
    return () => { active = false; };
  }, [cliente, temVencidos, maiorAtraso]);

  async function handleCopiarLinkCobrancaAguardando() {
    const lancComExtrato = cliente.lancamentos.find(l => l.extrato_id);
    const extratoId = lancComExtrato?.extrato_id || cliente.extrato_mais_recente?.id;
    const token = await getCobrancaTokenAtiva(cliente.cliente_id, extratoId || undefined);
    if (!token) { toast.error('Link de cobrança não encontrado.'); return; }
    await navigator.clipboard.writeText(getCobrancaPublicUrl(token));
    toast.success('🔗 Link copiado!');
  }

  function toggleSelectPagar(lancId: string) {
    setSelectedPagar(prev => {
      const next = new Set(prev);
      if (next.has(lancId)) next.delete(lancId); else next.add(lancId);
      return next;
    });
  }

  function selectAllPagar() { setSelectedPagar(new Set(cliente.lancamentos.map(l => l.id))); }
  function deselectAllPagar() { setSelectedPagar(new Set()); }

  async function confirmarPago() {
    const ids = selectedPagar.size > 0
      ? Array.from(selectedPagar)
      : cliente.lancamentos.map(l => l.id);

    if (ids.length === 0) {
      toast.warning('Selecione pelo menos um processo para marcar como pago.');
      return;
    }

    const { error } = await supabase
      .from('lancamentos')
      .update({
        etapa_financeiro: 'honorario_pago',
        status: 'pago' as const,
        data_pagamento: dataPagamento,
        confirmado_recebimento: true,
      })
      .in('id', ids);
    if (error) { toast.error(error.message); return; }
    setShowPago(false);
    setSelectedPagar(new Set());
    invalidateFinanceiro(qc);

    const naoSelecionados = cliente.lancamentos.length - ids.length;
    if (naoSelecionados > 0) {
      toast.success(`${ids.length} processo(s) marcado(s) como pago. ${naoSelecionados} permanecem pendentes.`);
    } else {
      toast.success('Todos os pagamentos confirmados!');
    }
  }

  async function handleCopiarCobranca() {
    const lancsParaMsg = temVencidos ? lancVencidos : cliente.lancamentos;
    if (lancsParaMsg.length === 0) return;
    const processoIds = [...new Set(lancsParaMsg.map(l => l.processo_id).filter(Boolean))];
    let vaMap: Record<string, number> = {};
    const vaDetalhadoMap: Record<string, Array<{ descricao: string; valor: number }>> = {};
    if (processoIds.length > 0) {
      const { data: vas } = await supabase.from('valores_adicionais').select('processo_id, descricao, valor').in('processo_id', processoIds);
      if (vas) {
        for (const va of vas) {
          // CODE-008 (17/05/2026): skip valor adicional NULL/0 (msg WhatsApp limpa).
          const vaValor = Number(va.valor);
          if (!Number.isFinite(vaValor) || vaValor <= 0) continue;
          vaMap[va.processo_id] = (vaMap[va.processo_id] || 0) + vaValor;
          if (!vaDetalhadoMap[va.processo_id]) vaDetalhadoMap[va.processo_id] = [];
          vaDetalhadoMap[va.processo_id].push({ descricao: (va as any).descricao || 'Taxa', valor: vaValor });
        }
      }
    }
    const nomeRemetente = await getNomeRemetente();
    const msg = buildMensagemFromLancamentos({ lancamentos: lancsParaMsg, vaMap, vaDetalhadoMap, diasAtraso: maiorAtraso, nomeRemetente });
    await navigator.clipboard.writeText(msg);
    toast.success(temVencidos ? '✅ Mensagem de recobrança copiada!' : '✅ Mensagem copiada! Cole no WhatsApp.');
  }

  async function handleBaixarExtrato() {
    setLoadingExtrato(true);
    try {
      const lancComExtrato = cliente.lancamentos.find(l => l.extrato_id);
      const extratoId = lancComExtrato?.extrato_id || cliente.extrato_mais_recente?.id;
      if (!extratoId) { toast.error('Nenhum extrato encontrado para este cliente.'); return; }
      const result = await fetchExtratoBlob(extratoId);
      if (!result) { toast.error('Erro ao baixar o extrato. Tente regerar.'); return; }
      triggerBlobDownload(result.blob, result.filename);
      toast.success('Extrato baixado!');
    } catch (err) {
      toast.error('Erro ao baixar extrato.');
    } finally {
      setLoadingExtrato(false);
    }
  }

  async function handleEnviarWhatsAppRecobranca() {
    const lancsParaMsg = temVencidos ? lancVencidos : cliente.lancamentos;
    if (lancsParaMsg.length === 0) return;
    const processoIds = [...new Set(lancsParaMsg.map(l => l.processo_id).filter(Boolean))];
    let vaMap: Record<string, number> = {};
    const vaDetalhadoMap: Record<string, Array<{ descricao: string; valor: number }>> = {};
    if (processoIds.length > 0) {
      const { data: vas } = await supabase.from('valores_adicionais').select('processo_id, descricao, valor').in('processo_id', processoIds);
      if (vas) {
        for (const va of vas) {
          // CODE-008 (17/05/2026): skip valor adicional NULL/0 (msg WhatsApp limpa).
          const vaValor = Number(va.valor);
          if (!Number.isFinite(vaValor) || vaValor <= 0) continue;
          vaMap[va.processo_id] = (vaMap[va.processo_id] || 0) + vaValor;
          if (!vaDetalhadoMap[va.processo_id]) vaDetalhadoMap[va.processo_id] = [];
          vaDetalhadoMap[va.processo_id].push({ descricao: (va as any).descricao || 'Taxa', valor: vaValor });
        }
      }
    }
    const nomeRemetente = await getNomeRemetente();
    let msg = buildMensagemFromLancamentos({ lancamentos: lancsParaMsg, vaMap, vaDetalhadoMap, diasAtraso: maiorAtraso, nomeRemetente });
    const extratoIds = [...new Set(lancsParaMsg.map(l => l.extrato_id).filter(Boolean))];
    if (extratoIds.length > 0) {
      const { data: cob } = await supabase.from('cobrancas').select('share_token').in('extrato_id', extratoIds as string[]).eq('status', 'ativa').order('created_at', { ascending: false }).limit(1).maybeSingle();
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
  }

  async function handleCompartilharAguardando() {
    try {
      const lancComExtrato = cliente.lancamentos.find(l => l.extrato_id);
      const extratoId = lancComExtrato?.extrato_id || cliente.extrato_mais_recente?.id;
      if (!extratoId) { toast.error('Nenhum extrato encontrado.'); return; }
      const result = await fetchExtratoBlob(extratoId);
      if (!result) { toast.error('Erro ao carregar extrato.'); return; }
      const file = new File([result.blob], result.filename, { type: 'application/pdf' });
      const lancsParaMsg = temVencidos ? lancVencidos : cliente.lancamentos;
      const processoIds = [...new Set(lancsParaMsg.map(l => l.processo_id).filter(Boolean))] as string[];
      const vaMap: Record<string, number> = {};
      const vaDetalhadoMap: Record<string, Array<{ descricao: string; valor: number }>> = {};
      if (processoIds.length > 0) {
        const { data: vas } = await supabase.from('valores_adicionais').select('processo_id, descricao, valor').in('processo_id', processoIds);
        if (vas) {
          for (const va of vas) {
            // CODE-008 (17/05/2026): skip valor adicional NULL/0 (msg WhatsApp limpa).
            const vaValor = Number(va.valor);
            if (!Number.isFinite(vaValor) || vaValor <= 0) continue;
            vaMap[va.processo_id] = (vaMap[va.processo_id] || 0) + vaValor;
            if (!vaDetalhadoMap[va.processo_id]) vaDetalhadoMap[va.processo_id] = [];
            vaDetalhadoMap[va.processo_id].push({ descricao: (va as any).descricao || 'Taxa', valor: vaValor });
          }
        }
      }
      const nomeRemetente = await getNomeRemetente();
      const msg = buildMensagemFromLancamentos({ lancamentos: lancsParaMsg, vaMap, vaDetalhadoMap, diasAtraso: maiorAtraso, nomeRemetente });
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

  const valorSelecionado = cliente.lancamentos.filter(l => selectedPagar.has(l.id)).reduce((s, l) => s + l.valor, 0);

  return (
    <>
      <AccordionItem value={cliente.cliente_id} className={cn("border rounded-lg bg-card", temVencidos && "border-destructive/30")}>
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
                {fmt(cliente.total_faturado)} · Enviado · Vence {fmtDate(vencimento)}
              </p>
              <div className="flex flex-wrap gap-1 items-center">
                <ClienteHeaderBadges cliente={cliente} />
                {temVencidos ? (
                  <Badge className="bg-destructive/15 text-destructive border-0 text-[10px] sm:text-xs whitespace-nowrap">
                    Vencido há {maiorAtraso}d
                  </Badge>
                ) : (
                  <Badge variant="outline" className={cn('text-[10px] sm:text-xs whitespace-nowrap', dias < 0
                    ? 'bg-destructive/10 text-destructive border-destructive/30'
                    : dias <= 3
                      ? 'bg-warning/10 text-warning border-warning/30'
                      : 'bg-muted text-muted-foreground'
                  )}>
                    {dias < 0 ? `Vencido há ${Math.abs(dias)}d` : dias === 0 ? 'Vence hoje' : `${dias}d p/ vencer`}
                  </Badge>
                )}
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
            {cliente.lancamentos.map(l => {
              const isVenc = isLancamentoVencidoReal(l);
              const dAtraso = isVenc ? Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(l.data_vencimento + 'T00:00:00').getTime()) / 86400000) : 0;
              return (
                <div key={l.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedPagar.has(l.id)}
                    onCheckedChange={() => toggleSelectPagar(l.id)}
                    className="h-4 w-4 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <LancamentoRow lancamento={l} />
                  </div>
                  {isVenc && (
                    <Badge className="bg-destructive/15 text-destructive border-0 text-[10px] shrink-0">
                      Vencido {dAtraso}d
                    </Badge>
                  )}
                </div>
              );
            })}
            <div className="flex items-center gap-2 mt-2">
              <Button size="sm" variant="ghost" className="text-xs h-6" onClick={selectAllPagar}>
                Selecionar todos
              </Button>
              <Button size="sm" variant="ghost" className="text-xs h-6" onClick={deselectAllPagar}>
                Limpar seleção
              </Button>
              <span className="text-xs text-muted-foreground">
                {selectedPagar.size} de {cliente.lancamentos.length} · {fmt(valorSelecionado)}
              </span>
            </div>
            {/* 27/05 noite: grid enxuto na bulk toolbar do AguardandoItem.
                Compartilhar / Editar vencimento / Copiar WhatsApp / Baixar
                consolidados dentro do "Ver cobrança". */}
            <div className="grid grid-cols-2 sm:flex gap-2 mt-3 sm:flex-wrap">
              <WhatsappLinkButton
                phone={cliente.cliente_telefone || ''}
                message={whatsappMsgAguardando}
                label={`WhatsApp${cliente.cliente_telefone ? ` ${cliente.cliente_telefone}` : ''}`.trim()}
                variant="outline"
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
              <Button size="sm" variant="outline" onClick={handleCopiarLinkCobrancaAguardando} className="h-11 sm:h-9">
                <LinkIcon className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Copiar Link</span><span className="sm:hidden">Link</span>
              </Button>
              <Button size="sm" onClick={() => setShowPago(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white col-span-2 h-11 sm:h-9">
                <CheckCircle className="h-4 w-4 mr-1" /> {selectedPagar.size > 0 ? `Pagar (${selectedPagar.size})` : 'Marcar como Pago'}
              </Button>
              {contestarLancamento && selectedPagar.size === 1 && (
                <Button size="sm" variant="outline" onClick={() => { setContestarModal(Array.from(selectedPagar)[0]); }} className="text-amber-600 border-amber-600/30 hover:bg-amber-500/10 h-11 sm:h-9">
                  <AlertTriangle className="h-4 w-4 mr-1" /> Contestar
                </Button>
              )}
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      <Dialog open={showPago} onOpenChange={setShowPago}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar Pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {cliente.cliente_apelido || cliente.cliente_nome} — {selectedPagar.size > 0 ? `${selectedPagar.size} de ${cliente.lancamentos.length} processos · ${fmt(valorSelecionado)}` : fmt(cliente.total_faturado)}
            </p>
            <div>
              <label className="text-xs font-medium">Data do pagamento</label>
              <Input type="date" value={dataPagamento} onChange={e => setDataPagamento(e.target.value)} />
            </div>
            {/* R2.7 — pagamento alto pede dupla confirmação pra reduzir clique acidental */}
            {(() => {
              const totalConfirmar = selectedPagar.size > 0 ? valorSelecionado : cliente.total_faturado;
              return totalConfirmar >= 3000 ? (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
                  <strong>Atenção:</strong> valor alto ({fmt(totalConfirmar)}). Confira data
                  e processos antes de confirmar — depois só dá pra reverter manualmente.
                </div>
              ) : null;
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPago(false)}>Cancelar</Button>
            <Button onClick={confirmarPago} className="bg-emerald-600 hover:bg-emerald-700 text-white">Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!contestarModal} onOpenChange={(open) => {
        if (!open) {
          setContestarModal(null);
          setContestarMotivo('');
          setContestarAnexo(null);
          if (contestarAnexoPreview) { URL.revokeObjectURL(contestarAnexoPreview); setContestarAnexoPreview(null); }
        }
      }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Contestar Lançamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Motivo da contestação</label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                placeholder="Descreva o motivo da contestação..."
                value={contestarMotivo}
                onChange={e => setContestarMotivo(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium">Anexo (opcional)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  // BUG-003 documentos (18/05): padronizado pra 10MB (igual ContractDropzone + RecargaModal)
                  if (f.size > 10 * 1024 * 1024) { toast.error('Arquivo muito grande. Máximo: 10MB'); return; }
                  setContestarAnexo(f);
                  if (f.type.startsWith('image/')) {
                    setContestarAnexoPreview(URL.createObjectURL(f));
                  } else {
                    setContestarAnexoPreview(null);
                  }
                }}
              />
              {contestarAnexo ? (
                <div className="flex items-center gap-2 mt-1 p-2 rounded-md border bg-muted/30">
                  {contestarAnexoPreview ? (
                    <img src={contestarAnexoPreview} alt="preview" className="h-10 w-10 rounded object-cover shrink-0" />
                  ) : (
                    <FileIcon className="h-5 w-5 text-muted-foreground shrink-0" />
                  )}
                  <span className="text-xs truncate flex-1">{contestarAnexo.name}</span>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" onClick={() => {
                    setContestarAnexo(null);
                    if (contestarAnexoPreview) { URL.revokeObjectURL(contestarAnexoPreview); setContestarAnexoPreview(null); }
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="mt-1 w-full gap-1 text-xs" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5" /> Selecionar arquivo
                </Button>
              )}
              <p className="text-[10px] text-muted-foreground mt-1">PNG, JPG ou PDF — máx. 5MB</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setContestarModal(null);
              setContestarMotivo('');
              setContestarAnexo(null);
              if (contestarAnexoPreview) { URL.revokeObjectURL(contestarAnexoPreview); setContestarAnexoPreview(null); }
            }}>Cancelar</Button>
            <Button
              disabled={!contestarMotivo.trim() || uploadingAnexo}
              onClick={async () => {
                if (!contestarModal || !contestarMotivo.trim()) return;
                let anexoUrl: string | null = null;
                if (contestarAnexo) {
                  setUploadingAnexo(true);
                  try {
                    const ext = contestarAnexo.name.split('.').pop();
                    const relativePath = `contestacoes/${contestarModal}/${Date.now()}.${ext}`;
                    const storagePath = await empresaPath(relativePath);
                    const { error } = await supabase.storage
                      .from('contestacoes')
                      .upload(storagePath, contestarAnexo, { upsert: true });
                    if (error) throw error;
                    anexoUrl = storagePath;
                  } catch (err: any) {
                    toast.error('Erro no upload: ' + (err?.message || 'Erro'));
                    setUploadingAnexo(false);
                    return;
                  }
                  setUploadingAnexo(false);
                }
                contestarLancamento.mutate({ lancamentoId: contestarModal, motivo: contestarMotivo, anexoUrl });
                setContestarModal(null);
                setContestarMotivo('');
                setContestarAnexo(null);
                if (contestarAnexoPreview) { URL.revokeObjectURL(contestarAnexoPreview); setContestarAnexoPreview(null); }
              }}
            >
              {uploadingAnexo ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Enviando...</> : 'Confirmar Contestação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DetalhesCobrancaModal
        open={detalhesOpen}
        onOpenChange={setDetalhesOpen}
        cobrancaId={cobrancaIdAtiva}
        clienteNome={cliente.cliente_apelido || cliente.cliente_nome}
        clienteTelefone={cliente.cliente_telefone}
        total={cliente.total_faturado}
        onCompartilhar={handleCompartilharAguardando}
        onCopiarMensagemWhatsapp={handleCopiarCobranca}
        onBaixarExtrato={(cliente.lancamentos.some(l => l.extrato_id) || cliente.extrato_mais_recente) ? handleBaixarExtrato : undefined}
        baixarLoading={loadingExtrato}
      />
    </>
  );
}
