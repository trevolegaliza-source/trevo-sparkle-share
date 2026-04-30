/**
 * Motor Financeiro — cálculo explícito, sem heurísticas e sem leitura de texto livre.
 * Fórmula: Valor Base (ou manual) + 50% de urgência, quando aplicável, + valores adicionais do popup.
 */

export interface ClienteFinanceiro {
  tipo: string;
  valor_base: number | null;
  desconto_progressivo: number | null;
  valor_limite_desconto: number | null;
  mensalidade: number | null;
  qtd_processos: number | null;
}

export interface CalculoPrecificacao {
  valorBase: number;
  descontoPercent: number;
  descontoValor: number;
  valorComDesconto: number;
  urgencia: number;
  valorServico: number;
  somaAdicionais: number;
  totalFinal: number;
  isMensalista: boolean;
  franquiaIncluida: boolean;
}

/**
 * Mantido para compatibilidade, mas a regra foi simplificada:
 * - nada é extraído de observações ou textos livres
 * - não há desconto progressivo automático no cálculo do processo
 * - urgência só adiciona 50% quando marcada explicitamente
 */
export function calcularPrecoProcesso(params: {
  cliente: ClienteFinanceiro | null;
  baseOverride?: number;
  processosNoMes: number;
  isUrgente: boolean;
  somaAdicionais: number;
  isRetrabalho?: boolean;
  isTransferenciaUF?: boolean;
}): CalculoPrecificacao {
  const { cliente, baseOverride, isUrgente, somaAdicionais } = params;

  const isMensalista = cliente?.tipo === 'MENSALISTA' && (cliente?.mensalidade ?? 0) > 0;
  const valorBase = Number(baseOverride ?? cliente?.valor_base ?? 0);
  const urgencia = isUrgente ? valorBase * 0.5 : 0;
  const valorServico = isMensalista ? 0 : valorBase + urgencia;

  return {
    valorBase,
    descontoPercent: 0,
    descontoValor: 0,
    valorComDesconto: valorBase,
    urgencia: isMensalista ? 0 : urgencia,
    valorServico,
    somaAdicionais: Number(somaAdicionais || 0),
    totalFinal: valorServico + Number(somaAdicionais || 0),
    isMensalista,
    franquiaIncluida: false,
  };
}

export function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
