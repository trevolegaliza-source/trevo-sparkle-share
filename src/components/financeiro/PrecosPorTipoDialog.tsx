/**
 * Dialog: CRUD de preços diferenciados por tipo de processo.
 * 25/05/2026: caso VITAE (R$ 540 abertura, demais tipos = valor_base normal).
 * Backend já consumia via get_preco_por_tipo() — esta UI substitui SQL manual.
 *
 * Comportamento:
 *  - Lista atual (max 6 linhas, um por tipo) com botão excluir individual
 *  - Linha "Adicionar" com select de tipos ainda não configurados + input valor
 *  - Override APENAS sobrescreve valor base; urgência e mudança UF continuam aplicando
 */
import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Trash2, Plus, Loader2, TagIcon } from 'lucide-react';
import {
  useClientePrecosPorTipo,
  useUpsertClientePrecoTipo,
  useDeleteClientePrecoTipo,
} from '@/hooks/useFinanceiro';
import type { TipoProcesso } from '@/types/financial';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clienteId: string;
  clienteNome: string;
  valorBase: number;
}

const TIPOS: { value: TipoProcesso; label: string }[] = [
  { value: 'abertura' as TipoProcesso, label: 'Abertura' },
  { value: 'alteracao' as TipoProcesso, label: 'Alteração' },
  { value: 'transformacao' as TipoProcesso, label: 'Transformação' },
  { value: 'baixa' as TipoProcesso, label: 'Baixa' },
  { value: 'avulso' as TipoProcesso, label: 'Avulso' },
  { value: 'orcamento' as TipoProcesso, label: 'Orçamento' },
];

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function PrecosPorTipoDialog({
  open, onOpenChange, clienteId, clienteNome, valorBase,
}: Props) {
  const { data: precos, isLoading } = useClientePrecosPorTipo(clienteId);
  const upsert = useUpsertClientePrecoTipo();
  const del = useDeleteClientePrecoTipo();

  const [novoTipo, setNovoTipo] = useState<TipoProcesso | ''>('');
  const [novoValor, setNovoValor] = useState<string>('');

  const tiposJaUsados = useMemo(
    () => new Set((precos || []).map((p) => p.tipo)),
    [precos]
  );
  const tiposDisponiveis = TIPOS.filter((t) => !tiposJaUsados.has(t.value));

  const handleAdicionar = async () => {
    if (!novoTipo || !novoValor) {
      toast.error('Selecione tipo e valor.');
      return;
    }
    const valorNum = Number(novoValor);
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      toast.error('Valor inválido.');
      return;
    }
    await upsert.mutateAsync({
      cliente_id: clienteId,
      tipo: novoTipo as TipoProcesso,
      valor: valorNum,
    });
    setNovoTipo('');
    setNovoValor('');
  };

  const handleSalvarEdicao = async (tipo: TipoProcesso, valor: number) => {
    if (!Number.isFinite(valor) || valor <= 0) {
      toast.error('Valor inválido.');
      return;
    }
    await upsert.mutateAsync({ cliente_id: clienteId, tipo, valor });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TagIcon className="h-4 w-4" />
            Preços diferenciados por tipo
          </DialogTitle>
          <DialogDescription>
            {clienteNome} — Valor base atual:{' '}
            <span className="font-semibold">{fmtBRL(valorBase)}</span>.
            Preços abaixo sobrescrevem o valor base para o tipo específico.
            Urgência e mudança de UF continuam se aplicando por cima.
          </DialogDescription>
        </DialogHeader>

        {/* Lista atual */}
        <div className="space-y-2 pt-2">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : (precos || []).length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              Nenhum preço diferenciado configurado. Cliente usa{' '}
              <span className="font-semibold">{fmtBRL(valorBase)}</span> para todos os tipos.
            </p>
          ) : (
            (precos || []).map((p) => (
              <PrecoLinha
                key={p.id}
                tipoLabel={TIPOS.find((t) => t.value === p.tipo)?.label || p.tipo}
                valorInicial={p.valor}
                onSave={(v) => handleSalvarEdicao(p.tipo, v)}
                onDelete={() => del.mutate({ id: p.id, cliente_id: clienteId })}
                disabled={upsert.isPending || del.isPending}
              />
            ))
          )}
        </div>

        {/* Adicionar */}
        {tiposDisponiveis.length > 0 && (
          <div className="pt-3 border-t space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Adicionar regra
            </Label>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Select
                  value={novoTipo}
                  onValueChange={(v) => setNovoTipo(v as TipoProcesso)}
                  disabled={upsert.isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposDisponiveis.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="R$ valor"
                  value={novoValor}
                  onChange={(e) => setNovoValor(e.target.value)}
                  disabled={upsert.isPending}
                />
              </div>
              <Button
                onClick={handleAdicionar}
                disabled={upsert.isPending || !novoTipo || !novoValor}
                size="sm"
              >
                {upsert.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface LinhaProps {
  tipoLabel: string;
  valorInicial: number;
  onSave: (v: number) => void;
  onDelete: () => void;
  disabled: boolean;
}

/**
 * Linha editável: clica no valor → vira input → blur ou Enter salva.
 * Evita "modo edição global" que confunde quando há várias regras.
 */
function PrecoLinha({ tipoLabel, valorInicial, onSave, onDelete, disabled }: LinhaProps) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(valorInicial.toString());

  const commit = () => {
    const v = Number(valor);
    if (Number.isFinite(v) && v > 0 && v !== valorInicial) {
      onSave(v);
    } else {
      setValor(valorInicial.toString());
    }
    setEditando(false);
  };

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border bg-muted/30">
      <span className="text-sm font-medium flex-1">{tipoLabel}</span>
      {editando ? (
        <Input
          autoFocus
          type="number"
          step="0.01"
          min="0"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setValor(valorInicial.toString());
              setEditando(false);
            }
          }}
          className="w-32 h-8"
          disabled={disabled}
        />
      ) : (
        <button
          onClick={() => setEditando(true)}
          className="text-sm font-semibold w-32 text-right tabular-nums hover:underline"
          disabled={disabled}
          title="Clique pra editar"
        >
          {fmtBRL(valorInicial)}
        </button>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        disabled={disabled}
        className="h-8 w-8 text-destructive hover:text-destructive"
        title="Remover regra"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
