import { Badge } from '@/components/ui/badge';

export type PagamentoStatus = 'pago' | 'pendente' | 'vencido' | 'sem-lancamento';

/**
 * Classifica status de pagamento a partir de um lançamento financeiro.
 * Usado em /processos (sidebar) e CLIENTES/:id > Processos.
 */
export function classificarPagamento(lanc: any): PagamentoStatus {
  if (!lanc) return 'sem-lancamento';
  if (lanc.status === 'pago') return 'pago';
  if (lanc.status === 'cancelado') return 'sem-lancamento';
  if (lanc.data_vencimento) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const venc = new Date(lanc.data_vencimento);
    venc.setHours(0, 0, 0, 0);
    if (venc < hoje) return 'vencido';
  }
  return 'pendente';
}

/** Badge visual de status de pagamento. */
export function PagamentoBadge({ status }: { status: PagamentoStatus | undefined }) {
  if (!status || status === 'sem-lancamento') {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  if (status === 'pago') {
    return <Badge className="text-[10px] bg-green-600/15 text-green-600 border-0">Pago</Badge>;
  }
  if (status === 'vencido') {
    return <Badge className="text-[10px] bg-destructive/10 text-destructive border-0">Vencido</Badge>;
  }
  return <Badge className="text-[10px] bg-amber-500/15 text-amber-600 border-0">Pendente</Badge>;
}
