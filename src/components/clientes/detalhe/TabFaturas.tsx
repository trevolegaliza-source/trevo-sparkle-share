import { useState } from 'react';
import { Receipt, ClipboardCheck, Check, X, Pencil, Undo2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ValorProtegido } from '@/components/auth/ValorProtegido';
import ValoresAdicionaisModal from '@/components/financeiro/ValoresAdicionaisModal';
import { useAuditarLancamento, useAuditarTodosCliente, useAlterarValorLancamento } from '@/hooks/useFinanceiroClientes';
import { supabase } from '@/integrations/supabase/client';
import { STATUS_LABELS, STATUS_STYLES } from '@/types/financial';
import type { ClienteDB, Lancamento, StatusFinanceiro } from '@/types/financial';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface TabFaturasProps {
  cliente: ClienteDB;
  lancamentos: Lancamento[];
  lancNaoAuditados: Lancamento[];
  lancAuditadosPendentes: Lancamento[];
  isMensalista: boolean;
  totalPago: number;
  totalPendente: number;
  permIsMaster: boolean;
  gerandoFaturaMensal: boolean;
  setGerandoFaturaMensal: (v: boolean) => void;
  onReload: () => void;
}

export default function TabFaturas({
  cliente,
  lancamentos,
  lancNaoAuditados,
  lancAuditadosPendentes,
  isMensalista,
  totalPago,
  totalPendente,
  permIsMaster,
  gerandoFaturaMensal,
  setGerandoFaturaMensal,
  onReload,
}: TabFaturasProps) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Faturas e Fechamentos</CardTitle>
          <div className="flex gap-2 text-xs">
            <Badge className="bg-success/10 text-success border-0">Pago: <ValorProtegido valor={totalPago} /></Badge>
            <Badge className="bg-warning/10 text-warning border-0">Pendente: <ValorProtegido valor={totalPendente} /></Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Mensalista: botão para gerar fatura mensal se não existe no mês */}
        {isMensalista && (() => {
          const now = new Date();
          const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
          const fimMes = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          const temFaturaMes = lancamentos.some(l => {
            if (l.tipo !== 'receber') return false;
            const venc = new Date(l.data_vencimento);
            return venc >= inicioMes && venc <= fimMes;
          });
          if (temFaturaMes) return null;
          return (
            <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-600">Sem fatura neste mês</p>
                {/* CLI-001 fix (26/05): em mensalistas, MENSALIDADE é o valor cobrado
                    por mês. valor_base é o preço do processo EXCEDENTE (após estourar
                    franquia). Antes mostrava valor_base aqui (e usava no INSERT abaixo)
                    — cliente com mensalidade R$ 1.500 e valor_base R$ 300 tinha fatura
                    gerada por R$ 300/mês. */}
                <p className="text-xs text-muted-foreground">
                  {Number((cliente as any).mensalidade || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês · Vencimento dia {(cliente as any).dia_vencimento_mensal || 10}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={gerandoFaturaMensal}
                onClick={async () => {
                  // Bug-006 / CODE-002 (17/05/2026): ADVANCE BPM teve 12 lancamentos
                  // orfaos criados em 3 batches porque double-click disparava 2 INSERTs
                  // antes do `loadAll` atualizar `lancamentos` (state local). 3 camadas:
                  //   1) disable enquanto está rodando
                  //   2) pre-check no banco (impede race entre 2 abas/users)
                  //   3) UNIQUE constraint SQL (defesa final — ver fin-bug006-*.sql)
                  if (gerandoFaturaMensal) return;
                  setGerandoFaturaMensal(true);
                  try {
                    const dia = (cliente as any).dia_vencimento_mensal || 10;
                    const vencimento = new Date(now.getFullYear(), now.getMonth(), dia);
                    if (vencimento < now) vencimento.setMonth(vencimento.getMonth() + 1);
                    const inicioMesISO = inicioMes.toISOString().split('T')[0];
                    const fimMesISO = fimMes.toISOString().split('T')[0];
                    const mesLabel = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

                    // Pre-check no banco (catch race entre janelas/abas)
                    const { data: existentes, error: chkErr } = await supabase
                      .from('lancamentos')
                      .select('id')
                      .eq('cliente_id', cliente.id)
                      .eq('tipo', 'receber')
                      .gte('data_vencimento', inicioMesISO)
                      .lte('data_vencimento', fimMesISO)
                      .limit(1);
                    if (chkErr) throw chkErr;
                    if (existentes && existentes.length > 0) {
                      toast.warning('Já existe fatura para este mês — atualizando lista');
                      onReload();
                      return;
                    }

                    // CLI-001 fix (26/05): MENSALIDADE (não valor_base — esse é p/ excedente)
                    const { error } = await supabase.from('lancamentos').insert({
                      tipo: 'receber' as const,
                      cliente_id: cliente.id,
                      descricao: `Fatura mensal — ${mesLabel}`,
                      valor: Number((cliente as any).mensalidade || 0),
                      data_vencimento: vencimento.toISOString().split('T')[0],
                      status: 'pendente' as const,
                      etapa_financeiro: 'solicitacao_criada',
                    });
                    if (error) {
                      toast.error('Erro ao gerar fatura: ' + error.message);
                    } else {
                      // UX-020 (11/05/2026): refresh silencioso, sem tirar usuário do cliente.
                      toast.success('Fatura mensal gerada!');
                      onReload();
                    }
                  } catch (err: any) {
                    toast.error('Erro ao gerar fatura: ' + (err?.message || 'Erro'));
                  } finally {
                    setGerandoFaturaMensal(false);
                  }
                }}
              >
                <Receipt className="h-3 w-3 mr-1" />
                {gerandoFaturaMensal ? 'Gerando...' : 'Gerar Fatura Mensal'}
              </Button>
            </div>
          );
        })()}
        {!isMensalista && (
          <div className="mb-4 p-3 rounded-lg bg-muted/40 border border-border/40">
            <p className="text-xs font-medium">Próximo Fechamento (Avulso)</p>
            <p className="text-sm text-muted-foreground mt-1">
              Cobrança prevista para D+{cliente.dia_vencimento_mensal || 4} após a última solicitação
            </p>
          </div>
        )}

        {/* ── Aguardando Auditoria ── */}
        {lancNaoAuditados.length > 0 && (
          <ClienteDetalheFaturasAuditoria
            lancamentos={lancNaoAuditados}
            clienteApelido={cliente.apelido || cliente.nome}
            onReload={onReload}
            isMaster={permIsMaster}
          />
        )}

        {/* ── Auditados / Prontos para cobrar ── */}
        {lancAuditadosPendentes.length > 0 && (
          <div className="space-y-2 mb-4">
            <h4 className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5">
              <ClipboardCheck className="h-3.5 w-3.5" /> Auditados — Prontos para cobrar
            </h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  {permIsMaster && <TableHead className="w-8" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {lancAuditadosPendentes.map(l => (
                  <AuditedLancRow key={l.id} l={l} isMaster={permIsMaster} onReload={onReload} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* ── Pagos ── */}
        {lancamentos.filter(l => l.tipo === 'receber' && l.status === 'pago').length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground">Pagos</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lancamentos.filter(l => l.tipo === 'receber' && l.status === 'pago').map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium text-sm">
                      {l.descricao}
                      {(l as any).valor_alterado_em && (
                        <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0 text-amber-600 border-amber-500/30">✏️ Alterado</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{new Date(l.data_vencimento).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>
                      <Badge className={cn('text-[10px] border-0', STATUS_STYLES[l.status as StatusFinanceiro] || '')}>
                        {STATUS_LABELS[l.status as StatusFinanceiro] || l.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {Number(l.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {lancamentos.filter(l => l.tipo === 'receber').length === 0 && (
          <p className="text-center py-8 text-muted-foreground text-sm">Nenhuma fatura registrada</p>
        )}
      </CardContent>
    </Card>
  );
}

function ClienteDetalheFaturasAuditoria({ lancamentos, clienteApelido, onReload, isMaster }: {
  lancamentos: any[];
  clienteApelido: string;
  onReload: () => void;
  isMaster: boolean;
}) {
  const auditarMut = useAuditarLancamento();
  const auditarTodosMut = useAuditarTodosCliente();
  const alterarValorMut = useAlterarValorLancamento();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [novoValor, setNovoValor] = useState('');
  const [taxaModalOpen, setTaxaModalOpen] = useState(false);
  const [taxaProcessoId, setTaxaProcessoId] = useState('');

  const totalNaoAuditado = lancamentos.reduce((s: number, l: any) => s + Number(l.valor), 0);

  const handleAuditarTodos = () => {
    const ids = lancamentos.map((l: any) => l.id);
    auditarTodosMut.mutate({ lancamentoIds: ids }, {
      onSuccess: () => { toast.success(`${ids.length} processos auditados ✅`); onReload(); },
    });
  };

  return (
    <>
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-amber-600 flex items-center gap-1.5">
            <ClipboardCheck className="h-3.5 w-3.5" /> Aguardando Auditoria ({lancamentos.length})
          </h4>
          <Button
            size="sm"
            variant="outline"
            className="text-xs text-emerald-600 border-emerald-600/30 hover:bg-emerald-600/10 h-7"
            onClick={handleAuditarTodos}
            disabled={auditarTodosMut.isPending}
          >
            <Check className="h-3 w-3 mr-1" /> Auditar Todos
          </Button>
        </div>
        <div className="space-y-2 border border-dashed border-amber-500/40 rounded-lg p-3 bg-amber-500/5">
          {lancamentos.map((l: any) => {
            const alertaTaxas = ((l as any).etiquetas?.includes('metodo_trevo') || (l as any).etiquetas?.includes('prioridade'));
            return (
              <div key={l.id} className="rounded-lg border border-border bg-card p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{l.descricao}</p>
                    <p className="text-xs text-muted-foreground">Vence {new Date(l.data_vencimento).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <span className="text-sm font-bold text-primary">
                    {Number(l.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    {(l as any).valor_original != null && (l as any).valor_original !== l.valor && (
                      <span className="text-[10px] text-muted-foreground line-through ml-1">
                        {Number((l as any).valor_original).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    )}
                  </span>
                </div>

                {editingId === l.id && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={novoValor}
                      onChange={e => setNovoValor(e.target.value)}
                      placeholder="Novo valor"
                      className="h-8 text-sm w-32"
                      style={{ fontSize: '16px' }}
                      autoFocus
                    />
                    <Button size="sm" variant="ghost" className="h-8 text-emerald-600" onClick={() => {
                      const valor = parseFloat(novoValor.replace(',', '.'));
                      if (isNaN(valor) || valor <= 0) { toast.error('Valor inválido'); return; }
                      alterarValorMut.mutate({ lancamentoId: l.id, novoValor: valor, valorAtual: l.valor }, {
                        // CODE-010 (17/05/2026): reset novoValor tambem (so editingId era resetado)
                        onSuccess: () => { setEditingId(null); setNovoValor(''); onReload(); },
                      });
                    }} disabled={alterarValorMut.isPending}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 text-muted-foreground" onClick={() => { setEditingId(null); setNovoValor(''); }}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => { setNovoValor(String(l.valor)); setEditingId(l.id); }}>
                    <Pencil className="h-3 w-3 mr-1" /> Editar Valor
                  </Button>
                  {l.processo_id && (
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => { setTaxaProcessoId(l.processo_id); setTaxaModalOpen(true); }}>
                      <Receipt className="h-3 w-3 mr-1" /> Add Taxa
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="text-xs h-7 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => {
                      auditarMut.mutate({ lancamentoId: l.id, auditado: true }, {
                        onSuccess: () => { toast.success('Processo auditado ✅'); onReload(); },
                      });
                    }}
                    disabled={auditarMut.isPending}
                  >
                    <Check className="h-3 w-3 mr-1" /> Auditar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {taxaProcessoId && (
        <ValoresAdicionaisModal
          open={taxaModalOpen}
          onOpenChange={setTaxaModalOpen}
          processoId={taxaProcessoId}
          clienteApelido={clienteApelido}
        />
      )}
    </>
  );
}

function AuditedLancRow({ l, isMaster, onReload }: { l: any; isMaster: boolean; onReload: () => void }) {
  const auditarMut = useAuditarLancamento();

  return (
    <TableRow>
      <TableCell className="font-medium text-sm">
        {l.descricao}
        <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0 text-emerald-600 border-emerald-500/30">✅ Auditado</Badge>
        {(l as any).valor_alterado_em && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0 text-amber-600 border-amber-500/30">✏️ Alterado</Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  Original: {Number((l as any).valor_original || l.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  {(l as any).auditado_em && ` · Auditado em ${new Date((l as any).auditado_em).toLocaleDateString('pt-BR')}`}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </TableCell>
      <TableCell className="text-sm">{new Date(l.data_vencimento).toLocaleDateString('pt-BR')}</TableCell>
      <TableCell>
        <Badge className={cn('text-[10px] border-0', STATUS_STYLES[l.status as StatusFinanceiro] || '')}>
          {STATUS_LABELS[l.status as StatusFinanceiro] || l.status}
        </Badge>
      </TableCell>
      <TableCell className="text-right text-sm font-medium">
        {Number(l.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </TableCell>
      {isMaster && (
        <TableCell className="w-8">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    auditarMut.mutate({ lancamentoId: l.id, auditado: false }, {
                      onSuccess: () => { toast.success('Auditoria removida — voltou para pendente'); onReload(); },
                    });
                  }}
                  disabled={auditarMut.isPending}
                >
                  <Undo2 className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p className="text-xs">Desmarcar auditoria</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </TableCell>
      )}
    </TableRow>
  );
}
