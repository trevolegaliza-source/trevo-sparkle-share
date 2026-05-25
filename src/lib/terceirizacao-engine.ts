/**
 * Engine de Terceirização — refactor 25/05/2026.
 *
 * Decisão de arquitetura (pós-feedback Thales):
 *  - Listas (servicos/naturezas/inclusos) são EDITÁVEIS: pode adicionar item
 *    novo, mudar label, mudar valor, remover. Os defaults são SUGESTÕES, não
 *    cárcere.
 *  - Cálculo automático continua como BASELINE; mas Thales pode digitar valor
 *    final override (`valorFinalOverride`) e dominar.
 *  - Sub-totais sempre exibidos pra transparência (você vê quanto cada item
 *    contribui).
 */

// ─── Item editável ──────────────────────────────────────────────────────────
// Usado pra servicos, naturezas e inclusos. Cada um vira objeto {id, label,
// valor, ativo, descricao, customizado}. JSON guarda direto.

export interface ItemEditavel {
  id: string;           // chave estável, pode ser custom_xxx pros adicionados pelo Thales
  label: string;        // texto exibido
  valor?: number;       // pra inclusos: quanto adiciona ao valor base. servicos/naturezas: 0.
  ativo: boolean;       // se tá marcado no escopo
  descricao?: string;   // texto auxiliar (opcional)
  customizado?: boolean;// true se foi adicionado pelo Thales (não é default)
}

// ─── Defaults (sugestões — Thales edita à vontade) ──────────────────────────

export const SERVICOS_DEFAULT: ItemEditavel[] = [
  { id: 'abertura',       label: 'Abertura',          ativo: true,  valor: 0 },
  { id: 'alteracao',      label: 'Alteração',         ativo: true,  valor: 0 },
  { id: 'baixa',          label: 'Baixa',             ativo: true,  valor: 0 },
  { id: 'transformacao',  label: 'Transformação',     ativo: true,  valor: 0 },
  { id: 'cisao',          label: 'Cisão',             ativo: false, valor: 0 },
  { id: 'fusao',          label: 'Fusão',             ativo: false, valor: 0 },
  { id: 'incorporacao',   label: 'Incorporação',      ativo: false, valor: 0 },
  { id: 'marcas_patentes',label: 'Marcas e Patentes', ativo: false, valor: 0 },
];

export const NATUREZAS_DEFAULT: ItemEditavel[] = [
  { id: 'ltda',      label: 'LTDA',      ativo: true,  valor: 0 },
  { id: 'slu',       label: 'SLU',       ativo: true,  valor: 0 },
  { id: 'mei',       label: 'MEI',       ativo: true,  valor: 0 },
  { id: 'ei',        label: 'EI',        ativo: true,  valor: 0 },
  { id: 'sa',        label: 'S.A.',      ativo: false, valor: 0 },
  { id: 'fundacao',  label: 'Fundação',  ativo: false, valor: 0 },
  { id: 'osc',       label: 'OSC',       ativo: false, valor: 0 },
  { id: 'consorcio', label: 'Consórcio', ativo: false, valor: 0 },
];

export const INCLUSOS_DEFAULT: ItemEditavel[] = [
  { id: 'plataforma',        label: 'Plataforma Trevo',          valor: 0,   ativo: true,  descricao: 'Gestão e rastreabilidade integral do processo na plataforma própria.' },
  { id: 'peticionamento',    label: 'Peticionamento',            valor: 0,   ativo: true,  descricao: 'Protocolo eletrônico ou físico de toda a documentação.' },
  { id: 'minuta_padrao',     label: 'Minuta Padrão Junta',       valor: 0,   ativo: false, descricao: 'Uso do modelo padrão da Junta Comercial.' },
  { id: 'minuta_propria',    label: 'Minuta Redação Própria',    valor: 50,  ativo: true,  descricao: 'Elaboração de instrumento societário com redação personalizada.' },
  { id: 'acompanhamento',    label: 'Acompanhamento Deferimento',valor: 0,   ativo: true,  descricao: 'Monitoramento ativo até o deferimento final.' },
  { id: 'viabilidade',       label: 'Viabilidade',               valor: 50,  ativo: true,  descricao: 'Consulta prévia de viabilidade de nome e atividade.' },
  { id: 'dbe',               label: 'DBE',                       valor: 50,  ativo: true,  descricao: 'Preenchimento e envio do Documento Básico de Entrada.' },
  { id: 'registro',          label: 'Registro (Junta/Cartório)', valor: 0,   ativo: true,  descricao: 'Protocolo perante Junta Comercial ou Cartório.' },
  { id: 'mat',               label: 'Módulo Adm. Tributária (MAT)', valor: 80,  ativo: false, descricao: 'Pós-reforma tributária: informa regime tributário e coordena assinaturas.' },
  { id: 'inscricao_mun_est', label: 'Inscrição Municipal/Estadual', valor: 100, ativo: false, descricao: 'Habilitação nos cadastros municipal e/ou estadual.' },
  { id: 'alvaras',           label: 'Alvarás e Licenças',        valor: 200, ativo: false, descricao: 'Solicitação e acompanhamento de alvarás de funcionamento.' },
  { id: 'conselho_classe',   label: 'Conselho de Classe',        valor: 50,  ativo: false, descricao: 'Registro perante conselhos profissionais (CRM, CRO, OAB, etc.).' },
];

