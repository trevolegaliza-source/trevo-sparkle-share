import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useColaboradores } from '@/hooks/useColaboradores';
import { buildVerbas } from '@/lib/gerar-verbas';

const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (lancamentos: Record<string, any>[]) => void;
  mes: number;
  ano: number;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface LinhaFolha {
  colaboradorId: string;
  colaboradorNome: string;
  subcategoria: string;
  valor: number;
  dataVencimento: string;
  selected: boolean;
}

export default function ImportarFolhaModal({ open, onClose, onConfirm, mes: mesProp, ano: anoProp }: Props) {
  const { data: colaboradores } = useColaboradores();
  const activeColabs = useMemo(() => (colaboradores || []).filter(c => c.status === 'ativo'), [colaboradores]);

  // Default to NEXT month relative to current view
  const nextMonth = mesProp === 12 ? 1 : mesProp + 1;
  const nextYear = mesProp === 12 ? anoProp + 1 : anoProp;
  const [selectedMes, setSelectedMes] = useState(nextMonth);
  const [selectedAno, setSelectedAno] = useState(nextYear);

  // Reset to next month when modal opens
  useEffect(() => {
    if (open) {
      const nm = mesProp === 12 ? 1 : mesProp + 1;
      const ny = mesProp === 12 ? anoProp + 1 : anoProp;
      setSelectedMes(nm);
      setSelectedAno(ny);
    }
  }, [open, mesProp, anoProp]);

  function generateLinhas(): LinhaFolha[] {
    const result: LinhaFolha[] = [];
    const month0 = selectedMes - 1; // buildVerbas uses 0-indexed month
    activeColabs.forEach(c => {
      const verbas = buildVerbas(c, selectedAno, month0);
      verbas.forEach(v => {
        result.push({
          colaboradorId: c.id,
          colaboradorNome: c.nome,
          subcategoria: v.subcategoria,
          valor: v.valor,
          dataVencimento: v.data_vencimento,
          selected: true,
        });
      });
    });
    return result;
  }

  const [linhas, setLinhas] = useState<LinhaFolha[]>([]);

  // Regenerate when colabs or month changes
  useEffect(() => {
    if (open && activeColabs.length > 0) {
      setLinhas(generateLinhas());
    }
  }, [open, activeColabs, selectedMes, selectedAno]);

  const prevMonth = () => {
    if (selectedMes === 1) { setSelectedMes(12); setSelectedAno(y => y - 1); }
    else setSelectedMes(m => m - 1);
  };
  const nextMo = () => {
    if (selectedMes === 12) { setSelectedMes(1); setSelectedAno(y => y + 1); }
    else setSelectedMes(m => m + 1);
  };

  const toggleAll = (checked: boolean) => setLinhas(ls => ls.map(l => ({ ...l, selected: checked })));
  const toggle = (idx: number) => setLinhas(ls => ls.map((l, i) => i === idx ? { ...l, selected: !l.selected } : l));

  const totalSelecionado = linhas.filter(l => l.selected).reduce((s, l) => s + l.valor, 0);

  const handleConfirm = () => {
    const selected = linhas.filter(l => l.selected);
    const lancamentos = selected.map(l => ({
      tipo: 'pagar' as const,
      descricao: `${l.subcategoria} - ${l.colaboradorNome}`,
      valor: l.valor,
      data_vencimento: l.dataVencimento,
      status: 'pendente' as const,
      categoria: 'folha',
      subcategoria: l.subcategoria,
      fornecedor: l.colaboradorNome,
      colaborador_id: l.colaboradorId,
      competencia_mes: selectedMes,
      competencia_ano: selectedAno,
      etapa_financeiro: 'solicitacao_criada',
    }));
    onConfirm(lancamentos);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Folha de Pagamento</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-center gap-3 py-1">
          <Button variant="ghost" size="sm" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-semibold text-foreground">{MESES_PT[selectedMes - 1]} {selectedAno}</span>
          <Button variant="ghost" size="sm" onClick={nextMo}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="space-y-3 py-2">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <Checkbox checked={linhas.every(l => l.selected)} onCheckedChange={c => toggleAll(!!c)} />
            <span className="text-sm font-medium">Selecionar todos</span>
            <span className="ml-auto text-sm font-bold text-primary">{fmt(totalSelecionado)}</span>
          </div>
          {linhas.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum colaborador ativo encontrado</p>
          ) : (
            <div className="divide-y divide-border">
              {linhas.map((l, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5">
                  <Checkbox checked={l.selected} onCheckedChange={() => toggle(i)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{l.colaboradorNome}</p>
                    <p className="text-xs text-muted-foreground">{l.subcategoria}</p>
                  </div>
                  <span className="text-sm font-bold whitespace-nowrap">{fmt(l.valor)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={linhas.filter(l => l.selected).length === 0}>
            Gerar {linhas.filter(l => l.selected).length} Lançamentos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
