import { Button } from '@/components/ui/button';
import { FileText, Send, Clock, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import type { ClienteFinanceiro } from '@/hooks/useFinanceiroClientes';
import { invalidateFinanceiro } from '@/hooks/useFinanceiroClientes';

// ══════════ MOVER PARA MENU ══════════
export function MoverParaMenu({ cliente }: { cliente: ClienteFinanceiro }) {
  const qc = useQueryClient();

  // Se todos os lançamentos já estão pagos (caso típico do Histórico),
  // o menu "Mover para" não tem nada útil — esconde pra evitar UX confusa
  // com "Marcar como Pago" disponível em algo que já foi pago.
  // Desfazer pagamento já está disponível inline em cada linha + botão "Desfazer Todos".
  const todosPagos = cliente.lancamentos.length > 0 && cliente.lancamentos.every(l => l.status === 'pago');
  if (todosPagos) return null;

  async function handleMoverPara(novaEtapa: string) {
    const lancamentoIds = cliente.lancamentos
      .filter(l => l.status !== 'pago')
      .map(l => l.id);

    if (lancamentoIds.length === 0) {
      toast.error('Nenhum lançamento pendente para mover.');
      return;
    }

    const updates: Record<string, any> = { etapa_financeiro: novaEtapa };

    if (novaEtapa === 'honorario_pago') {
      updates.status = 'pago';
      updates.data_pagamento = new Date().toISOString().split('T')[0];
      updates.confirmado_recebimento = true;
    }

    if (novaEtapa === 'solicitacao_criada') {
      updates.extrato_id = null;
    }

    const { error } = await supabase
      .from('lancamentos')
      .update(updates as any)
      .in('id', lancamentoIds);

    if (error) {
      toast.error('Erro ao mover: ' + error.message);
      return;
    }

    invalidateFinanceiro(qc);

    const nomes: Record<string, string> = {
      solicitacao_criada: 'Cobrar',
      cobranca_gerada: 'Enviados',
      cobranca_enviada: 'Ag. Pagamento',
      honorario_pago: 'Pagos',
    };
    toast.success(`${cliente.cliente_apelido || cliente.cliente_nome} movido para "${nomes[novaEtapa] || novaEtapa}"`);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="sm" className="h-9 w-9 sm:h-7 sm:w-7 p-0 border border-border rounded-md flex items-center justify-center">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel className="text-xs text-muted-foreground">Mover para</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => handleMoverPara('solicitacao_criada')}>
          <FileText className="h-4 w-4 mr-2" />
          Cobrar (resetar)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleMoverPara('cobranca_gerada')}>
          <Send className="h-4 w-4 mr-2" />
          Enviados (extrato gerado)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleMoverPara('cobranca_enviada')}>
          <Clock className="h-4 w-4 mr-2" />
          Ag. Pagamento (enviado)
        </DropdownMenuItem>
        {/* "Marcar como Pago" removido daqui em Sprint 4.A (13/05 noite) —
            era redundante com botão verde principal (que usa RPC com tenant
            check). Marcar pago segue via fluxo: ClientesAguardando > botão
            "Marcar como Pago" verde, ou linha individual com checkbox + bulk. */}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
