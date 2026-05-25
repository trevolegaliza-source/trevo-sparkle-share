import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, History } from 'lucide-react';
import { useHistoricoEntidade, CAMPO_LABELS, fmtValor } from '@/hooks/useHistoricoEntidade';
import { SkeletonList } from '@/components/ui/skeleton-patterns';
import { EmptyState } from '@/components/ui/empty-state';
import { usePermissions } from '@/hooks/usePermissions';

// PERM-015 (25/05/2026): campos financeiros mascarados pra quem não tem
// podeVerValores. Bate com SEC-029 (Clientes) — operacional/visualizador
// não vê R$ em lugar nenhum. Antes histórico vazava tudo.
const CAMPOS_FINANCEIROS = new Set(['valor', 'valor_final', 'valor_avulso', 'valor_base', 'desconto_pct', 'desconto_progressivo_pct']);

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entidadeTipo: 'processo' | 'orcamento';
  entidadeId: string | null;
  entidadeLabel?: string;
}

function fmtDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function HistoricoEntidadeModal({ open, onOpenChange, entidadeTipo, entidadeId, entidadeLabel }: Props) {
  const { data: entries = [], isLoading } = useHistoricoEntidade(entidadeTipo, entidadeId);
  const { podeVerValores } = usePermissions();

  const mascarar = (campo: string, valor: any): string => {
    if (!podeVerValores() && CAMPOS_FINANCEIROS.has(campo)) return '•••••';
    return fmtValor(campo, valor);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            Histórico de alterações
          </DialogTitle>
          <DialogDescription>
            {entidadeLabel
              ? <>Últimas mudanças em <span className="font-medium text-foreground">{entidadeLabel}</span>.</>
              : 'Últimas mudanças em todos os campos rastreados.'}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <SkeletonList rows={4} />
        ) : entries.length === 0 ? (
          <EmptyState
            variant="inline"
            icon={History}
            title="Nenhuma alteração registrada"
            description="Quando alguém editar um campo crítico, vai aparecer aqui."
          />
        ) : (
          <div className="space-y-2">
            {entries.map(entry => (
              <div
                key={entry.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-border/40 bg-muted/20"
              >
                <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5">
                  {CAMPO_LABELS[entry.campo] || entry.campo}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap text-sm font-mono">
                    <span className="text-muted-foreground line-through">
                      {mascarar(entry.campo, entry.valor_antigo)}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="font-semibold">
                      {mascarar(entry.campo, entry.valor_novo)}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    por <span className="font-medium">{entry.ator_nome}</span> · {fmtDataHora(entry.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
