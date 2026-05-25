import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AsaasCobrancaInfo {
  payment_id: string | null;
  status: string | null;
  invoice_url: string | null;
  boleto_url: string | null;
  boleto_barcode: string | null;
  pix_qrcode: string | null;
  pix_payload: string | null;
  gerado_em: string | null;
  pago_em: string | null;
  data_vencimento: string | null;
}

interface GerarAsaasResponse {
  ok?: boolean;
  reused?: boolean;
  asaas_payment_id?: string;
  invoice_url?: string;
  boleto_url?: string;
  boleto_barcode?: string;
  pix_payload?: string;
  due_date?: string;
  error?: string;
  message?: string;
}

export function useGerarAsaasCobranca() {
  const qc = useQueryClient();
  return useMutation<GerarAsaasResponse, Error, { cobrancaId: string; dataVencimento?: string }>({
    mutationFn: async ({ cobrancaId, dataVencimento }) => {
      const { data, error } = await supabase.functions.invoke<GerarAsaasResponse>(
        'asaas-gerar-cobranca',
        { body: { cobranca_id: cobrancaId, data_vencimento: dataVencimento } }
      );
      if (error) throw new Error(error.message || 'Erro inesperado.');
      if (!data) throw new Error('Resposta vazia da função.');
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['cobranca-asaas'] });
      qc.invalidateQueries({ queryKey: ['financeiro_clientes'] });
      if (data.reused) {
        toast.info('Cobrança Asaas já existia para este registro.');
      } else {
        toast.success('Cobrança gerada no Asaas com sucesso!');
      }
    },
    onError: (e) => {
      toast.error(e.message);
    },
  });
}

/**
 * Busca dados Asaas (boleto/PIX/status) de uma cobrança específica.
 * Usado para exibir badge "Asaas ✓" nos itens e dentro do modal.
 */
export function useCobrancaAsaas(cobrancaId: string | undefined | null) {
  return useQuery({
    queryKey: ['cobranca-asaas', cobrancaId],
    enabled: !!cobrancaId,
    staleTime: 30_000,
    queryFn: async (): Promise<AsaasCobrancaInfo | null> => {
      if (!cobrancaId) return null;
      const { data, error } = await supabase
        .from('cobrancas')
        .select(`
          asaas_payment_id, asaas_status, asaas_invoice_url,
          asaas_boleto_url, asaas_boleto_barcode,
          asaas_pix_qrcode, asaas_pix_payload,
          asaas_gerado_em, asaas_pago_em,
          data_vencimento
        `)
        .eq('id', cobrancaId)
        .single();
      if (error) return null;
      if (!data?.asaas_payment_id) return null;
      return {
        payment_id: data.asaas_payment_id,
        status: data.asaas_status,
        invoice_url: data.asaas_invoice_url,
        boleto_url: data.asaas_boleto_url,
        boleto_barcode: data.asaas_boleto_barcode,
        pix_qrcode: data.asaas_pix_qrcode,
        pix_payload: data.asaas_pix_payload,
        gerado_em: data.asaas_gerado_em,
        pago_em: data.asaas_pago_em,
        data_vencimento: data.data_vencimento,
      };
    },
  });
}
