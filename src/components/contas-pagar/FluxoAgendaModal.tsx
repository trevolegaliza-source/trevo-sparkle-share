import { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, Hourglass } from 'lucide-react';
import type { LancItem } from './FluxoProximos15Dias';
import type { Colaborador } from '@/hooks/useColaboradores';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const DIAS_SEMANA = ['DOMINGO', 'SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SÁBADO'];

type Urgencia = 'atrasado' | 'urgente' | 'normal';

interface BeneficioRow {
  type: 'beneficio';
  key: string;
  colaborador_id: string;
  nome: string;
  valor: number;
  vt: LancItem | null;
  vr: LancItem | null;
  vt_diario: number;
  vr_diario: number;
  vt_dias: number;
  vr_dias: number;
  urgencia: Urgencia;
  data_vencimento: string;
}

interface NormalRow {
  type: 'normal';
  item: LancItem;
}

type AgendaRow = BeneficioRow | NormalRow;

function UrgencyIcon({ urgencia }: { urgencia: Urgencia }) {
  if (urgencia === 'atrasado') return <AlertTriangle className="h-4 w-4 flex-shrink-0" style={{ color: '#EF4444' }} />;
  if (urgencia === 'urgente') return <Clock className="h-4 w-4 flex-shrink-0" style={{ color: '#F59E0B' }} />;
  return <Hourglass className="h-4 w-4 flex-shrink-0 text-muted-foreground" />;
}

function getDayLabel(dateStr: string): string {
  const hoje = new Date();
  const hojeStr = hoje.toISOString().split('T')[0];
  const amanha = new Date(hoje); amanha.setDate(amanha.getDate() + 1);
  const amanhaStr = amanha.toISOString().split('T')[0];
  const d = new Date(dateStr + 'T12:00:00');
  const diaSemana = DIAS_SEMANA[d.getDay()];
  const dataFmt = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  if (dateStr === hojeStr) return `HOJE · ${diaSemana}, ${dataFmt}`;
  if (dateStr === amanhaStr) return `AMANHÃ · ${diaSemana}, ${dataFmt}`;
  return `${diaSemana}, ${dataFmt}`;
}

function getRowLabel(item: LancItem): string {
  const parts: string[] = [];
  if (item.subcategoria) parts.push(item.subcategoria.toUpperCase());
  else if (item.categoria) parts.push(item.categoria.toUpperCase());
  if (item.fornecedor) parts.push(item.fornecedor.toUpperCase());
  else parts.push(item.descricao.toUpperCase());
  return parts.join(' · ');
}

interface Props {
  open: boolean;
  onClose: () => void;
  items: LancItem[];
  colaboradores: Colaborador[];
  onSelectItem: (item: LancItem) => void;
}

