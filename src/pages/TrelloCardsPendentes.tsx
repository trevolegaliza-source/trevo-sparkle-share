/**
 * /admin/trello-cards-pendentes (29/05/2026)
 *
 * Página de revisão manual dos processos sem trello_card_id (ambíguos +
 * sem_match do backfill automático em trello-setup-boards). Aumenta a
 * cobertura da automação de deferimento de 77% pra ~95%.
 *
 * Fluxo:
 * 1. Lista processos pendentes agrupados por cliente (RPC trello_processos_pendentes)
 * 2. Pra cada processo, botão "Selecionar card" abre modal com cards do board
 *    do cliente, ordenados por relevância (edge trello-cards-pendentes)
 * 3. Click em "Linkar" no card escolhido → RPC trello_linkar_card_manual
 * 4. Processo some da lista
 */
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2, RefreshCw, ExternalLink, Link2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface ProcessoPendente {
  processo_id: string;
  processo_tipo: string;
  processo_razao_social: string;
  processo_etapa: string;
  processo_created_at: string;
  processo_data_deferimento: string | null;
  cliente_id: string;
  cliente_nome: string;
  cliente_apelido: string | null;
  trello_board_id: string;
  trello_board_url: string | null;
}

interface CardTrello {
  id: string;
  name: string;
  url: string;
  list_id: string;
  list_name: string;
  due: string | null;
  ja_linkado_a: { processo_id: string; tipo: string; razao_social: string } | null;
  score: number;
}

interface ClienteGroup {
  cliente_id: string;
  cliente_nome: string;
  cliente_apelido: string | null;
  trello_board_id: string;
  trello_board_url: string | null;
  processos: ProcessoPendente[];
}

const fmtDate = (s: string | null) => {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('pt-BR');
  } catch {
    return s;
  }
};

