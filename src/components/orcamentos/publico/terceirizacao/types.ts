/**
 * Tipos compartilhados entre TerceirizacaoPublicaView e seus sub-componentes.
 * Extraído do arquivo monolítico em 29/05 — refactor estrutural, sem mudança
 * de comportamento.
 */
import type { ItemEditavel, Modalidade, PrecosPorTipo } from '@/lib/terceirizacao-engine';

export interface OrcTerc {
  id: string;
  numero: number;
  status: string;
  prospect_nome: string;
  prospect_cnpj: string | null;
  prospect_contato: string | null;
  terc_modalidade: Modalidade;
  terc_servicos: ItemEditavel[];
  terc_naturezas: ItemEditavel[];
  terc_inclusos: ItemEditavel[];
  terc_valor_base: number;
  terc_valor_pro: number;
  terc_valor_final_override?: number | null;
  terc_valor_abertura?: number | null;
  terc_dia_pagamento?: number | null;
  terc_vencimento_tipo?: 'mensal_dia' | 'deferimento' | 'outros' | null;
  terc_vencimento_outros_texto?: string | null;
  terc_precos_por_tipo?: PrecosPorTipo | null;
  terc_regras_rapidas_ativas?: string[] | null;
  terc_observacoes_publicas?: string | null;
  terc_video_url?: string | null;
  terc_pdf_url?: string | null;
  validade_dias: number;
  created_at: string;
}

export interface VencProps {
  tipo?: 'mensal_dia' | 'deferimento' | 'outros' | null;
  dia?: number | null;
  texto?: string | null;
}
