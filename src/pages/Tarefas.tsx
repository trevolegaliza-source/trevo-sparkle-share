/**
 * Tarefas — checklist single source of truth de pendências.
 * 25/05/2026: substitui consulta manual aos 7+ docs .md.
 *
 * UX:
 *  - Agrupado por prioridade (crítica → alta → média → baixa)
 *  - Pendentes no topo; feitas/canceladas/adiadas em accordion no final
 *  - Checkbox inline pra marcar como feito
 *  - Click no item → modal com descrição completa + link pro .md
 *  - Filtro por categoria + busca por título
 *  - Botão "+ Nova" pra adicionar manualmente
 */
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Plus, Search, MoreVertical, FileText, GitCommit, Tag,
  CheckCircle2, XCircle, Clock, ChevronDown, ChevronRight, Sparkles, User,
} from 'lucide-react';
import {
  useTarefas, useAtualizarStatusTarefa, useDeletarTarefa,
  type Tarefa, type TarefaCategoria, type TarefaPrioridade, type TarefaStatus,
} from '@/hooks/useTarefas';
import { NovaTarefaDialog } from '@/components/tarefas/NovaTarefaDialog';
import { SkeletonList } from '@/components/ui/skeleton-patterns';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';

const PRIORIDADE_ORDEM: Record<TarefaPrioridade, number> = {
  critica: 0, alta: 1, media: 2, baixa: 3,
};

const PRIORIDADE_LABEL: Record<TarefaPrioridade, { label: string; emoji: string; className: string }> = {
  critica: { label: 'Críticas',  emoji: '🔴', className: 'text-rose-700 dark:text-rose-300' },
  alta:    { label: 'Altas',     emoji: '🟠', className: 'text-orange-700 dark:text-orange-300' },
  media:   { label: 'Médias',    emoji: '🟡', className: 'text-amber-700 dark:text-amber-300' },
  baixa:   { label: 'Baixas',    emoji: '🟢', className: 'text-emerald-700 dark:text-emerald-300' },
};

const CATEGORIA_LABEL: Record<TarefaCategoria, string> = {
  bug: 'Bug', feature: 'Feature', teste: 'Teste',
  auditoria: 'Auditoria', manutencao: 'Manutenção',
  investigacao: 'Investigação', outro: 'Outro',
};

const STATUS_FECHADOS: TarefaStatus[] = ['feito', 'cancelado', 'adiado'];

