export type ProcessType = 'abertura' | 'alteracao' | 'transformacao' | 'baixa' | 'avulso' | 'orcamento';

export type KanbanStage =
  | 'recebidos'
  | 'analise_documental'
  | 'contrato'
  | 'viabilidade'
  | 'dbe'
  | 'vre'
  | 'aguardando_pagamento'
  | 'taxa_paga'
  | 'assinaturas'
  | 'assinado'
  | 'em_analise'
  | 'registro'
  | 'mat'
  | 'inscricao_me'
  | 'alvaras'
  | 'conselho'
  | 'finalizados'
  | 'arquivo';

export const KANBAN_STAGES: { key: KanbanStage; label: string }[] = [
  { key: 'recebidos', label: 'Recebidos' },
  { key: 'analise_documental', label: 'Análise Documental' },
  { key: 'contrato', label: 'Contrato' },
  { key: 'viabilidade', label: 'Viabilidade' },
  { key: 'dbe', label: 'DBE' },
  { key: 'vre', label: 'VRE' },
  { key: 'aguardando_pagamento', label: 'Aguardando Pagamento' },
  { key: 'taxa_paga', label: 'Taxa Paga' },
  { key: 'assinaturas', label: 'Assinaturas' },
  { key: 'assinado', label: 'Assinado' },
  { key: 'em_analise', label: 'Em Análise' },
  { key: 'registro', label: 'Registro' },
  { key: 'mat', label: 'MAT' },
  { key: 'inscricao_me', label: 'Inscrição M/E' },
  { key: 'alvaras', label: 'Alvarás' },
  { key: 'conselho', label: 'Conselho' },
  { key: 'finalizados', label: 'Finalizados' },
  { key: 'arquivo', label: 'Arquivo' },
];

export const PROCESS_TYPE_LABELS: Record<ProcessType, string> = {
  abertura: 'Abertura',
  alteracao: 'Alteração',
  transformacao: 'Transformação',
  baixa: 'Baixa',
  avulso: 'Avulso',
  orcamento: 'Orçamento',
};

export interface Process {
  id: string;
  client_name: string;
  company_name: string;
  process_type: ProcessType;
  stage: KanbanStage;
  created_at: string;
  updated_at: string;
  priority: 'normal' | 'urgente';
  responsible?: string;
  notes?: string;
  value?: number;
}

export interface Client {
  id: string;
  name: string;
  type: 'avulso' | 'mensalista';
  email: string;
  phone: string;
  total_processes: number;
  active_processes: number;
}
