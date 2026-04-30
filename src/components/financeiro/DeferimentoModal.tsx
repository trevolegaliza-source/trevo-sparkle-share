import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProcessoDeferimento {
  processo_id: string;
  razao_social: string;
  tipo: string;
  data_deferimento_atual: string | null;
}

interface DeferimentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteNome: string;
  processos: ProcessoDeferimento[];
  onConfirm: (processosDeferidos: string[]) => void;
}

export default function DeferimentoModal({
  open, onOpenChange, clienteNome, processos, onConfirm,
}: DeferimentoModalProps) {
  const [items, setItems] = useState<Record<string, { checked: boolean; data: string }>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const initial: Record<string, { checked: boolean; data: string }> = {};
    processos.forEach(p => {
      initial[p.processo_id] = {
        checked: !!p.data_deferimento_atual,
        data: p.data_deferimento_atual || '',
      };
    });
    setItems(initial);
  }, [open, processos]);

  function toggleCheck(id: string) {
    setItems(prev => {
      const cur = prev[id] || { checked: false, data: '' };
      return { ...prev, [id]: { ...cur, checked: !cur.checked } };
    });
  }

  function setData(id: string, data: string) {
    setItems(prev => {
      const cur = prev[id] || { checked: false, data: '' };
      return { ...prev, [id]: { ...cur, data, checked: true } };
    });
  }

  const deferidos = processos.filter(p => items[p.processo_id]?.checked && items[p.processo_id]?.data);
  const temSemData = processos.some(p => items[p.processo_id]?.checked && !items[p.processo_id]?.data);

  async function handleConfirm() {
    if (deferidos.length === 0) {
      toast.warning('Selecione ao menos um processo deferido com data.');
      return;
    }
    if (temSemData) {
      toast.warning('Preencha a data de deferimento para todos os processos marcados.');
      return;
    }

    setSaving(true);
    try {
      for (const p of deferidos) {
        const data = items[p.processo_id].data;
        await supabase
          .from('processos')
          .update({ data_deferimento: data } as any)
          .eq('id', p.processo_id);
      }

      onConfirm(deferidos.map(p => p.processo_id));
    } catch (err: any) {
      toast.error('Erro ao salvar datas: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-warning">
            <AlertTriangle className="h-5 w-5" />
            Faturamento por Deferimento
          </DialogTitle>
          <DialogDescription>
            O cliente <span className="font-semibold text-foreground">{clienteNome}</span> está configurado
            para faturar apenas processos deferidos. Marque os processos que já foram deferidos e informe a data.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 py-2">
          {processos.map(p => {
            const item = items[p.processo_id] || { checked: false, data: '' };
            return (
              <div key={p.processo_id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30">
                <Checkbox
                  checked={item.checked}
                  onCheckedChange={() => toggleCheck(p.processo_id)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0 space-y-2">
                  <div>
                    <p className="text-sm font-semibold truncate">
                      {p.tipo.toUpperCase()} — {p.razao_social}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground whitespace-nowrap">Data deferimento:</label>
                    <Input
                      type="date"
                      value={item.data}
                      onChange={e => setData(p.processo_id, e.target.value)}
                      className="h-8 text-xs w-40"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-3 border-t">
          <div className="flex-1 text-sm text-muted-foreground">
            {deferidos.length} de {processos.length} processo(s) deferido(s)
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={saving || deferidos.length === 0 || temSemData}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {saving ? 'Salvando...' : `Gerar Extrato (${deferidos.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
