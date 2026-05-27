/**
 * Engine de Terceirização — refactor visual 26/05/2026.
 *
 * Mudanças vs versão anterior:
 *  - Defaults enxutos: só os essenciais (Thales adiciona o resto se quiser)
 *  - Inclusos sem valor predefinido (Thales preenche cada um manualmente)
 *  - Modalidade NOVA: `preco_por_tipo` — preços diferentes por tipo de processo
 *  - Catálogo de Regras Rápidas (pills cláusula): clica e o texto vai pras observações
 */

// ─── Item editável ──────────────────────────────────────────────────────────

export interface ItemEditavel {
  id: string;
  label: string;
  valor?: number;
  ativo: boolean;
  descricao?: string;
  customizado?: boolean;
}

// ─── Defaults enxutos ───────────────────────────────────────────────────────
// Thales pediu: vir só com o essencial. Quem quiser cisão/fusão/etc adiciona.

export const SERVICOS_DEFAULT: ItemEditavel[] = [
  { id: 'abertura',       label: 'Abertura',      ativo: true,  valor: 0 },
  { id: 'alteracao',      label: 'Alteração',     ativo: true,  valor: 0 },
  { id: 'baixa',          label: 'Baixa',         ativo: true,  valor: 0 },
  { id: 'transformacao',  label: 'Transformação', ativo: true,  valor: 0 },
];

export const NATUREZAS_DEFAULT: ItemEditavel[] = [
  { id: 'ltda', label: 'LTDA',                   ativo: true,  valor: 0 },
  { id: 'slu',  label: 'SLU',                    ativo: true,  valor: 0 },
  { id: 'mei',  label: 'MEI',                    ativo: true,  valor: 0 },
  { id: 'ei',   label: 'Empresário Individual',  ativo: true,  valor: 0 },
  { id: 'sa',   label: 'S.A.',                   ativo: false, valor: 0 },
];

// Inclusos sem valor predefinido. Ordem fixa solicitada pelo Thales (26/05).
export const INCLUSOS_DEFAULT: ItemEditavel[] = [
  { id: 'plataforma',         label: 'Plataforma Trevo',                 valor: 0, ativo: true,  descricao: 'Gestão e rastreabilidade integral do processo na plataforma própria, com acesso ao status em tempo real.' },
  { id: 'viabilidade',        label: 'Viabilidade',                      valor: 0, ativo: true,  descricao: 'Consulta prévia de viabilidade de nome e atividade junto ao órgão competente antes do início do processo.' },
  { id: 'dbe',                label: 'DBE',                              valor: 0, ativo: true,  descricao: 'Preenchimento e envio do Documento Básico de Entrada junto à Receita Federal.' },
  { id: 'contrato_social',    label: 'Contrato Social',                  valor: 0, ativo: true,  descricao: 'Elaboração do instrumento societário (contrato social ou estatuto), seja em modelo padrão ou com redação personalizada.' },
  { id: 'peticionamento_junta', label: 'Peticionamento Junta Comercial', valor: 0, ativo: true,  descricao: 'Protocolo eletrônico ou físico de toda a documentação na Junta Comercial competente, com acompanhamento até o deferimento.' },
  { id: 'mat',                label: 'MAT',                              valor: 0, ativo: false, descricao: 'Módulo de Administração Tributária: regime tributário e assinaturas coordenadas pós-reforma tributária.' },
  { id: 'inscricao_municipal',label: 'Inscrição Municipal',              valor: 0, ativo: false, descricao: 'Habilitação da empresa no cadastro municipal para emissão de notas fiscais.' },
  { id: 'alvaras',            label: 'Alvarás e Licenças',               valor: 0, ativo: false, descricao: 'Solicitação e acompanhamento de alvarás de funcionamento e licenças necessárias para a operação.' },
  { id: 'conselho_classe',    label: 'Conselho de Classe',               valor: 0, ativo: false, descricao: 'Registro perante conselhos profissionais (CRM, CRO, OAB, etc.) quando aplicável.' },
];

// Valor mínimo / base padrão (Thales 26/05): R$ 680.
export const VALOR_BASE_MINIMO = 680;

