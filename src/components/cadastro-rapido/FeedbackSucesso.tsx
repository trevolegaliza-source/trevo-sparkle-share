import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, Plus, FileText, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TIPO_PROCESSO_LABELS, type TipoProcesso } from '@/types/financial';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export interface ProcessoSalvo {
  razaoSocial: string;
  tipo: string;
  valorFinal: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  clienteNome: string;
  processos: ProcessoSalvo[];
  totalEconomia: number;
}

export default function FeedbackSucesso({ open, onClose, clienteNome, processos, totalEconomia }: Props) {
  const navigate = useNavigate();
  const total = processos.reduce((s, p) => s + p.valorFinal, 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-success">
            <CheckCircle className="h-5 w-5" />
            Processos Cadastrados!
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {processos.length} processo{processos.length > 1 ? 's' : ''} criado{processos.length > 1 ? 's' : ''} para <span className="font-medium text-foreground">{clienteNome}</span>
          </p>

          <div className="space-y-2">
            {processos.map((p, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span>{i + 1}. {TIPO_PROCESSO_LABELS[p.tipo as TipoProcesso] || p.tipo} - {p.razaoSocial}</span>
                <span className="font-medium">{fmt(p.valorFinal)}</span>
              </div>
            ))}
          </div>

          <div className="h-px bg-border" />

          <div className="flex justify-between font-bold text-sm">
            <span>Total</span>
            <span className="text-primary">{fmt(total)}</span>
          </div>

          {totalEconomia > 0 && (
            <p className="text-xs text-success">Economia (desc. progressivo): {fmt(totalEconomia)}</p>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <Button onClick={onClose} className="gap-2">
              <Plus className="h-4 w-4" /> Cadastrar Mais
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-2" onClick={() => navigate('/processos')}>
                <FileText className="h-4 w-4" /> Processos
              </Button>
              <Button variant="outline" className="flex-1 gap-2" onClick={() => navigate('/financeiro')}>
                <DollarSign className="h-4 w-4" /> Financeiro
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