export default function FluxoAgendaModal({ open, onClose, items, colaboradores, onSelectItem }: Props) {
  const agenda = useMemo(() => {
    const colabMap = new Map(colaboradores.map(c => [c.id, c]));
    const grouped: Record<string, LancItem[]> = {};
    items.forEach(item => {
      const key = item.data_vencimento;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });

    const result: { date: string; label: string; total: number; rows: AgendaRow[] }[] = [];

    Object.keys(grouped).sort().forEach(dateStr => {
      const dayItems = grouped[dateStr];
      const rows: AgendaRow[] = [];

      const vtVr = dayItems.filter(i => i.subcategoria === 'Vale Transporte (VT)' || i.subcategoria === 'Vale Refeição (VR)');
      const others = dayItems.filter(i => i.subcategoria !== 'Vale Transporte (VT)' && i.subcategoria !== 'Vale Refeição (VR)');

      const byColab: Record<string, { vt: LancItem | null; vr: LancItem | null }> = {};
      vtVr.forEach(item => {
        const key = item.colaborador_id || 'none';
        if (!byColab[key]) byColab[key] = { vt: null, vr: null };
        if (item.subcategoria === 'Vale Transporte (VT)') byColab[key].vt = item;
        else byColab[key].vr = item;
      });

      Object.entries(byColab).forEach(([colabId, { vt, vr }]) => {
        const colab = colabMap.get(colabId);
        const vtDiario = colab?.vt_diario || 0;
        const vrDiario = colab?.vr_diario || 0;
        const vtDias = vt && vtDiario > 0 ? Math.round(vt.valor / vtDiario) : 0;
        const vrDias = vr && vrDiario > 0 ? Math.round(vr.valor / vrDiario) : 0;
        const totalVal = (vt?.valor || 0) + (vr?.valor || 0);
        const nome = colab?.nome || vt?.descricao || vr?.descricao || 'COLABORADOR';
        const dataVenc = vt?.data_vencimento || vr?.data_vencimento || dateStr;
        const urg: Urgencia = (vt?.urgencia === 'atrasado' || vr?.urgencia === 'atrasado') ? 'atrasado'
          : (vt?.urgencia === 'urgente' || vr?.urgencia === 'urgente') ? 'urgente' : 'normal';

        rows.push({
          type: 'beneficio',
          key: `ben-${colabId}-${dateStr}`,
          colaborador_id: colabId,
          nome: nome.toUpperCase(),
          valor: totalVal,
          vt, vr,
          vt_diario: vtDiario,
          vr_diario: vrDiario,
          vt_dias: vtDias,
          vr_dias: vrDias,
          urgencia: urg,
          data_vencimento: dataVenc,
        });
      });

      others.forEach(item => rows.push({ type: 'normal', item }));
      const total = dayItems.reduce((s, i) => s + i.valor, 0);
      result.push({ date: dateStr, label: getDayLabel(dateStr), total, rows });
    });

    return result;
  }, [items, colaboradores]);

  const totalGeral = items.reduce((s, i) => s + i.valor, 0);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-wide">Compromissos dos Próximos 15 Dias</DialogTitle>
          <DialogDescription className="uppercase font-semibold">
            {items.length} DESPESA{items.length !== 1 ? 'S' : ''} · TOTAL: {fmt(totalGeral)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-0 pr-1">
          {agenda.map((day, di) => (
            <div key={day.date}>
              {/* Double separator between days */}
              {di > 0 && <div className="h-px bg-border my-1" />}
              <div className="h-[2px] bg-border my-3" />

              {/* Day header */}
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-foreground tracking-wide">{day.label}</span>
                <span className="text-sm font-bold text-foreground">{fmt(day.total)}</span>
              </div>
              <div className="h-px bg-border mb-2" />

              {/* Rows */}
              <div className="space-y-1 pl-2">
                {day.rows.map(row => {
                  if (row.type === 'beneficio') {
                    const bRow = row;
                    const vencFmt = new Date(bRow.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR');
                    return (
                      <div
                        key={bRow.key}
                        className="cursor-pointer rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors"
                        onClick={() => {
                          const firstItem = bRow.vt || bRow.vr;
                          if (firstItem) onSelectItem(firstItem);
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <UrgencyIcon urgencia={bRow.urgencia} />
                          <span className="text-xs font-semibold text-foreground flex-1 truncate uppercase">
                            BENEFÍCIOS · {bRow.nome}
                          </span>
                          <span className="text-xs font-bold text-foreground whitespace-nowrap">{fmt(bRow.valor)}</span>
                        </div>
                        <div className="pl-6 mt-0.5 space-y-0">
                          {bRow.vt && (
                            <div className="text-[10px] text-muted-foreground uppercase">
                              VT R$ {bRow.vt_diario.toFixed(2).replace('.', ',')}/DIA × {bRow.vt_dias} DIAS
                            </div>
                          )}
                          {bRow.vr && (
                            <div className="text-[10px] text-muted-foreground uppercase">
                              VR R$ {bRow.vr_diario.toFixed(2).replace('.', ',')}/DIA × {bRow.vr_dias} DIAS
                            </div>
                          )}
                          <div className="text-[10px] text-muted-foreground uppercase">
                            VENCIMENTO: {vencFmt}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const item = row.item;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 cursor-pointer rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors"
                      onClick={() => onSelectItem(item)}
                    >
                      <UrgencyIcon urgencia={item.urgencia} />
                      <span className="text-xs font-semibold text-foreground flex-1 truncate uppercase">
                        {getRowLabel(item)}
                      </span>
                      <span className="text-xs font-bold text-foreground whitespace-nowrap">{fmt(item.valor)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {items.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8 uppercase">Nenhum compromisso nos próximos 15 dias.</p>
          )}
        </div>

        {/* Footer */}
        <div className="h-[2px] bg-border mt-2" />
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs font-bold text-muted-foreground tracking-wide uppercase">TOTAL</span>
          <span className="text-sm font-bold text-foreground">{fmt(totalGeral)}</span>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>FECHAR</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
