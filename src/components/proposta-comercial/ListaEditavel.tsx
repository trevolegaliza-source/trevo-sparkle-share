/**
 * ListaEditavel — chips ativos/inativos + modo edição expandido onde Thales
 * customiza label, valor, descrição de cada item, adiciona itens novos e
 * remove os que não quiser. Pensado pra Serviços, Naturezas e Inclusos.
 *
 * Filosofia: defaults são SUGESTÕES, não cárcere. Thales tem liberdade total.
 */
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ChevronDown, ChevronRight, Plus, Trash2, Sparkles } from 'lucide-react';
import { type ItemEditavel, gerarIdCustomizado, fmtBRL } from '@/lib/terceirizacao-engine';

interface Props {
  titulo: string;
  subtitulo?: string;
  icon?: React.ComponentType<{ className?: string }>;
  itens: ItemEditavel[];
  onChange: (itens: ItemEditavel[]) => void;
  /** Se true, mostra inputs de valor (pra "Inclusos"). Se false, esconde (pra Serviços/Naturezas). */
  mostrarValor?: boolean;
  /** Se true, mostra campo de descrição. */
  mostrarDescricao?: boolean;
  /** Cor dos chips ativos. */
  corAtivo?: string;
}

export function ListaEditavel({
  titulo, subtitulo, icon: Icon, itens, onChange,
  mostrarValor = false, mostrarDescricao = false,
  corAtivo = 'bg-emerald-600 border-emerald-600 text-white',
}: Props) {
  const [editando, setEditando] = useState(false);

  const toggle = (id: string) => {
    onChange(itens.map((it) => it.id === id ? { ...it, ativo: !it.ativo } : it));
  };

  const update = (id: string, patch: Partial<ItemEditavel>) => {
    onChange(itens.map((it) => it.id === id ? { ...it, ...patch } : it));
  };

  const remover = (id: string) => {
    onChange(itens.filter((it) => it.id !== id));
  };

  const adicionar = () => {
    onChange([
      ...itens,
      {
        id: gerarIdCustomizado(),
        label: '',
        valor: mostrarValor ? 0 : 0,
        ativo: true,
        customizado: true,
        descricao: '',
      },
    ]);
    setEditando(true);
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              {Icon && <Icon className="h-4 w-4" />} {titulo}
            </div>
            {subtitulo && (
              <p className="text-xs text-muted-foreground mt-1">{subtitulo}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setEditando((e) => !e)}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            {editando ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            {editando ? 'Recolher edição' : 'Personalizar'}
          </button>
        </div>

        {/* Chips compactos (sempre visíveis) */}
        {!editando && (
          <div className="flex flex-wrap gap-2">
            {itens.map((it) => (
              <button
                key={it.id}
                type="button"
                onClick={() => toggle(it.id)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium border transition-all inline-flex items-center gap-1.5',
                  it.ativo ? corAtivo + ' shadow-sm' : 'bg-muted/30 border-border text-muted-foreground line-through hover:bg-muted/60'
                )}
                title={it.descricao || it.label}
              >
                {it.customizado && <Sparkles className="h-3 w-3" />}
                {it.label || '(sem nome)'}
                {mostrarValor && (it.valor ?? 0) > 0 && (
                  <span className="text-[10px] opacity-70">+{fmtBRL(it.valor || 0)}</span>
                )}
              </button>
            ))}
            <button
              type="button"
              onClick={adicionar}
              className="px-3 py-1.5 rounded-md text-xs font-medium border border-dashed text-muted-foreground hover:bg-muted/30 inline-flex items-center gap-1"
            >
              <Plus className="h-3 w-3" /> Adicionar
            </button>
          </div>
        )}

        {/* Modo edição expandido (linhas editáveis) */}
        {editando && (
          <div className="space-y-2">
            {itens.length === 0 && (
              <p className="text-xs text-muted-foreground py-4 text-center">
                Nenhum item ainda. Clique "+ Adicionar item" pra começar.
              </p>
            )}
            {itens.map((it) => (
              <div
                key={it.id}
                className={cn(
                  'p-3 rounded-md border space-y-2',
                  it.ativo ? 'bg-emerald-50/40 border-emerald-200 dark:bg-emerald-950/20' : 'bg-muted/20 border-border'
                )}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={it.ativo}
                    onChange={() => toggle(it.id)}
                    className="mt-1.5 h-4 w-4 rounded cursor-pointer"
                  />
                  <div className="flex-1 space-y-2">
                    <div className={cn('grid gap-2', mostrarValor ? 'grid-cols-[1fr_120px]' : 'grid-cols-1')}>
                      <Input
                        value={it.label}
                        onChange={(e) => update(it.id, { label: e.target.value })}
                        placeholder="Nome do item"
                        className="h-8 text-sm"
                      />
                      {mostrarValor && (
                        <Input
                          type="number"
                          value={it.valor ?? 0}
                          onChange={(e) => update(it.id, { valor: Number(e.target.value) || 0 })}
                          placeholder="Valor +R$"
                          step="0.01"
                          min="0"
                          className="h-8 text-sm tabular-nums"
                        />
                      )}
                    </div>
                    {mostrarDescricao && (
                      <Textarea
                        value={it.descricao || ''}
                        onChange={(e) => update(it.id, { descricao: e.target.value })}
                        placeholder="Descrição (opcional — aparece pro cliente na proposta)"
                        rows={2}
                        className="text-xs"
                      />
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remover(it.id)}
                    className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                    title="Remover item"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {it.customizado && (
                  <p className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                    <Sparkles className="h-2.5 w-2.5" /> Item customizado
                  </p>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={adicionar}
              className="w-full border-dashed"
            >
              <Plus className="h-4 w-4 mr-1" /> Adicionar item personalizado
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
