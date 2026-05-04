// ===========================================================================
// Página /cartao/:id — Fase 2: detalhes de um cartão.
// Mostra fatura por mês de vencimento, com lista de compras e total.
// Navegação ← / → entre meses.
// ===========================================================================

import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronLeft, ChevronRight, Plus, ArrowLeft, Trash2, CreditCard,
} from 'lucide-react';
import {
  useCartoes,
  useCartaoCompras,
  useDeleteCompra,
  useDeleteCompraGrupo,
  type CartaoCompra,
} from '@/hooks/useCartoes';
import { CompraFormModal } from '@/components/cartao/CompraFormModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { calcularDataFechamento } from '@/lib/cartao-fatura';

const fmtBRL = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

const fmtData = (iso: string) => {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

const fmtMesAno = (yyyymm: string) => {
  const [y, m] = yyyymm.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
};

const isoToYearMonth = (iso: string) => iso.slice(0, 7);

const mesAtualISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const navegarMes = (yyyymm: string, delta: number) => {
  const [y, m] = yyyymm.split('-').map(Number);
  const novoMes = m + delta;
  const novoAno = y + Math.floor((novoMes - 1) / 12);
  const mesNorm = ((((novoMes - 1) % 12) + 12) % 12) + 1;
  return `${novoAno}-${String(mesNorm).padStart(2, '0')}`;
};

export default function CartaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const { data: cartoes = [] } = useCartoes();
  const cartao = cartoes.find((c) => c.id === id);

  const [faturaMes, setFaturaMes] = useState(mesAtualISO);
  const [novaCompraOpen, setNovaCompraOpen] = useState(false);
  const [deleteCompra, setDeleteCompra] = useState<CartaoCompra | null>(null);

  const { data: todasCompras = [], isLoading } = useCartaoCompras(id ?? null);
  const { data: comprasFatura = [] } = useCartaoCompras(id ?? null, faturaMes);

  const delCompra = useDeleteCompra();
  const delGrupo = useDeleteCompraGrupo();

  // Lista de meses de fatura que têm compras (pra navegação inteligente)
  const mesesComCompras = useMemo(() => {
    const set = new Set<string>();
    todasCompras.forEach((c) => set.add(isoToYearMonth(c.fatura_vencimento)));
    set.add(mesAtualISO()); // garante mês atual disponível mesmo vazio
    return Array.from(set).sort();
  }, [todasCompras]);

  const totalFatura = useMemo(
    () => comprasFatura.reduce((acc, c) => acc + Number(c.valor_parcela), 0),
    [comprasFatura]
  );

  if (!id) return null;

  if (!cartao) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <Link to="/cartao" className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar
        </Link>
        <Card><CardContent className="p-6 text-sm">Cartão não encontrado.</CardContent></Card>
      </div>
    );
  }

  const dataVencFatura = `${faturaMes}-${String(cartao.dia_vencimento).padStart(2, '0')}`;
  const dataFechFatura = calcularDataFechamento(dataVencFatura, cartao.dia_fechamento);
  const fechouHoje = new Date(dataFechFatura + 'T23:59:59') < new Date();

  const indexAtual = mesesComCompras.indexOf(faturaMes);
  const mesAnterior = navegarMes(faturaMes, -1);
  const mesSeguinte = navegarMes(faturaMes, 1);

  return (
    <div className="container mx-auto p-4 lg:p-6 space-y-5">
      {/* Topo */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link
          to="/cartao"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Cartões
        </Link>
        <Button onClick={() => setNovaCompraOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova compra
        </Button>
      </div>

      {/* Header do cartão */}
      <Card>
        <CardContent className="p-5 flex items-center gap-4 flex-wrap">
          <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <CreditCard className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold tracking-tight">{cartao.nome}</h1>
            <p className="text-xs text-muted-foreground">
              {[cartao.bandeira, cartao.ultimos_4 ? `•••• ${cartao.ultimos_4}` : null]
                .filter(Boolean)
                .join(' · ')}
              {cartao.bandeira || cartao.ultimos_4 ? ' · ' : ''}
              fecha dia {cartao.dia_fechamento} · vence dia {cartao.dia_vencimento}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Navegação de fatura */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-2 p-4 border-b">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFaturaMes(mesAnterior)}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">{fmtMesAno(mesAnterior)}</span>
            </Button>

            <div className="text-center">
              <p className="text-xs text-muted-foreground">Fatura de</p>
              <p className="font-semibold capitalize">{fmtMesAno(faturaMes)}</p>
              <div className="flex items-center justify-center gap-2 mt-1">
                <Badge variant={fechouHoje ? 'secondary' : 'outline'} className="text-[10px]">
                  {fechouHoje ? 'Fechada' : 'Aberta'}
                </Badge>
                {faturaMes === mesAtualISO() && (
                  <Badge className="text-[10px]">Atual</Badge>
                )}
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFaturaMes(mesSeguinte)}
            >
              <span className="hidden sm:inline mr-1">{fmtMesAno(mesSeguinte)}</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Total + datas */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 text-sm border-b bg-muted/20">
            <div>
              <p className="text-xs text-muted-foreground">Fechamento</p>
              <p className="font-medium">{fmtData(dataFechFatura)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vencimento</p>
              <p className="font-medium">{fmtData(dataVencFatura)}</p>
            </div>
            <div className="col-span-2 sm:col-span-1 sm:text-right">
              <p className="text-xs text-muted-foreground">Total da fatura</p>
              <p className="font-bold text-base">{fmtBRL(totalFatura)}</p>
            </div>
          </div>

          {/* Lista de compras */}
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground text-center">Carregando…</div>
          ) : comprasFatura.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-sm text-muted-foreground">Nenhuma compra nesta fatura.</p>
              <Button variant="outline" size="sm" onClick={() => setNovaCompraOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Lançar compra
              </Button>
            </div>
          ) : (
            <ul className="divide-y">
              {comprasFatura.map((c) => (
                <li key={c.id} className="p-4 flex items-start gap-3 hover:bg-muted/30 transition-colors">
                  <div className="text-xs text-muted-foreground tabular-nums w-12 shrink-0 pt-0.5">
                    {fmtData(c.data_compra)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{c.descricao}</p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      {c.parcelas_total > 1 && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                          {c.parcela_numero}/{c.parcelas_total}
                        </Badge>
                      )}
                      {c.fornecedor && (
                        <span className="text-xs text-muted-foreground truncate">{c.fornecedor}</span>
                      )}
                      {c.categoria && (
                        <span className="text-xs text-muted-foreground">· {c.categoria}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold text-sm tabular-nums">{fmtBRL(Number(c.valor_parcela))}</p>
                    {c.parcelas_total > 1 && (
                      <p className="text-[10px] text-muted-foreground">
                        de {fmtBRL(Number(c.valor_total))}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteCompra(c)}
                    aria-label="Excluir compra"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Atalhos de meses com compras */}
      {mesesComCompras.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="text-muted-foreground">Faturas com lançamentos:</span>
          {mesesComCompras.map((m) => (
            <Button
              key={m}
              variant={m === faturaMes ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setFaturaMes(m)}
            >
              {fmtMesAno(m)}
            </Button>
          ))}
        </div>
      )}

      <CompraFormModal
        open={novaCompraOpen}
        onOpenChange={setNovaCompraOpen}
        cartao={cartao}
      />

      <AlertDialog
        open={!!deleteCompra}
        onOpenChange={(o) => !o && setDeleteCompra(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir compra?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteCompra && (
                <>
                  <strong>{deleteCompra.descricao}</strong>
                  {deleteCompra.parcelas_total > 1 ? (
                    <>
                      <br /><br />
                      Esta compra tem <strong>{deleteCompra.parcelas_total} parcelas</strong>.
                      Você pode excluir só esta parcela ({deleteCompra.parcela_numero}/{deleteCompra.parcelas_total})
                      ou a compra inteira (todas as parcelas).
                    </>
                  ) : (
                    <>
                      <br /><br />
                      Valor: {fmtBRL(Number(deleteCompra.valor_parcela))}
                    </>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="sm:mr-auto">Cancelar</AlertDialogCancel>
            {deleteCompra && deleteCompra.parcelas_total > 1 && deleteCompra.compra_grupo_id && (
              <Button
                variant="outline"
                onClick={async () => {
                  if (!deleteCompra.compra_grupo_id) return;
                  await delGrupo.mutateAsync(deleteCompra.compra_grupo_id);
                  setDeleteCompra(null);
                }}
              >
                Excluir todas as parcelas
              </Button>
            )}
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteCompra) return;
                await delCompra.mutateAsync(deleteCompra.id);
                setDeleteCompra(null);
              }}
            >
              {deleteCompra && deleteCompra.parcelas_total > 1 ? 'Só esta parcela' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
