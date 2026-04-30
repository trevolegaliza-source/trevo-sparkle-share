import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, ChevronDown, ChevronRight, FileText, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import ValoresAdicionaisModal from './ValoresAdicionaisModal';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface ClienteFinanceiro {
  id: string;
  nome: string;
  apelido: string | null;
  codigo_identificador: string | null;
  nome_contador: string | null;
  tipo: string | null;
  momento_faturamento: string | null;
  valor_base: number | null;
  dia_vencimento_mensal: number | null;
  auditado_financeiro: boolean;
  auditado_em: string | null;
  processos: ProcessoResumido[];
}

interface ProcessoResumido {
  id: string;
  razao_social: string;
  tipo: string;
  etapa: string;
  valor: number | null;
  created_at: string;
  notas: string | null;
  auditado_financeiro: boolean;
  auditado_em: string | null;
  lancamento_status: string | null;
  lancamento_etapa: string | null;
  lancamento_valor: number | null;
  lancamento_data_vencimento: string | null;
  lancamento_data_pagamento: string | null;
}

export default function ClientesFinanceiroTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filtroAuditado, setFiltroAuditado] = useState<'todos' | 'auditado' | 'pendente'>('todos');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedProcessoId, setExpandedProcessoId] = useState<string | null>(null);
  const [valoresAdicionaisId, setValoresAdicionaisId] = useState<string | null>(null);

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ['clientes_financeiro_tab'],
    queryFn: async () => {
      const { data: clientesData, error: cErr } = await supabase
        .from('clientes')
        .select('id, nome, apelido, codigo_identificador, nome_contador, tipo, momento_faturamento, valor_base, dia_vencimento_mensal, auditado_financeiro, auditado_em')
        .eq('is_archived', false)
        .order('nome', { ascending: true });

      if (cErr) throw cErr;

      const { data: processosData, error: pErr } = await supabase
        .from('processos')
        .select('id, razao_social, tipo, etapa, valor, created_at, cliente_id, notas, auditado_financeiro, auditado_em')
        .eq('is_archived', false);

      if (pErr) throw pErr;

      const { data: lancData, error: lErr } = await supabase
        .from('lancamentos')
        .select('id, processo_id, status, etapa_financeiro, valor, data_vencimento, data_pagamento')
        .eq('tipo', 'receber');

      if (lErr) throw lErr;

      const lancMap = new Map<string, any>();
      (lancData || []).forEach((l: any) => {
        if (l.processo_id && !lancMap.has(l.processo_id)) lancMap.set(l.processo_id, l);
      });

      const result: ClienteFinanceiro[] = (clientesData || []).map((c: any) => {
        const procs = (processosData || [])
          .filter((p: any) => p.cliente_id === c.id)
          .map((p: any) => {
            const lanc = lancMap.get(p.id);
            return {
              id: p.id,
              razao_social: p.razao_social,
              tipo: p.tipo,
              etapa: p.etapa,
              valor: p.valor,
              created_at: p.created_at,
              notas: p.notas,
              auditado_financeiro: p.auditado_financeiro || false,
              auditado_em: p.auditado_em,
              lancamento_status: lanc?.status || null,
              lancamento_etapa: lanc?.etapa_financeiro || null,
              lancamento_valor: lanc?.valor || null,
              lancamento_data_vencimento: lanc?.data_vencimento || null,
              lancamento_data_pagamento: lanc?.data_pagamento || null,
            };
          });

        return {
          id: c.id,
          nome: c.nome,
          apelido: c.apelido,
          codigo_identificador: c.codigo_identificador,
          nome_contador: c.nome_contador,
          tipo: c.tipo,
          momento_faturamento: c.momento_faturamento,
          valor_base: c.valor_base,
          dia_vencimento_mensal: c.dia_vencimento_mensal,
          auditado_financeiro: c.auditado_financeiro || false,
          auditado_em: c.auditado_em,
          processos: procs,
        };
      });

      return result;
    },
  });

  const filtered = useMemo(() => {
    let result = clientes;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.nome.toLowerCase().includes(q) ||
        (c.apelido || '').toLowerCase().includes(q) ||
        (c.codigo_identificador || '').includes(q) ||
        (c.nome_contador || '').toLowerCase().includes(q) ||
        c.processos.some(p => p.razao_social.toLowerCase().includes(q))
      );
    }

    if (filtroAuditado === 'auditado') result = result.filter(c => c.auditado_financeiro);
    if (filtroAuditado === 'pendente') result = result.filter(c => !c.auditado_financeiro);

    if (filtroTipo !== 'todos') result = result.filter(c => c.tipo === filtroTipo);

    return result;
  }, [clientes, search, filtroAuditado, filtroTipo]);

  const totalClientes = filtered.length;
  const totalAuditados = filtered.filter(c => c.auditado_financeiro).length;
  const totalPendentes = totalClientes - totalAuditados;
  const totalProcessosAuditados = filtered.reduce((s, c) => s + c.processos.filter(p => p.auditado_financeiro).length, 0);
  const totalProcessos = filtered.reduce((s, c) => s + c.processos.length, 0);

  async function toggleAuditado(clienteId: string, atual: boolean) {
    const novoValor = !atual;
    await supabase.from('clientes').update({
      auditado_financeiro: novoValor,
      auditado_em: novoValor ? new Date().toISOString() : null,
    } as any).eq('id', clienteId);
    qc.invalidateQueries({ queryKey: ['clientes_financeiro_tab'] });
    toast.success(novoValor ? 'Cliente marcado como auditado ✅' : 'Auditoria removida');
  }

  async function toggleProcessoAuditado(processoId: string, atual: boolean) {
    const novoValor = !atual;
    await supabase.from('processos').update({
      auditado_financeiro: novoValor,
      auditado_em: novoValor ? new Date().toISOString() : null,
    } as any).eq('id', processoId);

    const cliente = clientes.find(c => c.processos.some(p => p.id === processoId));
    if (cliente && novoValor) {
      const todosAuditados = cliente.processos.every(p =>
        p.id === processoId ? true : p.auditado_financeiro
      );
      if (todosAuditados) {
        await supabase.from('clientes').update({
          auditado_financeiro: true,
          auditado_em: new Date().toISOString(),
        } as any).eq('id', cliente.id);
        toast.success('Todos os processos auditados — cliente marcado como auditado ✅');
      } else {
        toast.success('Processo auditado ✅');
      }
    } else {
      toast.success(novoValor ? 'Processo auditado ✅' : 'Auditoria do processo removida');
    }

    qc.invalidateQueries({ queryKey: ['clientes_financeiro_tab'] });
  }

  async function salvarObservacao(processoId: string, texto: string) {
    await supabase.from('processos').update({ notas: texto } as any).eq('id', processoId);
    toast.success('Observação salva');
  }

  function getResumo(c: ClienteFinanceiro) {
    const total = c.processos.reduce((s, p) => s + (p.lancamento_valor || p.valor || 0), 0);
    const pago = c.processos.filter(p => p.lancamento_status === 'pago').reduce((s, p) => s + (p.lancamento_valor || 0), 0);
    const pendente = total - pago;
    const qtdPendente = c.processos.filter(p => p.lancamento_status !== 'pago').length;
    const qtdSemLanc = c.processos.filter(p => !p.lancamento_status).length;
    return { total, pago, pendente, qtdPendente, qtdSemLanc };
  }

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">Carregando clientes...</div>;
  }

  return (
    <div className="space-y-4">
      {/* KPIs — responsive 2x2 on mobile, 4 cols on desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        <div className="bg-card border rounded-lg p-2 sm:p-4 text-center">
          <p className="text-[10px] sm:text-xs text-muted-foreground uppercase">Total Clientes</p>
          <p className="text-xl sm:text-2xl font-bold">{totalClientes}</p>
        </div>
        <div className="bg-card border rounded-lg p-2 sm:p-4 text-center">
          <p className="text-[10px] sm:text-xs text-muted-foreground uppercase">Auditados ✅</p>
          <p className="text-xl sm:text-2xl font-bold text-primary">{totalAuditados}</p>
        </div>
        <div className="bg-card border rounded-lg p-2 sm:p-4 text-center">
          <p className="text-[10px] sm:text-xs text-muted-foreground uppercase">Pend. Auditoria</p>
          <p className="text-xl sm:text-2xl font-bold text-amber-500">{totalPendentes}</p>
        </div>
        <div className="bg-card border rounded-lg p-2 sm:p-4 text-center">
          <p className="text-[10px] sm:text-xs text-muted-foreground uppercase">Proc. Auditados</p>
          <p className="text-xl sm:text-2xl font-bold text-blue-500">
            {totalProcessosAuditados}
            <span className="text-sm text-muted-foreground font-normal"> / {totalProcessos}</span>
          </p>
        </div>
      </div>

      {/* Filtros — stack on mobile */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={filtroAuditado} onValueChange={(v: any) => setFiltroAuditado(v)}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pendente">Pendentes auditoria</SelectItem>
              <SelectItem value="auditado">Já auditados</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              <SelectItem value="AVULSO_4D">Avulso D+4</SelectItem>
              <SelectItem value="MENSALISTA">Mensalista</SelectItem>
              <SelectItem value="PRE_PAGO">Pré-pago</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {filtered.map(c => {
          const resumo = getResumo(c);
          const isExpanded = expandedId === c.id;

          return (
            <div key={c.id} className={cn("border rounded-lg overflow-hidden", c.auditado_financeiro ? "border-primary/30 bg-primary/5" : "")}>
              {/* Header — mobile: vertical stack / desktop: horizontal */}
              <div
                className="flex items-start sm:items-center gap-3 px-3 sm:px-4 py-3 cursor-pointer hover:bg-muted/50"
                onClick={() => { setExpandedId(isExpanded ? null : c.id); setExpandedProcessoId(null); }}
              >
                <Checkbox
                  checked={c.auditado_financeiro}
                  onCheckedChange={() => toggleAuditado(c.id, c.auditado_financeiro)}
                  onClick={e => e.stopPropagation()}
                  className="h-5 w-5 mt-0.5 shrink-0"
                />

                <div className="flex-1 min-w-0">
                  {/* Nome */}
                  <p className="font-semibold text-sm truncate">
                    {c.apelido || c.nome}
                  </p>
                  {/* Details line */}
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {c.codigo_identificador || '—'}{c.nome_contador ? ` · ${c.nome_contador}` : ''} · {c.processos.length} proc.
                  </p>
                  {/* Type and badges */}
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="text-xs text-muted-foreground">{c.tipo || 'Sem tipo'}</span>
                    {c.momento_faturamento === 'no_deferimento' && (
                      <Badge variant="outline" className="text-[10px]">No deferimento</Badge>
                    )}
                    {c.tipo === 'MENSALISTA' && (
                      <Badge variant="outline" className="text-[10px] bg-primary/10">Mensal dia {c.dia_vencimento_mensal}</Badge>
                    )}
                    {c.auditado_financeiro && (
                      <Badge className="text-[10px] bg-primary/20 text-primary border-primary/30 sm:hidden">✅</Badge>
                    )}
                  </div>
                  {/* Values — always visible */}
                  <div className="flex items-center gap-4 mt-1.5">
                    {resumo.pendente > 0 && (
                      <span className="text-xs">
                        <span className="text-muted-foreground">Pend.: </span>
                        <span className="font-semibold text-amber-500">{fmt(resumo.pendente)}</span>
                      </span>
                    )}
                    <span className="text-xs">
                      <span className="text-muted-foreground">Rec.: </span>
                      <span className="font-semibold text-primary">{fmt(resumo.pago)}</span>
                    </span>
                    {resumo.qtdSemLanc > 0 && (
                      <Badge variant="destructive" className="text-[10px]">{resumo.qtdSemLanc} sem lanç.</Badge>
                    )}
                  </div>
                </div>

                {/* Desktop-only badges and values */}
                <div className="hidden sm:flex items-center gap-4 text-right shrink-0">
                  {c.auditado_financeiro && (
                    <Badge className="text-[10px] bg-primary/20 text-primary border-primary/30">✅ Auditado</Badge>
                  )}
                </div>

                <div className="shrink-0 mt-1">
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t bg-muted/30 px-3 sm:px-4 py-3">
                  {c.processos.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum processo cadastrado</p>
                  ) : (
                    <>
                      {/* Desktop: table */}
                      <div className="hidden sm:block">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-muted-foreground border-b">
                              <th className="text-left py-2 font-medium w-8"></th>
                              <th className="text-left py-2 font-medium">Razão Social</th>
                              <th className="text-left py-2 font-medium">Tipo</th>
                              <th className="text-left py-2 font-medium">Etapa</th>
                              <th className="text-right py-2 font-medium">Valor</th>
                              <th className="text-left py-2 font-medium">Financeiro</th>
                              <th className="text-left py-2 font-medium">Vencimento</th>
                              <th className="text-left py-2 font-medium w-8"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {c.processos.map(p => {
                              const isProcessoExpanded = expandedProcessoId === p.id;
                              return (
                                <React.Fragment key={p.id}>
                                  <tr
                                    className="border-b border-muted cursor-pointer hover:bg-muted/30"
                                    onClick={() => setExpandedProcessoId(isProcessoExpanded ? null : p.id)}
                                  >
                                    <td className="py-2">
                                      <Checkbox
                                        checked={p.auditado_financeiro}
                                        onCheckedChange={() => toggleProcessoAuditado(p.id, p.auditado_financeiro)}
                                        onClick={e => e.stopPropagation()}
                                        className="h-4 w-4"
                                      />
                                    </td>
                                    <td className="py-2 font-medium">
                                      <div className="flex items-center gap-2">
                                        {isProcessoExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                        {p.razao_social}
                                      </div>
                                    </td>
                                    <td className="py-2">
                                      <Badge variant="outline" className="text-[10px]">{p.tipo}</Badge>
                                    </td>
                                    <td className="py-2 text-xs text-muted-foreground">{p.etapa}</td>
                                    <td className="py-2 text-right font-medium">{fmt(p.lancamento_valor || p.valor || 0)}</td>
                                    <td className="py-2">
                                      {p.lancamento_status === 'pago' ? (
                                        <Badge className="text-[10px] bg-primary/20 text-primary">Pago</Badge>
                                      ) : p.lancamento_etapa === 'cobranca_enviada' ? (
                                        <Badge className="text-[10px] bg-blue-500/20 text-blue-500">Enviado</Badge>
                                      ) : p.lancamento_etapa === 'solicitacao_criada' ? (
                                        <Badge className="text-[10px] bg-amber-500/20 text-amber-500">Cobrar</Badge>
                                      ) : (
                                        <Badge variant="destructive" className="text-[10px]">Sem lançamento</Badge>
                                      )}
                                    </td>
                                    <td className="py-2 text-xs text-muted-foreground">
                                      {p.lancamento_data_vencimento ? new Date(p.lancamento_data_vencimento).toLocaleDateString('pt-BR') : '—'}
                                    </td>
                                    <td className="py-2">
                                      {p.auditado_financeiro && <span className="text-[10px] text-primary">✅</span>}
                                    </td>
                                  </tr>
                                  {isProcessoExpanded && (
                                    <tr>
                                      <td colSpan={8} className="py-3 px-4 bg-muted/20">
                                        <ProcessoExpandido
                                          p={p}
                                          clienteId={c.id}
                                          salvarObservacao={salvarObservacao}
                                          setValoresAdicionaisId={setValoresAdicionaisId}
                                        />
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile: stacked cards */}
                      <div className="sm:hidden space-y-2">
                        {c.processos.map(p => {
                          const isProcessoExpanded = expandedProcessoId === p.id;
                          return (
                            <div key={p.id} className="border rounded-lg p-3 space-y-1.5">
                              <div
                                className="flex items-start justify-between cursor-pointer"
                                onClick={() => setExpandedProcessoId(isProcessoExpanded ? null : p.id)}
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <Checkbox
                                    checked={p.auditado_financeiro}
                                    onCheckedChange={() => toggleProcessoAuditado(p.id, p.auditado_financeiro)}
                                    onClick={e => e.stopPropagation()}
                                    className="h-4 w-4 shrink-0"
                                  />
                                  <p className="text-sm font-medium truncate">{p.razao_social}</p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {p.auditado_financeiro && <span className="text-[10px] text-primary">✅</span>}
                                  {isProcessoExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 flex-wrap ml-6">
                                <Badge variant="outline" className="text-[10px]">{p.tipo}</Badge>
                                <span className="text-xs text-muted-foreground">{p.etapa}</span>
                                {p.lancamento_status === 'pago' ? (
                                  <Badge className="text-[10px] bg-primary/20 text-primary">Pago</Badge>
                                ) : p.lancamento_etapa === 'cobranca_enviada' ? (
                                  <Badge className="text-[10px] bg-blue-500/20 text-blue-500">Enviado</Badge>
                                ) : p.lancamento_etapa === 'solicitacao_criada' ? (
                                  <Badge className="text-[10px] bg-amber-500/20 text-amber-500">Cobrar</Badge>
                                ) : (
                                  <Badge variant="destructive" className="text-[10px]">Sem lanç.</Badge>
                                )}
                              </div>

                              <div className="flex items-center justify-between ml-6">
                                <span className="text-sm font-bold">{fmt(p.lancamento_valor || p.valor || 0)}</span>
                                <span className="text-xs text-muted-foreground">
                                  Vence {p.lancamento_data_vencimento ? new Date(p.lancamento_data_vencimento).toLocaleDateString('pt-BR') : '—'}
                                </span>
                              </div>

                              {isProcessoExpanded && (
                                <div className="ml-6 pt-2 border-t">
                                  <ProcessoExpandido
                                    p={p}
                                    clienteId={c.id}
                                    salvarObservacao={salvarObservacao}
                                    setValoresAdicionaisId={setValoresAdicionaisId}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-muted">
                    <div className="text-xs text-muted-foreground">
                      {c.auditado_em && `Auditado em ${new Date(c.auditado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="text-xs h-7" onClick={e => { e.stopPropagation(); window.open(`/clientes/${c.id}`, '_blank'); }}>
                        <FileText className="h-3 w-3 mr-1" /> Ver detalhe
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal valores adicionais */}
      {valoresAdicionaisId && (
        <ValoresAdicionaisModal
          open={!!valoresAdicionaisId}
          onOpenChange={(open) => { if (!open) setValoresAdicionaisId(null); }}
          processoId={valoresAdicionaisId}
          clienteApelido=""
        />
      )}
    </div>
  );
}

/** Expanded process detail — shared between mobile cards and desktop table rows */
function ProcessoExpandido({
  p,
  clienteId,
  salvarObservacao,
  setValoresAdicionaisId,
}: {
  p: ProcessoResumido;
  clienteId: string;
  salvarObservacao: (id: string, texto: string) => void;
  setValoresAdicionaisId: (id: string | null) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
        <span>Criado em: {p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : '—'}</span>
        <span>Etapa: {p.etapa}</span>
        {p.auditado_em && <span>Auditado em: {new Date(p.auditado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>}
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Observações financeiras</label>
        <textarea
          className="w-full mt-1 px-3 py-2 text-sm border rounded-lg bg-background resize-none"
          rows={2}
          defaultValue={p.notas || ''}
          placeholder="Notas sobre cobrança, taxas adicionais, acordos..."
          onBlur={e => salvarObservacao(p.id, e.target.value)}
          style={{ fontSize: '16px' }}
        />
      </div>
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" size="sm" className="text-xs h-7" onClick={e => { e.stopPropagation(); setValoresAdicionaisId(p.id); }}>
          <DollarSign className="h-3 w-3 mr-1" /> Valores Adicionais
        </Button>
        <Button variant="outline" size="sm" className="text-xs h-7" onClick={e => { e.stopPropagation(); window.open(`/clientes/${clienteId}`, '_blank'); }}>
          <FileText className="h-3 w-3 mr-1" /> Ver Cliente
        </Button>
      </div>
    </div>
  );
}
