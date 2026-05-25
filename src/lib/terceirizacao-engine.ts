/**
 * Engine de Terceirização — calculador de preços + tipos do MVP.
 * 25/05/2026: porta do app.web do Apps Script pra dentro do ERP.
 *
 * Lógica espelha o que Thales fazia ao vivo na reunião comercial:
 *  - Cada item incluso no escopo adiciona R$ X ao valor base
 *  - Desmarcar = remove R$ X (ex: tirar Alvarás = -200, tirar Inscrições = -100)
 *  - Modalidades aplicam desconto progressivo sobre o valor base
 *
 * Caso real reunião 23/02 com Edenilson (CONTADORIA):
 *  Base com tudo: R$ 880
 *  Removeu Inscrição Municipal/Estadual: -100 → 780
 *  Removeu Alvarás e Licenças: -200 → 580 (avulso final)
 *  PRO (5 proc, -15%): 493/un × 5 = 2.465/mês
 *  ENTERPRISE (10 proc, -20%): 464/un × 10 = 4.640/mês
 */

// ─── Catálogos ──────────────────────────────────────────────────────────────

export type ServicoSocietario =
  | 'abertura' | 'alteracao' | 'baixa' | 'transformacao'
  | 'cisao' | 'fusao' | 'incorporacao' | 'marcas_patentes';

export type NaturezaJuridica =
  | 'ltda' | 'slu' | 'mei' | 'ei'
  | 'sa' | 'fundacao' | 'osc' | 'consorcio';

export type ItemIncluso =
  | 'plataforma' | 'peticionamento' | 'minuta_padrao' | 'minuta_propria'
  | 'acompanhamento' | 'viabilidade' | 'dbe' | 'registro'
  | 'mat' | 'inscricao_mun_est' | 'alvaras' | 'conselho_classe';

export type Modalidade = 'avulso' | 'pro_5' | 'enterprise_10' | 'custom';

// ─── Labels pra UI (consistentes com a Proposta PDF) ───────────────────────

export const SERVICO_LABELS: Record<ServicoSocietario, string> = {
  abertura: 'Abertura',
  alteracao: 'Alteração',
  baixa: 'Baixa',
  transformacao: 'Transformação',
  cisao: 'Cisão',
  fusao: 'Fusão',
  incorporacao: 'Incorporação',
  marcas_patentes: 'Marcas e Patentes',
};

export const NATUREZA_LABELS: Record<NaturezaJuridica, string> = {
  ltda: 'LTDA',
  slu: 'SLU',
  mei: 'MEI',
  ei: 'EI',
  sa: 'S.A',
  fundacao: 'Fundação',
  osc: 'OSC',
  consorcio: 'Consórcio',
};

export interface ItemInclusoMeta {
  label: string;
  descricao: string;
  precoAdicional: number;  // R$ que esse item adiciona ao valor base
  obrigatorio?: boolean;   // se true, não pode desmarcar
}

export const ITEM_INCLUSO_META: Record<ItemIncluso, ItemInclusoMeta> = {
  plataforma: {
    label: 'Plataforma Trevo',
    descricao: 'Gestão e rastreabilidade integral do processo na plataforma própria da Trevo, com acesso ao status em tempo real.',
    precoAdicional: 0,
    obrigatorio: true,
  },
  peticionamento: {
    label: 'Peticionamento',
    descricao: 'Protocolo eletrônico ou físico de toda a documentação exigida pelo órgão registrador.',
    precoAdicional: 0,
    obrigatorio: true,
  },
  minuta_padrao: {
    label: 'Minuta Padrão Junta',
    descricao: 'Uso do modelo padrão da Junta Comercial (sem redação personalizada).',
    precoAdicional: 0,
  },
  minuta_propria: {
    label: 'Minuta Redação Própria',
    descricao: 'Elaboração de instrumento societário com redação personalizada, conforme necessidade específica do caso.',
    precoAdicional: 50,
  },
  acompanhamento: {
    label: 'Acompanhamento Deferimento',
    descricao: 'Monitoramento ativo até o deferimento final, com comunicação proativa sobre exigências ou pendências.',
    precoAdicional: 0,
    obrigatorio: true,
  },
  viabilidade: {
    label: 'Viabilidade',
    descricao: 'Consulta prévia de viabilidade de nome e atividade junto ao órgão competente antes do início do processo.',
    precoAdicional: 50,
  },
  dbe: {
    label: 'DBE',
    descricao: 'Preenchimento e envio do Documento Básico de Entrada junto à Receita Federal para obtenção ou atualização do CNPJ.',
    precoAdicional: 50,
  },
  registro: {
    label: 'Registro (Junta/Cartório)',
    descricao: 'Protocolo e acompanhamento do registro perante a Junta Comercial ou Cartório de Registro de Pessoas Jurídicas.',
    precoAdicional: 0,
    obrigatorio: true,
  },
  mat: {
    label: 'Módulo Adm. Tributária (MAT)',
    descricao: 'Pós-reforma tributária: informa regime tributário e coordena assinaturas para obtenção do CNPJ. Geralmente fica sob responsabilidade da Contabilidade.',
    precoAdicional: 80,
  },
  inscricao_mun_est: {
    label: 'Inscrição Municipal/Estadual',
    descricao: 'Habilitação da empresa nos cadastros municipal e/ou estadual para emissão de notas fiscais.',
    precoAdicional: 100,
  },
  alvaras: {
    label: 'Alvarás e Licenças',
    descricao: 'Solicitação e acompanhamento de alvarás de funcionamento e licenças necessárias para a operação.',
    precoAdicional: 200,
  },
  conselho_classe: {
    label: 'Conselho de Classe',
    descricao: 'Registro perante conselhos profissionais (CRM, CRO, OAB, etc.) quando aplicável à atividade.',
    precoAdicional: 50,
  },
};

