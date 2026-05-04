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
