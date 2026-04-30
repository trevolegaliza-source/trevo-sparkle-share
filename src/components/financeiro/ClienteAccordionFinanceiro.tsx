import { memo, useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FileText, Send, Copy, Download, CheckCircle, AlertTriangle, Clock, RefreshCw, Loader2, MoreHorizontal, Receipt, MessageCircle, Share2, ChevronDown, Upload, X, File as FileIcon, Undo2, Link as LinkIcon } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
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
import { empresaPath } from '@/lib/storage-path';
import { EtiquetasEdit } from '@/components/EtiquetasBadges';
import ValoresAdicionaisModal from './ValoresAdicionaisModal';
import DeferimentoModal from './DeferimentoModal';
import { useHighlightOnModal } from '@/hooks/useHighlightOnModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ClienteFinanceiro, LancamentoFinanceiro, MensalistaSemFatura } from '@/hooks/useFinanceiroClientes';
import { isLancamentoVencidoReal, invalidateFinanceiro } from '@/hooks/useFinanceiroClientes';
import { useExtratos } from '@/hooks/useExtratos';
import { gerarExtratoPDF, fetchValoresAdicionaisMulti, fetchCompetenciaProcessos } from '@/lib/extrato-pdf';
import { gerarMensagemCobranca } from '@/lib/mensagem-cobranca';
import { getContatoCobranca } from '@/lib/contato-cobranca';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { TIPO_PROCESSO_LABELS } from '@/types/financial';
import type { ProcessoFinanceiro } from '@/hooks/useProcessosFinanceiro';
import { downloadExtrato } from '@/lib/storage-utils';
import { fetchExtratoBlob, triggerBlobDownload } from '@/lib/extrato-download';
import { consolidarObservacoes } from '@/lib/observacao-processo';

// ══════════ WHATSAPP HELPER ══════════
import { WhatsappLinkButton } from './WhatsappLinkButton';
import { buildWhatsappUrl } from '@/lib/open-whatsapp';
import { getCobrancaTokenAtiva } from '@/hooks/useFinanceiroClientes';
import { getCobrancaPublicUrl } from '@/lib/cobranca-url';
import GerarAsaasModal from './GerarAsaasModal';
import DetalhesCobrancaModal from './DetalhesCobrancaModal';
import { useCobrancaAsaas } from '@/hooks/useAsaas';
import { FileBadge, Eye } from 'lucide-react';

/** Programmatic open via real anchor click (used after WhatsappLinkButton click handlers). */
function openWhatsApp(phone: string, message: string) {
  navigator.clipboard.writeText(message).catch(() => {});
  const url = buildWhatsappUrl(phone, message);
  if (url === '#') {
    toast.error('Telefone inválido.');
    return;
  }
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  toast.success('✅ Mensagem copiada! Abrindo WhatsApp...');
}

// ══════════ EXPORTED TYPE ══════════
export type ExtratoGeradoPayload = {
  blob: Blob;
  filename: string;
  clienteId: string;
  clienteNome: string;
  clienteTelefone: string;
  total: number;
  /** Lancamentos included in this extrato — used for WhatsApp message */
  lancamentos: LancamentoFinanceiro[];
  cobrancaUrl?: string;
  cobrancaId?: string;
  cleanup?: () => void;
};

export type ExtratoRequestPayload = {
  requestKey: string;
  clienteId: string;
  clienteNome: string;
  clienteTelefone: string;
  lancamentos: LancamentoFinanceiro[];
};

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export async function getNomeRemetente(): Promise<string> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('nome').eq('id', user.id).single();
      if (profile?.nome) return (profile.nome as string).split(' ')[0];
    }
  } catch { /* ignore */ }
  return 'Equipe';
}

async function marcarLancamentosComoEnviados(lancamentoIds: string[]) {
  if (lancamentoIds.length === 0) return true;
  const { error } = await supabase
    .from('lancamentos')
    .update({
      etapa_financeiro: 'cobranca_enviada',
      observacoes_financeiro: `Cobrança enviada em ${new Date().toLocaleDateString('pt-BR')}`,
    } as any)
    .in('id', lancamentoIds);

  if (error) {
    toast.error(error.message);
    return false;
  }

  return true;
}

interface MsgBuilderParams {
  lancamentos: LancamentoFinanceiro[];
  vaMap: Record<string, number>;
  vaDetalhadoMap?: Record<string, Array<{ descricao: string; valor: number }>>;
  diasAtraso: number;
  nomeRemetente: string;
  observacao?: string;
}

function getTipoProcessoLabel(tipo: string) {
  return TIPO_PROCESSO_LABELS[tipo as keyof typeof TIPO_PROCESSO_LABELS] || (tipo ? tipo.charAt(0).toUpperCase() + tipo.slice(1) : 'Processo');
}

function sanitizeFileNamePart(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
    .toUpperCase();
}

export function buildExtratoFilename(clienteNome: string, date = new Date()) {
  const safeName = sanitizeFileNamePart(clienteNome) || 'CLIENTE';
  return `extrato_${safeName}_${date.toISOString().split('T')[0]}.pdf`;
}

async function buildValoresAdicionaisMap(lancamentos: Array<Pick<LancamentoFinanceiro, 'processo_id'>>) {
  const processoIds = [...new Set(lancamentos.map(l => l.processo_id).filter(Boolean))] as string[];
  const vaMap: Record<string, number> = {};
  if (processoIds.length === 0) return vaMap;

  const { data: vas } = await supabase
    .from('valores_adicionais')
    .select('processo_id, valor')
    .in('processo_id', processoIds);

  if (vas) {
    for (const va of vas) {
      vaMap[va.processo_id] = (vaMap[va.processo_id] || 0) + va.valor;
    }
  }

  return vaMap;
}