// Valor mínimo independente do escopo (custo operacional fixo da Trevo)
export const VALOR_BASE_MINIMO = 380;

// Configuração dos planos
export interface PlanoConfig {
  modalidade: Modalidade;
  label: string;
  badge: string;
  volumeProcessos: number;   // 0 = avulso (sem volume)
  descontoPercent: number;   // 0 = avulso, 15 = PRO, 20 = ENTERPRISE
}

export const PLANOS: Record<Exclude<Modalidade, 'custom'>, PlanoConfig> = {
  avulso: {
    modalidade: 'avulso',
    label: 'Avulso — Pontual',
    badge: 'AVULSO — PONTUAL',
    volumeProcessos: 0,
    descontoPercent: 0,
  },
  pro_5: {
    modalidade: 'pro_5',
    label: 'Plano PRO',
    badge: 'PLANO PRO',
    volumeProcessos: 5,
    descontoPercent: 15,
  },
  enterprise_10: {
    modalidade: 'enterprise_10',
    label: 'Plano ENTERPRISE',
    badge: 'PLANO ENTERPRISE',
    volumeProcessos: 10,
    descontoPercent: 20,
  },
};

// ─── Cálculo ─────────────────────────────────────────────────────────────────

export interface CalculoTerceirizacao {
  valorBase: number;          // Avulso (preço por processo, sem desconto)
  valorPro: number;           // R$/un no PRO (com -15%)
  valorEnterprise: number;    // R$/un no ENTERPRISE (com -20%)
  totalMensalPro: number;     // valorPro × 5
  totalMensalEnterprise: number;  // valorEnterprise × 10
  itensSelecionados: ItemIncluso[];
  itensDesmarcados: ItemIncluso[];
}

export function calcularTerceirizacao(inclusos: ItemIncluso[]): CalculoTerceirizacao {
  // Soma valor base mínimo + adicional de cada item marcado
  const adicional = inclusos.reduce((soma, item) => {
    return soma + (ITEM_INCLUSO_META[item]?.precoAdicional ?? 0);
  }, 0);

  const valorBase = VALOR_BASE_MINIMO + adicional;

  const valorPro = Math.round(valorBase * (1 - PLANOS.pro_5.descontoPercent / 100));
  const valorEnterprise = Math.round(valorBase * (1 - PLANOS.enterprise_10.descontoPercent / 100));

  const todosItens = Object.keys(ITEM_INCLUSO_META) as ItemIncluso[];
  const itensDesmarcados = todosItens.filter((i) => !inclusos.includes(i));

  return {
    valorBase,
    valorPro,
    valorEnterprise,
    totalMensalPro: valorPro * PLANOS.pro_5.volumeProcessos,
    totalMensalEnterprise: valorEnterprise * PLANOS.enterprise_10.volumeProcessos,
    itensSelecionados: inclusos,
    itensDesmarcados,
  };
}

// ─── Defaults sensatos pra começar uma proposta nova ──────────────────────

export const SERVICOS_DEFAULT: ServicoSocietario[] = ['abertura', 'alteracao', 'baixa', 'transformacao'];
export const NATUREZAS_DEFAULT: NaturezaJuridica[] = ['ltda', 'slu', 'mei', 'ei'];
export const INCLUSOS_DEFAULT: ItemIncluso[] = [
  'plataforma',
  'peticionamento',
  'minuta_propria',
  'acompanhamento',
  'viabilidade',
  'dbe',
  'registro',
];

// ─── Formatação ──────────────────────────────────────────────────────────────

export const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
