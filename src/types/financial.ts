import type { Cliente as SupabaseCliente } from '@/types/supabase';

export type TipoCliente = 'MENSALISTA' | 'AVULSO_4D' | 'PRE_PAGO' | 'PRECO_POR_TIPO';
export type TipoProcesso = 'abertura' | 'alteracao' | 'transformacao' | 'baixa' | 'avulso' | 'orcamento';
export type StatusFinanceiro = 'pendente' | 'pago' | 'atrasado' | 'cancelado';
export type TipoLancamento = 'receber' | 'pagar';

export interface ClienteDB extends SupabaseCliente {}

export interface ProcessoDB {
  id: string;
  cliente_id: string;
  razao_social: string;
  tipo: TipoProcesso;
  etapa: string;
  prioridade: string;
  responsavel: string | null;
  valor: number | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
  cliente?: ClienteDB;
  dentro_do_plano?: boolean | null;
  valor_avulso?: number | null;
  justificativa_avulso?: string | null;
  link_drive?: string | null;
}

export type EtapaFinanceiro =
  | 'aguardando_deferimento' // 0. Cliente no_deferimento — só pode cobrar após processo deferido
  | 'solicitacao_criada'    // 1. Faturar — precisa gerar extrato
  | 'cobranca_gerada'       // 2. Enviar — extrato gerado, enviar ao cliente
  | 'cobranca_enviada'      // 3. Aguardando — cobrança enviada, aguardar pagamento
  | 'honorario_pago'        // 4. Pago — concluído
  | 'honorario_vencido';    // Vencido — recobrança

export const ETAPA_FINANCEIRO_LABELS: Record<EtapaFinanceiro, string> = {
  aguardando_deferimento: 'Aguardando deferimento',
  solicitacao_criada: 'Faturar',
  cobranca_gerada: 'Enviar',
  cobranca_enviada: 'Aguardando',
  honorario_pago: 'Pago',
  honorario_vencido: 'Vencido',
};

export const ETAPA_FINANCEIRO_COLORS: Record<EtapaFinanceiro, string> = {
  aguardando_deferimento: 'border-amber-500/40',
  solicitacao_criada: 'border-warning',
  cobranca_gerada: 'border-info',
  cobranca_enviada: 'border-muted-foreground/40',
  honorario_pago: 'border-success',
  honorario_vencido: 'border-destructive',
};

export const ETAPA_FINANCEIRO_ORDER: EtapaFinanceiro[] = [
  'aguardando_deferimento',
  'solicitacao_criada',
  'cobranca_gerada',
  'cobranca_enviada',
  'honorario_pago',
  'honorario_vencido',
];

export interface Lancamento {
  id: string;
  tipo: TipoLancamento;
  cliente_id: string | null;
  processo_id: string | null;
  descricao: string;
  valor: number;
  status: StatusFinanceiro;
  data_vencimento: string;
  data_pagamento: string | null;
  is_taxa_reembolsavel: boolean;
  comprovante_url: string | null;
  categoria: string | null;
  etapa_financeiro: EtapaFinanceiro;
  honorario_extra: number;
  cobranca_encaminhada: boolean;
  confirmado_recebimento: boolean;
  observacoes_financeiro: string | null;
  boleto_url: string | null;
  url_comprovante: string | null;
  url_recibo_taxa: string | null;
  created_at: string;
  updated_at: string;
  cliente?: ClienteDB;
  processo?: ProcessoDB;
}

export interface PrecoTier {
  id: string;
  tipo_processo: TipoProcesso;
  tier: number;
  valor: number;
  descricao: string | null;
}

export const TIPO_PROCESSO_LABELS: Record<TipoProcesso, string> = {
  abertura: 'Abertura',
  alteracao: 'Alteração',
  transformacao: 'Transformação',
  baixa: 'Baixa',
  avulso: 'Avulso',
  orcamento: 'Orçamento',
};

export const STATUS_LABELS: Record<StatusFinanceiro, string> = {
  pendente: 'Pendente',
  pago: 'Pago',
  atrasado: 'Atrasado',
  cancelado: 'Cancelado',
};

export const STATUS_STYLES: Record<StatusFinanceiro, string> = {
  pago: 'bg-success/10 text-success',
  pendente: 'bg-warning/10 text-warning',
  atrasado: 'bg-destructive/10 text-destructive',
  cancelado: 'bg-muted text-muted-foreground',
};
