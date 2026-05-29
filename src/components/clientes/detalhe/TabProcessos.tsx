import { FileText, Plus, Check, CheckCircle, Undo2, History, Settings } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EtiquetasDisplay, EtiquetasEdit } from '@/components/EtiquetasBadges';
import { PagamentoBadge, classificarPagamento } from '@/components/processos/PagamentoBadge';
import { getEtapaSimplificada } from '@/types/process';
import { TIPO_PROCESSO_LABELS } from '@/types/financial';
import type { ClienteDB, ProcessoDB, Lancamento, TipoProcesso } from '@/types/financial';
import type { ProcessoFinanceiro } from '@/hooks/useProcessosFinanceiro';
import { cn } from '@/lib/utils';

interface TabProcessosProps {
  cliente: ClienteDB;
  processos: ProcessoDB[];
  processosOrdenados: ProcessoDB[];
  lancamentos: Lancamento[];
  aguardandoDeferimento: ProcessoDB[];
  isMensalista: boolean;
  totalProcessos: number;
  processosPagosCount: number;
  processosPendentesCount: number;
  selectedProcessosTab: Set<string>;
  setSelectedProcessosTab: (s: Set<string>) => void;
  generatingExtrato: boolean;
  isProcessoPago: (id: string) => boolean;
  profileNames: Record<string, string>;
  isDesfazerDeferimentoPending: boolean;
  onGerarExtrato: () => void | Promise<void>;
  onNovoProcesso: () => void;
  onEditProcesso: (fin: ProcessoFinanceiro) => void;
  onMarkPaid: (p: ProcessoDB) => void;
  onMarkDeferido: (p: ProcessoDB) => void;
  onDesfazerDeferimento: (p: ProcessoDB) => void;
  onAbrirHistorico: (processoId: string, label: string) => void;
  onAbrirConfig: (p: ProcessoDB) => void;
}

