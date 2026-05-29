import { useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, ChevronDown } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { ClienteFinanceiro } from '@/hooks/useFinanceiroClientes';
import { invalidateFinanceiro } from '@/hooks/useFinanceiroClientes';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

import { fmt } from './utils';
import { ClienteHeaderBadges } from './ClienteHeaderBadges';
import { MoverParaMenu } from './MoverParaMenu';
import { EmptyState } from './EmptyState';
import { LancamentoRow } from './LancamentoRow';

// ══════════ TAB: RECEBIDOS ══════════
export function ClientesRecebidos({ clientes }: { clientes: ClienteFinanceiro[] }) {
  if (clientes.length === 0) return <EmptyState text="Nenhum pagamento recebido neste período." />;
  return (
    <Accordion type="multiple" defaultValue={[]} className="space-y-2">
      {clientes.map(c => <RecebidoItem key={c.cliente_id} cliente={c} />)}
    </Accordion>
  );
}

function RecebidoItem({ cliente: c }: { cliente: ClienteFinanceiro }) {
  const qc = useQueryClient();
  // C19/C20 — confirm() nativo bloqueia main thread + UX inconsistente
  const [pendingDesfazer, setPendingDesfazer] = useState<string[] | null>(null);

  async function executarDesfazerPagamento(lancamentoIds: string[]) {
    setPendingDesfazer(null);
    const { error } = await supabase
      .from('lancamentos')
      .update({
        etapa_financeiro: 'cobranca_enviada',
        status: 'pendente' as const,
        data_pagamento: null,
        confirmado_recebimento: false,
      })
      .in('id', lancamentoIds);
    if (error) { toast.error(error.message); return; }
    invalidateFinanceiro(qc);
    toast.success('Pagamento desfeito! Lançamento voltou para "Aguardando".');
  }

  return (
    <>
      <AccordionItem key={c.cliente_id} value={c.cliente_id} className="border rounded-lg bg-card">
        <AccordionTrigger className="px-3 sm:px-4 py-3 hover:no-underline [&>svg]:hidden">
          <div className="flex items-center gap-2 flex-1 text-left min-w-0">
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <p className="font-semibold text-sm truncate min-w-0 flex-1">
                  {c.cliente_apelido || c.cliente_nome}
                  {c.cliente_codigo && <span className="text-muted-foreground font-mono font-normal text-xs"> · {c.cliente_codigo}</span>}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">{fmt(c.total_faturado)} · {c.qtd_processos} proc.</p>
              <div className="flex flex-wrap gap-1 items-center">
                <ClienteHeaderBadges cliente={c} />
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-[10px] sm:text-xs">
                  <CheckCircle className="h-3 w-3 mr-1" /> Pago
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0 ml-2">
              <MoverParaMenu cliente={c} />
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0" />
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          <div className="space-y-2">
            {c.lancamentos.map(l => (
              <div key={l.id} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <LancamentoRow lancamento={l} />
                </div>
                {(l.status === 'pago' || l.etapa_financeiro === 'honorario_pago') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 text-xs shrink-0"
                    onClick={() => setPendingDesfazer([l.id])}
                  >
                    Desfazer
                  </Button>
                )}
              </div>
            ))}
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                variant="outline"
                className="text-amber-600 border-amber-600/30 hover:bg-amber-500/10"
                onClick={() => setPendingDesfazer(c.lancamentos.map(l => l.id))}
              >
                Desfazer Todos os Pagamentos
              </Button>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AlertDialog open={!!pendingDesfazer} onOpenChange={(open) => { if (!open) setPendingDesfazer(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desfazer pagamento?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDesfazer && pendingDesfazer.length > 1
                ? `${pendingDesfazer.length} lançamentos voltarão para "Aguardando" (status pendente, sem data de pagamento).`
                : 'O lançamento voltará para "Aguardando" (status pendente, sem data de pagamento).'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDesfazer && executarDesfazerPagamento(pendingDesfazer)}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              Desfazer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
