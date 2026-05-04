// ===========================================================================
// Modal de lançamento de compra no cartão.
// 3 tipos:
//   - À vista: 1 row, valor cheio
//   - Parcelado: N rows, valor_total / N (TV em 6x)
//   - Assinatura: N rows, valor cheio em CADA fatura (SaaS R$ X/mês × N meses)
// Cada parcela vira uma row em cartao_compras com mesmo compra_grupo_id.
// ===========================================================================

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import {
  useCreateCompra,
  type Cartao,
  type CartaoCompra,
  type CompraTipo,
} from '@/hooks/useCartoes';
import {
  calcularVencimentoFatura,
  somarMesesAoVencimento,
  calcularValoresParcelas,
} from '@/lib/cartao-fatura';
import { CATEGORIAS_DESPESAS } from '@/constants/categorias-despesas';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cartao: Cartao;
}

const fmtBRL = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

const fmtMesAno = (iso: string) => {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const EMPTY = {
  data_compra: todayISO(),
  descricao: '',
  fornecedor: '',
  valor_total: '' as string | number,
  tipo: 'avista' as CompraTipo,
  parcelas_total: 1,
  meses_assinatura: 12,
  categoria: '',
  subcategoria: '',
  centro_custo: '',
  observacoes: '',
};

export function CompraFormModal({ open, onOpenChange, cartao }: Props) {
  const create = useCreateCompra();
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (open) setForm({ ...EMPTY, data_compra: todayISO() });
  }, [open]);

  const valorNum =
    typeof form.valor_total === 'number' ? form.valor_total : Number(form.valor_total) || 0;

  // Quantas rows vão ser criadas
  const numRows = useMemo(() => {
    if (form.tipo === 'avista') return 1;
    if (form.tipo === 'parcelado') return Math.max(1, Math.min(24, Number(form.parcelas_total) || 1));
    return Math.max(1, Math.min(120, Number(form.meses_assinatura) || 1));
  }, [form.tipo, form.parcelas_total, form.meses_assinatura]);

  // Valores de cada row (depende do tipo)
  const valoresPorRow = useMemo(() => {
    if (valorNum <= 0) return [];
    if (form.tipo === 'parcelado') return calcularValoresParcelas(valorNum, numRows);
    // avista (1) ou assinatura (cada mês = valor cheio)
    return Array.from({ length: numRows }, () => valorNum);
  }, [form.tipo, valorNum, numRows]);

  // Preview de em quais faturas a compra vai cair
  const preview = useMemo(() => {
    if (!form.data_compra || valorNum <= 0) return null;
    const venc1 = calcularVencimentoFatura(
      form.data_compra,
      cartao.dia_fechamento,
      cartao.dia_vencimento
    );
    return Array.from({ length: numRows }, (_, i) => ({
      indice: i + 1,
      vencimento: somarMesesAoVencimento(venc1, i),
      valor: valoresPorRow[i] ?? 0,
    }));
  }, [form.data_compra, valorNum, numRows, valoresPorRow, cartao.dia_fechamento, cartao.dia_vencimento]);

  const totalSerie = useMemo(
    () => valoresPorRow.reduce((acc, v) => acc + v, 0),
    [valoresPorRow]
  );

  const subcategorias = form.categoria
    ? CATEGORIAS_DESPESAS[form.categoria as keyof typeof CATEGORIAS_DESPESAS]?.subcategorias ?? []
    : [];

  const handleSubmit = async () => {
    if (!form.data_compra) return toast.error('Data da compra é obrigatória.');
    if (!form.descricao.trim()) return toast.error('Descrição é obrigatória.');
    if (valorNum <= 0) return toast.error('Valor deve ser maior que zero.');
    if (form.tipo === 'parcelado' && (numRows < 2 || numRows > 24)) {
      return toast.error('Parcelas deve ser entre 2 e 24.');
    }
    if (form.tipo === 'assinatura' && (numRows < 1 || numRows > 120)) {
      return toast.error('Meses de assinatura deve ser entre 1 e 120.');
    }

    const grupoId = numRows > 1 ? crypto.randomUUID() : null;
    const venc1 = calcularVencimentoFatura(
      form.data_compra,
      cartao.dia_fechamento,
      cartao.dia_vencimento
    );

    const rows: Partial<CartaoCompra>[] = Array.from({ length: numRows }, (_, i) => ({
      cartao_id: cartao.id,
      data_compra: form.data_compra,
      descricao: form.descricao.trim(),
      fornecedor: form.fornecedor.trim() || null,
      valor_total: valorNum,
      parcelas_total: numRows,
      parcela_numero: i + 1,
      valor_parcela: valoresPorRow[i],
      fatura_vencimento: somarMesesAoVencimento(venc1, i),
      categoria: form.subcategoria || null,
      centro_custo: form.centro_custo.trim() || null,
      observacoes: form.observacoes.trim() || null,
      compra_grupo_id: grupoId,
      tipo: form.tipo,
    }));

    try {
      await create.mutateAsync(rows);
      onOpenChange(false);
    } catch {}
  };

  const labelValor =
    form.tipo === 'assinatura' ? 'Valor por mês (R$) *' : 'Valor total (R$) *';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova compra · {cartao.nome}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Tipo de compra */}
          <div className="space-y-2">
            <Label>Tipo de compra</Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { v: 'avista', label: 'À vista', hint: '1 fatura' },
                { v: 'parcelado', label: 'Parcelado', hint: 'TV em 6x' },
                { v: 'assinatura', label: 'Assinatura', hint: 'SaaS/mês' },
              ] as { v: CompraTipo; label: string; hint: string }[]).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setForm({ ...form, tipo: opt.v })}
                  className={`rounded-md border p-2.5 text-left transition-colors ${
                    form.tipo === opt.v
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-[10px] text-muted-foreground">{opt.hint}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="data_compra">Data da compra *</Label>
              <Input
                id="data_compra"
                type="date"
                value={form.data_compra}
                onChange={(e) => setForm({ ...form, data_compra: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="valor">{labelValor}</Label>
              <Input
                id="valor"
                type="number"
                step="0.01"
                min={0}
                inputMode="decimal"
                value={form.valor_total}
                onChange={(e) =>
                  setForm({ ...form, valor_total: e.target.value === '' ? '' : Number(e.target.value) })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição *</Label>
            <Input
              id="descricao"
              placeholder={
                form.tipo === 'assinatura'
                  ? 'Ex.: Z-API.IO (assinatura mensal)'
                  : 'Ex.: Anuidade Adobe'
              }
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="fornecedor">Fornecedor</Label>
              <Input
                id="fornecedor"
                placeholder="Opcional"
                value={form.fornecedor}
                onChange={(e) => setForm({ ...form, fornecedor: e.target.value })}
              />
            </div>
            {form.tipo === 'parcelado' && (
              <div className="space-y-2">
                <Label htmlFor="parcelas">Parcelas</Label>
                <Input
                  id="parcelas"
                  type="number"
                  min={2}
                  max={24}
                  value={form.parcelas_total}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      parcelas_total: Math.max(2, Math.min(24, Number(e.target.value) || 2)),
                    })
                  }
                />
              </div>
            )}
            {form.tipo === 'assinatura' && (
              <div className="space-y-2">
                <Label htmlFor="meses">Por quantos meses?</Label>
                <Input
                  id="meses"
                  type="number"
                  min={1}
                  max={120}
                  value={form.meses_assinatura}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      meses_assinatura: Math.max(1, Math.min(120, Number(e.target.value) || 12)),
                    })
                  }
                />
                <p className="text-[10px] text-muted-foreground">
                  Padrão 12. Você recebe um aviso 2 meses antes de expirar.
                </p>
              </div>
            )}
          </div>

          {preview && preview.length > 0 && (
            <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
              <p className="font-medium text-foreground">
                {form.tipo === 'avista' && 'Cai em 1 fatura:'}
                {form.tipo === 'parcelado' &&
                  `Parcelado em ${numRows}x · total ${fmtBRL(totalSerie)}`}
                {form.tipo === 'assinatura' &&
                  `Assinatura: ${numRows}× ${fmtBRL(valorNum)} · total ${fmtBRL(totalSerie)}`}
              </p>
              {preview.slice(0, 3).map((p) => (
                <p key={p.indice} className="text-muted-foreground">
                  {form.tipo === 'parcelado' && `${p.indice}/${numRows} · `}
                  {form.tipo === 'assinatura' && `Mês ${p.indice}/${numRows} · `}
                  {fmtMesAno(p.vencimento)} · {fmtBRL(p.valor)}
                </p>
              ))}
              {preview.length > 3 && (
                <p className="text-muted-foreground italic">
                  …e mais {preview.length - 3}
                </p>
              )}
            </div>
          )}

          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors group">
              <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180" />
              Categoria, centro de custo e observações (opcional)
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select
                    value={form.categoria || undefined}
                    onValueChange={(v) => setForm({ ...form, categoria: v, subcategoria: '' })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORIAS_DESPESAS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{(v as any).label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Subcategoria</Label>
                  <Select
                    value={form.subcategoria || undefined}
                    onValueChange={(v) => setForm({ ...form, subcategoria: v })}
                    disabled={!subcategorias.length}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {subcategorias.map((s: string) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="centro_custo">Centro de custo</Label>
                <Input
                  id="centro_custo"
                  value={form.centro_custo}
                  onChange={(e) => setForm({ ...form, centro_custo: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="obs">Observações</Label>
                <Textarea
                  id="obs"
                  rows={2}
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={create.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={create.isPending}>
            {create.isPending ? 'Lançando…' : 'Lançar compra'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