export default function TabProcessos({
  cliente,
  processos,
  processosOrdenados,
  lancamentos,
  aguardandoDeferimento,
  isMensalista,
  totalProcessos,
  processosPagosCount,
  processosPendentesCount,
  selectedProcessosTab,
  setSelectedProcessosTab,
  generatingExtrato,
  isProcessoPago,
  profileNames,
  isDesfazerDeferimentoPending,
  onGerarExtrato,
  onNovoProcesso,
  onEditProcesso,
  onMarkPaid,
  onMarkDeferido,
  onDesfazerDeferimento,
  onAbrirHistorico,
  onAbrirConfig,
}: TabProcessosProps) {
  return (
    <>
      {aguardandoDeferimento.length > 0 && (
        <div className="mb-4 rounded-lg border border-warning/40 bg-warning/5 p-4">
          <p className="text-xs font-semibold text-warning mb-2">⏳ Aguardando Deferimento para Cobrança ({aguardandoDeferimento.length})</p>
          <div className="space-y-1">
            {aguardandoDeferimento.map(p => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span>{p.razao_social}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{getEtapaSimplificada(p.etapa)}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {p.valor ? Number(p.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Card className="border-border/60">
        <CardHeader className="flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">
            Histórico de Processos ({totalProcessos})
            {processosPagosCount > 0 && (
              <span className="text-xs text-muted-foreground font-normal ml-2">
                · {processosPagosCount} pagos · {processosPendentesCount} pendentes
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {selectedProcessosTab.size > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                disabled={generatingExtrato}
                onClick={onGerarExtrato}
              >
                <FileText className="h-3.5 w-3.5" />
                {generatingExtrato ? 'Gerando...' : `Gerar Extrato (${selectedProcessosTab.size})`}
              </Button>
            )}
            <Button size="sm" className="gap-1.5" onClick={onNovoProcesso}>
              <Plus className="h-3.5 w-3.5" /> Novo Processo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {processos.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={processos.length > 0 && selectedProcessosTab.size === processos.length}
                      onCheckedChange={(checked) => {
                        if (checked) setSelectedProcessosTab(new Set(processos.map(p => p.id)));
                        else setSelectedProcessosTab(new Set());
                      }}
                    />
                  </TableHead>
                  <TableHead>Razão Social</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-center w-12">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processosOrdenados.map(p => {
                  const pago = isProcessoPago(p.id);
                  return (
                  <TableRow
                    key={p.id}
                    className={cn("cursor-pointer hover:bg-muted/30", pago && "opacity-50")}
                    onDoubleClick={() => {
                      const fin: ProcessoFinanceiro = {
                        ...p,
                        etapa_financeiro: 'solicitacao_criada' as const,
                        lancamento: lancamentos.find(l => l.processo_id === p.id && l.tipo === 'receber') || null,
                      };
                      onEditProcesso(fin);
                    }}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedProcessosTab.has(p.id)}
                        onCheckedChange={(checked) => {
                          const next = new Set(selectedProcessosTab);
                          if (checked) next.add(p.id); else next.delete(p.id);
                          setSelectedProcessosTab(next);
                        }}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {pago && <Check className="h-4 w-4 text-green-500 flex-shrink-0" />}
                        <span className={pago ? 'line-through text-muted-foreground' : ''}>{p.razao_social}</span>
                        <EtiquetasDisplay etiquetas={(p as any).etiquetas || []} size="compact" />
                        <EtiquetasEdit etiquetas={(p as any).etiquetas || []} processoId={p.id} size="compact" triggerVariant="icon" />
                      </div>
                      {/* 18/05/2026: criado por + última edição (triggers SQL preenchem auto) */}
                      {((p as any).created_by || (p as any).updated_by) && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {(p as any).created_by && (
                            <>criado por <span className="font-medium">{profileNames[(p as any).created_by] || 'Usuário'}</span></>
                          )}
                          {(p as any).updated_by && (p as any).updated_by !== (p as any).created_by && (
                            <> · editado por <span className="font-medium">{profileNames[(p as any).updated_by] || 'Usuário'}</span></>
                          )}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 flex-wrap">
                        <Badge variant="outline" className={cn("text-[10px] border-primary/30 text-primary", pago && "opacity-50")}>
                          {TIPO_PROCESSO_LABELS[p.tipo as TipoProcesso] || p.tipo}
                        </Badge>
                        {(p as any).dentro_do_plano === false && (
                          <Badge variant="outline" className="text-amber-500 border-amber-500/30 text-[10px]">
                            Avulso {(p as any).valor_avulso > 0 ? `R$ ${Number((p as any).valor_avulso).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}
                          </Badge>
                        )}
                        {(p as any).dentro_do_plano === true && isMensalista && (
                          <Badge variant="outline" className="text-green-500 border-green-500/30 text-[10px]">
                            Plano
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className={cn("text-sm", pago && "text-muted-foreground")}>
                      {pago ? 'Concluído' : getEtapaSimplificada(p.etapa)}
                    </TableCell>
                    <TableCell>
                      <PagamentoBadge status={classificarPagamento(lancamentos.find(l => l.processo_id === p.id && l.tipo === 'receber'))} />
                    </TableCell>
                    <TableCell>
                      {!pago && p.prioridade === 'urgente'
                        ? <Badge className="text-[10px] bg-destructive/10 text-destructive border-0">Urgente</Badge>
                        : <span className={cn("text-xs", pago ? "text-muted-foreground" : "text-muted-foreground")}>Normal</span>}
                    </TableCell>
                    <TableCell className={cn("text-sm", pago && "text-muted-foreground")}>{new Date(p.created_at).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell className={cn("text-right text-sm", pago ? "line-through text-green-500/50" : "font-medium")}>
                      {p.valor ? Number(p.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                      {pago && <span className="ml-2 text-xs text-green-500 no-underline inline-block">✓ Pago</span>}
                    </TableCell>
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      {(() => {
                        const lancProc = lancamentos.find(l => l.processo_id === p.id && l.tipo === 'receber');
                        const isNoDeferimento = (cliente as any).momento_faturamento === 'no_deferimento';
                        // FEAT-002: marcar deferido aparece se cliente é no_deferimento
                        // e lançamento ainda está em aguardando_deferimento.
                        const podeMarcarDeferido = !pago && isNoDeferimento
                          && lancProc?.etapa_financeiro === 'aguardando_deferimento';
                        // FEAT-003: desfazer deferimento aparece se cliente é
                        // no_deferimento, processo já tem data_deferimento,
                        // e lançamento NÃO foi enviado/pago ainda (anti-rebaixamento).
                        const podeDesfazerDeferimento = !pago && isNoDeferimento
                          && (p as any).data_deferimento != null
                          && lancProc
                          && ['solicitacao_criada', 'cobranca_gerada'].includes(lancProc.etapa_financeiro as string);
                        return (
                          <div className="flex items-center justify-center gap-0.5">
                            {/* FEAT-002 (11/05/2026): marcar deferido. */}
                            {podeMarcarDeferido && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                                title="Marcar como deferido"
                                onClick={() => onMarkDeferido(p)}
                              >
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {/* FEAT-003 (11/05/2026): desfazer deferimento (engano). */}
                            {podeDesfazerDeferimento && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                                title="Desfazer deferimento (marcou por engano)"
                                disabled={isDesfazerDeferimentoPending}
                                onClick={() => {
                                  if (!confirm(`Desfazer deferimento de "${p.razao_social}"? O lançamento volta para "aguardando deferimento".`)) return;
                                  onDesfazerDeferimento(p);
                                }}
                              >
                                <Undo2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {/* FEAT-001 (11/05/2026): marca processo como pago.
                                Só aparece se ainda não está pago. */}
                            {!pago && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-success hover:text-success hover:bg-success/10"
                                title="Marcar como pago"
                                onClick={() => onMarkPaid(p)}
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {/* Histórico (18/05/2026): mostra quem mudou o quê. Sutil. */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="Histórico de alterações"
                              onClick={() => onAbrirHistorico(p.id, p.razao_social)}
                            >
                              <History className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Editar configurações do processo"
                              onClick={() => onAbrirConfig(p)}
                            >
                              <Settings className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center py-8 text-muted-foreground text-sm">Nenhum processo registrado</p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
