import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { PrepagoMovimentacao } from '@/types/supabase';

export function usePrepagoMovimentacoes(clienteId?: string) {
  return useQuery({
    queryKey: ['prepago_movimentacoes', clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prepago_movimentacoes')
        .select('*')
        .eq('cliente_id', clienteId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as PrepagoMovimentacao[];
    },
  });
}

export function useRegistrarRecarga() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      clienteId: string;
      valor: number;
      saldoAtual: number;
      nomeCliente: string;
      comprovanteUrl?: string;
      observacao?: string;
    }) => {
      const novoSaldo = input.saldoAtual + input.valor;
      const hoje = new Date().toISOString().split('T')[0];
      const now = new Date();

      // 1. Update client balance
      const { error: updateErr } = await supabase
        .from('clientes')
        .update({
          saldo_prepago: novoSaldo,
          saldo_ultima_recarga: input.valor,
          data_ultima_recarga: hoje,
          updated_at: now.toISOString(),
        } as any)
        .eq('id', input.clienteId);
      if (updateErr) throw updateErr;

      // 2. Record movement
      const { error: movErr } = await supabase
        .from('prepago_movimentacoes')
        .insert({
          cliente_id: input.clienteId,
          tipo: 'recarga',
          valor: input.valor,
          saldo_anterior: input.saldoAtual,
          saldo_posterior: novoSaldo,
          descricao: `Recarga de R$ ${input.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}${input.observacao ? ' — ' + input.observacao : ''}`,
        } as any);
      if (movErr) throw movErr;

      // 3. Create lancamento as paid
      const { error: lancErr } = await supabase
        .from('lancamentos')
        .insert({
          tipo: 'receber',
          cliente_id: input.clienteId,
          descricao: `Recarga Pré-Pago — ${input.nomeCliente}`,
          valor: input.valor,
          status: 'pago',
          data_vencimento: hoje,
          data_pagamento: hoje,
          comprovante_url: input.comprovanteUrl || null,
          etapa_financeiro: 'honorario_pago',
          competencia_mes: now.getMonth() + 1,
          competencia_ano: now.getFullYear(),
        });
      if (lancErr) throw lancErr;

      return novoSaldo;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['clientes'] });
      qc.invalidateQueries({ queryKey: ['prepago_movimentacoes', vars.clienteId] });
      qc.invalidateQueries({ queryKey: ['lancamentos'] });
      toast.success('Recarga registrada com sucesso!');
    },
    onError: (e: Error) => toast.error('Erro na recarga: ' + e.message),
  });
}
