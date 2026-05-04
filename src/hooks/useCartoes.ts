// ===========================================================================
// Hooks de Cartão (cadastro, compras, faturas)
// Demanda Thales 04/05/2026: entidade nativa de cartão de crédito.
// ===========================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Cartao {
  id: string;
  empresa_id: string | null;
  nome: string;
  bandeira: string | null;
  ultimos_4: string | null;
  dia_fechamento: number;
  dia_vencimento: number;
  limite: number | null;
  ativo: boolean;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CartaoCompra {
  id: string;
  empresa_id: string | null;
  cartao_id: string;
  data_compra: string;
  descricao: string;
  fornecedor: string | null;
  valor_total: number;
  parcelas_total: number;
  parcela_numero: number;
  valor_parcela: number;
  fatura_vencimento: string;
  categoria: string | null;
  centro_custo: string | null;
  observacoes: string | null;
  compra_grupo_id: string | null;
  cartao_fatura_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CartaoFatura {
  id: string;
  empresa_id: string | null;
  cartao_id: string;
  data_fechamento: string;
  data_vencimento: string;
  valor_total: number;
  status: 'aberta' | 'fechada' | 'paga';
  lancamento_id: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Cartões
// ---------------------------------------------------------------------------

export function useCartoes() {
  return useQuery({
    queryKey: ['cartoes'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cartoes')
        .select('*')
        .order('ativo', { ascending: false })
        .order('nome', { ascending: true });
      if (error) throw error;
      return (data || []) as Cartao[];
    },
  });
}

export function useCreateCartao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Partial<Cartao>) => {
      const { error, data } = await supabase
        .from('cartoes')
        .insert(values as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cartoes'] });
      toast.success('Cartão cadastrado!');
    },
    onError: (e: any) => toast.error('Erro ao cadastrar cartão: ' + e.message),
  });
}

export function useUpdateCartao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<Cartao> & { id: string }) => {
      const { error } = await supabase
        .from('cartoes')
        .update(values as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cartoes'] });
      toast.success('Cartão atualizado!');
    },
    onError: (e: any) => toast.error('Erro ao atualizar cartão: ' + e.message),
  });
}

export function useDeleteCartao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Soft-delete via flag ativo=false (preserva compras históricas).
      // Hard-delete fica fora do escopo da Fase 1 — exige confirmar que
      // não há fatura paga vinculada.
      const { error } = await supabase
        .from('cartoes')
        .update({ ativo: false } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cartoes'] });
      toast.success('Cartão arquivado.');
    },
    onError: (e: any) => toast.error('Erro ao arquivar: ' + e.message),
  });
}

// ---------------------------------------------------------------------------
// Compras
// ---------------------------------------------------------------------------

/**
 * Compras de um cartão, opcionalmente filtradas por mês de fatura.
 * fatura_vencimento_mes formato 'YYYY-MM' — null = todas.
 */
export function useCartaoCompras(cartaoId: string | null, faturaVencimentoMes?: string | null) {
  return useQuery({
    queryKey: ['cartao_compras', cartaoId, faturaVencimentoMes ?? 'all'],
    enabled: !!cartaoId,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      let q = supabase.from('cartao_compras').select('*').eq('cartao_id', cartaoId!);
      if (faturaVencimentoMes) {
        const start = `${faturaVencimentoMes}-01`;
        const [yy, mm] = faturaVencimentoMes.split('-').map(Number);
        const end = mm === 12
          ? `${yy + 1}-01-01`
          : `${yy}-${String(mm + 1).padStart(2, '0')}-01`;
        q = q.gte('fatura_vencimento', start).lt('fatura_vencimento', end);
      }
      const { data, error } = await q.order('data_compra', { ascending: false });
      if (error) throw error;
      return (data || []) as CartaoCompra[];
    },
  });
}

export function useCreateCompra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: Partial<CartaoCompra>[]) => {
      // Aceita 1+ rows (parcelado = N rows com mesmo compra_grupo_id).
      const { error } = await supabase.from('cartao_compras').insert(rows as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cartao_compras'] });
      qc.invalidateQueries({ queryKey: ['cartao_faturas'] });
      toast.success('Compra lançada!');
    },
    onError: (e: any) => toast.error('Erro ao lançar compra: ' + e.message),
  });
}

