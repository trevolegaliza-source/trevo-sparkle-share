// ===========================================================================
// Página /cartao — Fase 1: cadastro de cartão (placeholder de listagem).
// Fases futuras adicionam: lançar compra, listar fatura, fechar fatura.
// ===========================================================================

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, CreditCard, Pencil, Archive } from 'lucide-react';
import { useCartoes, useDeleteCartao } from '@/hooks/useCartoes';
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

export default function Cartao() {
  const { data: cartoes = [], isLoading } = useCartoes();
  const deleteCartao = useDeleteCartao();
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [archiveConfirm, setArchiveConfirm] = useState<{ id: string; nome: string } | null>(null);

  const ativos = cartoes.filter((c) => c.ativo);
  const arquivados = cartoes.filter((c) => !c.ativo);

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
                  <Button variant="outline" size="sm" className="w-full" disabled>
                    Ver fatura — em breve
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
