import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePlanoContas, type PlanoContas } from './usePlanoContas';
import { useMemo } from 'react';

export interface DRELinha {
  codigo: string;
  nome: string;
  valor: number;
  valorComparativo?: number;
  variacao?: number;
  nivel: number; // 0=grupo, 1=subgrupo, 2=conta
  tipo: 'header' | 'item' | 'subtotal' | 'metrica';
  destaque?: boolean;
}

export interface DREResultado {
  linhas: DRELinha[];
  receitaBruta: number;
  deducoes: number;
  receitaLiquida: number;
  custosOperacionais: number;
  lucroBruto: number;
  margemBruta: number;
  despesasOperacionais: number;
  ebitda: number;
  margemEbitda: number;
  despesasFinanceiras: number;
  resultadoLiquido: number;
  margemLiquida: number;
}

const CATEGORIA_TO_CONTA: Record<string, string> = {
  folha: '3.1',
  terceiros: '3.2',
  infraestrutura: '4.1',
  ferramentas: '4.2',
  marketing: '4.3',
  outros: '4.4',
  impostos: '2.1',
};

function classificarLancamento(lanc: any, contas: PlanoContas[]): string | null {
  if (lanc.conta_id) {
    const conta = contas.find(c => c.id === lanc.conta_id);
    return conta?.tipo || null;
  }
  // Auto-classify
  if (lanc.tipo === 'receber') return 'receita';
  if (lanc.categoria && CATEGORIA_TO_CONTA[lanc.categoria]) {
    const prefix = CATEGORIA_TO_CONTA[lanc.categoria];
    const conta = contas.find(c => c.codigo === prefix);
    return conta?.tipo || (lanc.categoria === 'impostos' ? 'deducao' : 'custo');
  }
  if (lanc.tipo === 'pagar') return 'despesa';
  return null;
}

function getContaCodigo(lanc: any, contas: PlanoContas[]): string {
  if (lanc.conta_id) {
    const conta = contas.find(c => c.id === lanc.conta_id);
    return conta?.codigo || '9.9';
  }
  if (lanc.tipo === 'receber') {
    if (lanc.is_taxa_reembolsavel) return '1.1.4';
    if (lanc.categoria === 'mensalidade') return '1.1.2';
    return '1.1.1';
  }
  if (lanc.categoria && CATEGORIA_TO_CONTA[lanc.categoria]) {
    return CATEGORIA_TO_CONTA[lanc.categoria];
  }
  return '4.4';
}

function fetchLancamentosPeriodo(mes: number, ano: number) {
  return supabase
    .from('lancamentos')
    .select('*')
    .eq('status', 'pago')
    .gte('data_pagamento', `${ano}-${String(mes).padStart(2, '0')}-01`)
    .lt('data_pagamento', mes === 12
      ? `${ano + 1}-01-01`
      : `${ano}-${String(mes + 1).padStart(2, '0')}-01`
    );
}

function calcularDRE(
  lancamentos: any[],
  contas: PlanoContas[],
  centroCusto?: string,
): Omit<DREResultado, 'linhas'> & { porConta: Record<string, number> } {
  let filtered = lancamentos;
  if (centroCusto && centroCusto !== 'todos') {
    filtered = lancamentos.filter(l => {
      if (l.centro_custo === centroCusto) return true;
      if (l.conta_id) {
        const conta = contas.find(c => c.id === l.conta_id);
        return conta?.centro_custo === centroCusto;
      }
      return false;
    });
  }

  const porConta: Record<string, number> = {};

  for (const l of filtered) {
    const codigo = getContaCodigo(l, contas);
    porConta[codigo] = (porConta[codigo] || 0) + Math.abs(l.valor);
  }

  // Sum by type prefix
  const sumPrefix = (prefix: string) =>
    Object.entries(porConta)
      .filter(([k]) => k.startsWith(prefix))
      .reduce((s, [, v]) => s + v, 0);

  const receitaBruta = sumPrefix('1.');
  const deducoes = sumPrefix('2.');
  const receitaLiquida = receitaBruta - deducoes;
  const custosOperacionais = sumPrefix('3.');
  const lucroBruto = receitaLiquida - custosOperacionais;
  const margemBruta = receitaBruta > 0 ? (lucroBruto / receitaBruta) * 100 : 0;
  const despesasOperacionais = sumPrefix('4.');
  const ebitda = lucroBruto - despesasOperacionais;
  const margemEbitda = receitaBruta > 0 ? (ebitda / receitaBruta) * 100 : 0;
  const despesasFinanceiras = sumPrefix('5.');
  const resultadoLiquido = ebitda - despesasFinanceiras;
  const margemLiquida = receitaBruta > 0 ? (resultadoLiquido / receitaBruta) * 100 : 0;

  return {
    receitaBruta, deducoes, receitaLiquida, custosOperacionais,
    lucroBruto, margemBruta, despesasOperacionais, ebitda, margemEbitda,
    despesasFinanceiras, resultadoLiquido, margemLiquida, porConta,
  };
}