export function useUpdateCompra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<CartaoCompra> & { id: string }) => {
      const { error } = await supabase
        .from('cartao_compras')
        .update(values as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cartao_compras'] });
      qc.invalidateQueries({ queryKey: ['cartao_faturas'] });
      toast.success('Compra atualizada!');
    },
    onError: (e: any) => toast.error('Erro ao atualizar: ' + e.message),
  });
}

export function useDeleteCompra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cartao_compras').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cartao_compras'] });
      qc.invalidateQueries({ queryKey: ['cartao_faturas'] });
      toast.success('Compra removida.');
    },
    onError: (e: any) => toast.error('Erro ao remover: ' + e.message),
  });
}

/**
 * Deleta TODAS as parcelas de uma mesma compra (usa compra_grupo_id).
 * Útil quando usuário cria parcelado errado e quer reverter.
 */
export function useDeleteCompraGrupo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (compraGrupoId: string) => {
      const { error } = await supabase
        .from('cartao_compras')
        .delete()
        .eq('compra_grupo_id', compraGrupoId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cartao_compras'] });
      qc.invalidateQueries({ queryKey: ['cartao_faturas'] });
      toast.success('Compra (todas as parcelas) removida.');
    },
    onError: (e: any) => toast.error('Erro ao remover: ' + e.message),
  });
}

// ---------------------------------------------------------------------------
// Faturas
// ---------------------------------------------------------------------------

export function useCartaoFaturas(cartaoId: string | null) {
  return useQuery({
    queryKey: ['cartao_faturas', cartaoId],
    enabled: !!cartaoId,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cartao_faturas')
        .select('*')
        .eq('cartao_id', cartaoId!)
        .order('data_vencimento', { ascending: false });
      if (error) throw error;
      return (data || []) as CartaoFatura[];
    },
  });
}

/**
 * Status REAL de uma fatura, lendo o lançamento associado.
 * Retorna: 'aberta' (sem fatura ainda), 'pendente' (fechada, lancamento
 * pendente), 'paga' (lancamento pago).
 *
 * Usa querry agregada: pega cartao_faturas + lancamentos de uma vez.
 */
export type FaturaStatusReal = 'aberta' | 'pendente' | 'paga';

export interface FaturaConsolidada {
  fatura: CartaoFatura | null;
  lancamento: { id: string; status: string; data_pagamento: string | null } | null;
  statusReal: FaturaStatusReal;
}

export function useFaturaConsolidada(
  cartaoId: string | null,
  dataVencimento: string | null
) {
  return useQuery({
    queryKey: ['fatura_consolidada', cartaoId, dataVencimento],
    enabled: !!cartaoId && !!dataVencimento,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<FaturaConsolidada> => {
      const { data: faturaData, error: fatErr } = await supabase
        .from('cartao_faturas')
        .select('*')
        .eq('cartao_id', cartaoId!)
        .eq('data_vencimento', dataVencimento!)
        .maybeSingle();
      if (fatErr) throw fatErr;
      const fatura = (faturaData as CartaoFatura | null) ?? null;

      if (!fatura) return { fatura: null, lancamento: null, statusReal: 'aberta' };
      if (!fatura.lancamento_id) {
        return { fatura, lancamento: null, statusReal: 'pendente' };
      }

      const { data: lancData } = await supabase
        .from('lancamentos')
        .select('id, status, data_pagamento')
        .eq('id', fatura.lancamento_id)
        .maybeSingle();

      if (!lancData) {
        // Lançamento foi deletado em Contas a Pagar — fatura está órfã.
        return { fatura, lancamento: null, statusReal: 'pendente' };
      }

      const statusReal: FaturaStatusReal =
        lancData.status === 'pago' ? 'paga' : 'pendente';

      return { fatura, lancamento: lancData as any, statusReal };
    },
  });
}

/**
 * Fecha uma fatura: cria row em cartao_faturas + cria lançamento em
 * Contas a Pagar + vincula todas as compras do mês.
 *
 * Não é transacional (Supabase JS não tem tx multi-tabela). Se a 2ª chamada
 * falhar, deixa estado parcial. Operação é idempotente o suficiente para
 * o user reexecutar.
 */