export default function TrelloCardsPendentes() {
  const { role, loading: permLoading } = usePermissions();
  const [pendentes, setPendentes] = useState<ProcessoPendente[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalProcesso, setModalProcesso] = useState<ProcessoPendente | null>(null);
  const [modalCards, setModalCards] = useState<CardTrello[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('trello_processos_pendentes' as any);
      if (error) throw error;
      setPendentes((data as ProcessoPendente[]) || []);
    } catch (e: any) {
      toast.error('Erro ao carregar pendentes: ' + (e?.message || 'desconhecido'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!permLoading && role === 'master') {
      load();
    }
  }, [permLoading, role]);

  async function openModal(processo: ProcessoPendente) {
    setModalProcesso(processo);
    setModalCards([]);
    setModalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('trello-cards-pendentes', {
        body: {
          board_id: processo.trello_board_id,
          processo_id: processo.processo_id,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setModalCards(((data as any)?.cards || []) as CardTrello[]);
    } catch (e: any) {
      toast.error('Erro ao buscar cards do Trello: ' + (e?.message || 'desconhecido'));
      setModalProcesso(null);
    } finally {
      setModalLoading(false);
    }
  }

  async function linkar(card: CardTrello) {
    if (!modalProcesso || linking) return;
    if (card.ja_linkado_a) {
      const ok = window.confirm(
        `Esse card já está linkado a outro processo (${card.ja_linkado_a.razao_social}). Quer trocar o link mesmo assim?`
      );
      if (!ok) return;
    }
    setLinking(card.id);
    try {
      const { data, error } = await supabase.rpc('trello_linkar_card_manual' as any, {
        p_processo_id: modalProcesso.processo_id,
        p_card_id: card.id,
        p_card_url: card.url,
      } as any);
      if (error) throw error;
      if (!(data as any)?.ok) throw new Error((data as any)?.error || 'falha desconhecida');

      toast.success('Card linkado ao processo!');
      // Remove o processo da lista
      setPendentes((prev) => prev.filter((p) => p.processo_id !== modalProcesso.processo_id));
      setModalProcesso(null);
    } catch (e: any) {
      toast.error('Erro ao linkar: ' + (e?.message || 'desconhecido'));
    } finally {
      setLinking(null);
    }
  }

  // Auth gate
  if (permLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (role !== 'master') {
    return <Navigate to="/" replace />;
  }

  // Agrupa por cliente
  const grupos = new Map<string, ClienteGroup>();
  for (const p of pendentes) {
    let grupo = grupos.get(p.cliente_id);
    if (!grupo) {
      grupo = {
        cliente_id: p.cliente_id,
        cliente_nome: p.cliente_nome,
        cliente_apelido: p.cliente_apelido,
        trello_board_id: p.trello_board_id,
        trello_board_url: p.trello_board_url,
        processos: [],
      };
      grupos.set(p.cliente_id, grupo);
    }
    grupo.processos.push(p);
  }
  const gruposArr = Array.from(grupos.values()).sort((a, b) =>
    (a.cliente_apelido || a.cliente_nome).localeCompare(b.cliente_apelido || b.cliente_nome)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="🔗 Trello — cards pendentes de link"
        subtitle="Processos do ERP sem card Trello correspondente. Linke manualmente pra automação de deferimento cobrir o processo."
        actions={
          <Button onClick={load} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : pendentes.length === 0 ? (
        <Card>
          <CardContent className="p-8 flex flex-col items-center gap-2 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            <p className="text-sm font-medium">Nenhum processo pendente!</p>
            <p className="text-xs text-muted-foreground max-w-md">
              Todos os processos cujo cliente tem board Trello linkado já estão com card associado.
              Quando movidos pra lista <strong>🍀 INSCRIÇÃO MUNICIPAL E ESTADUAL</strong>, o ERP marca
              data_deferimento automaticamente.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-sm text-amber-900">
                <p className="font-medium">{pendentes.length} processos pendentes em {gruposArr.length} clientes</p>
                <p className="text-xs mt-1">
                  Esses processos não vão receber deferimento automático até o link ser feito.
                  Clique em <strong>"Selecionar card"</strong> em cada um pra escolher o card correspondente do Trello.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {gruposArr.map((grupo) => (
              <Card key={grupo.cliente_id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b">
                    <div>
                      <p className="font-semibold text-sm">
                        {grupo.cliente_apelido || grupo.cliente_nome}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {grupo.processos.length} processo(s) pendente(s)
                      </p>
                    </div>
                    {grupo.trello_board_url && (
                      <a
                        href={grupo.trello_board_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-emerald-700 hover:underline flex items-center gap-1"
                      >
                        Abrir board <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>

                  <div className="space-y-2">
                    {grupo.processos.map((p) => (
                      <div
                        key={p.processo_id}
                        className="flex items-center justify-between p-3 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] uppercase">
                              {p.processo_tipo}
                            </Badge>
                            <p className="text-sm font-medium truncate">{p.processo_razao_social}</p>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Etapa: {p.processo_etapa} · Criado: {fmtDate(p.processo_created_at)}
                            {p.processo_data_deferimento && (
                              <span className="ml-2 text-emerald-600">
                                · Deferido: {fmtDate(p.processo_data_deferimento)}
                              </span>
                            )}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openModal(p)}
                          className="shrink-0"
                        >
                          <Link2 className="h-3.5 w-3.5 mr-1.5" />
                          Selecionar card
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Modal de seleção de card */}
      <Dialog open={!!modalProcesso} onOpenChange={(open) => !open && setModalProcesso(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Linkar card do Trello</DialogTitle>
            <DialogDescription>
              {modalProcesso && (
                <span>
                  Processo: <strong>{modalProcesso.processo_tipo.toUpperCase()}</strong> — {modalProcesso.processo_razao_social}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {modalLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : modalCards.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum card encontrado nesse board.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Cards ordenados por relevância (tipo + nome similar). Os com 🟢 batem melhor com o processo.
              </p>
              {modalCards.map((card) => (
                <div
                  key={card.id}
                  className={`p-3 rounded-md border transition-colors ${
                    card.ja_linkado_a
                      ? 'bg-amber-50 border-amber-200'
                      : card.score >= 1.5
                      ? 'bg-emerald-50 border-emerald-300'
                      : 'bg-white hover:bg-muted/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {card.score >= 1.5 && '🟢 '}
                        {card.score >= 0.8 && card.score < 1.5 && '🟡 '}
                        {card.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Lista: <strong>{card.list_name}</strong>
                        {card.due && <> · Prazo: {fmtDate(card.due)}</>}
                      </p>
                      {card.ja_linkado_a && (
                        <p className="text-[11px] text-amber-700 mt-1 font-medium">
                          ⚠️ Já linkado a outro processo: {card.ja_linkado_a.razao_social}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <a
                        href={card.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-muted-foreground hover:text-foreground"
                        title="Abrir card no Trello"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <Button
                        size="sm"
                        onClick={() => linkar(card)}
                        disabled={linking === card.id}
                      >
                        {linking === card.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            <Link2 className="h-3.5 w-3.5 mr-1.5" />
                            Linkar
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
