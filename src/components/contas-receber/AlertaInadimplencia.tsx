import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { LancamentoReceber } from '@/hooks/useContasReceber';
import { diasAtraso } from '@/hooks/useContasReceber';

interface Props {
  lancamentos: LancamentoReceber[];
  onVerClick: () => void;
}

export default function AlertaInadimplencia({ lancamentos, onVerClick }: Props) {
  const hoje = new Date().toISOString().split('T')[0];
  const vencidos = lancamentos.filter(l => l.status === 'pendente' && l.data_vencimento < hoje);
  if (vencidos.length === 0) return null;

  const totalVencido = vencidos.reduce((s, l) => s + Number(l.valor), 0);
  const maisAtrasado = vencidos.reduce((worst, l) => {
    const d = diasAtraso(l.data_vencimento, l.status);
    return d > worst.dias ? { dias: d, nome: l.cliente?.nome || 'Desconhecido' } : worst;
  }, { dias: 0, nome: '' });

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border-l-4 border-destructive bg-card p-4">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
        <div>
          <p className="text-sm font-semibold">
            {vencidos.length} cobrança{vencidos.length > 1 ? 's' : ''} vencida{vencidos.length > 1 ? 's' : ''} totalizando{' '}
            {totalVencido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
          <p className="text-xs text-muted-foreground">
            Cliente mais crítico: {maisAtrasado.nome} ({maisAtrasado.dias} dias)
          </p>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onVerClick}>Ver</Button>
    </div>
  );
}
