import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Minus, Plus, Loader2 } from 'lucide-react';
import type { Colaborador } from '@/hooks/useColaboradores';
import type { FeriadoNacional } from '@/lib/brasil-api';
import { fetchFeriadosNacionais, calcularDiasUteis, feriadosDoMes } from '@/lib/brasil-api';

const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  month: number; // 0-indexed (competência)
  colaboradores: Colaborador[];
  onConfirm: (diasUteis: number) => void;
  isPending: boolean;
}

// VT/VR is paid on the 1st of the month AFTER competência,
// so business days should be calculated for the PAYMENT month.
function getPaymentMonth(year: number, month: number) {
  const nextMonth = month + 1;
  return {
    payYear: nextMonth > 11 ? year + 1 : year,
    payMonth: nextMonth > 11 ? 0 : nextMonth,
  };
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function ConfirmarDiasUteisModal({ open, onOpenChange, year, month, colaboradores, onConfirm, isPending }: Props) {
  const { payYear, payMonth } = getPaymentMonth(year, month);
  const [loading, setLoading] = useState(false);
  const [feriados, setFeriados] = useState<FeriadoNacional[]>([]);
  const [feriadosMes, setFeriadosMes] = useState<FeriadoNacional[]>([]);
  const [diasUteis, setDiasUteis] = useState(22);
  const [apiError, setApiError] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setApiError(false);
    fetchFeriadosNacionais(payYear).then(result => {
      if (result.length === 0) {
        setApiError(true);
        setDiasUteis(22);
        setFeriados([]);
        setFeriadosMes([]);
      } else {
        setFeriados(result);
        const doMes = feriadosDoMes(result, payYear, payMonth);
        setFeriadosMes(doMes);
        setDiasUteis(calcularDiasUteis(payYear, payMonth, result));
      }
      setLoading(false);
    });
  }, [open, payYear, payMonth]);

  const ativos = colaboradores.filter(c => c.status === 'ativo');
  const colabsComBeneficios = ativos.filter(c => Number(c.vt_diario) > 0 || Number(c.vr_diario) > 0);

  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            Confirmar Dias Úteis · {MESES_PT[payMonth]} {payYear}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            VT e VR de {MESES_PT[month]} serão pagos em 01/{String(payMonth + 1).padStart(2, '0')}/{payYear}.
            Informe os dias úteis de {MESES_PT[payMonth]} para o cálculo.
          </p>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Consultando feriados...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Feriados encontrados */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">
                Cálculo automático via feriados nacionais (BrasilAPI):
              </p>
              {feriadosMes.length > 0 ? (
                <ul className="space-y-1">
                  {feriadosMes.map(f => (
                    <li key={f.date} className="text-sm text-foreground flex items-center gap-2">
                      <span className="text-muted-foreground">•</span>
                      {f.name} · {formatDate(f.date)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Nenhum feriado nacional neste mês.
                </p>
              )}
            </div>

            <p className="text-sm text-foreground">
              Dias úteis calculados: <span className="font-bold text-primary">{diasUteis}</span>
            </p>

            {/* Warning */}
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <span className="text-xs text-foreground">
                {apiError
                  ? '⚠ Não foi possível carregar os feriados automáticos. Verifique e ajuste manualmente.'
                  : 'Este cálculo considera apenas feriados nacionais. Feriados estaduais (ex: 9 de Julho/SP) e municipais de São Bernardo do Campo não estão incluídos. Ajuste o número abaixo se necessário.'}
              </span>
            </div>

            {/* Editable business days */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                Dias úteis para cálculo de VT e VR:
              </p>
              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setDiasUteis(d => Math.max(1, d - 1))}
                  disabled={diasUteis <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="text-3xl font-bold text-primary min-w-[60px] text-center">
                  {diasUteis}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setDiasUteis(d => Math.min(31, d + 1))}
                  disabled={diasUteis >= 31}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Preview */}
            {colabsComBeneficios.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                  Prévia do impacto:
                </p>
                <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
                  {colabsComBeneficios.map(c => {
                    const vt = Number(c.vt_diario);
                    const vr = Number(c.vr_diario);
                    return (
                      <div key={c.id} className="space-y-0.5">
                        {vt > 0 && (
                          <p className="text-xs text-foreground">
                            VT · {c.nome}: {fmt(vt)} × {diasUteis} dias ({MESES_PT[payMonth]}) = <span className="font-semibold">{fmt(vt * diasUteis)}</span>
                          </p>
                        )}
                        {vr > 0 && (
                          <p className="text-xs text-foreground">
                            VR · {c.nome}: {fmt(vr)} × {diasUteis} dias ({MESES_PT[payMonth]}) = <span className="font-semibold">{fmt(vr * diasUteis)}</span>
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground">
                          Vencimento: 01/{String(payMonth + 1).padStart(2, '0')}/{payYear}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => onConfirm(diasUteis)}
            disabled={isPending || loading}
          >
            {isPending ? 'Gerando...' : 'Confirmar e Gerar Verbas'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
