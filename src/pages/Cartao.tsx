// ===========================================================================
// Página /cartao — Fase 1: cadastro de cartão (placeholder de listagem).
// Fases futuras adicionam: lançar compra, listar fatura, fechar fatura.
// ===========================================================================

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, CreditCard, Pencil, Archive, Repeat, AlertCircle } from 'lucide-react';
import { useCartoes, useDeleteCartao } from '@/hooks/useCartoes';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { CartaoFormModal } from '@/components/cartao/CartaoFormModal';
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

const fmtBRL = (n: number | null | undefined) =>
  n == null
    ? '—'
    : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

// Busca a ÚLTIMA fatura de cada assinatura (compra_grupo_id) ativa.
// Se a última fatura estiver a <= 2 meses da hoje, mostra alerta de renovação.
function useAssinaturasExpirando() {
  return useQuery({
    queryKey: ['assinaturas_expirando'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cartao_compras')
        .select('compra_grupo_id, descricao, fornecedor, fatura_vencimento, parcela_numero, parcelas_total, cartao_id')
        .eq('tipo', 'assinatura')
        .order('fatura_vencimento', { ascending: false });
      if (error) throw error;

      // Agrupa por compra_grupo_id, pega a row com maior parcela_numero (= última fatura)
      const porGrupo = new Map<string, any>();
      (data || []).forEach((r: any) => {
        if (!r.compra_grupo_id) return;
        const atual = porGrupo.get(r.compra_grupo_id);
        if (!atual || r.parcela_numero > atual.parcela_numero) {
          porGrupo.set(r.compra_grupo_id, r);
        }
      });

      const hoje = new Date();
      const dois_meses_em_dias = 62;
      const expirando: any[] = [];
      porGrupo.forEach((r) => {
        const dVenc = new Date(r.fatura_vencimento + 'T12:00:00');
        const diffMs = dVenc.getTime() - hoje.getTime();
        const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (diffDias <= dois_meses_em_dias && diffDias >= -7) {
          expirando.push({ ...r, diasParaExpirar: diffDias });
        }
      });
      // Ordem: mais próxima de expirar primeiro
      expirando.sort((a, b) => a.diasParaExpirar - b.diasParaExpirar);
      return expirando;
    },
  });
}

export default function Cartao() {
  const { data: cartoes = [], isLoading } = useCartoes();
  const { data: expirando = [] } = useAssinaturasExpirando();
  const deleteCartao = useDeleteCartao();
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [archiveConfirm, setArchiveConfirm] = useState<{ id: string; nome: string } | null>(null);

  const ativos = cartoes.filter((c) => c.ativo);
  const arquivados = cartoes.filter((c) => !c.ativo);

  const cartaoNomeMap = useMemo(() => {
    const m = new Map<string, string>();
    cartoes.forEach((c) => m.set(c.id, c.nome));
    return m;
  }, [cartoes]);

  const editingCartao = editId ? cartoes.find((c) => c.id === editId) : null;

  return (
    <div className="container mx-auto p-4 lg:p-6 space-y-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CreditCard className="h-6 w-6" />
            Cartão de Crédito
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastre seus cartões, lance compras e veja a fatura mensal.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditId(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo cartão
        </Button>
      </header>

      {expirando.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/60 dark:bg-amber-950/10">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm font-medium">
                {expirando.length === 1
                  ? '1 assinatura está perto de expirar'
                  : `${expirando.length} assinaturas estão perto de expirar`}
              </p>
            </div>
            <ul className="text-xs space-y-1">
              {expirando.slice(0, 5).map((a) => (
                <li key={a.compra_grupo_id} className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <Repeat className="h-3 w-3 shrink-0 text-amber-700" />
                    <strong className="truncate">{a.descricao}</strong>
                    <span className="text-muted-foreground">· {cartaoNomeMap.get(a.cartao_id) ?? '?'}</span>
                  </span>
                  <span className="text-muted-foreground shrink-0">
                    {a.diasParaExpirar < 0
                      ? `expirou há ${Math.abs(a.diasParaExpirar)}d`
                      : a.diasParaExpirar === 0
                      ? 'expira hoje'
                      : `${a.diasParaExpirar}d (última fatura ${a.parcela_numero}/${a.parcelas_total})`}
                  </span>
                </li>
              ))}
              {expirando.length > 5 && (
                <li className="text-muted-foreground italic">…e mais {expirando.length - 5}</li>
              )}
            </ul>
            <p className="text-[11px] text-muted-foreground pt-1">
              Renove cadastrando a mesma assinatura como nova compra (ela continuará a partir do próximo mês).
            </p>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Carregando cartões…
          </CardContent>
        </Card>
      )}

      {!isLoading && ativos.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center space-y-3">
            <CreditCard className="h-10 w-10 mx-auto text-muted-foreground/50" />
            <div>
              <p className="font-medium">Nenhum cartão cadastrado</p>
              <p className="text-sm text-muted-foreground mt-1">
                Cadastre seu primeiro cartão pra começar a lançar compras e ver a fatura.
              </p>
            </div>
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Cadastrar cartão
            </Button>
          </CardContent>
        </Card>
      )}

      {ativos.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ativos.map((c) => (
            <Card key={c.id} className="overflow-hidden">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{c.nome}</h3>
                    {(c.bandeira || c.ultimos_4) && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {[c.bandeira, c.ultimos_4 ? `•••• ${c.ultimos_4}` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setEditId(c.id);
                        setFormOpen(true);
                      }}
                      aria-label="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setArchiveConfirm({ id: c.id, nome: c.nome })}
                      aria-label="Arquivar"
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Fechamento</p>
                    <p className="font-medium">dia {c.dia_fechamento}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Vencimento</p>
                    <p className="font-medium">dia {c.dia_vencimento}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Limite</p>
                    <p className="font-medium">{fmtBRL(c.limite)}</p>
                  </div>
                </div>

                <div className="pt-3 border-t">
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link to={`/cartao/${c.id}`}>Abrir fatura</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {arquivados.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            {arquivados.length} cartão(ões) arquivado(s)
          </summary>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 mt-3">
            {arquivados.map((c) => (
              <Card key={c.id} className="opacity-60">
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{c.nome}</p>
                    <p className="text-xs text-muted-foreground">arquivado</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditId(c.id);
                      setFormOpen(true);
                    }}
                  >
                    Abrir
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </details>
      )}

      <CartaoFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        cartao={editingCartao || null}
      />

      <AlertDialog
        open={!!archiveConfirm}
        onOpenChange={(o) => !o && setArchiveConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar cartão?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{archiveConfirm?.nome}</strong> ficará oculto da lista principal.
              Compras e faturas históricas continuam visíveis. Você pode reativar
              depois clicando em "Abrir" na lista de arquivados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!archiveConfirm) return;
                await deleteCartao.mutateAsync(archiveConfirm.id);
                setArchiveConfirm(null);
              }}
            >
              Arquivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