// Valor mínimo independente do escopo (custo operacional fixo da Trevo)
export const VALOR_BASE_MINIMO = 380;

// ─── Modalidades ─────────────────────────────────────────────────────────────

export type Modalidade = 'avulso' | 'pro_5' | 'enterprise_10' | 'custom';

export interface PlanoConfig {
  modalidade: Modalidade;
  label: string;
  badge: string;
  volumeProcessos: number;
  descontoPercent: number;
}

export const PLANOS: Record<'avulso' | 'pro_5' | 'enterprise_10', PlanoConfig> = {
  avulso:        { modalidade: 'avulso',        label: 'Avulso — Pontual',    badge: 'AVULSO — PONTUAL',    volumeProcessos: 0,  descontoPercent: 0 },
  pro_5:         { modalidade: 'pro_5',         label: 'Plano PRO',           badge: 'PLANO PRO',           volumeProcessos: 5,  descontoPercent: 15 },
  enterprise_10: { modalidade: 'enterprise_10', label: 'Plano ENTERPRISE',    badge: 'PLANO ENTERPRISE',    volumeProcessos: 10, descontoPercent: 20 },
};

// ─── Cálculo ─────────────────────────────────────────────────────────────────

export interface CalculoTerceirizacao {
  valorBase: number;
  valorPro: number;
  valorEnterprise: number;
  totalMensalPro: number;
  totalMensalEnterprise: number;
  detalhamentoAdicional: Array<{ label: string; valor: number }>;
}

export function calcularTerceirizacao(
  inclusos: ItemEditavel[],
  opts: {
    valorBaseMinimoOverride?: number;
    descontoProOverride?: number;
    descontoEnterpriseOverride?: number;
  } = {},
): CalculoTerceirizacao {
  const baseMinimo = opts.valorBaseMinimoOverride ?? VALOR_BASE_MINIMO;
  const ativos = inclusos.filter((i) => i.ativo);
  const adicional = ativos.reduce((s, i) => s + Number(i.valor ?? 0), 0);
  const valorBase = baseMinimo + adicional;

  const descPro = opts.descontoProOverride ?? PLANOS.pro_5.descontoPercent;
  const descEnt = opts.descontoEnterpriseOverride ?? PLANOS.enterprise_10.descontoPercent;
  const valorPro = Math.round(valorBase * (1 - descPro / 100));
  const valorEnterprise = Math.round(valorBase * (1 - descEnt / 100));

  return {
    valorBase,
    valorPro,
    valorEnterprise,
    totalMensalPro: valorPro * PLANOS.pro_5.volumeProcessos,
    totalMensalEnterprise: valorEnterprise * PLANOS.enterprise_10.volumeProcessos,
    detalhamentoAdicional: ativos
      .filter((i) => (i.valor ?? 0) > 0)
      .map((i) => ({ label: i.label, valor: i.valor ?? 0 })),
  };
}

// Valor "principal" exibido conforme modalidade
export function valorPrincipalPorModalidade(
  calc: CalculoTerceirizacao,
  modalidade: Modalidade,
  override?: number | null,
): number {
  if (override !== null && override !== undefined && override > 0) return override;
  switch (modalidade) {
    case 'pro_5':         return calc.totalMensalPro;
    case 'enterprise_10': return calc.totalMensalEnterprise;
    case 'avulso':
    case 'custom':        return calc.valorBase;
    default:              return calc.valorBase;
  }
}

// ─── Formatação ──────────────────────────────────────────────────────────────

export const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Gera id custom único pra novos itens adicionados pelo Thales
export function gerarIdCustomizado(): string {
  return `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}
