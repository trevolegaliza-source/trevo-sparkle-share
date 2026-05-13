export type ProcessType = 'abertura' | 'alteracao' | 'transformacao' | 'baixa' | 'avulso' | 'orcamento';

// DECISION-001 Fase 3 (13/05/2026 noite): etapa simplificada pra binário.
// Banco migrado pra text aceitando só ('ativo','finalizado') via CHECK.
// Frontend continua tolerante a valores legados ('recebidos','registro',
// 'finalizados','arquivo','concluido') pra cobrir a janela entre Publish
// e SQL e snapshots históricos.
export type KanbanStage = 'ativo' | 'finalizado';

export const KANBAN_STAGES: { key: KanbanStage; label: string }[] = [
  { key: 'ativo', label: 'Ativo' },
  { key: 'finalizado', label: 'Finalizado' },
];

// Lista exaustiva de valores que indicam "processo finalizado" — inclui
// canônico novo ('finalizado') + valores legados pra tolerância durante
// migração e snapshots históricos.
export const ETAPAS_FINALIZADAS_RAW = [
  'finalizado',
  'finalizados',
  'arquivo',
  'concluido',
] as const;

// String pronta pra usar em filtros Supabase:
//   .not('etapa', 'in', ETAPAS_FINALIZADAS_SQL_IN)
//   .in('etapa', ETAPAS_FINALIZADAS_SQL_IN)
export const ETAPAS_FINALIZADAS_SQL_IN = '("finalizado","finalizados","arquivo","concluido")';

/** Resolve etapa (canônica ou legada) pra label 'Ativo' / 'Finalizado'. */
export function getEtapaSimplificada(etapa: string | null | undefined): 'Ativo' | 'Finalizado' {
  if (!etapa) return 'Ativo';
  return (ETAPAS_FINALIZADAS_RAW as readonly string[]).includes(etapa) ? 'Finalizado' : 'Ativo';
}

/** Resolve etapa pra valor canônico 'ativo' | 'finalizado'. */
export function etapaCanonica(etapa: string | null | undefined): KanbanStage {
  if (!etapa) return 'ativo';
  return (ETAPAS_FINALIZADAS_RAW as readonly string[]).includes(etapa) ? 'finalizado' : 'ativo';
}

/** True se o processo está finalizado, considerando valores legados. */
export function isProcessoFinalizado(etapa: string | null | undefined): boolean {
  return etapaCanonica(etapa) === 'finalizado';
}

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