export async function buildValoresAdicionaisDetalhadosMap(
  lancamentos: Array<Pick<LancamentoFinanceiro, 'processo_id'>>,
): Promise<Record<string, Array<{ descricao: string; valor: number }>>> {
  const processoIds = [...new Set(lancamentos.map(l => l.processo_id).filter(Boolean))] as string[];
  const map: Record<string, Array<{ descricao: string; valor: number }>> = {};
  if (processoIds.length === 0) return map;

  const { data: vas } = await supabase
    .from('valores_adicionais')
    .select('processo_id, descricao, valor')
    .in('processo_id', processoIds);

  if (vas) {
    for (const va of vas) {
      if (!map[va.processo_id]) map[va.processo_id] = [];
      map[va.processo_id].push({ descricao: va.descricao || 'Taxa', valor: Number(va.valor) || 0 });
    }
  }

  return map;
}

function getExtratoIdAtual(cliente: ClienteFinanceiro) {
  return cliente.extrato_mais_recente?.id || cliente.lancamentos.find(l => l.extrato_id)?.extrato_id || null;
}

function getLancamentosDoExtrato(cliente: ClienteFinanceiro, extratoId?: string | null) {
  if (!extratoId) return cliente.lancamentos;
  const lancamentos = cliente.lancamentos.filter(l => l.extrato_id === extratoId);
  return lancamentos.length > 0 ? lancamentos : cliente.lancamentos;
}

export function buildMensagemFromLancamentos({ lancamentos, vaMap, vaDetalhadoMap, diasAtraso, nomeRemetente, observacao }: MsgBuilderParams): string {
  const l = lancamentos[0];
  if (!l) return '';
  const honorarios = l.valor;
  const taxasExtras = l.processo_id ? (vaMap[l.processo_id] || 0) : 0;
  const taxasDetalhadas = l.processo_id ? (vaDetalhadoMap?.[l.processo_id] || []) : [];
  const valorPrimeiro = honorarios + taxasExtras;
  const adicionais = lancamentos.slice(1).map(item => {
    const h = item.valor;
    const t = item.processo_id ? (vaMap[item.processo_id] || 0) : 0;
    const td = item.processo_id ? (vaDetalhadoMap?.[item.processo_id] || []) : [];
    return {
      tipo: getTipoProcessoLabel(item.processo_tipo),
      razao_social: item.processo_razao_social,
      valor: h + t,
      honorarios: h,
      taxasExtras: t,
      taxasDetalhadas: td,
    };
  });
  // Consolida observações do processo + financeiro filtrando metadados auto-gerados.
  const obsConsolidada =
    observacao ??
    consolidarObservacoes(
      (l as any).processo_notas ?? null,
      l.observacoes_financeiro ?? null,
    ) ??
    undefined;
  return gerarMensagemCobranca({
    tipo: getTipoProcessoLabel(l.processo_tipo),
    razao_social: l.processo_razao_social,
    valor: valorPrimeiro,
    honorarios,
    taxasExtras,
    taxasDetalhadas,
    data_vencimento: l.data_vencimento,
    diasAtraso,
    nomeRemetente,
    observacao: obsConsolidada,
    processosAdicionais: adicionais.length > 0 ? adicionais : undefined,
  });
}



function fmtDate(d: string | null | undefined) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('pt-BR');
}

function diasAtraso(vencimento: string): number {
  const diff = Date.now() - new Date(vencimento).getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

function diasParaVencer(vencimento: string): number {
  const diff = new Date(vencimento).getTime() - Date.now();
  return Math.floor(diff / 86400000);
}

function parseBadges(notas: string | null): string[] {
  if (!notas) return [];
  const badges: string[] = [];
  const lower = notas.toLowerCase();
  if (lower.includes('boas-vindas') || lower.includes('boas vindas')) badges.push('Boas-vindas');
  if (lower.includes('mudança de uf') || lower.includes('mudanca de uf')) badges.push('Mudança UF');
  if (lower.includes('urgência') || lower.includes('urgencia') || lower.includes('método trevo')) badges.push('Urgência');
  if (lower.includes('valor manual')) badges.push('Valor Manual');
  if (lower.includes('cortesia')) badges.push('Cortesia');
  return badges;
}

const BADGE_COLORS: Record<string, string> = {
  'Boas-vindas': 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  'Mudança UF': 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  'Urgência': 'bg-red-500/15 text-red-500 border-red-500/30',
  'Valor Manual': 'bg-orange-500/15 text-orange-500 border-orange-500/30',
  'Cortesia': 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
};

function tipoLabel(c: ClienteFinanceiro): string {
  if (c.cliente_momento_faturamento === 'no_deferimento') return 'No deferimento';

  if (c.cliente_tipo === 'MENSALISTA') {
    return `Mensalista${c.cliente_dia_vencimento_mensal ? ` — dia ${c.cliente_dia_vencimento_mensal}` : ''}`;
  }

  if (c.cliente_tipo === 'PRE_PAGO') return 'Pré-Pago';

  if (c.cliente_dia_vencimento_mensal && c.cliente_dia_vencimento_mensal > 0 && !c.cliente_dia_cobranca) {
    return `Fatura mensal — dia ${c.cliente_dia_vencimento_mensal}`;
  }

  if (c.cliente_dia_cobranca && c.cliente_dia_cobranca > 0) {
    return `Avulso D+${c.cliente_dia_cobranca}`;
  }

  return 'Avulso';
}

// ══════════ HELPER: Client-level badge indicators ══════════
function ClienteHeaderBadges({ cliente }: { cliente: ClienteFinanceiro }) {
  const temMetodoTrevo = cliente.lancamentos.some(l => l.tem_etiqueta_metodo_trevo);
  const temPrioridade = cliente.lancamentos.some(l => l.tem_etiqueta_prioridade);
  const temAlertaTaxas = cliente.lancamentos.some(l =>
    (l.tem_etiqueta_metodo_trevo || l.tem_etiqueta_prioridade) && l.total_valores_adicionais === 0
  );
  const totalTaxas = cliente.lancamentos.reduce((s, l) => s + l.total_valores_adicionais, 0);

  return (
    <>
      {temMetodoTrevo && (
        <Badge variant="outline" className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px] px-1.5 py-0">
          🍀 Método Trevo
        </Badge>
      )}
      {temPrioridade && (
        <Badge variant="outline" className="bg-red-500/15 text-red-500 border-red-500/30 text-[10px] px-1.5 py-0">
          🔴 Prioridade
        </Badge>
      )}
      {temAlertaTaxas && (
        <Badge variant="outline" className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px] px-1.5 py-0">
          ⚠️ Taxas pendentes
        </Badge>
      )}
      {totalTaxas > 0 && (
        <span className="text-[10px] text-muted-foreground">+ {fmt(totalTaxas)} taxas</span>
      )}
    </>
  );
}

