export interface OrcamentoItem {
  id: string;
  secao: string;        // "obrigatorios" | "opcionais" | "geral" | custom
  ordem: number;
  descricao: string;
  detalhes: string;
  honorario: number;    // Custo Trevo
  honorario_contador: number; // legacy compat alias
  honorario_minimo_contador: number; // Mínimo sugerido para o contador cobrar
  valor_mercado: number;  // Referência de mercado
  valor_premium: number;  // Acima = caro
  taxa_min: number;
  taxa_max: number;
  prazo: string;
  docs_necessarios: string;
  quantidade: number;
  isOptional?: boolean; // false = obrigatório (default), true = opcional
  valorVendaDireto?: number; // valor de venda editável no modo direto (Trevo → Cliente Final)
  cenarioId?: string; // se undefined/null = item avulso (sem cenário)
  // legacy compat
  valor?: number;
}

export interface OrcamentoPacote {
  id: string;
  nome: string;
  itens_ids: string[];
  desconto_pct: number;
  descricao: string;
}

export interface OrcamentoSecao {
  key: string;
  label: string;
  descricao: string;
}

export interface CenarioOrcamento {
  id: string;
  nome: string;        // ex: "Opção 1 — Subsidiária Brasileira"
  descricao?: string;   // ex: "Ágil, econômica; ideal para holdings/comércio"
  ordem: number;        // 1, 2, 3...
}

export interface RiscoOperacao {
  id: string;
  penalidade: string;
  condicao?: string;
}

export interface EtapaFluxo {
  id: string;
  nome: string;
  prazo?: string;
  ordem: number;
}

export interface BeneficioCapa {
  id: string;
  titulo: string;
  descricao: string;
}

export type OrcamentoModo = 'simples' | 'detalhado';
export type OrcamentoPDFMode = 'contador' | 'cliente' | 'direto';
export type OrcamentoDestinatario = 'contador' | 'cliente_via_contador' | 'cliente_direto';

export interface OrcamentoForm {
  destinatario: OrcamentoDestinatario;
  prospect_nome: string;
  prospect_cnpj: string;
  prospect_email: string;
  prospect_telefone: string;
  prospect_contato: string;
  escritorio_nome: string;
  escritorio_cnpj: string;
  escritorio_email: string;
  escritorio_telefone: string;
  cliente_id: string | null;
  modo: OrcamentoModo;
  contexto: string;
  ordem_execucao: string;
  itens: OrcamentoItem[];
  pacotes: OrcamentoPacote[];
  secoes: OrcamentoSecao[];
  desconto_pct: number;
  validade_dias: number;
  prazo_execucao: string;
  pagamento: string;
  observacoes: string;
  // Dynamic fields
  headline_cenario: string;
  riscos: RiscoOperacao[];
  beneficios_capa: BeneficioCapa[];
  etapas_fluxo: EtapaFluxo[];
  cenarios: CenarioOrcamento[];
  senha_link: string;
}

export const DEFAULT_SECOES: OrcamentoSecao[] = [
  { key: 'geral', label: 'Geral', descricao: '' },
  { key: 'obrigatorios', label: 'Itens Obrigatórios', descricao: 'Serviços necessários para regularização' },
  { key: 'opcionais', label: 'Itens Opcionais', descricao: 'Serviços complementares recomendados' },
];

export function createItem(overrides?: Partial<OrcamentoItem>): OrcamentoItem {
  return {
    id: crypto.randomUUID(),
    secao: 'geral',
    ordem: 0,
    descricao: '',
    detalhes: '',
    honorario: 0,
    honorario_contador: 0,
    honorario_minimo_contador: 0,
    valor_mercado: 0,
    valor_premium: 0,
    taxa_min: 0,
    taxa_max: 0,
    prazo: '',
    docs_necessarios: '',
    quantidade: 1,
    isOptional: false,
    ...overrides,
  };
}

export function createPacote(): OrcamentoPacote {
  return {
    id: crypto.randomUUID(),
    nome: '',
    itens_ids: [],
    desconto_pct: 0,
    descricao: '',
  };
}

/** Get item value: uses honorario for new format, falls back to valor for legacy */
export function getItemValor(item: OrcamentoItem): number {
  return item.honorario || item.valor || 0;
}

/** Normalize legacy items (old format) to new format */
export function normalizeItem(raw: any): OrcamentoItem {
  return {
    id: raw.id || crypto.randomUUID(),
    secao: raw.secao || 'geral',
    ordem: raw.ordem || 0,
    descricao: raw.descricao || '',
    detalhes: raw.detalhes || '',
    honorario: Number(raw.honorario) || Number(raw.valor) || 0,
    honorario_contador: Number(raw.honorario_contador) || 0,
    honorario_minimo_contador: Number(raw.honorario_minimo_contador) || Number(raw.honorario_contador) || 0,
    valor_mercado: Number(raw.valor_mercado) || 0,
    valor_premium: Number(raw.valor_premium) || 0,
    taxa_min: Number(raw.taxa_min) || 0,
    taxa_max: Number(raw.taxa_max) || 0,
    prazo: raw.prazo || '',
    docs_necessarios: raw.docs_necessarios || '',
    quantidade: Number(raw.quantidade) || 1,
    isOptional: raw.isOptional === true,
    valorVendaDireto: raw.valorVendaDireto != null ? Number(raw.valorVendaDireto) : undefined,
    cenarioId: raw.cenarioId || undefined,
    valor: Number(raw.valor) || undefined,
  };
}
