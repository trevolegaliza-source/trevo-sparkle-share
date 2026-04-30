import { useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, ChevronDown, ExternalLink, CheckCircle, RotateCcw, Loader2 } from 'lucide-react';
import type { ClienteFinanceiro, LancamentoFinanceiro } from '@/hooks/useFinanceiroClientes';
import { TIPO_PROCESSO_LABELS } from '@/types/financial';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('pt-BR');
}

function AnexoButton({ storagePath }: { storagePath: string }) {
  const [loading, setLoading] = useState(false);
  // Signed URL (não blob) — blob URL em iframe → ERR_BLOCKED_BY_CLIENT
  async function handleOpen() {
    setLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from('contestacoes')
        .createSignedUrl(storagePath, 3600);
      if (error || !data?.signedUrl) { toast.error('Erro ao abrir anexo.'); return; }
      const win = window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
      if (!win) {
        await navigator.clipboard.writeText(data.signedUrl).catch(() => {});
        toast.info('Pop-up bloqueado. Link copiado pra área de transferência.', { duration: 8000 });
      }
    } catch { toast.error('Erro ao abrir anexo.'); } finally { setLoading(false); }
  }
  return (
    <Button variant="outline" size="sm" className="text-xs h-8 gap-1" onClick={handleOpen} disabled={loading}>
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />} Ver anexo
    </Button>
  );
}

interface Props {
  clientes: ClienteFinanceiro[];
  onResolver: (params: { lancamentoId: string; destino: 'aguardando' | 'pagos'; observacao: string }) => void;
  userRole: string | null;
}

export default function ClientesContestados({ clientes, onResolver, userRole }: Props) {
  if (clientes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertTriangle className="h-8 w-8 text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground">Nenhuma contestação pendente.</p>
      </div>
    );
  }

  const isMaster = userRole === 'master';

  return (
    <Accordion type="multiple" className="space-y-2">
      {clientes.map(c => (
        <ContestadoItem key={c.cliente_id} cliente={c} isMaster={isMaster} onResolver={onResolver} />
      ))}
    </Accordion>
  );
}

function ContestadoItem({ cliente, isMaster, onResolver }: {
  cliente: ClienteFinanceiro;
  isMaster: boolean;
  onResolver: Props['onResolver'];
}) {
  const [resolveModal, setResolveModal] = useState<{ lancamentoId: string; destino: 'aguardando' | 'pagos' } | null>(null);
  const [observacao, setObservacao] = useState('');

  function handleResolver() {
    if (!resolveModal) return;
    onResolver({
      lancamentoId: resolveModal.lancamentoId,
      destino: resolveModal.destino,
      observacao,
    });
    setResolveModal(null);
    setObservacao('');
  }

  return (
    <>
      <AccordionItem value={cliente.cliente_id} className="border rounded-lg bg-card border-amber-500/30">
        <AccordionTrigger className="px-3 sm:px-4 py-3 hover:no-underline [&>svg]:hidden">
          <div className="flex items-center gap-2 flex-1 text-left min-w-0">
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <p className="font-semibold text-sm truncate">
                {cliente.cliente_apelido || cliente.cliente_nome}
                {cliente.cliente_codigo && <span className="text-muted-foreground font-mono font-normal text-xs"> · {cliente.cliente_codigo}</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {fmt(cliente.total_faturado)} · {cliente.qtd_processos} processo(s) contestado(s)
              </p>
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px] w-fit">
                ⚠️ Contestado
              </Badge>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0" />
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          <div className="space-y-3">
            {cliente.lancamentos.map(l => (
              <ContestadoLancamentoCard
                key={l.id}
                lancamento={l}
                isMaster={isMaster}
                onDevolver={() => setResolveModal({ lancamentoId: l.id, destino: 'aguardando' })}
                onEncerrar={() => setResolveModal({ lancamentoId: l.id, destino: 'pagos' })}
              />
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>

      <Dialog open={!!resolveModal} onOpenChange={(open) => { if (!open) { setResolveModal(null); setObservacao(''); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {resolveModal?.destino === 'pagos' ? 'Encerrar como Pago' : 'Devolver para Ag. Pagamento'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              placeholder="Observação sobre a resolução..."
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResolveModal(null); setObservacao(''); }}>Cancelar</Button>
            <Button onClick={handleResolver} disabled={!observacao.trim()}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ContestadoLancamentoCard({ lancamento: l, isMaster, onDevolver, onEncerrar }: {
  lancamento: LancamentoFinanceiro & { contestacao_motivo?: string; contestacao_anexo_url?: string; contestacao_data?: string };
  isMaster: boolean;
  onDevolver: () => void;
  onEncerrar: () => void;
}) {
  return (
    <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{l.processo_razao_social}</p>
          <p className="text-xs text-muted-foreground">
            {TIPO_PROCESSO_LABELS[l.processo_tipo as keyof typeof TIPO_PROCESSO_LABELS] || l.processo_tipo} · {fmt(l.valor)}
          </p>
        </div>
        <p className="text-sm font-bold text-amber-600 shrink-0">{fmt(l.valor)}</p>
      </div>

      {(l as any).contestacao_motivo && (
        <div className="bg-background/60 rounded p-2">
          <p className="text-xs font-medium text-amber-600 mb-1">Motivo:</p>
          <p className="text-xs text-foreground">{(l as any).contestacao_motivo}</p>
        </div>
      )}

      {(l as any).contestacao_data && (
        <p className="text-[10px] text-muted-foreground">Contestado em {fmtDate((l as any).contestacao_data)}</p>
      )}

      {(l as any).contestacao_anexo_url && (
        <AnexoButton storagePath={(l as any).contestacao_anexo_url} />
      )}

      {isMaster && (
        <div className="flex gap-2 mt-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-9 gap-1 flex-1"
            onClick={onDevolver}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Devolver p/ Cobrança
          </Button>
          <Button
            size="sm"
            className="text-xs h-9 gap-1 flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={onEncerrar}
          >
            <CheckCircle className="h-3.5 w-3.5" /> Encerrar como Pago
          </Button>
        </div>
      )}
    </div>
  );
}