function buildLinhas(
  atual: ReturnType<typeof calcularDRE>,
  comparativo: ReturnType<typeof calcularDRE> | null,
  contas: PlanoContas[],
): DRELinha[] {
  const linhas: DRELinha[] = [];

  const addHeader = (nome: string, sinal: string, valor: number, compVal?: number) => {
    linhas.push({
      codigo: sinal, nome, valor, nivel: 0, tipo: 'subtotal', destaque: true,
      valorComparativo: compVal,
      variacao: compVal && compVal !== 0 ? ((valor - compVal) / Math.abs(compVal)) * 100 : undefined,
    });
  };

  const addContas = (prefix: string) => {
    const relevant = contas
      .filter(c => c.codigo.startsWith(prefix) && c.codigo.split('.').length >= 3)
      .sort((a, b) => a.codigo.localeCompare(b.codigo));
    for (const c of relevant) {
      const val = atual.porConta[c.codigo] || 0;
      const comp = comparativo?.porConta[c.codigo] || 0;
      if (val === 0 && comp === 0) continue;
      linhas.push({
        codigo: c.codigo, nome: c.nome, valor: val, nivel: 2, tipo: 'item',
        valorComparativo: comparativo ? comp : undefined,
        variacao: comp !== 0 ? ((val - comp) / Math.abs(comp)) * 100 : undefined,
      });
    }
  };

  const addMetrica = (nome: string, valor: number, compVal?: number) => {
    linhas.push({
      codigo: '', nome, valor, nivel: 1, tipo: 'metrica',
      valorComparativo: compVal,
    });
  };

  // RECEITA BRUTA
  addHeader('RECEITA BRUTA', '(+)', atual.receitaBruta, comparativo?.receitaBruta);
  addContas('1.');

  // DEDUÇÕES
  addHeader('DEDUÇÕES', '(-)', atual.deducoes, comparativo?.deducoes);
  addContas('2.');

  // RECEITA LÍQUIDA
  addHeader('RECEITA LÍQUIDA', '(=)', atual.receitaLiquida, comparativo?.receitaLiquida);

  // CUSTOS OPERACIONAIS
  addHeader('CUSTOS OPERACIONAIS', '(-)', atual.custosOperacionais, comparativo?.custosOperacionais);
  addContas('3.');

  // LUCRO BRUTO
  addHeader('LUCRO BRUTO', '(=)', atual.lucroBruto, comparativo?.lucroBruto);
  addMetrica('Margem Bruta', atual.margemBruta, comparativo?.margemBruta);

  // DESPESAS OPERACIONAIS
  addHeader('DESPESAS OPERACIONAIS', '(-)', atual.despesasOperacionais, comparativo?.despesasOperacionais);
  addContas('4.');

  // EBITDA
  addHeader('EBITDA', '(=)', atual.ebitda, comparativo?.ebitda);
  addMetrica('Margem EBITDA', atual.margemEbitda, comparativo?.margemEbitda);

  // DESPESAS FINANCEIRAS
  addHeader('DESPESAS FINANCEIRAS', '(-)', atual.despesasFinanceiras, comparativo?.despesasFinanceiras);
  addContas('5.');

  // RESULTADO LÍQUIDO
  addHeader('RESULTADO LÍQUIDO', '(=)', atual.resultadoLiquido, comparativo?.resultadoLiquido);
  addMetrica('Margem Líquida', atual.margemLiquida, comparativo?.margemLiquida);

  return linhas;
}

export type ComparativoTipo = 'mes_anterior' | 'mesmo_mes_ano_anterior' | 'nenhum';

export function useDRE(mes: number, ano: number, comparativo: ComparativoTipo = 'nenhum', centroCusto: string = 'todos') {
  const { data: contas = [] } = usePlanoContas();

  const compMes = comparativo === 'mes_anterior'
    ? (mes === 1 ? 12 : mes - 1)
    : comparativo === 'mesmo_mes_ano_anterior' ? mes : 0;
  const compAno = comparativo === 'mes_anterior'
    ? (mes === 1 ? ano - 1 : ano)
    : comparativo === 'mesmo_mes_ano_anterior' ? ano - 1 : 0;

  const query = useQuery({
    queryKey: ['dre', mes, ano, comparativo, centroCusto],
    queryFn: async () => {
      const { data: lancAtual, error: e1 } = await fetchLancamentosPeriodo(mes, ano);
      if (e1) throw e1;

      let lancComp: any[] | null = null;
      if (comparativo !== 'nenhum' && compMes > 0) {
        const { data, error: e2 } = await fetchLancamentosPeriodo(compMes, compAno);
        if (e2) throw e2;
        lancComp = data;
      }

      return { lancAtual: lancAtual || [], lancComp };
    },
    enabled: contas.length > 0,
  });

  const resultado = useMemo<DREResultado | null>(() => {
    if (!query.data || contas.length === 0) return null;

    const atual = calcularDRE(query.data.lancAtual, contas, centroCusto);
    const comp = query.data.lancComp ? calcularDRE(query.data.lancComp, contas, centroCusto) : null;
    const linhas = buildLinhas(atual, comp, contas);

    return { ...atual, linhas };
  }, [query.data, contas, centroCusto]);

  return {
    data: resultado,
    isLoading: query.isLoading,
    error: query.error,
  };
}
