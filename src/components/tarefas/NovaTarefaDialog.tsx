import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { Loader2, Plus } from 'lucide-react';
import { useCriarTarefa, type TarefaCategoria, type TarefaPrioridade } from '@/hooks/useTarefas';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const CATEGORIAS: { value: TarefaCategoria; label: string }[] = [
  { value: 'bug', label: 'Bug' },
  { value: 'feature', label: 'Feature' },
  { value: 'teste', label: 'Teste' },
  { value: 'auditoria', label: 'Auditoria' },
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'investigacao', label: 'Investigação' },
  { value: 'outro', label: 'Outro' },
];

const PRIORIDADES: { value: TarefaPrioridade; label: string }[] = [
  { value: 'critica', label: '🔴 Crítica' },
  { value: 'alta', label: '🟠 Alta' },
  { value: 'media', label: '🟡 Média' },
  { value: 'baixa', label: '🟢 Baixa' },
];

export function NovaTarefaDialog({ open, onOpenChange }: Props) {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState<TarefaCategoria>('outro');
  const [prioridade, setPrioridade] = useState<TarefaPrioridade>('media');
  const criar = useCriarTarefa();

  const reset = () => {
    setTitulo(''); setDescricao('');
    setCategoria('outro'); setPrioridade('media');
  };

  const handleSubmit = async () => {
    if (!titulo.trim()) {
      toast.error('Título obrigatório.');
      return;
    }
    try {
      await criar.mutateAsync({
        titulo, descricao: descricao || undefined,
        categoria, prioridade,
      });
      reset();
      onOpenChange(false);
    } catch {
      // toast já disparado pelo hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Nova tarefa
          </DialogTitle>
          <DialogDescription>
            Adicionar lembrete pessoal ou pendência. Aparece na aba Tarefas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Revisar emails enviados na semana"
              disabled={criar.isPending}
              autoFocus
              maxLength={200}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label>Categoria</Label>
              <Select value={categoria} onValueChange={(v) => setCategoria(v as TarefaCategoria)} disabled={criar.isPending}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={(v) => setPrioridade(v as TarefaPrioridade)} disabled={criar.isPending}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORIDADES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="descricao">Descrição (opcional)</Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Detalhes, contexto, links..."
              rows={4}
              disabled={criar.isPending}
              maxLength={4000}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={criar.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={criar.isPending || !titulo.trim()}>
            {criar.isPending ? (
              <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Criando...</>
            ) : 'Criar tarefa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
