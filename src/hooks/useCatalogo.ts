import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ServicosCatalogo {
  id: string;
  nome: string;
  categoria: string;
  descricao: string | null;
  prazo_estimado: string | null;
  ativo: boolean;
  created_at: string | null;
  precos?: PrecoUF[];
}

export interface PrecoUF {
  id: string;
  servico_id: string;
  uf: string;
  honorario_trevo: number;
  taxa_orgao: number;
  prazo_estimado: string | null;
  observacoes: string | null;
}

export function useServicos() {
  return useQuery({
    queryKey: ['catalogo_servicos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('catalogo_servicos')
        .select('*')
        .order('categoria', { ascending: true })
        .order('nome', { ascending: true });
      if (error) throw error;
      return data as ServicosCatalogo[];
    },
  });
}

export function usePrecosUF(servicoId: string | null) {
  return useQuery({
    queryKey: ['catalogo_precos_uf', servicoId],
    queryFn: async () => {
      if (!servicoId) return [];
      const { data, error } = await supabase
        .from('catalogo_precos_uf')
        .select('*')
        .eq('servico_id', servicoId)
        .order('uf', { ascending: true });
      if (error) throw error;
      return data as PrecoUF[];
    },
    enabled: !!servicoId,
  });
}

export function useCreateServico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (servico: { nome: string; categoria: string; descricao?: string; prazo_estimado?: string }) => {
      const { data, error } = await supabase
        .from('catalogo_servicos')
        .insert(servico as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalogo_servicos'] });
      toast.success('Serviço cadastrado!');
    },
    onError: (err: any) => toast.error('Erro: ' + err.message),
  });
}

export function useUpdateServico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ServicosCatalogo> }) => {
      const { error } = await supabase
        .from('catalogo_servicos')
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalogo_servicos'] });
      toast.success('Serviço atualizado!');
    },
    onError: (err: any) => toast.error('Erro: ' + err.message),
  });
}

export function useDeleteServico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('catalogo_servicos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalogo_servicos'] });
      toast.success('Serviço excluído!');
    },
    onError: (err: any) => toast.error('Erro: ' + err.message),
  });
}

export function useUpsertPrecoUF() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (preco: { servico_id: string; uf: string; honorario_trevo: number; taxa_orgao: number; prazo_estimado?: string; observacoes?: string }) => {
      const { data, error } = await supabase
        .from('catalogo_precos_uf')
        .upsert(preco as any, { onConflict: 'servico_id,uf' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['catalogo_precos_uf', variables.servico_id] });
      toast.success('Preço salvo!');
    },
    onError: (err: any) => toast.error('Erro: ' + err.message),
  });
}

export function useDeletePrecoUF() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, servicoId }: { id: string; servicoId: string }) => {
      const { error } = await supabase.from('catalogo_precos_uf').delete().eq('id', id);
      if (error) throw error;
      return servicoId;
    },
    onSuccess: (servicoId) => {
      qc.invalidateQueries({ queryKey: ['catalogo_precos_uf', servicoId] });
      toast.success('Preço removido!');
    },
    onError: (err: any) => toast.error('Erro: ' + err.message),
  });
}

export const CATEGORIAS_SERVICO = [
  { value: 'abertura', label: 'Abertura de Empresa' },
  { value: 'alteracao', label: 'Alteração Contratual' },
  { value: 'transformacao', label: 'Transformação Societária' },
  { value: 'baixa', label: 'Encerramento / Baixa' },
  { value: 'licenca', label: 'Licenças e Alvarás' },
  { value: 'certidao', label: 'Certidões' },
  { value: 'regularizacao', label: 'Regularização' },
  { value: 'registros_especiais', label: 'Registros Especiais' },
  { value: 'marcas_patentes', label: 'Marcas e Patentes' },
  { value: 'cartorario', label: 'Serviços Cartorários' },
  { value: 'consultoria', label: 'Consultoria Societária' },
  { value: 'recorrentes', label: 'Serviços Recorrentes' },
  { value: 'outros', label: 'Outros Serviços' },
] as const;
