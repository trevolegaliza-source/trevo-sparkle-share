import { useMemo } from 'react';
import { calcularDescontoProgressivo } from '@/hooks/useFinanceiro';
import type { ClienteDB, ProcessoDB } from '@/types/financial';
import type { DescontoPreview } from './types';

interface UseDescontoPreviewArgs {
  cliente: ClienteDB | null;
  processos: ProcessoDB[];
  mudancaUf: boolean;
  prioridade: string;
  isManualPrice: boolean;
  isNegotiatedService: boolean;
  aplicarBoasVindas: boolean;
  boasVindasPct: string;
}

/**
 * Preview em tempo real do desconto progressivo. Encapsula a regra de
 * franquia/mensalista/urgência/mudança UF/boas-vindas — antes inline no
 * ClienteDetalhe (era ~60 linhas dentro do componente).
 */
export function useDescontoPreview({
  cliente,
  processos,
  mudancaUf,
  prioridade,
  isManualPrice,
  isNegotiatedService,
  aplicarBoasVindas,
  boasVindasPct,
}: UseDescontoPreviewArgs): DescontoPreview | null {
  return useMemo(() => {
    if (!cliente || isManualPrice || isNegotiatedService) return null;
    const c = cliente as any;
    const valorBase = Number(c.valor_base ?? 0);
    const descontoPercent = Number(c.desconto_progressivo ?? 0);
    const valorLimite = c.valor_limite_desconto != null ? Number(c.valor_limite_desconto) : null;
    const isMens = c.tipo === 'MENSALISTA';
    const franquia = Number(c.franquia_processos ?? 0);

    // count current month processes
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthCount = processos.filter(p => new Date(p.created_at) >= startMonth).length;
    const slots = mudancaUf ? 2 : 1;

    if (isMens && franquia > 0 && monthCount < franquia) {
      return { slot: monthCount + 1, valor: 0, desconto: 0, label: `Dentro da franquia (${monthCount + 1}/${franquia})` };
    }

    const effectiveCount = isMens && franquia > 0 ? monthCount - franquia : monthCount;
    if (effectiveCount < 0) return { slot: monthCount + 1, valor: 0, desconto: 0, label: 'Franquia' };

    const isUrg = prioridade === 'urgente';
    const slotNumero = effectiveCount + 1;

    if (isUrg) {
      let val = valorBase * 1.5;
      if (slots === 2) val *= 2;

      if (aplicarBoasVindas) {
        const pct = Number(boasVindasPct) || 50;
        val = Math.round(val * (1 - pct / 100) * 100) / 100;
      }

      return {
        slot: slotNumero,
        valor: val,
        desconto: 0,
        label: slots === 2 ? `Slots ${slotNumero} e ${slotNumero + 1}` : `Slot nº ${slotNumero}`,
      };
    }

    if (slots === 2 && descontoPercent > 0) {
      const calc1 = calcularDescontoProgressivo(valorBase, descontoPercent, effectiveCount, valorLimite);
      const calc2 = calcularDescontoProgressivo(valorBase, descontoPercent, effectiveCount + 1, valorLimite);
      const total = calc1.valorFinal + calc2.valorFinal;
      return { slot: calc1.processoNumero, valor: total, desconto: calc1.descontoAcumulado + calc2.descontoAcumulado, label: `Mudança UF: Slots ${calc1.processoNumero} e ${calc2.processoNumero}` };
    }

    const calc = calcularDescontoProgressivo(valorBase, descontoPercent, effectiveCount, valorLimite);
    let val = calc.valorFinal;

    // Apply boas-vindas preview
    if (aplicarBoasVindas) {
      const pct = Number(boasVindasPct) || 50;
      val = Math.round(val * (1 - pct / 100) * 100) / 100;
    }

    return { slot: calc.processoNumero, valor: val, desconto: calc.descontoAcumulado, label: `Slot nº ${calc.processoNumero}` };
  }, [cliente, processos, mudancaUf, prioridade, isManualPrice, isNegotiatedService, aplicarBoasVindas, boasVindasPct]);
}