// ══════════ TAB: FATURAR ══════════
function ClientesFaturarBase({
  clientes, 
  mensalistasSemFatura = [],
  onExtratoGerado,
}: { 
  clientes: ClienteFinanceiro[]; 
  mensalistasSemFatura?: MensalistaSemFatura[];
  onExtratoGerado: (payload: ExtratoGeradoPayload) => void;
}) {
  const queryClient = useQueryClient();
  const [gerandoFatura, setGerandoFatura] = useState<string | null>(null);

  const handleGerarFaturaMensal = useCallback(async (m: MensalistaSemFatura) => {
    setGerandoFatura(m.id);
    try {
      const now = new Date();
      const dia = m.dia_vencimento_mensal || 10;
      const vencimento = new Date(now.getFullYear(), now.getMonth(), dia);
      if (vencimento < now) {
        vencimento.setMonth(vencimento.getMonth() + 1);
      }
      const mesLabel = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

      const { error } = await supabase.from('lancamentos').insert({
        tipo: 'receber' as const,
        cliente_id: m.id,
        descricao: `Fatura mensal — ${mesLabel}`,
        valor: m.valor_base,
        data_vencimento: vencimento.toISOString().split('T')[0],
        status: 'pendente' as const,
        etapa_financeiro: 'solicitacao_criada',
      });
      if (error) throw error;
      toast.success(`Fatura mensal gerada para ${m.apelido || m.nome}!`);
      invalidateFinanceiro(queryClient);
    } catch (err: any) {
      toast.error('Erro ao gerar fatura: ' + (err?.message || 'Erro'));
    } finally {
      setGerandoFatura(null);
    }
  }, [queryClient]);

  const hasMensalistas = mensalistasSemFatura.length > 0;
  const hasClientes = clientes.length > 0;

  const ETAPAS_DEFERIDAS = ['registro', 'finalizados', 'mat', 'inscricao_me', 'alvaras', 'conselho', 'deferido', 'concluido'];

  const { prontos, aguardandoDef } = useMemo(() => {
    const prontosMap = new Map<string, ClienteFinanceiro>();
    const aguardandoDefMap = new Map<string, ClienteFinanceiro>();

    for (const c of clientes) {
      if (c.cliente_momento_faturamento !== 'no_deferimento') {
        prontosMap.set(c.cliente_id, c);
        continue;
      }

      const lancDeferidos = c.lancamentos.filter(l => ETAPAS_DEFERIDAS.includes(l.processo_etapa));
      const lancNaoDeferidos = c.lancamentos.filter(l => !ETAPAS_DEFERIDAS.includes(l.processo_etapa));

      if (lancDeferidos.length > 0) {
        prontosMap.set(c.cliente_id, {
          ...c,
          lancamentos: lancDeferidos,
          qtd_processos: lancDeferidos.length,
          total_faturado: lancDeferidos.reduce((s, l) => s + l.valor, 0),
          total_pendente: lancDeferidos.filter(l => l.status !== 'pago').reduce((s, l) => s + l.valor, 0),
          qtd_sem_extrato: lancDeferidos.filter(l => !l.extrato_id && l.etapa_financeiro === 'solicitacao_criada').length,
        });
      }

      if (lancNaoDeferidos.length > 0) {
        aguardandoDefMap.set(c.cliente_id, {
          ...c,
          lancamentos: lancNaoDeferidos,
          qtd_processos: lancNaoDeferidos.length,
          total_faturado: lancNaoDeferidos.reduce((s, l) => s + l.valor, 0),
          total_pendente: lancNaoDeferidos.filter(l => l.status !== 'pago').reduce((s, l) => s + l.valor, 0),
          qtd_sem_extrato: lancNaoDeferidos.filter(l => !l.extrato_id && l.etapa_financeiro === 'solicitacao_criada').length,
        });
      }
    }

    return {
      prontos: Array.from(prontosMap.values()),
      aguardandoDef: Array.from(aguardandoDefMap.values()),
    };
  }, [clientes]);

  const [defOpen, setDefOpen] = useState(false);

  if (!hasMensalistas && !hasClientes) return <EmptyState text="Nenhum cliente aguardando geração de extrato." />;

  return (
    <div className="space-y-6">
      {hasMensalistas && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-amber-600 flex items-center gap-1.5">📋 Mensalistas sem fatura neste mês</h3>
          <div className="space-y-2">
            {mensalistasSemFatura.map(m => (
              <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5">
                <div>
                  <p className="text-sm font-medium">{m.apelido || m.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmt(m.valor_base)}/mês · Vencimento dia {m.dia_vencimento_mensal}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={gerandoFatura === m.id}
                  onClick={() => handleGerarFaturaMensal(m)}
                  className="text-xs"
                >
                  {gerandoFatura === m.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Receipt className="h-3 w-3 mr-1" />}
                  Gerar Fatura
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {prontos.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-emerald-600 flex items-center gap-1.5">✅ Prontos para cobrar</h3>
          <Accordion type="multiple" defaultValue={[]} className="space-y-2">
            {prontos.map(c => <FaturarItem key={c.cliente_id} cliente={c} isDeferimento={false} onExtratoGerado={onExtratoGerado} />)}
          </Accordion>
        </div>
      )}
      {aguardandoDef.length > 0 && (
        <Collapsible open={defOpen} onOpenChange={setDefOpen}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors w-full text-left">
              <ChevronDown className={cn("h-4 w-4 transition-transform", defOpen && "rotate-180")} />
              ⏳ Aguardando deferimento — não cobrar ainda ({aguardandoDef.reduce((s, c) => s + c.qtd_processos, 0)} proc.)
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <Accordion type="multiple" defaultValue={[]} className="space-y-2">
              {aguardandoDef.map(c => <FaturarItem key={c.cliente_id + '_def'} cliente={c} isDeferimento={true} onExtratoGerado={onExtratoGerado} />)}
            </Accordion>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

export const ClientesFaturar = memo(ClientesFaturarBase);
ClientesFaturar.displayName = 'ClientesFaturar';

function FaturarItem({ cliente, isDeferimento = false, onExtratoGerado }: { 
  cliente: ClienteFinanceiro; 
  isDeferimento?: boolean;
  onExtratoGerado: (payload: ExtratoGeradoPayload) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [taxaModalOpen, setTaxaModalOpen] = useState(false);
  const [taxaProcessoId, setTaxaProcessoId] = useState<string>('');
  const [taxaClienteApelido, setTaxaClienteApelido] = useState<string>('');
  const [deferimentoOpen, setDeferimentoOpen] = useState(false);
  const [deferimentoProcessos, setDeferimentoProcessos] = useState<Array<{
    processo_id: string;
    razao_social: string;
    tipo: string;
    data_deferimento_atual: string | null;
  }>>([]);
  const queryClient = useQueryClient();

  const lancSemExtrato = cliente.lancamentos.filter(l => l.status !== 'pago' && l.etapa_financeiro !== 'honorario_pago');
  const totalSelecionado = lancSemExtrato.filter(l => selected.has(l.id)).reduce((s, l) => s + l.valor, 0);

  function toggleAll() {
    if (selected.size === lancSemExtrato.length) setSelected(new Set());
    else setSelected(new Set(lancSemExtrato.map(l => l.id)));
  }

  const { isMaster } = usePermissions();
  const [confirmDesauditarOpen, setConfirmDesauditarOpen] = useState(false);
  const [desauditando, setDesauditando] = useState(false);

  const lancsParaDesauditar = cliente.lancamentos.filter(
    (l) => (l as any).auditado === true && l.status !== 'pago' && !l.extrato_id
  );

  async function handleDesauditar() {
    setDesauditando(true);
    try {
      const ids = lancsParaDesauditar.map((l) => l.id);
      if (ids.length === 0) {
        toast.warning('Nenhum processo elegível para desauditar (já possuem extrato ou estão pagos).');
        return;
      }
      const { error } = await supabase
        .from('lancamentos')
        .update({ auditado: false, auditado_por: null, auditado_em: null } as any)
        .in('id', ids);
      if (error) throw error;
      toast.success(`${ids.length} processo${ids.length > 1 ? 's' : ''} devolvido${ids.length > 1 ? 's' : ''} para auditoria`);
      invalidateFinanceiro(queryClient);
    } catch (err: any) {
      toast.error('Erro ao desauditar: ' + (err?.message || 'Erro'));
    } finally {
      setDesauditando(false);
      setConfirmDesauditarOpen(false);
    }
  }

  async function handleGerarExtrato() {
    const selecionados = lancSemExtrato.filter(l => selected.has(l.id));
    if (selecionados.length === 0) { toast.warning('Selecione ao menos um processo.'); return; }

    if (cliente.cliente_momento_faturamento === 'no_deferimento') {
      setGenerating(true);
      const processoIds = selecionados.map(l => l.processo_id).filter(Boolean);
      const { data: processosData } = await supabase
        .from('processos')
        .select('id, razao_social, tipo, data_deferimento')
        .in('id', processoIds);

      setDeferimentoProcessos((processosData || []).map((p: any) => ({
        processo_id: p.id,
        razao_social: p.razao_social,
        tipo: p.tipo,
        data_deferimento_atual: p.data_deferimento || null,
      })));
      setDeferimentoOpen(true);
      setGenerating(false);
      return;
    }

    executarGeracaoExtrato(selecionados);
  }

  async function handleDeferimentoConfirm(processoIdsDeferidos: string[]) {
    setDeferimentoOpen(false);
    const selecionadosDeferidos = lancSemExtrato.filter(
      l => selected.has(l.id) && processoIdsDeferidos.includes(l.processo_id!)
    );
    if (selecionadosDeferidos.length === 0) {
      toast.warning('Nenhum processo deferido selecionado.');
      return;
    }
    executarGeracaoExtrato(selecionadosDeferidos);
  }

  async function executarGeracaoExtrato(selecionados: typeof lancSemExtrato) {
    setGenerating(true);
    queryClient.cancelQueries({ queryKey: ['financeiro_clientes'] });
    try {
      const processoIds = selecionados.map(l => l.processo_id).filter(Boolean) as string[];
      const clienteId = cliente.cliente_id;
      const clienteNome = cliente.cliente_apelido || cliente.cliente_nome;

      // Fetch client data, valores adicionais, and competencia in parallel
      const [clienteData, vaMulti, allComp] = await Promise.all([
        supabase.from('clientes').select('nome, cnpj, apelido, valor_base, desconto_progressivo, valor_limite_desconto, telefone, telefone_financeiro, email, nome_contador, dia_cobranca, dia_vencimento_mensal').eq('id', clienteId).single().then(r => r.data),
        fetchValoresAdicionaisMulti(processoIds),
        fetchCompetenciaProcessos(clienteId, selecionados.map(l => ({
          id: l.processo_id || l.id,
          created_at: l.processo_created_at || new Date().toISOString(),
        })) as any),
      ]);

      const processos = selecionados.map(l => ({
        id: l.processo_id || l.id,
        razao_social: l.processo_razao_social,
        tipo: l.processo_tipo,
        valor: l.valor,
        valor_avulso: l.valor_original ?? null,
        created_at: l.processo_created_at || new Date().toISOString(),
        etapa: l.processo_etapa || '',
        cliente_id: clienteId,
        notas: l.processo_notas || null,
        data_deferimento: null,
        etiquetas: [] as string[],
      }));

      const result = await gerarExtratoPDF({
        processos: processos as any,
        allCompetencia: allComp as any,
        valoresAdicionais: vaMulti,
        cliente: {
          nome: clienteData?.nome || clienteNome,
          cnpj: (clienteData as any)?.cnpj || null,
          apelido: (clienteData as any)?.apelido || null,
          valor_base: (clienteData as any)?.valor_base || null,
          desconto_progressivo: (clienteData as any)?.desconto_progressivo || null,
          valor_limite_desconto: (clienteData as any)?.valor_limite_desconto || null,
          telefone: (clienteData as any)?.telefone || null,
          email: (clienteData as any)?.email || null,
          nome_contador: (clienteData as any)?.nome_contador || null,
          dia_cobranca: (clienteData as any)?.dia_cobranca || null,
          dia_vencimento_mensal: (clienteData as any)?.dia_vencimento_mensal || null,
        },
      });

      const pdfBlob = result.doc.output('blob');
      const filename = buildExtratoFilename(clienteNome);

      // Save extrato to DB
      const { empresaPath } = await import('@/lib/storage-path');
      const path = await empresaPath(`extratos/${clienteId}/${filename}`);
      await supabase.storage.from('documentos').upload(path, pdfBlob, { contentType: 'application/pdf', upsert: true });
      const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(path);

      const now = new Date();
      const { data: extrato, error: insertError } = await supabase
        .from('extratos')
        .insert({
          cliente_id: clienteId,
          pdf_url: urlData.publicUrl,
          filename,
          total_honorarios: result.totalHonorarios,
          total_taxas: result.totalTaxas,
          total_geral: result.totalGeral,
          qtd_processos: result.processCount,
          processo_ids: processoIds,
          competencia_mes: now.getMonth() + 1,
          competencia_ano: now.getFullYear(),
          status: 'ativo',
        })
        .select()
        .single();
      if (insertError) throw insertError;

      // Link lancamentos to extrato
      for (const pid of processoIds) {
        await supabase
          .from('lancamentos')
          .update({
            extrato_id: (extrato as any).id,
            etapa_financeiro: 'cobranca_gerada',
          } as any)
          .eq('processo_id', pid)
          .eq('tipo', 'receber');
      }

      // Criar registro de cobrança pública
      let cobrancaUrl: string | undefined;
      let cobrancaId: string | undefined;
      try {
        const { getCobrancaPublicUrl } = await import('@/lib/cobranca-url');
        const lancamentoIds = selecionados.map(l => l.id);
        const datasVenc = selecionados
          .map(l => l.data_vencimento)
          .filter(Boolean)
          .sort();
        const dataVencimento = datasVenc[0] || null;

        const { data: cobranca, error: cobErr } = await supabase
          .from('cobrancas')
          .insert({
            cliente_id: clienteId,
            extrato_id: (extrato as any).id,
            lancamento_ids: lancamentoIds,
            total_honorarios: result.totalHonorarios,
            total_taxas: result.totalTaxas,
            total_geral: result.totalGeral,
            data_vencimento: dataVencimento,
            status: 'ativa',
          } as any)
          .select('id, share_token')
          .single();

        if (cobErr) throw cobErr;
        cobrancaId = (cobranca as any).id;
        cobrancaUrl = getCobrancaPublicUrl((cobranca as any).share_token);
      } catch (cobErr: any) {
        console.error('Falha ao criar cobrança pública:', cobErr);
        // Não bloquear fluxo do extrato se cobrança falhar
      }

      // invalidateFinanceiro moved to ModalPosExtrato close

      toast.success('Extrato gerado com sucesso!');

      onExtratoGerado({
        blob: pdfBlob,
        filename,
        clienteId,
        clienteNome,
        clienteTelefone: (clienteData as any)?.telefone_financeiro || (clienteData as any)?.telefone || cliente.cliente_telefone || '',
        total: result.totalGeral,
        lancamentos: selecionados,
        cobrancaUrl,
        cobrancaId,
        cleanup: () => {
          setSelected(new Set());
          setGenerating(false);
        },
      });
    } catch (err: any) {
      setGenerating(false);
      toast.error('Erro ao gerar extrato: ' + (err?.message || 'Erro'));
    }
  }

  const nenhumDeferido = isDeferimento && cliente.lancamentos.every(l => {
    return l.processo_etapa ? ['recebidos', 'analise_documental', 'contrato', 'viabilidade', 'dbe', 'vre', 'aguardando_pagamento', 'taxa_paga', 'assinaturas', 'assinado', 'em_analise'].includes(l.processo_etapa) : true;
  });

  return (
    <AccordionItem value={cliente.cliente_id} className={cn("border rounded-lg bg-card", isDeferimento && "border-dashed opacity-60")}>
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
              {cliente.qtd_processos} proc. · {fmt(cliente.total_faturado)}
              {(() => {
                const totalTaxas = cliente.lancamentos.reduce((s, l) => s + (l.total_valores_adicionais || 0), 0);
                return totalTaxas > 0 ? <> + {fmt(totalTaxas)} taxas</> : null;
              })()}
              {' · '}{tipoLabel(cliente)}
            </p>
            <div className="flex flex-wrap gap-1 items-center">
              <ClienteHeaderBadges cliente={cliente} />
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-[10px] sm:text-xs whitespace-nowrap">
                {cliente.qtd_sem_extrato} sem extrato
              </Badge>
              {cliente.qtd_aguardando_deferimento > 0 && (
                <Badge variant="outline" className="bg-muted text-muted-foreground border-muted-foreground/30 text-[10px] sm:text-xs whitespace-nowrap">
                  ⏳ {cliente.qtd_aguardando_deferimento} ag. deferimento
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-2">
            {isMaster() && lancsParaDesauditar.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setConfirmDesauditarOpen(true);
                }}
              >
                <Undo2 className="h-3 w-3" />
                Voltar pra Auditoria
              </Button>
            )}
            <MoverParaMenu cliente={cliente} />
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0" />
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Checkbox checked={selected.size === lancSemExtrato.length && lancSemExtrato.length > 0} onCheckedChange={toggleAll} />
            <span className="text-xs text-muted-foreground">Selecionar todos</span>
          </div>
          {lancSemExtrato.map(l => (
            <LancamentoRowWithHighlight
              key={l.id}
              lancamento={l}
              checked={selected.has(l.id)}
              isTaxaSourceOpen={taxaModalOpen && l.processo_id === taxaProcessoId}
              onToggle={() => {
                const next = new Set(selected);
                if (next.has(l.id)) next.delete(l.id); else next.add(l.id);
                setSelected(next);
              }}
              onOpenTaxa={() => {
                setTaxaProcessoId(l.processo_id!);
                setTaxaClienteApelido(cliente.cliente_apelido || cliente.cliente_nome);
                setTaxaModalOpen(true);
              }}
            />
          ))}
          {selected.size > 0 && (
            <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3 mt-3">
              <span className="text-sm font-medium">{selected.size} selecionados · {fmt(totalSelecionado)}</span>
              <Button size="sm" onClick={handleGerarExtrato} disabled={generating || (isDeferimento && nenhumDeferido)} className="bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50">
                <FileText className="h-4 w-4 mr-1" />
                {generating ? 'Gerando...' : `Gerar Extrato (${selected.size})`}
              </Button>
            </div>
          )}
        </div>
      </AccordionContent>
      {taxaProcessoId && (
        <ValoresAdicionaisModal
          open={taxaModalOpen}
          onOpenChange={setTaxaModalOpen}
          processoId={taxaProcessoId}
          clienteApelido={taxaClienteApelido}
        />
      )}
      <DeferimentoModal
        open={deferimentoOpen}
        onOpenChange={setDeferimentoOpen}
        clienteNome={cliente.cliente_apelido || cliente.cliente_nome}
        processos={deferimentoProcessos}
        onConfirm={handleDeferimentoConfirm}
      />
      <AlertDialog open={confirmDesauditarOpen} onOpenChange={setConfirmDesauditarOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Devolver para auditoria?</AlertDialogTitle>
            <AlertDialogDescription>
              {lancsParaDesauditar.length} processo{lancsParaDesauditar.length > 1 ? 's' : ''} de <strong>{cliente.cliente_apelido || cliente.cliente_nome}</strong> voltará{lancsParaDesauditar.length > 1 ? 'ão' : ''} para a aba <strong>Auditoria</strong>. Processos com extrato já gerado ou já pagos não serão afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={desauditando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDesauditar} disabled={desauditando}>
              {desauditando ? 'Devolvendo...' : 'Devolver para auditoria'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AccordionItem>
  );
}

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
      } catch {/* noop */}
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
              variant="outline"
              onClick={() => setDetalhesOpen(true)}
              disabled={!cobrancaIdAtiva}
              className="h-11 sm:h-9 text-primary border-primary/40 hover:bg-primary/10"
            >
              <Eye className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Ver cobrança</span>
              <span className="sm:hidden">Ver</span>
            </Button>
            <Button size="sm" variant="outline" onClick={handleCopiarLinkCobranca} className="h-11 sm:h-9">
              <LinkIcon className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Copiar Link</span><span className="sm:hidden">Link</span>
            </Button>
            <Button size="sm" variant="outline" onClick={handleCompartilhar} className="gap-1 h-11 sm:h-9">
              <Share2 className="h-4 w-4" /> <span className="hidden sm:inline">Compartilhar</span><span className="sm:hidden">Enviar</span>
            </Button>
            {hasExtratoNoSistema && (
              <Button size="sm" variant="outline" onClick={handleBaixarExtrato} disabled={loadingExtrato} className="h-11 sm:h-9">
                {loadingExtrato ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Baixando</>
                ) : (
                  <><Download className="h-4 w-4 mr-1" /> Baixar</>
                )}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={handleCopiarMensagem} className="h-11 sm:h-9">
              <Copy className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Copiar WhatsApp</span><span className="sm:hidden">Copiar</span>
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
      />
    </AccordionItem>
  );
}

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
              vaMap[va.processo_id] = (vaMap[va.processo_id] || 0) + Number(va.valor);
              if (!vaDetalhadoMap[va.processo_id]) vaDetalhadoMap[va.processo_id] = [];
              vaDetalhadoMap[va.processo_id].push({ descricao: (va as any).descricao || 'Taxa', valor: Number(va.valor) || 0 });
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
      } catch {/* noop */}
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
          vaMap[va.processo_id] = (vaMap[va.processo_id] || 0) + Number(va.valor);
          if (!vaDetalhadoMap[va.processo_id]) vaDetalhadoMap[va.processo_id] = [];
          vaDetalhadoMap[va.processo_id].push({ descricao: (va as any).descricao || 'Taxa', valor: Number(va.valor) || 0 });
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
          vaMap[va.processo_id] = (vaMap[va.processo_id] || 0) + Number(va.valor);
          if (!vaDetalhadoMap[va.processo_id]) vaDetalhadoMap[va.processo_id] = [];
          vaDetalhadoMap[va.processo_id].push({ descricao: (va as any).descricao || 'Taxa', valor: Number(va.valor) || 0 });
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
            vaMap[va.processo_id] = (vaMap[va.processo_id] || 0) + Number(va.valor);
            if (!vaDetalhadoMap[va.processo_id]) vaDetalhadoMap[va.processo_id] = [];
            vaDetalhadoMap[va.processo_id].push({ descricao: (va as any).descricao || 'Taxa', valor: Number(va.valor) || 0 });
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
            <div className="grid grid-cols-2 sm:flex gap-2 mt-3 sm:flex-wrap">
              <WhatsappLinkButton
                phone={cliente.cliente_telefone || ''}
                message={whatsappMsgAguardando}
                label={`WhatsApp${cliente.cliente_telefone ? ` ${cliente.cliente_telefone}` : ''}`.trim()}
                variant="outline"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDetalhesOpen(true)}
                disabled={!cobrancaIdAtiva}
                className="h-11 sm:h-9 text-primary border-primary/40 hover:bg-primary/10"
              >
                <Eye className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Ver cobrança</span>
                <span className="sm:hidden">Ver</span>
              </Button>
              <Button size="sm" variant="outline" onClick={handleCopiarLinkCobrancaAguardando} className="h-11 sm:h-9">
                <LinkIcon className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Copiar Link</span><span className="sm:hidden">Link</span>
              </Button>
              <Button size="sm" variant="outline" onClick={handleCompartilharAguardando} className="gap-1 h-11 sm:h-9">
                <Share2 className="h-4 w-4" /> <span className="hidden sm:inline">Compartilhar</span><span className="sm:hidden">Enviar</span>
              </Button>
              <Button size="sm" variant="outline" onClick={handleCopiarCobranca} className="h-11 sm:h-9">
                <Copy className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">{temVencidos ? 'Reenviar Cobrança' : 'Copiar WhatsApp'}</span><span className="sm:hidden">{temVencidos ? 'Reenviar' : 'Copiar'}</span>
              </Button>
              {(cliente.lancamentos.some(l => l.extrato_id) || cliente.extrato_mais_recente) && (
                <Button size="sm" variant="outline" onClick={handleBaixarExtrato} disabled={loadingExtrato} className="h-11 sm:h-9">
                  <Download className="h-4 w-4 mr-1" /> {loadingExtrato ? 'Baixando...' : 'Baixar'}
                </Button>
              )}
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
                  if (f.size > 5 * 1024 * 1024) { toast.error('Arquivo muito grande. Máximo: 5MB'); return; }
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
      />
    </>
  );
}

// ══════════ TAB: RECEBIDOS ══════════
export function ClientesRecebidos({ clientes }: { clientes: ClienteFinanceiro[] }) {
  if (clientes.length === 0) return <EmptyState text="Nenhum pagamento recebido neste período." />;
  return (
    <Accordion type="multiple" defaultValue={[]} className="space-y-2">
      {clientes.map(c => <RecebidoItem key={c.cliente_id} cliente={c} />)}
    </Accordion>
  );
}

function RecebidoItem({ cliente: c }: { cliente: ClienteFinanceiro }) {
  const qc = useQueryClient();
  // C19/C20 — confirm() nativo bloqueia main thread + UX inconsistente
  const [pendingDesfazer, setPendingDesfazer] = useState<string[] | null>(null);

  async function executarDesfazerPagamento(lancamentoIds: string[]) {
    setPendingDesfazer(null);
    const { error } = await supabase
      .from('lancamentos')
      .update({
        etapa_financeiro: 'cobranca_enviada',
        status: 'pendente' as const,
        data_pagamento: null,
        confirmado_recebimento: false,
      })
      .in('id', lancamentoIds);
    if (error) { toast.error(error.message); return; }
    invalidateFinanceiro(qc);
    toast.success('Pagamento desfeito! Lançamento voltou para "Aguardando".');
  }

  return (
    <>
      <AccordionItem key={c.cliente_id} value={c.cliente_id} className="border rounded-lg bg-card">
        <AccordionTrigger className="px-3 sm:px-4 py-3 hover:no-underline [&>svg]:hidden">
          <div className="flex items-center gap-2 flex-1 text-left min-w-0">
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <p className="font-semibold text-sm truncate min-w-0 flex-1">
                  {c.cliente_apelido || c.cliente_nome}
                  {c.cliente_codigo && <span className="text-muted-foreground font-mono font-normal text-xs"> · {c.cliente_codigo}</span>}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">{fmt(c.total_faturado)} · {c.qtd_processos} proc.</p>
              <div className="flex flex-wrap gap-1 items-center">
                <ClienteHeaderBadges cliente={c} />
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-[10px] sm:text-xs">
                  <CheckCircle className="h-3 w-3 mr-1" /> Pago
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0 ml-2">
              <MoverParaMenu cliente={c} />
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0" />
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          <div className="space-y-2">
            {c.lancamentos.map(l => (
              <div key={l.id} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <LancamentoRow lancamento={l} />
                </div>
                {(l.status === 'pago' || l.etapa_financeiro === 'honorario_pago') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 text-xs shrink-0"
                    onClick={() => setPendingDesfazer([l.id])}
                  >
                    Desfazer
                  </Button>
                )}
              </div>
            ))}
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                variant="outline"
                className="text-amber-600 border-amber-600/30 hover:bg-amber-500/10"
                onClick={() => setPendingDesfazer(c.lancamentos.map(l => l.id))}
              >
                Desfazer Todos os Pagamentos
              </Button>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AlertDialog open={!!pendingDesfazer} onOpenChange={(open) => { if (!open) setPendingDesfazer(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desfazer pagamento?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDesfazer && pendingDesfazer.length > 1
                ? `${pendingDesfazer.length} lançamentos voltarão para "Aguardando" (status pendente, sem data de pagamento).`
                : 'O lançamento voltará para "Aguardando" (status pendente, sem data de pagamento).'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDesfazer && executarDesfazerPagamento(pendingDesfazer)}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              Desfazer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

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

        let msg = buildMensagemFromLancamentos({ lancamentos: lancsForMsg, vaMap, vaDetalhadoMap, diasAtraso: 0, nomeRemetente });
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
  }, [extratoGerado]);

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
            {extratoGerado.cobrancaId && (
              <Button
                variant={asaasInfo?.payment_id ? 'outline' : 'default'}
                className="w-full gap-2 h-11"
                onClick={() => setAsaasModalOpen(true)}
              >
                <FileBadge className="h-4 w-4" />
                {asaasInfo?.payment_id ? 'Boleto/PIX gerado ✓ — Ver detalhes' : 'Gerar Boleto / PIX (Asaas)'}
              </Button>
            )}
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

// ══════════ MOVER PARA MENU ══════════
function MoverParaMenu({ cliente }: { cliente: ClienteFinanceiro }) {
  const qc = useQueryClient();

  async function handleMoverPara(novaEtapa: string) {
    const lancamentoIds = cliente.lancamentos
      .filter(l => l.status !== 'pago')
      .map(l => l.id);

    if (lancamentoIds.length === 0) {
      toast.error('Nenhum lançamento pendente para mover.');
      return;
    }

    const updates: Record<string, any> = { etapa_financeiro: novaEtapa };

    if (novaEtapa === 'honorario_pago') {
      updates.status = 'pago';
      updates.data_pagamento = new Date().toISOString().split('T')[0];
      updates.confirmado_recebimento = true;
    }

    if (novaEtapa === 'solicitacao_criada') {
      updates.extrato_id = null;
    }

    const { error } = await supabase
      .from('lancamentos')
      .update(updates as any)
      .in('id', lancamentoIds);

    if (error) {
      toast.error('Erro ao mover: ' + error.message);
      return;
    }

    invalidateFinanceiro(qc);

    const nomes: Record<string, string> = {
      solicitacao_criada: 'Cobrar',
      cobranca_gerada: 'Enviados',
      cobranca_enviada: 'Ag. Pagamento',
      honorario_pago: 'Pagos',
    };
    toast.success(`${cliente.cliente_apelido || cliente.cliente_nome} movido para "${nomes[novaEtapa] || novaEtapa}"`);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="sm" className="h-9 w-9 sm:h-7 sm:w-7 p-0 border border-border rounded-md flex items-center justify-center">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel className="text-xs text-muted-foreground">Mover para</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => handleMoverPara('solicitacao_criada')}>
          <FileText className="h-4 w-4 mr-2" />
          Cobrar (resetar)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleMoverPara('cobranca_gerada')}>
          <Send className="h-4 w-4 mr-2" />
          Enviados (extrato gerado)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleMoverPara('cobranca_enviada')}>
          <Clock className="h-4 w-4 mr-2" />
          Ag. Pagamento (enviado)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleMoverPara('honorario_pago')} className="text-emerald-500">
          <CheckCircle className="h-4 w-4 mr-2" />
          Marcar como Pago
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ══════════ SHARED COMPONENTS ══════════
function LancamentoRowWithHighlight({
  lancamento: l,
  checked,
  isTaxaSourceOpen,
  onToggle,
  onOpenTaxa,
}: {
  lancamento: LancamentoFinanceiro;
  checked: boolean;
  isTaxaSourceOpen: boolean;
  onToggle: () => void;
  onOpenTaxa: () => void;
}) {
  const { highlight, ref } = useHighlightOnModal(isTaxaSourceOpen);
  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center gap-1 rounded-md transition-all duration-700",
        highlight && "border-l-4 border-l-primary bg-primary/5 shadow-md pl-1"
      )}
    >
      <div className="flex-1 min-w-0">
        <LancamentoRow lancamento={l} checked={checked} onToggle={onToggle} />
      </div>
      {l.processo_id && (
        <button
          onClick={onOpenTaxa}
          title="Adicionar taxa / valor adicional"
          className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
        >
          <Receipt className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function LancamentoRow({ lancamento: l, checked, onToggle }: { lancamento: LancamentoFinanceiro; checked?: boolean; onToggle?: () => void }) {
  const badges = parseBadges(l.processo_notas);
  const alertaTaxas = (l.tem_etiqueta_metodo_trevo || l.tem_etiqueta_prioridade) && l.total_valores_adicionais === 0;
  const obsLower = ((l.observacoes_financeiro || '') + ' ' + (l.descricao || '')).toLowerCase();
  const temExtratoLegado = !l.extrato_id && obsLower.includes('extrato emitido');

  const currentEtiquetas: string[] = [];
  if (l.tem_etiqueta_metodo_trevo) currentEtiquetas.push('metodo_trevo');
  if (l.tem_etiqueta_prioridade) currentEtiquetas.push('prioridade');

  const hasEtiquetaBadges = l.tem_etiqueta_metodo_trevo || l.tem_etiqueta_prioridade || badges.length > 0;
  const hasStatusBadges = l.valor_alterado_em || l.extrato_id || temExtratoLegado;

  return (
    <div className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/30 transition-colors">
      {onToggle !== undefined && (
        <Checkbox checked={checked} onCheckedChange={onToggle} className="mt-1" />
      )}
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm font-medium truncate">{l.processo_razao_social}</p>
        <p className="text-xs text-muted-foreground">
          {TIPO_PROCESSO_LABELS[l.processo_tipo as keyof typeof TIPO_PROCESSO_LABELS] || l.processo_tipo}
          {l.data_vencimento && ` · Vence ${fmtDate(l.data_vencimento)}`}
          {l.extrato_id && <span className="text-emerald-500 font-medium"> · Extrato ✓</span>}
          {l.valor_alterado_em && <span className="text-amber-600 font-medium"> · ✏️ Alterado</span>}
        </p>
        {/* FIX 1 — Subtotal honorário + taxa + total expandido */}
        <div className="text-xs space-y-0.5 rounded bg-muted/30 p-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Honorários:</span>
            <span className="font-mono">
              {fmt(l.valor)}
              {l.valor_original != null && l.valor_original !== l.valor && (
                <span className="ml-1 text-[10px] text-muted-foreground line-through">{fmt(l.valor_original)}</span>
              )}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Taxas reembolsáveis:</span>
            <span className="font-mono">{fmt(l.total_valores_adicionais || 0)}</span>
          </div>
          <div className="flex justify-between border-t border-border/40 pt-0.5 mt-0.5 font-semibold">
            <span>Total:</span>
            <span className="font-mono">{fmt(l.valor + (l.total_valores_adicionais || 0))}</span>
          </div>
        </div>
        {alertaTaxas && (
          <p className="text-[10px] text-amber-600 mt-0.5">⚠️ Verificar taxas adicionais</p>
        )}
        {(hasEtiquetaBadges || temExtratoLegado) && (
          <div className="flex gap-1 flex-wrap items-center">
            {l.tem_etiqueta_metodo_trevo && (
              <Badge variant="outline" className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px] px-1.5 py-0">
                🍀 Trevo
              </Badge>
            )}
            {l.tem_etiqueta_prioridade && (
              <Badge variant="outline" className="bg-red-500/15 text-red-500 border-red-500/30 text-[10px] px-1.5 py-0">
                🔴 Prior.
              </Badge>
            )}
            {badges.map(b => (
              <Badge key={b} variant="outline" className={cn('text-[10px] px-1.5 py-0', BADGE_COLORS[b] || '')}>
                {b}
              </Badge>
            ))}
            {temExtratoLegado && (
              <Badge variant="outline" className="bg-orange-500/15 text-orange-600 border-orange-500/30 text-[10px] px-1.5 py-0">
                ⚠️ Extrato anterior
              </Badge>
            )}
            {l.processo_id && (
              <EtiquetasEdit
                etiquetas={currentEtiquetas}
                processoId={l.processo_id}
                size="compact"
                triggerVariant="icon"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <CheckCircle className="h-10 w-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">{text}</p>
      </CardContent>
    </Card>
  );
}
