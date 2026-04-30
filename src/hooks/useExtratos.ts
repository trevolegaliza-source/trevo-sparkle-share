import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { empresaPath } from '@/lib/storage-path';

export interface Extrato {
  id: string;
  cliente_id: string;
  pdf_url: string;
  filename: string;
  total_honorarios: number;
  total_taxas: number;
  total_geral: number;
  qtd_processos: number;
  processo_ids: string[];
  competencia_mes: number;
  competencia_ano: number;
  status: string;
  enviado: boolean;
  data_envio: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export function useExtratos(clienteId?: string) {
  const queryClient = useQueryClient();

  const extratosQuery = useQuery({
    queryKey: ['extratos', clienteId],
    queryFn: async () => {
      if (!clienteId) return [];
      const { data, error } = await supabase
        .from('extratos' as any)
        .select('*')
        .eq('cliente_id', clienteId)
        .eq('status', 'ativo')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Extrato[];
    },
    enabled: !!clienteId,
  });

  const salvarExtrato = useMutation({
    mutationFn: async (input: {
      clienteId: string;
      pdfBlob: Blob;
      filename: string;
      totalHonorarios: number;
      totalTaxas: number;
      totalGeral: number;
      processoIds: string[];
      competenciaMes: number;
      competenciaAno: number;
    }) => {
      const path = await empresaPath(`extratos/${input.clienteId}/${input.filename}`);
      const { error: uploadError } = await supabase.storage
        .from('documentos')
        .upload(path, input.pdfBlob, {
          contentType: 'application/pdf',
          upsert: true,
        });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('documentos')
        .getPublicUrl(path);

      const { data: extrato, error: insertError } = await supabase
        .from('extratos' as any)
        .insert({
          cliente_id: input.clienteId,
          pdf_url: urlData.publicUrl,
          filename: input.filename,
          total_honorarios: input.totalHonorarios,
          total_taxas: input.totalTaxas,
          total_geral: input.totalGeral,
          qtd_processos: input.processoIds.length,
          processo_ids: input.processoIds,
          competencia_mes: input.competenciaMes,
          competencia_ano: input.competenciaAno,
          status: 'ativo',
        } as any)
        .select()
        .single();
      if (insertError) throw insertError;

      const extratoTyped = extrato as unknown as Extrato;

      // Vincular lançamentos ao extrato (NÃO sobrescrever observacoes_financeiro;
      // esse campo é exclusivo do operador — metadata de extrato não vai pra lá)
      for (const pid of input.processoIds) {
        await supabase
          .from('lancamentos')
          .update({
            extrato_id: extratoTyped.id,
            etapa_financeiro: 'cobranca_gerada',
          } as any)
          .eq('processo_id', pid)
          .eq('tipo', 'receber');
      }

      return extratoTyped;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extratos'] });
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
      queryClient.invalidateQueries({ queryKey: ['lancamentos_receber'] });
      queryClient.invalidateQueries({ queryKey: ['processos_financeiro'] });
      toast.success('Extrato salvo no sistema!');
    },
    onError: (e: Error) => toast.error('Erro ao salvar extrato: ' + e.message),
  });

  const excluirExtrato = useMutation({
    mutationFn: async (extratoId: string) => {
      const { data: extrato } = await supabase
        .from('extratos' as any)
        .select('*')
        .eq('id', extratoId)
        .single();

      if (!extrato) throw new Error('Extrato não encontrado');
      const ext = extrato as unknown as Extrato;

      // Desvincular lançamentos
      for (const pid of (ext.processo_ids || [])) {
        await supabase
          .from('lancamentos')
          .update({
            extrato_id: null,
            etapa_financeiro: 'solicitacao_criada',
          } as any)
          .eq('processo_id', pid as string)
          .eq('tipo', 'receber');
      }

      // Soft delete
      await supabase
        .from('extratos' as any)
        .update({ status: 'excluido', updated_at: new Date().toISOString() } as any)
        .eq('id', extratoId);

      // Remove PDF
      const path = await empresaPath(`extratos/${ext.cliente_id}/${ext.filename}`);
      await supabase.storage.from('documentos').remove([path]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extratos'] });
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
      queryClient.invalidateQueries({ queryKey: ['lancamentos_receber'] });
      toast.success('Extrato excluído!');
    },
    onError: (e: Error) => toast.error('Erro ao excluir: ' + e.message),
  });

  return { extratosQuery, salvarExtrato, excluirExtrato };
}

export async function buscarExtratoPorId(extratoId: string): Promise<Extrato | null> {
  const { data } = await supabase
    .from('extratos' as any)
    .select('*')
    .eq('id', extratoId)
    .single();
  return data as unknown as Extrato | null;
}
