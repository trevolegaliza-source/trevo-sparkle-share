import type { ProcessoDB } from '@/types/financial';

export interface DeferimentoAlertData {
  clienteNome: string;
  naoDeferidos: ProcessoDB[];
  todosSelecionados: ProcessoDB[];
}

export interface ProcessoFormState {
  razao_social: string;
  tipo: string;
  prioridade: string;
  responsavel: string;
  valor_manual: string;
  definir_manual: boolean;
  negotiated_service_id: string;
  mudanca_uf: boolean;
  boas_vindas: boolean;
  boas_vindas_pct: string;
  ja_pago: boolean;
  observacoes: string;
  motivo_manual: string;
  data_entrada: string;
  dentro_do_plano: boolean;
  valor_avulso: number;
  justificativa_avulso: string;
}

export interface DescontoPreview {
  slot: number;
  valor: number;
  desconto: number;
  label: string;
}
