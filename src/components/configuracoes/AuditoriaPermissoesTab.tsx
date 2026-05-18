import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History, UserCog, Shield, Plus, Minus, Edit3 } from 'lucide-react';
import { usePermissoesAudit, type PermissaoAuditEntry } from '@/hooks/usePermissoesAudit';
import { SkeletonList } from '@/components/ui/skeleton-patterns';
import { EmptyState } from '@/components/ui/empty-state';

const ACAO_CONFIG: Record<PermissaoAuditEntry['acao'], { label: string; icon: typeof Plus; cls: string }> = {
  role_changed: { label: 'Mudou role', icon: UserCog, cls: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
  modulo_added: { label: 'Adicionou módulo', icon: Plus, cls: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
  modulo_removed: { label: 'Removeu módulo', icon: Minus, cls: 'bg-destructive/15 text-destructive border-destructive/30' },
  perm_updated: { label: 'Ajustou permissão', icon: Edit3, cls: 'bg-blue-500/15 text-blue-600 border-blue-500/30' },
};

function fmtData(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function descricaoDetalhes(entry: PermissaoAuditEntry): string {
  const d = entry.detalhes || {};
  if (entry.acao === 'role_changed') {
    return `${d.role_antigo || '—'} → ${d.role_novo || '—'}`;
  }
  if (entry.acao === 'modulo_added') {
    const acoes = ['ver', 'criar', 'editar', 'excluir', 'aprovar']
      .filter(a => d[`pode_${a}`])
      .join(', ');
    return `${d.modulo} ${acoes ? `(${acoes})` : ''}`;
  }
  if (entry.acao === 'modulo_removed') {
    return d.modulo;
  }
  if (entry.acao === 'perm_updated') {
    const mudancas: string[] = [];
    for (const k of ['pode_ver', 'pode_criar', 'pode_editar', 'pode_excluir', 'pode_aprovar']) {
      const v = d[k];
      if (v && typeof v === 'object' && v.antes !== v.depois) {
        mudancas.push(`${k.replace('pode_', '')}: ${v.antes ? '✓' : '✕'}→${v.depois ? '✓' : '✕'}`);
      }
    }
    return `${d.modulo}${mudancas.length ? ' · ' + mudancas.join(', ') : ''}`;
  }
  return '';
}

export default function AuditoriaPermissoesTab() {
  const { data: entries = [], isLoading } = usePermissoesAudit(50);

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4 text-primary" />
          Histórico de Permissões
        </CardTitle>
        <CardDescription>
          Quem mudou o quê e quando. Últimas 50 alterações de role/módulos/permissões.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <SkeletonList rows={5} />
        ) : entries.length === 0 ? (
          <EmptyState
            variant="inline"
            icon={Shield}
            title="Nenhuma alteração registrada"
            description="Quando você mexer em roles ou permissões, vai aparecer aqui."
          />
        ) : (
          <div className="space-y-2">
            {entries.map(entry => {
              const cfg = ACAO_CONFIG[entry.acao];
              const Icon = cfg?.icon || History;
              return (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border/40 bg-muted/20 hover:bg-muted/40 transition-colors"
                >
                  <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] ${cfg?.cls || ''}`}>
                        {cfg?.label || entry.acao}
                      </Badge>
                      <span className="text-sm font-medium truncate">{entry.alvo_nome}</span>
                      <span className="text-[10px] text-muted-foreground">
                        por {entry.ator_nome} · {fmtData(entry.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      {descricaoDetalhes(entry)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
