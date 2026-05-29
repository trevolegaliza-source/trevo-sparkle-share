import { Badge } from '@/components/ui/badge';
import type { ClienteFinanceiro } from '@/hooks/useFinanceiroClientes';
import { fmt } from './utils';
import { ScorePagamentoBadge } from './ScorePagamentoBadge';

// ══════════ HELPER: Client-level badge indicators ══════════
export function ClienteHeaderBadges({ cliente }: { cliente: ClienteFinanceiro }) {
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
      {/* FIN-004 (27/05 noite): score de pagamento aparece em TODOS os contextos
          (Faturar, Em andamento, Aguardando, Pagos) via este componente. */}
      <ScorePagamentoBadge score={cliente.cliente_score_pagamento} atrasoMedio={cliente.cliente_atraso_medio_dias} />
      {/* FIN-008 (27/05 noite): alerta de limite de crédito excedido */}
      {cliente.cliente_limite_credito != null
       && cliente.cliente_saldo_aberto != null
       && cliente.cliente_saldo_aberto > cliente.cliente_limite_credito && (
        <Badge
          variant="outline"
          className="bg-rose-500/10 text-rose-600 border-rose-500/30 text-[10px] sm:text-xs whitespace-nowrap"
          title={`Saldo aberto R$ ${cliente.cliente_saldo_aberto.toFixed(0)} excede limite R$ ${cliente.cliente_limite_credito.toFixed(0)}`}
        >
          ⚠️ Limite excedido
        </Badge>
      )}
    </>
  );
}