export default function Tarefas() {
  const { data: tarefas = [], isLoading } = useTarefas();
  const atualizar = useAtualizarStatusTarefa();
  const deletar = useDeletarTarefa();

  const [busca, setBusca] = useState('');
  const [filtroCat, setFiltroCat] = useState<TarefaCategoria | 'todas'>('todas');
  const [novaOpen, setNovaOpen] = useState(false);
  const [detalheTarefa, setDetalheTarefa] = useState<Tarefa | null>(null);
  const [showFechadas, setShowFechadas] = useState(false);

  const { pendentesPorPrioridade, fechadas } = useMemo(() => {
    const filtradas = tarefas.filter((t) => {
      if (filtroCat !== 'todas' && t.categoria !== filtroCat) return false;
      if (busca.trim()) {
        const q = busca.toLowerCase();
        if (!t.titulo.toLowerCase().includes(q) &&
            !(t.descricao || '').toLowerCase().includes(q) &&
            !(t.achado_id || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });

    const pendentes = filtradas
      .filter((t) => !STATUS_FECHADOS.includes(t.status))
      .sort((a, b) => {
        const pd = PRIORIDADE_ORDEM[a.prioridade] - PRIORIDADE_ORDEM[b.prioridade];
        if (pd !== 0) return pd;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

    const porPrio: Record<TarefaPrioridade, Tarefa[]> = {
      critica: [], alta: [], media: [], baixa: [],
    };
    pendentes.forEach((t) => { porPrio[t.prioridade].push(t); });

    const fechadas = filtradas
      .filter((t) => STATUS_FECHADOS.includes(t.status))
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    return { pendentesPorPrioridade: porPrio, fechadas };
  }, [tarefas, busca, filtroCat]);

  const totalPendentes =
    pendentesPorPrioridade.critica.length +
    pendentesPorPrioridade.alta.length +
    pendentesPorPrioridade.media.length +
    pendentesPorPrioridade.baixa.length;

  const handleToggleFeito = (t: Tarefa, checked: boolean) => {
    atualizar.mutate({ id: t.id, status: checked ? 'feito' : 'pendente' });
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-primary" />
            Tarefas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalPendentes} pendente{totalPendentes !== 1 ? 's' : ''} ·{' '}
            {fechadas.length} fechada{fechadas.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setNovaOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Nova tarefa
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, descrição ou ID"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtroCat} onValueChange={(v) => setFiltroCat(v as any)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as categorias</SelectItem>
            {Object.entries(CATEGORIA_LABEL).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Pendentes por prioridade */}
      {isLoading ? (
        <SkeletonList rows={6} />
      ) : totalPendentes === 0 && fechadas.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Nenhuma tarefa"
          description="Adicione uma manualmente ou aguarde o Claude popular após uma auditoria."
        />
      ) : (
        <>
          {totalPendentes === 0 && (
            <Card className="mb-6">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                ✨ Sem pendências com esse filtro. Todas fechadas.
              </CardContent>
            </Card>
          )}

          {(['critica', 'alta', 'media', 'baixa'] as TarefaPrioridade[]).map((prio) => {
            const itens = pendentesPorPrioridade[prio];
            if (itens.length === 0) return null;
            const meta = PRIORIDADE_LABEL[prio];
            return (
              <Card key={prio} className="mb-4">
                <CardHeader className="pb-3">
                  <CardTitle className={cn('text-sm font-semibold flex items-center gap-2', meta.className)}>
                    <span>{meta.emoji}</span> {meta.label} ({itens.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 pt-0">
                  {itens.map((t) => (
                    <TarefaItem
                      key={t.id}
                      tarefa={t}
                      onToggleFeito={(c) => handleToggleFeito(t, c)}
                      onAbrirDetalhe={() => setDetalheTarefa(t)}
                      onAdiar={() => atualizar.mutate({ id: t.id, status: 'adiado' })}
                      onCancelar={() => atualizar.mutate({ id: t.id, status: 'cancelado' })}
                      onDeletar={() => deletar.mutate(t.id)}
                      disabled={atualizar.isPending || deletar.isPending}
                    />
                  ))}
                </CardContent>
              </Card>
            );
          })}

          {/* Fechadas (collapsible) */}
          {fechadas.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <button
                  className="flex items-center justify-between w-full text-left"
                  onClick={() => setShowFechadas((s) => !s)}
                >
                  <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                    {showFechadas ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    Fechadas ({fechadas.length})
                  </CardTitle>
                </button>
              </CardHeader>
              {showFechadas && (
                <CardContent className="space-y-1.5 pt-0">
                  {fechadas.map((t) => (
                    <TarefaItem
                      key={t.id}
                      tarefa={t}
                      onToggleFeito={(c) => handleToggleFeito(t, c)}
                      onAbrirDetalhe={() => setDetalheTarefa(t)}
                      onAdiar={() => atualizar.mutate({ id: t.id, status: 'adiado' })}
                      onCancelar={() => atualizar.mutate({ id: t.id, status: 'cancelado' })}
                      onDeletar={() => deletar.mutate(t.id)}
                      disabled={atualizar.isPending || deletar.isPending}
                    />
                  ))}
                </CardContent>
              )}
            </Card>
          )}
        </>
      )}

      <NovaTarefaDialog open={novaOpen} onOpenChange={setNovaOpen} />
      <DetalheTarefaDialog tarefa={detalheTarefa} onClose={() => setDetalheTarefa(null)} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
interface ItemProps {
  tarefa: Tarefa;
  onToggleFeito: (checked: boolean) => void;
  onAbrirDetalhe: () => void;
  onAdiar: () => void;
  onCancelar: () => void;
  onDeletar: () => void;
  disabled: boolean;
}

function TarefaItem({ tarefa, onToggleFeito, onAbrirDetalhe, onAdiar, onCancelar, onDeletar, disabled }: ItemProps) {
  const isFechada = STATUS_FECHADOS.includes(tarefa.status);
  return (
    <div
      className={cn(
        'flex items-start gap-3 px-2 py-2 rounded-md hover:bg-muted/50 transition-colors group',
        isFechada && 'opacity-60'
      )}
    >
      <Checkbox
        checked={tarefa.status === 'feito'}
        onCheckedChange={(c) => onToggleFeito(c === true)}
        disabled={disabled}
        className="mt-0.5"
      />
      <button
        onClick={onAbrirDetalhe}
        className="flex-1 text-left min-w-0"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('text-sm font-medium', tarefa.status === 'feito' && 'line-through')}>
            {tarefa.titulo}
          </span>
          {tarefa.origem === 'claude' && (
            <Badge variant="secondary" className="text-[9px] h-4 px-1.5 gap-0.5">
              <Sparkles className="h-2.5 w-2.5" /> Claude
            </Badge>
          )}
          {tarefa.origem === 'manual' && (
            <Badge variant="outline" className="text-[9px] h-4 px-1.5 gap-0.5">
              <User className="h-2.5 w-2.5" /> Manual
            </Badge>
          )}
          {tarefa.achado_id && (
            <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-mono">
              {tarefa.achado_id}
            </Badge>
          )}
          {tarefa.status === 'adiado' && (
            <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-amber-600">
              Adiado
            </Badge>
          )}
          {tarefa.status === 'cancelado' && (
            <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-muted-foreground">
              Cancelado
            </Badge>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
          <Tag className="h-2.5 w-2.5" /> {CATEGORIA_LABEL[tarefa.categoria]}
          <span>·</span>
          <span>{new Date(tarefa.created_at).toLocaleDateString('pt-BR')}</span>
        </div>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" disabled={disabled}>
            <MoreVertical className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onAbrirDetalhe}>
            <FileText className="h-3.5 w-3.5 mr-2" /> Ver detalhes
          </DropdownMenuItem>
          {!isFechada && (
            <>
              <DropdownMenuItem onClick={onAdiar}>
                <Clock className="h-3.5 w-3.5 mr-2" /> Adiar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onCancelar}>
                <XCircle className="h-3.5 w-3.5 mr-2" /> Cancelar
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem onClick={onDeletar} className="text-destructive">
            <XCircle className="h-3.5 w-3.5 mr-2" /> Remover
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function DetalheTarefaDialog({ tarefa, onClose }: { tarefa: Tarefa | null; onClose: () => void }) {
  if (!tarefa) return null;
  const githubUrl = tarefa.arquivo_md
    ? `https://github.com/trevolegaliza-source/trevo-sparkle-share/blob/main/${tarefa.arquivo_md}`
    : null;
  const commitUrl = tarefa.commit_sha
    ? `https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/${tarefa.commit_sha}`
    : null;
  return (
    <Dialog open={!!tarefa} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-left pr-6">
            <span>{PRIORIDADE_LABEL[tarefa.prioridade].emoji}</span>
            <span>{tarefa.titulo}</span>
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2 pt-2">
            <Badge variant="outline">{CATEGORIA_LABEL[tarefa.categoria]}</Badge>
            <Badge variant="outline">{tarefa.status}</Badge>
            {tarefa.achado_id && (
              <Badge variant="outline" className="font-mono">{tarefa.achado_id}</Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {tarefa.descricao && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                Descrição
              </p>
              <p className="text-sm whitespace-pre-wrap">{tarefa.descricao}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">Criada em</p>
              <p>{new Date(tarefa.created_at).toLocaleString('pt-BR')}</p>
            </div>
            {tarefa.completed_at && (
              <div>
                <p className="text-muted-foreground">Concluída em</p>
                <p>{new Date(tarefa.completed_at).toLocaleString('pt-BR')}</p>
              </div>
            )}
          </div>

          {(githubUrl || commitUrl) && (
            <div className="pt-3 border-t space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Contexto
              </p>
              {githubUrl && (
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1.5"
                >
                  <FileText className="h-3 w-3" /> {tarefa.arquivo_md}
                </a>
              )}
              {commitUrl && (
                <a
                  href={commitUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1.5 font-mono"
                >
                  <GitCommit className="h-3 w-3" /> {tarefa.commit_sha}
                </a>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
