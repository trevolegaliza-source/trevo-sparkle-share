export type ClienteTipoDB = 'MENSALISTA' | 'AVULSO_4D' | 'PRE_PAGO';
export type MomentoFaturamento = 'na_solicitacao' | 'no_deferimento';
export type TipoDesconto = 'progressivo' | 'cumulativo' | 'composto';

export interface Cliente {
  id: string;
  codigo_identificador: string;
  nome: string;
  cnpj: string | null;
  tipo: ClienteTipoDB;
  email: string | null;
  telefone: string | null;
  nome_contador: string;
  apelido: string;
  dia_vencimento_mensal: number;
  momento_faturamento: MomentoFaturamento;
  observacoes?: string | null;
  contrato_url?: string | null;
  valor_base: number | null;
  desconto_progressivo: number | null;
  dia_cobranca: number | null;
  valor_limite_desconto: number | null;
  tipo_desconto: TipoDesconto | null;
  mensalidade: number | null;
  vencimento: number | null;
  qtd_processos: number | null;
  is_archived?: boolean;
  // Endereço
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  latitude: number | null;
  longitude: number | null;
  // Pré-Pago
  saldo_prepago: number;
  saldo_ultima_recarga: number;
  data_ultima_recarga: string | null;
  // Mensalista
  franquia_processos: number;
  // Boas-vindas
  desconto_boas_vindas_aplicado: boolean;
  created_at: string;
  updated_at: string;
}

export type ClienteInsert = Omit<Cliente, 'id' | 'created_at' | 'updated_at' | 'valor_base' | 'desconto_progressivo' | 'dia_cobranca' | 'valor_limite_desconto' | 'mensalidade' | 'vencimento' | 'qtd_processos' | 'tipo_desconto' | 'is_archived' | 'saldo_prepago' | 'saldo_ultima_recarga' | 'data_ultima_recarga' | 'franquia_processos' | 'desconto_boas_vindas_aplicado'> & {
  valor_base?: number | null;
  desconto_progressivo?: number | null;
  dia_cobranca?: number | null;
  valor_limite_desconto?: number | null;
  tipo_desconto?: TipoDesconto | null;
  mensalidade?: number | null;
  vencimento?: number | null;
  qtd_processos?: number | null;
  saldo_prepago?: number;
  franquia_processos?: number;
};
export type ClienteUpdate = Partial<ClienteInsert> & { updated_at?: string };

export interface PrepagoMovimentacao {
  id: string;
  cliente_id: string;
  tipo: 'recarga' | 'consumo';
  valor: number;
  saldo_anterior: number;
  saldo_posterior: number;
  descricao: string;
  processo_id: string | null;
  created_at: string;
}
