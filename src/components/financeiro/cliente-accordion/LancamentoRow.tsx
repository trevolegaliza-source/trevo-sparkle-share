import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TIPO_PROCESSO_LABELS } from '@/types/financial';
import { EtiquetasEdit } from '@/components/EtiquetasBadges';
import type { LancamentoFinanceiro } from '@/hooks/useFinanceiroClientes';
import { useHighlightOnModal } from '@/hooks/useHighlightOnModal';
import { fmt, fmtDate, parseBadges, BADGE_COLORS } from './utils';

// ══════════ SHARED COMPONENTS ══════════
export function LancamentoRowWithHighlight({
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

export function LancamentoRow({ lancamento: l, checked, onToggle }: { lancamento: LancamentoFinanceiro; checked?: boolean; onToggle?: () => void }) {
  const badges = parseBadges(l.processo_notas);
  const alertaTaxas = (l.tem_etiqueta_metodo_trevo || l.tem_etiqueta_prioridade) && l.total_valores_adicionais === 0;
  const obsLower = ((l.observacoes_financeiro || '') + ' ' + (l.descricao || '')).toLowerCase();
  const temExtratoLegado = !l.extrato_id && obsLower.includes('extrato emitido');

  const currentEtiquetas: string[] = [];
  if (l.tem_etiqueta_metodo_trevo) currentEtiquetas.push('metodo_trevo');
  if (l.tem_etiqueta_prioridade) currentEtiquetas.push('prioridade');

  const hasEtiquetaBadges = l.tem_etiqueta_metodo_trevo || l.tem_etiqueta_prioridade || badges.length > 0;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
          {l.status === 'pago' && l.data_pagamento && (
            <span className="text-emerald-500 font-medium"> · Pago em {fmtDate(l.data_pagamento)}</span>
          )}
          {l.status === 'pago' && l.cobranca_share_token && (
            <>
              {' · '}
              <a
                href={`/cobranca/${l.cobranca_share_token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                Ver cobrança ↗
              </a>
            </>
          )}
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