// ─── Modalidades ─────────────────────────────────────────────────────────────

export type Modalidade = 'avulso' | 'pro_5' | 'preco_por_tipo' | 'custom';

export interface PlanoConfig {
  modalidade: Modalidade;
  label: string;
  badge: string;
  volumeProcessos: number;
  descontoPercent: number;
}

export const PLANOS: Record<'avulso' | 'pro_5', PlanoConfig> = {
  avulso: { modalidade: 'avulso', label: 'Avulso — Pontual', badge: 'AVULSO — PONTUAL', volumeProcessos: 0, descontoPercent: 0 },
  pro_5:  { modalidade: 'pro_5',  label: 'Plano PRO',        badge: 'PLANO PRO',        volumeProcessos: 5, descontoPercent: 15 },
};

// ITEM-033 fix: fonte única de labels de modalidade. Antes estava duplicado
// em 3 arquivos (PropostasComerciais.tsx, edge function, este). Usar este
// daqui pra frente em todos os lugares de exibição.
export const MODALIDADE_LABEL: Record<string, string> = {
  avulso: 'Avulso',
  pro_5: 'PRO (5/mês)',
  enterprise_10: 'ENTERPRISE (10/mês)',
  preco_por_tipo: 'Preço por tipo',
  custom: 'Customizado',
};

// ─── Preço por tipo de processo ─────────────────────────────────────────────
// Modalidade nova: valores DIFERENTES por categoria de processo.

export type TipoProcessoPreco = 'abertura' | 'alteracao' | 'baixa' | 'transformacao' | 'encerramento';

export interface PrecosPorTipo {
  abertura?: number;
  alteracao?: number;
  baixa?: number;
  transformacao?: number;
  encerramento?: number;
}

export const TIPO_PROCESSO_PRECO_LABELS: Record<TipoProcessoPreco, string> = {
  abertura: 'Abertura',
  alteracao: 'Alteração',
  baixa: 'Baixa',
  transformacao: 'Transformação',
  encerramento: 'Encerramento',
};

// ─── Regras Rápidas (Cláusulas) ─────────────────────────────────────────────
// Pills que Thales clica e o texto vira parte das observações.

export interface RegraRapida {
  id: string;
  label: string;     // texto curto na pill
  texto: string;     // texto completo que vira observação
}

export const REGRAS_RAPIDAS_CATALOGO: RegraRapida[] = [
  {
    id: 'mat',
    label: 'MAT',
    texto: 'A responsabilidade técnica, preenchimento e envio do Módulo de Administração Tributária (MAT) permanecerá sob encargo EXCLUSIVO da Contabilidade.',
  },
  {
    id: 'troca_uf',
    label: 'TROCA UF',
    texto: 'Processos que envolvam transferência de UF serão cobrados como 2 processos avulsos.',
  },
  {
    id: 'doc_completa',
    label: 'DOC COMPLETA',
    texto: 'PRAZO: O prazo de 5 dias úteis inicia-se EXCLUSIVAMENTE após recebimento de 100% da documentação solicitada.',
  },
  {
    id: 'alvaras_600',
    label: 'ALVARÁS +600',
    texto: 'ALVARÁS EXTRAS: Processos que exijam Alvarás e Licenças (não inclusos no serviço) terão cobrança adicional de R$ 600,00 por processo + taxas + responsável técnico.',
  },
  {
    id: 'taxas_fora',
    label: 'TAXAS FORA',
    texto: 'TAXAS GOVERNAMENTAIS: DAREs, DARFs, emolumentos e guias oficiais NÃO estão inclusos nos honorários.',
  },
  {
    id: 'fast_track',
    label: 'FAST TRACK',
    texto: 'URGÊNCIA (FAST TRACK): Solicitações com prazo inferior a 24h terão acréscimo de 50% sobre o valor + taxa de registro junta e regional.',
  },
  {
    id: 'retrabalho',
    label: 'RETRABALHO',
    texto: 'RETRABALHO: Exigências decorrentes de dados incorretos fornecidos pela CONTRATANTE serão cobradas 50% a mais do valor do processo avulso.',
  },
  {
    id: 'inadimplencia',
    label: 'INADIMPLÊNCIA',
    texto: 'INADIMPLÊNCIA: Atrasos superiores a 5 dias resultarão em suspensão imediata do acesso à plataforma e protocolização de novos processos.',
  },
  {
    id: 'lgpd',
    label: 'LGPD',
    texto: 'LGPD: A CONTRATANTE autoriza a CONTRATADA a tratar dados pessoais exclusivamente para execução deste contrato, conforme Lei 13.709/2018.',
  },
  {
    id: 'escopo_estendido',
    label: 'ESCOPO ESTENDIDO',
    texto: 'ESCOPO ESTENDIDO: Processos que excederem a complexidade média prevista no escopo contratual (ex: holdings patrimoniais com múltiplos imóveis a integralizar, sociedades anônimas com estrutura ampla, contratos extensos ou cláusulas atípicas) serão analisados caso a caso e poderão sofrer cobrança de honorário adicional, mediante orçamento prévio e aprovação por escrito da CONTRATANTE.',
  },
];

