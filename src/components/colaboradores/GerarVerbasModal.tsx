import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronLeft, ChevronRight, Zap, AlertTriangle } from 'lucide-react';
import type { Colaborador } from '@/hooks/useColaboradores';
import { estimarCustoTotal } from '@/lib/gerar-verbas';
import { getBusinessDaysInMonth } from '@/lib/business-days';
import ConfirmarDiasUteisModal from './ConfirmarDiasUteisModal';

const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  colaboradores: Colaborador[];
  onConfirm: (selectedIds: string[], year: number, month: number, diasUteis: number) => void;
  isPending: boolean;
}

export default function GerarVerbasModal({ open, onOpenChange, colaboradores, onConfirm, isPending }: Props) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const ativos = colaboradores.filter(c => c.status === 'ativo');
  const [selected, setSelected] = useState<Set<string>>(new Set(ativos.map(c => c.id)));
  const [showConfirmacao, setShowConfirmacao] = useState(false);

  const diasUteis = getBusinessDaysInMonth(year, month);
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const totalEstimado = ativos.filter(c => selected.has(c.id)).reduce((s, c) => s + estimarCustoTotal(c, diasUteis), 0);

  const selectedColabs = ativos.filter(c => selected.has(c.id));

  const handleConfirmDiasUteis = (diasUteisConfirmados: number) => {
    setShowConfirmacao(false);
    onConfirm(Array.from(selected), year, month, diasUteisConfirmados);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" /> Gerar Verbas
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-center gap-3 py-2">
            <Button variant="ghost" size="sm" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-sm font-semibold text-foreground">{MESES_PT[month]} {year}</span>
            <Button variant="ghost" size="sm" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Serão gerados lançamentos em Contas a Pagar para os colaboradores selecionados:
          </p>

          <div className="space-y-2 max-h-[280px] overflow-y-auto">
            {ativos.map(c => {
              const custo = estimarCustoTotal(c, diasUteis);
              return (
                <label key={c.id} className="flex items-center justify-between rounded-lg border border-border/40 p-2.5 cursor-pointer hover:bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                    <div>
                      <p className="text-sm text-foreground">{c.nome}</p>
                      <p className="text-[10px] text-muted-foreground">{c.regime}</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-foreground">~ {fmt(custo)}</span>
                </label>
              );
            })}
          </div>

          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Total estimado:</span>
            <span className="text-lg font-bold text-primary">{fmt(totalEstimado)}</span>
          </div>

          <div className="flex items-start gap-2 text-xs text-warning bg-warning/5 rounded-lg p-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Verbas pendentes já existentes serão substituídas. Pagamentos confirmados serão mantidos.</span>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={() => setShowConfirmacao(true)} disabled={isPending || selected.size === 0}>
              Próximo: Confirmar Dias Úteis ({selected.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmarDiasUteisModal
        open={showConfirmacao}
        onOpenChange={setShowConfirmacao}
        year={year}
        month={month}
        colaboradores={selectedColabs}
        onConfirm={handleConfirmDiasUteis}
        isPending={isPending}
      />
    </>
  );
}
