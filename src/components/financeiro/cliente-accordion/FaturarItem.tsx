import { memo, useState, useMemo, useCallback } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FileText, Loader2, Receipt, ChevronDown, Undo2 } from 'lucide-react';
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
import ValoresAdicionaisModal from '../ValoresAdicionaisModal';
import DeferimentoModal from '../DeferimentoModal';
import type { ClienteFinanceiro, MensalistaSemFatura } from '@/hooks/useFinanceiroClientes';
import { invalidateFinanceiro } from '@/hooks/useFinanceiroClientes';
import { gerarExtratoPDF, fetchValoresAdicionaisMulti, fetchCompetenciaProcessos } from '@/lib/extrato-pdf';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';

import { fmt, buildExtratoFilename, tipoLabel } from './utils';
import type { ExtratoGeradoPayload } from './types';
import { ClienteHeaderBadges } from './ClienteHeaderBadges';
import { MoverParaMenu } from './MoverParaMenu';
import { EmptyState } from './EmptyState';
import { LancamentoRowWithHighlight } from './LancamentoRow';

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
      const inicioMesISO = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const fimMesISO = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      const mesLabel = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

      // Bug-006 (17/05/2026): pre-check pra fechar race entre abas/users (button
      // disable só protege double-click na mesma instância). Defesa final é a
      // UNIQUE constraint em fin-bug006-*.sql.
      const { data: existentes, error: chkErr } = await supabase
        .from('lancamentos')
        .select('id')
        .eq('cliente_id', m.id)
        .eq('tipo', 'receber')
        .gte('data_vencimento', inicioMesISO)
        .lte('data_vencimento', fimMesISO)
        .limit(1);
      if (chkErr) throw chkErr;
      if (existentes && existentes.length > 0) {
        toast.warning(`Já existe fatura para ${m.apelido || m.nome} neste mês`);
        invalidateFinanceiro(queryClient);
        return;
      }

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

  // DECISION-001 Fase 3 (13/05/2026): "deferido" = processo_data_deferimento setado.
  // Antes filtrava por lista de etapas — etapa virou binária no banco.
  const isLancDeferido = (l: { processo_data_deferimento: string | null }) =>
    !!l.processo_data_deferimento;

  const { prontos, aguardandoDef } = useMemo(() => {
    const prontosMap = new Map<string, ClienteFinanceiro>();
    const aguardandoDefMap = new Map<string, ClienteFinanceiro>();

    for (const c of clientes) {
      if (c.cliente_momento_faturamento !== 'no_deferimento') {
        prontosMap.set(c.cliente_id, c);
        continue;
      }

      const lancDeferidos = c.lancamentos.filter(isLancDeferido);
      const lancNaoDeferidos = c.lancamentos.filter(l => !isLancDeferido(l));

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

  // UX-009 (11/05/2026): se houver seleção, devolve só os selecionados;
  // senão, mantém o comportamento legado (devolve todos elegíveis do cliente).
  // Antes só dava pra devolver todos, exigindo re-auditar processos
  // que estavam ok.
  const selectedDesauditarIds = lancsParaDesauditar
    .filter((l) => selected.has(l.id))
    .map((l) => l.id);
  const idsToDesauditar = selectedDesauditarIds.length > 0
    ? selectedDesauditarIds
    : lancsParaDesauditar.map((l) => l.id);

  async function handleDesauditar() {
    setDesauditando(true);
    try {
      const ids = idsToDesauditar;
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
      // Limpa seleção pra não ficar resquício depois da operação.
      setSelected(new Set());
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

      // Upload PDF pro Storage (continua client-side — Postgres não faz upload)
      const { empresaPath } = await import('@/lib/storage-path');
      const path = await empresaPath(`extratos/${clienteId}/${filename}`);
      await supabase.storage.from('documentos').upload(path, pdfBlob, { contentType: 'application/pdf', upsert: true });
      const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(path);

      const now = new Date();
      const lancamentoIds = selecionados.map(l => l.id);
      const datasVenc = selecionados.map(l => l.data_vencimento).filter(Boolean).sort();
      // FIN bugfix 29/05/2026 (caso ZYGOS — "Asaas não gerou sozinho com 5
      // processos"): selecionados podem ter data_vencimento NO PASSADO (lanç
      // que vence antes do extrato ser gerado — comum em extrato retroativo).
      // datasVenc[0] = MAIS ANTIGA. Se já passou, Asaas /payments retorna 400
      // ("dueDate cannot be in the past") → edge devolve 500 → toast warning
      // e auto-Asaas falha silenciosamente. Antes precisava clicar manual e
      // escolher data nova no modal. Agora clampamos: data passada → hoje+3
      // (mesmo fallback que a edge usa quando data_vencimento é null).
      const todayStr = new Date().toISOString().split('T')[0];
      const hojeMais3 = (() => {
        const d = new Date();
        d.setDate(d.getDate() + 3);
        return d.toISOString().split('T')[0];
      })();
      const dataVencimentoRaw = datasVenc[0] || null;
      const dataVencimento = dataVencimentoRaw && dataVencimentoRaw < todayStr
        ? hojeMais3
        : dataVencimentoRaw;
      const { getCobrancaPublicUrl } = await import('@/lib/cobranca-url');

      let cobrancaUrl: string | undefined;
      let cobrancaId: string | undefined;

      // REL-014 (13/05/2026): tenta RPC atômica primeiro. Antes: 5 awaits
      // sequenciais sem rollback — se cobrança falhasse no fim, extrato +
      // lancamentos atualizados ficavam sem cobrança e toast.success
      // enganava o usuário. Agora: tudo em transação Postgres.
      //
      // Fallback: se RPC não existe (Thales ainda não rodou o SQL em
      // docs/sql/rel-014-gerar-extrato-completo.sql), cai no fluxo antigo
      // pra não quebrar nada. Zero downtime durante rollout.
      const { data: rpcResult, error: rpcErr } = await supabase.rpc(
        'gerar_extrato_completo' as any,
        {
          p_cliente_id: clienteId,
          p_processo_ids: processoIds,
          p_lancamento_ids: lancamentoIds,
          p_pdf_url: urlData.publicUrl,
          p_filename: filename,
          p_total_honorarios: result.totalHonorarios,
          p_total_taxas: result.totalTaxas,
          p_total_geral: result.totalGeral,
          p_qtd_processos: result.processCount,
          p_competencia_mes: now.getMonth() + 1,
          p_competencia_ano: now.getFullYear(),
          p_data_vencimento_cobranca: dataVencimento,
        } as any,
      ) as any;

      const rpcAusente = rpcErr && (
        rpcErr.code === '42883' ||
        rpcErr.code === 'PGRST202' ||
        (typeof rpcErr.message === 'string' && rpcErr.message.toLowerCase().includes('could not find the function'))
      );

      if (!rpcErr && rpcResult?.ok) {
        // Sucesso via RPC atômica
        cobrancaId = rpcResult.cobranca_id;
        cobrancaUrl = getCobrancaPublicUrl(rpcResult.share_token);
      } else if (rpcAusente) {
        // Fallback: fluxo antigo (5 awaits sem rollback). Será removido
        // quando a RPC estiver deployada em produção 24-48h sem incidente.
        console.warn('[REL-014] RPC gerar_extrato_completo não deployada — usando fluxo antigo');

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

        // Linka lancamentos (com guard anti-rebaixamento — bug DERMAE 07/05/2026)
        for (const pid of processoIds) {
          await supabase
            .from('lancamentos')
            .update({ extrato_id: (extrato as any).id } as any)
            .eq('processo_id', pid)
            .eq('tipo', 'receber');
          await supabase
            .from('lancamentos')
            .update({ etapa_financeiro: 'cobranca_gerada' } as any)
            .eq('processo_id', pid)
            .eq('tipo', 'receber')
            .not('etapa_financeiro', 'in', '("honorario_pago","cobranca_enviada")');
        }

        try {
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
          // Não bloqueia fluxo do extrato (legado: mantém comportamento antigo)
        }
      } else {
        // Erro real na RPC (ex: tenant check falhou, lancamento de outra
        // empresa, etc). Tenta limpar PDF órfão e propaga o erro.
        await supabase.storage.from('documentos').remove([path]).catch(() => {});
        throw rpcErr ?? new Error('RPC gerar_extrato_completo retornou sem ok=true');
      }

      // invalidateFinanceiro moved to ModalPosExtrato close

      toast.success('Extrato gerado com sucesso!');

      // 27/05 noite: dispara asaas-gerar-cobranca AUTOMATICAMENTE em background
      // logo após extrato sair OK. Popup abre imediato (sem bloquear), mostra
      // spinner no botão Asaas, e atualiza pra "Boleto/PIX gerado ✓" quando o
      // edge function retornar — via invalidateQueries. Se Asaas falhar, o popup
      // volta pro botão manual e mostra warning toast.
      let asaasGerandoAuto = false;
      // Só dispara Asaas se tem cobrancaId E valor > 0 (Asaas rejeita value=0).
      if (cobrancaId && result.totalGeral > 0) {
        asaasGerandoAuto = true;
        const cobrancaIdLocal = cobrancaId; // capture pro closure
        supabase.functions
          .invoke('asaas-gerar-cobranca', {
            body: { cobranca_id: cobrancaIdLocal, data_vencimento: dataVencimento },
          })
          .then((res: any) => {
            if (res.error || res.data?.error) {
              console.warn('[asaas auto] falhou:', res.error || res.data?.error);
              toast.warning('Boleto Asaas não gerou automaticamente. Use o botão "Gerar Boleto/PIX" no popup.');
            } else {
              // Sucesso — invalida queries pra popup re-renderizar
              queryClient.invalidateQueries({ queryKey: ['cobranca-asaas', cobrancaIdLocal] });
              queryClient.invalidateQueries({ queryKey: ['financeiro_clientes'] });
              toast.success('Boleto/PIX Asaas gerado automaticamente.');
            }
          })
          .catch((err: any) => {
            console.warn('[asaas auto] exception:', err);
            toast.warning('Boleto Asaas não gerou automaticamente. Use o botão "Gerar Boleto/PIX" no popup.');
          });
      }

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
        asaasGerandoAuto,
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

  // DECISION-001 Fase 3 (13/05/2026): "nenhum deferido" = todos os lancamentos
  // do cliente sem processo_data_deferimento (etapa binária agora).
  const nenhumDeferido = isDeferimento && cliente.lancamentos.every(l => !l.processo_data_deferimento);

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
                {selectedDesauditarIds.length > 0
                  ? `Voltar pra Auditoria (${selectedDesauditarIds.length})`
                  : 'Voltar pra Auditoria'}
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
              {selectedDesauditarIds.length > 0 ? (
                <>
                  <strong>{selectedDesauditarIds.length}</strong> processo{selectedDesauditarIds.length > 1 ? 's' : ''} selecionado{selectedDesauditarIds.length > 1 ? 's' : ''} de <strong>{cliente.cliente_apelido || cliente.cliente_nome}</strong> voltará{selectedDesauditarIds.length > 1 ? 'ão' : ''} para a aba <strong>Auditoria</strong>.
                </>
              ) : (
                <>
                  Nenhum selecionado — <strong>todos os {lancsParaDesauditar.length}</strong> processos auditados de <strong>{cliente.cliente_apelido || cliente.cliente_nome}</strong> voltarão para a aba <strong>Auditoria</strong>. Processos com extrato já gerado ou já pagos não serão afetados.
                </>
              )}
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