// Regras que vêm sempre ativas em proposta nova (Thales 26/05).
// FAST_TRACK e ALVARAS_600 ficam OPCIONAIS (Thales clica se quiser).
export const REGRAS_RAPIDAS_ATIVAS_DEFAULT: string[] = [
  'mat', 'troca_uf', 'doc_completa', 'taxas_fora', 'retrabalho', 'inadimplencia', 'lgpd', 'escopo_estendido',
];

// Renderiza texto completo das observações combinando regras rápidas + texto livre
export function montarObservacoesCompletas(
  regrasAtivas: string[],
  textoLivre: string,
): string {
  const regrasTexto = REGRAS_RAPIDAS_CATALOGO
    .filter((r) => regrasAtivas.includes(r.id))
    .map((r) => '• ' + r.texto)
    .join('\n');

  if (regrasTexto && textoLivre.trim()) {
    return `${regrasTexto}\n\n${textoLivre.trim()}`;
  }
  return regrasTexto || textoLivre.trim();
}

// ─── Cálculo ─────────────────────────────────────────────────────────────────

export interface CalculoTerceirizacao {
  valorBase: number;
  valorPro: number;
  totalMensalPro: number;
  detalhamentoAdicional: Array<{ label: string; valor: number }>;
}

export function calcularTerceirizacao(
  inclusos: ItemEditavel[],
  opts: {
    valorBaseMinimoOverride?: number;
    descontoProOverride?: number;
  } = {},
): CalculoTerceirizacao {
  const baseMinimo = opts.valorBaseMinimoOverride ?? VALOR_BASE_MINIMO;
  const ativos = inclusos.filter((i) => i.ativo);
  const adicional = ativos.reduce((s, i) => s + Number(i.valor ?? 0), 0);
  const valorBase = baseMinimo + adicional;

  const descPro = opts.descontoProOverride ?? PLANOS.pro_5.descontoPercent;
  const valorPro = Math.round(valorBase * (1 - descPro / 100));

  return {
    valorBase,
    valorPro,
    totalMensalPro: valorPro * PLANOS.pro_5.volumeProcessos,
    detalhamentoAdicional: ativos
      .filter((i) => (i.valor ?? 0) > 0)
      .map((i) => ({ label: i.label, valor: i.valor ?? 0 })),
  };
}

export function valorPrincipalPorModalidade(
  calc: CalculoTerceirizacao,
  modalidade: Modalidade,
  override?: number | null,
): number {
  if (override !== null && override !== undefined && override > 0) return override;
  switch (modalidade) {
    case 'pro_5':         return calc.totalMensalPro;
    case 'preco_por_tipo':return 0; // preço varia por tipo — exibido em outro lugar
    case 'avulso':
    case 'custom':        return calc.valorBase;
    default:              return calc.valorBase;
  }
}

// ─── Formatação ──────────────────────────────────────────────────────────────

export const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function gerarIdCustomizado(): string {
  return `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}
