import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface OrcamentoPDFRecord {
  id: string;
  orcamento_id: string;
  modo: 'contador' | 'cliente' | 'direto';
  versao: number;
  status: 'ativo' | 'cancelado';
  url: string;
  storage_path: string;
  filename: string;
  gerado_em: string;
  cancelado_em: string | null;
  created_at: string;
}

export function useOrcamentoPDFs(orcamentoId: string | null | undefined) {
  const queryClient = useQueryClient();

  const { data: pdfs, isLoading } = useQuery({
    queryKey: ['orcamento_pdfs', orcamentoId],
    queryFn: async () => {
      if (!orcamentoId) return [];
      const { data, error } = await supabase
        .from('orcamento_pdfs' as any)
        .select('*')
        .eq('orcamento_id', orcamentoId)
        .order('gerado_em', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as OrcamentoPDFRecord[];
    },
    enabled: !!orcamentoId,
  });

  const salvarPDF = useMutation({
    mutationFn: async ({ blob, modo, orcamentoId: orcId, filename }: {
      blob: Blob;
      modo: 'contador' | 'cliente' | 'direto';
      orcamentoId: string;
      filename: string;
    }) => {
      // 1. Cancel previous active version (same mode)
      const { data: anteriores } = await supabase
        .from('orcamento_pdfs' as any)
        .select('id')
        .eq('orcamento_id', orcId)
        .eq('modo', modo)
        .eq('status', 'ativo');

      if (anteriores && anteriores.length > 0) {
        await supabase
          .from('orcamento_pdfs' as any)
          .update({ status: 'cancelado', cancelado_em: new Date().toISOString() })
          .in('id', anteriores.map((a: any) => a.id));
      }

      // 2. Calculate next version
      const { count } = await supabase
        .from('orcamento_pdfs' as any)
        .select('*', { count: 'exact', head: true })
        .eq('orcamento_id', orcId)
        .eq('modo', modo);

      const versao = (count || 0) + 1;

      // 3. Upload to Storage
      const { empresaPath: makeEmpresaPath } = await import('@/lib/storage-path');
      const storagePath = await makeEmpresaPath(`orcamentos/${orcId}/${modo}_v${versao}_${Date.now()}.pdf`);
      const { error: uploadError } = await supabase.storage
        .from('documentos')
        .upload(storagePath, blob, {
          contentType: 'application/pdf',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // 4. Generate signed URL (1h TTL) — bucket may not be public
      const { data: signed, error: signedErr } = await supabase.storage
        .from('documentos')
        .createSignedUrl(storagePath, 3600);
      if (signedErr) throw signedErr;

      // 5. Save record (url = signed URL no momento da geração; storage_path é a fonte da verdade)
      const { error: insertError } = await supabase
        .from('orcamento_pdfs' as any)
        .insert({
          orcamento_id: orcId,
          modo,
          versao,
          status: 'ativo',
          url: signed.signedUrl,
          storage_path: storagePath,
          filename,
        });

      if (insertError) throw insertError;

      return { url: signed.signedUrl, versao };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orcamento_pdfs', orcamentoId] });
    },
  });

  return { pdfs, isLoading, salvarPDF };
}
