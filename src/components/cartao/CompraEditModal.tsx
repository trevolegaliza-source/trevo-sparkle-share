// ===========================================================================
// Modal de edição de compra existente.
// - Edita campos da row (descrição, fornecedor, valor, categoria, etc.)
// - Para parcelado/assinatura: oferece "aplicar a todas as parcelas/meses
//   futuros do mesmo grupo" (não toca em rows já em fatura fechada).
// - Bloqueia edição de valor se a row já está em fatura FECHADA (que virou
//   lançamento em Contas a Pagar) — pra evitar divergência de total.
// ===========================================================================

import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, Lock } from 'lucide-react';
import {
  useUpdateCompra,
  useUpdateCompraGrupo,
  type CartaoCompra,
} from '@/hooks/useCartoes';
import { CATEGORIAS_DESPESAS } from '@/constants/categorias-despesas';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  compra: CartaoCompra | null;
}

export function CompraEditModal({ open, onOpenChange, compra }: Props) {
  const updateOne = useUpdateCompra();
  const updateGrupo = useUpdateCompraGrupo();

  const [descricao, setDescricao] = useState('');
  const [fornecedor, setFornecedor] = useState('');
  const [valorParcela, setValorParcela] = useState<string | number>('');
  const [categoria, setCategoria] = useState('');
  const [subcategoria, setSubcategoria] = useState('');
  const [centroCusto, setCentroCusto] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [aplicarFuturas, setAplicarFuturas] = useState(false);

  useEffect(() => {
    if (open && compra) {
      setDescricao(compra.descricao);
      setFornecedor(compra.fornecedor ?? '');
      setValorParcela(Number(compra.valor_parcela));
      // categoria armazenada é a subcategoria. Recupera categoria-pai pelo lookup.
      const subcat = compra.categoria ?? '';
      setSubcategoria(subcat);
      let pai = '';
      for (const [k, v] of Object.entries(CATEGORIAS_DESPESAS)) {
        if ((v as any).subcategorias?.includes(subcat)) { pai = k; break; }
      }
      setCategoria(pai);
      setCentroCusto(compra.centro_custo ?? '');
      setObservacoes(compra.observacoes ?? '');
      setAplicarFuturas(false);
    }
  }, [open, compra]);

  if (!compra) return null;

  const isGrupo = !!compra.compra_grupo_id && compra.parcelas_total > 1;
  const ehAssinatura = compra.tipo === 'assinatura';
  const faturaJaFechada = !!compra.cartao_fatura_id;

  const subcategorias = categoria
    ? CATEGORIAS_DESPESAS[categoria as keyof typeof CATEGORIAS_DESPESAS]?.subcategorias ?? []
    : [];

  const valorNum =
    typeof valorParcela === 'number' ? valorParcela : Number(valorParcela) || 0;

  const handleSubmit = async () => {
    if (!descricao.trim()) return toast.error('Descrição é obrigatória.');
    if (valorNum <= 0) return toast.error('Valor deve ser maior que zero.');
    if (faturaJaFechada && Number(compra.valor_parcela) !== valorNum) {
      return toast.error(
        'Esta fatura já foi fechada. Reabra a fatura antes de alterar o valor.'
      );
    }

    const baseValues = {
      descricao: descricao.trim(),
      fornecedor: fornecedor.trim() || null,
      categoria: subcategoria || null,
      centro_custo: centroCusto.trim() || null,
      observacoes: observacoes.trim() || null,
    };

    try {
      if (aplicarFuturas && isGrupo && compra.compra_grupo_id) {
        // Atualiza esta + todas as futuras (não-fechadas) do mesmo grupo.
        // Pra assinatura: também atualiza valor_parcela.
        const valuesGrupo: Partial<CartaoCompra> = { ...baseValues };
        if (ehAssinatura) {
          (valuesGrupo as any).valor_parcela = valorNum;
          (valuesGrupo as any).valor_total = valorNum;
        }
        await updateGrupo.mutateAsync({
          compraGrupoId: compra.compra_grupo_id,
          values: valuesGrupo,
          apenasAPartirDe: compra.fatura_vencimento,
        });
      } else {
        // Atualiza só esta row.
        const valuesUm: Partial<CartaoCompra> = { ...baseValues };
        if (Number(compra.valor_parcela) !== valorNum) {
          (valuesUm as any).valor_parcela = valorNum;
        }
        await updateOne.mutateAsync({ id: compra.id, ...valuesUm });
      }
      onOpenChange(false);
    } catch {}
  };

  const isPending = updateOne.isPending || updateGrupo.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar compra</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {faturaJaFechada && (
            <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 text-xs flex items-start gap-2">
              <Lock className="h-3.5 w-3.5 mt-0.5 text-amber-600 shrink-0" />
              <p>
                Esta parcela está em <strong>fatura fechada</strong>. Você pode
                editar descrição/categoria/observações, mas <strong>não o valor</strong>.
                Pra alterar valor, reabra a fatura primeiro.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Descrição *</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Fornecedor</Label>
              <Input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>
                {ehAssinatura ? 'Valor desta fatura (R$)' : 'Valor da parcela (R$)'}
              </Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                inputMode="decimal"
                disabled={faturaJaFechada}
                value={valorParcela}
                onChange={(e) =>
                  setValorParcela(e.target.value === '' ? '' : Number(e.target.value))
                }
              />
            </div>
          </div>

          {isGrupo && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <Label htmlFor="aplicar-futuras" className="text-sm cursor-pointer">
                    Aplicar a esta e às {ehAssinatura ? 'mensalidades' : 'parcelas'} futuras
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    {ehAssinatura
                      ? 'Útil quando a assinatura sobe de preço a partir deste mês.'
                      : 'Mantém faturas já fechadas intactas — só mexe nas abertas.'}
                  </p>
                </div>
                <Switch
                  id="aplicar-futuras"
                  checked={aplicarFuturas}
                  onCheckedChange={setAplicarFuturas}
                />
              </div>
            </div>
          )}

          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors group">
              <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180" />
              Categoria, centro de custo e observações
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select
                    value={categoria || undefined}
                    onValueChange={(v) => { setCategoria(v); setSubcategoria(''); }}
                  >
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
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
                    value={subcategoria || undefined}
                    onValueChange={setSubcategoria}
                    disabled={!subcategorias.length}
                  >
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {subcategorias.map((s: string) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Centro de custo</Label>
                <Input value={centroCusto} onChange={(e) => setCentroCusto(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  rows={2}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