export function useFecharFatura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      cartaoId: string;
      cartaoNome: string;
      dataFechamento: string;
      dataVencimento: string;
      valorTotal: number;
      compraIds: string[];
    }) => {
      const {
        cartaoId, cartaoNome, dataFechamento, dataVencimento, valorTotal, compraIds,
      } = params;

      if (!compraIds.length) throw new Error('Fatura sem compras para fechar.');

      // 1) Cria a fatura
      const { data: faturaCriada, error: fatErr } = await supabase
        .from('cartao_faturas')
        .insert({
          cartao_id: cartaoId,
          data_fechamento: dataFechamento,
          data_vencimento: dataVencimento,
          valor_total: valorTotal,
          status: 'fechada',
        } as any)
        .select()
        .single();
      if (fatErr) throw fatErr;
      const faturaId = (faturaCriada as any).id;

      // 2) Cria o lançamento em Contas a Pagar
      const dVenc = new Date(dataVencimento + 'T12:00:00');
      const mesAno = dVenc.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      const { data: lancCriado, error: lancErr } = await supabase
        .from('lancamentos')
        .insert({
          tipo: 'pagar',
          status: 'pendente',
          descricao: `Fatura ${cartaoNome} · ${mesAno}`,
          fornecedor: cartaoNome,
          valor: valorTotal,
          data_vencimento: dataVencimento,
          competencia_mes: dVenc.getMonth() + 1,
          competencia_ano: dVenc.getFullYear(),
          categoria: 'infraestrutura',
          subcategoria: 'Cartão de Crédito',
        } as any)
        .select('id')
        .single();
      if (lancErr) throw lancErr;
      const lancamentoId = (lancCriado as any).id;

      // 3) Atualiza fatura com lancamento_id
      await supabase
        .from('cartao_faturas')
        .update({ lancamento_id: lancamentoId } as any)
        .eq('id', faturaId);

      // 4) Vincula todas as compras
      await supabase
        .from('cartao_compras')
        .update({ cartao_fatura_id: faturaId } as any)
        .in('id', compraIds);

      return { faturaId, lancamentoId };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cartao_faturas'] });
      qc.invalidateQueries({ queryKey: ['cartao_compras'] });
      qc.invalidateQueries({ queryKey: ['fatura_consolidada'] });
      qc.invalidateQueries({ queryKey: ['lancamentos_pagar'] });
      qc.invalidateQueries({ queryKey: ['lancamentos_pagar_date'] });
      toast.success('Fatura fechada! Lançamento criado em Contas a Pagar.');
    },
    onError: (e: any) => toast.error('Erro ao fechar fatura: ' + e.message),
  });
}

/**
 * Reabre uma fatura: deleta o lançamento + a row de cartao_faturas +
 * desvincula as compras. Bloqueia se lançamento já foi pago.
 */
export function useReabrirFatura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { faturaId: string; lancamentoId: string | null }) => {
      const { faturaId, lancamentoId } = params;

      if (lancamentoId) {
        // Verifica se já foi pago
        const { data: lanc } = await supabase
          .from('lancamentos')
          .select('status')
          .eq('id', lancamentoId)
          .maybeSingle();
        if (lanc && (lanc as any).status === 'pago') {
          throw new Error('Fatura já foi paga. Desfaça o pagamento em Contas a Pagar primeiro.');
        }
        // Apaga o lançamento
        await supabase.from('lancamentos').delete().eq('id', lancamentoId);
      }

      // Desvincula compras
      await supabase
        .from('cartao_compras')
        .update({ cartao_fatura_id: null } as any)
        .eq('cartao_fatura_id', faturaId);

      // Apaga a fatura
      const { error } = await supabase.from('cartao_faturas').delete().eq('id', faturaId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cartao_faturas'] });
      qc.invalidateQueries({ queryKey: ['cartao_compras'] });
      qc.invalidateQueries({ queryKey: ['fatura_consolidada'] });
      qc.invalidateQueries({ queryKey: ['lancamentos_pagar'] });
      qc.invalidateQueries({ queryKey: ['lancamentos_pagar_date'] });
      toast.success('Fatura reaberta. Compras voltaram para o status aberto.');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao reabrir fatura.'),
  });
}
