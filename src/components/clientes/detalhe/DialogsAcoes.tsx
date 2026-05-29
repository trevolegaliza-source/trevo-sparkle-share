import { FileBarChart, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getEtapaSimplificada } from '@/types/process';
import { TIPO_PROCESSO_LABELS } from '@/types/financial';
import type { ClienteDB, ProcessoDB, Lancamento, TipoProcesso } from '@/types/financial';
import type { DeferimentoAlertData } from './types';
import { gerarRelatorioStatusPDF } from '@/lib/relatorio-status-pdf';
import { toast } from 'sonner';

interface RelatorioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente: ClienteDB;
  processos: ProcessoDB[];
  selectedRelatorioProcessos: Set<string>;
  setSelectedRelatorioProcessos: (s: Set<string>) => void;
}

export function RelatorioDialog({
  open,
  onOpenChange,
  cliente,
  processos,
  selectedRelatorioProcessos,
  setSelectedRelatorioProcessos,
}: RelatorioDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileBarChart className="h-5 w-5" /> Gerar Relatório</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Selecione os processos que deseja incluir no relatório:</p>
          <div className="flex gap-2 mb-2">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setSelectedRelatorioProcessos(new Set(processos.map(p => p.id)))}>Selecionar Todos</Button>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setSelectedRelatorioProcessos(new Set())}>Limpar</Button>
          </div>
          {processos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum processo encontrado.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-2">
              {processos.map(p => (
                <label key={p.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer">
                  <Checkbox
                    checked={selectedRelatorioProcessos.has(p.id)}
                    onCheckedChange={(checked) => {
                      const next = new Set(selectedRelatorioProcessos);
                      if (checked) next.add(p.id); else next.delete(p.id);
                      setSelectedRelatorioProcessos(next);
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.razao_social}</p>
                    <p className="text-xs text-muted-foreground">{TIPO_PROCESSO_LABELS[p.tipo as TipoProcesso] || p.tipo} · {getEtapaSimplificada(p.etapa)}</p>
                  </div>
                  <span className="text-xs font-medium">{Number(p.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={selectedRelatorioProcessos.size === 0}
            onClick={async () => {
              const selected = processos.filter(p => selectedRelatorioProcessos.has(p.id));
              if (!cliente || selected.length === 0) return;

              try {
                const relatorioData = {
                  cliente_nome: cliente.apelido || cliente.nome,
                  cliente_cnpj: cliente.cnpj || '',
                  data_emissao: new Date().toLocaleDateString('pt-BR'),
                  processos: selected.map(p => ({
                    razao_social: p.razao_social,
                    tipo: p.tipo,
                    etapa: p.etapa,
                    created_at: p.created_at || new Date().toISOString(),
                  })),
                };

                const doc = await gerarRelatorioStatusPDF(relatorioData);
                doc.save(`status_${(cliente.apelido || cliente.nome).replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
                toast.success(`Relatório gerado com ${selected.length} processo(s)`);
                onOpenChange(false);
              } catch (err: any) {
                toast.error('Erro ao gerar relatório: ' + (err.message || 'Erro desconhecido'));
              }
            }}
          >
            Gerar Relatório ({selectedRelatorioProcessos.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CobrancaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente: ClienteDB;
  lancamentos: Lancamento[];
  selectedCobrancaProcessos: Set<string>;
  setSelectedCobrancaProcessos: (s: Set<string>) => void;
}

export function CobrancaDialog({
  open,
  onOpenChange,
  cliente,
  lancamentos,
  selectedCobrancaProcessos,
  setSelectedCobrancaProcessos,
}: CobrancaDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Baixar resumo (.txt)</DialogTitle>
        </DialogHeader>
        {(() => {
          const pendentes = lancamentos.filter(l => l.tipo === 'receber' && l.status === 'pendente');
          return (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Gera um arquivo <code>.txt</code> local com os processos pendentes — útil pra controle interno. <strong>Não envia cobrança nem gera boleto.</strong> Pra cobrança real, use "Gerar Extrato".</p>
              {pendentes.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma cobrança pendente.</p>
              ) : (
                <>
                  <div className="flex gap-2 mb-2">
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => setSelectedCobrancaProcessos(new Set(pendentes.map(l => l.id)))}>Selecionar Todos</Button>
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => setSelectedCobrancaProcessos(new Set())}>Limpar</Button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-2">
                    {pendentes.map(l => (
                      <label key={l.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer">
                        <Checkbox
                          checked={selectedCobrancaProcessos.has(l.id)}
                          onCheckedChange={(checked) => {
                            const next = new Set(selectedCobrancaProcessos);
                            if (checked) next.add(l.id); else next.delete(l.id);
                            setSelectedCobrancaProcessos(next);
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{l.descricao}</p>
                          <p className="text-xs text-muted-foreground">Venc: {l.data_vencimento ? new Date(l.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}</p>
                        </div>
                        <span className="text-sm font-semibold text-warning">{Number(l.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button
                  disabled={selectedCobrancaProcessos.size === 0}
                  onClick={() => {
                    const selected = pendentes.filter(l => selectedCobrancaProcessos.has(l.id));
                    const totalCobranca = selected.reduce((s, l) => s + Number(l.valor), 0);
                    const lines = [
                      `COBRANÇA - ${cliente.nome}`,
                      `Data: ${new Date().toLocaleDateString('pt-BR')}`,
                      `Código: ${cliente.codigo_identificador}`,
                      '',
                      'ITENS:',
                      ...selected.map((l, i) => `${i + 1}. ${l.descricao} | Venc: ${l.data_vencimento ? new Date(l.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR') : '-'} | ${Number(l.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`),
                      '',
                      `TOTAL: ${totalCobranca.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
                    ];
                    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = `cobranca_${cliente.codigo_identificador}_${Date.now()}.txt`; a.click();
                    URL.revokeObjectURL(url);
                    toast.success(`Arquivo baixado: ${totalCobranca.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);
                    onOpenChange(false);
                  }}
                >
                  Baixar .txt ({selectedCobrancaProcessos.size})
                </Button>
              </DialogFooter>
            </div>
          );
        })()}
      </DialogContent>
    </Dialog>
  );
}

interface MarkFaturadoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingFaturadoProcs: ProcessoDB[];
  setPendingFaturadoProcs: (procs: ProcessoDB[]) => void;
  onConfirm: () => Promise<void>;
}

export function MarkFaturadoDialog({
  open,
  onOpenChange,
  pendingFaturadoProcs,
  setPendingFaturadoProcs,
  onConfirm,
}: MarkFaturadoDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Extrato gerado com sucesso!</AlertDialogTitle>
          <AlertDialogDescription>
            Deseja marcar os {pendingFaturadoProcs.length} processo(s) como "Faturado"?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setPendingFaturadoProcs([])}>Não, manter</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Marcar como Faturado
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface DeferimentoAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deferimentoAlertData: DeferimentoAlertData | null;
  onGerarApenasDeferidos: () => void;
  onGerarTodos: () => void;
}

export function DeferimentoAlertDialog({
  open,
  onOpenChange,
  deferimentoAlertData,
  onGerarApenasDeferidos,
  onGerarTodos,
}: DeferimentoAlertDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-warning">
            ⚠️ Cliente com Faturamento no Deferimento
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                O cliente <strong>{deferimentoAlertData?.clienteNome}</strong> está configurado para faturar apenas no deferimento.
              </p>
              <p className="font-medium text-foreground">Processos ainda NÃO deferidos:</p>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                {deferimentoAlertData?.naoDeferidos.map(p => (
                  <li key={p.id}>
                    {TIPO_PROCESSO_LABELS[p.tipo] || p.tipo} — {p.razao_social}{' '}
                    <span className="text-muted-foreground">(Etapa: {p.etapa})</span>
                  </li>
                ))}
              </ul>
              <p>Deseja gerar o extrato mesmo assim?</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button
            variant="outline"
            onClick={onGerarApenasDeferidos}
          >
            Gerar Apenas Deferidos
          </Button>
          <AlertDialogAction onClick={onGerarTodos}>
            Gerar Todos Mesmo Assim
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
