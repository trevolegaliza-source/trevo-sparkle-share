import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { CATEGORIAS_DESPESAS, type CategoriaKey } from '@/constants/categorias-despesas';
import { useColaboradores } from '@/hooks/useColaboradores';
import type { DespesaRecorrente } from '@/hooks/useContasPagar';
import * as LucideIcons from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: Record<string, any>) => void;
  editData?: DespesaRecorrente | null;
}

export default function RecorrenteFormModal({ open, onClose, onSave, editData }: Props) {
  const { data: colaboradores } = useColaboradores();
  const activeColabs = (colaboradores || []).filter(c => c.status === 'ativo');

  const [categoria, setCategoria] = useState<CategoriaKey>('infraestrutura');
  const [subcategoria, setSubcategoria] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [diaVencimento, setDiaVencimento] = useState('10');
  const [fornecedor, setFornecedor] = useState('');
  const [vincularColab, setVincularColab] = useState(false);
  const [colaboradorId, setColaboradorId] = useState('');
  const [observacoes, setObservacoes] = useState('');

  useEffect(() => {
    if (editData) {
      setCategoria((editData.categoria || 'outros') as CategoriaKey);
      setSubcategoria(editData.subcategoria || '');
      setDescricao(editData.descricao || '');
      setValor(String(editData.valor || ''));
      setDiaVencimento(String(editData.dia_vencimento || '10'));
      setFornecedor(editData.fornecedor || '');
      setColaboradorId(editData.colaborador_id || '');
      setVincularColab(!!editData.colaborador_id);
      setObservacoes(editData.observacoes || '');
    } else {
      setCategoria('infraestrutura');
      setSubcategoria('');
      setDescricao('');
      setValor('');
      setDiaVencimento('10');
      setFornecedor('');
      setVincularColab(false);
      setColaboradorId('');
      setObservacoes('');
    }
  }, [editData, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valor) return;
    const descFinal = `${subcategoria || categoria}${descricao ? ' - ' + descricao : ''}`;
    const data: Record<string, any> = {
      descricao: descFinal,
      categoria,
      subcategoria: subcategoria || null,
      valor: Number(valor),
      dia_vencimento: Number(diaVencimento),
      fornecedor: fornecedor || null,
      colaborador_id: vincularColab && colaboradorId ? colaboradorId : null,
      ativo: true,
      data_inicio: new Date().toISOString().split('T')[0],
      observacoes: observacoes || null,
    };
    if (editData?.id) data.id = editData.id;
    onSave(data);
    onClose();
  };

  const subcategorias = CATEGORIAS_DESPESAS[categoria]?.subcategorias || [];

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editData ? 'Editar Recorrente' : 'Nova Despesa Recorrente'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid gap-2">
            <Label>Categoria *</Label>
            <Select value={categoria} onValueChange={v => { setCategoria(v as CategoriaKey); setSubcategoria(''); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORIAS_DESPESAS).map(([k, v]) => {
                  const Icon = (LucideIcons as any)[v.icon] || LucideIcons.Circle;
                  return <SelectItem key={k} value={k}><div className="flex items-center gap-2"><Icon className="h-3.5 w-3.5" style={{ color: v.color }} />{v.label}</div></SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Subcategoria</Label>
            <Select value={subcategoria} onValueChange={setSubcategoria}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {subcategorias.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Descrição</Label>
            <Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Detalhes..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Valor Mensal *</Label>
              <Input type="number" step="0.01" min="0" required value={valor} onChange={e => setValor(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Dia do Vencimento</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={diaVencimento}
                onChange={e => {
                  const v = parseInt(e.target.value || '0', 10);
                  if (Number.isNaN(v)) return setDiaVencimento('');
                  if (v < 1) return setDiaVencimento('1');
                  if (v > 31) return setDiaVencimento('31');
                  setDiaVencimento(String(v));
                }}
              />
              <p className="text-[10px] text-muted-foreground leading-tight">
                Dias 29-31 ajustam automaticamente em fevereiro (vai pro último dia do mês).
              </p>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Fornecedor</Label>
            <Input value={fornecedor} onChange={e => setFornecedor(e.target.value)} />
          </div>
          <div className="rounded-lg border border-border/60 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">🔗 Vincular Colaborador</Label>
              <Switch checked={vincularColab} onCheckedChange={c => { setVincularColab(c); if (!c) setColaboradorId(''); }} />
            </div>
            {vincularColab && (
              <Select value={colaboradorId} onValueChange={setColaboradorId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {activeColabs.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="grid gap-2">
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
            <Button type="submit">{editData ? 'Salvar' : 'Criar Recorrente'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
