import { useEffect, useMemo, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, RefreshCw, Download, ExternalLink, CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { downloadCSV } from "@/lib/export-utils";

interface TrelloCard {
  id: string;
  name: string;
  idBoard: string;
  closed: boolean;
  url: string;
}

interface BoardWithCards {
  boardId: string;
  boardName: string;
  cards: TrelloCard[];
}

interface ClienteRow {
  id: string;
  nome: string;
  codigo_identificador: string;
  cnpj: string | null;
}

interface ProcessoRow {
  id: string;
  razao_social: string;
  cliente_id: string;
}

// Normaliza string: lowercase, sem acentos, sem sufixos societários, sem pontuação
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(ltda|me|epp|eireli|s\/?a|sa|mei)\b/gi, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Extrai código de 6 dígitos do nome do board (se existir)
function extractCodigo(name: string): string | null {
  const match = name.match(/\b(\d{6})\b/);
  return match ? match[1] : null;
}

// Inferir tipo de processo a partir do nome do card
function inferirTipo(cardName: string): string {
  const n = cardName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  if (/\bABERTURA\b/.test(n)) return "abertura";
  if (/\bALTERAC/.test(n)) return "alteracao";
  if (/\bTRANSFORMAC/.test(n)) return "transformacao";
  if (/\bENCERRAMENTO\b|\bBAIXA\b/.test(n)) return "baixa";
  if (/\bAVULSO\b/.test(n)) return "avulso";
  return "abertura";
}

// Limpa "CODIGO - " do início do nome do card
function limparNomeCard(name: string): string {
  return name.replace(/^\s*\d{6}\s*[-–—]\s*/, "").trim();
}

interface BoardMatch {
  board: BoardWithCards;
  codigoTrello: string | null;
  cliente: ClienteRow | null;
  matchType: "codigo" | "nome" | null;
}

interface CardMatch {
  card: TrelloCard;
  boardName: string;
  cliente: ClienteRow | null;
  processo: ProcessoRow | null;
}

export default function ReconciliacaoTrello() {
  const { isMaster, loading: permLoading } = usePermissions();
  const [loading, setLoading] = useState(false);
  const [trelloData, setTrelloData] = useState<BoardWithCards[]>([]);
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [processos, setProcessos] = useState<ProcessoRow[]>([]);
  const [search, setSearch] = useState("");

  const podeAcessar = !permLoading && isMaster();

  const carregar = async () => {
    setLoading(true);
    try {
      const [trelloRes, clientesRes, processosRes] = await Promise.all([
        supabase.functions.invoke("trello-reconciliacao"),
        supabase.from("clientes").select("id, nome, codigo_identificador, cnpj").eq("is_archived", false),
        supabase.from("processos").select("id, razao_social, cliente_id").eq("is_archived", false),
      ]);

      if (trelloRes.error) throw new Error(trelloRes.error.message);
      if (trelloRes.data?.error) throw new Error(trelloRes.data.error);
      if (clientesRes.error) throw clientesRes.error;
      if (processosRes.error) throw processosRes.error;

      setTrelloData(trelloRes.data?.cardsByBoard || []);
      setClientes(clientesRes.data || []);
      setProcessos(processosRes.data || []);
      toast.success(
        `Carregado: ${trelloRes.data?.totalBoards} boards, ${trelloRes.data?.totalCards} cards`
      );
    } catch (e: any) {
      toast.error("Erro ao carregar: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (podeAcessar) carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [podeAcessar]);

  // Match boards → clientes
  const boardMatches: BoardMatch[] = useMemo(() => {
    return trelloData.map((board) => {
      const codigo = extractCodigo(board.boardName);
      let cliente: ClienteRow | null = null;
      let matchType: "codigo" | "nome" | null = null;

      // 1. Match por código (6 dígitos)
      if (codigo) {
        cliente = clientes.find((c) => c.codigo_identificador === codigo) || null;
        if (cliente) matchType = "codigo";
      }

      // 2. Fallback: match por nome normalizado
      if (!cliente) {
        const boardNorm = normalize(board.boardName.replace(/\b\d{6}\b/g, ""));
        cliente =
          clientes.find((c) => {
            const nomeNorm = normalize(c.nome);
            const apelidoNorm = (c as any).apelido ? normalize((c as any).apelido) : "";
            return (
              nomeNorm && (boardNorm.includes(nomeNorm) || nomeNorm.includes(boardNorm)) ||
              (apelidoNorm && (boardNorm.includes(apelidoNorm) || apelidoNorm.includes(boardNorm)))
            );
          }) || null;
        if (cliente) matchType = "nome";
      }

      return { board, codigoTrello: codigo, cliente, matchType };
    });
  }, [trelloData, clientes]);

  // Cards (processos): matched boards → comparar cards com processos do cliente
  const cardMatches: CardMatch[] = useMemo(() => {
    const all: CardMatch[] = [];
    for (const bm of boardMatches) {
      if (!bm.cliente) continue;
      const procsCliente = processos.filter((p) => p.cliente_id === bm.cliente!.id);
      for (const card of bm.board.cards) {
        const cardNorm = normalize(card.name);
        const proc = procsCliente.find((p) => {
          const procNorm = normalize(p.razao_social);
          return (
            (procNorm && (cardNorm.includes(procNorm) || procNorm.includes(cardNorm))) ||
            cardNorm === procNorm
          );
        });
        all.push({ card, boardName: bm.board.boardName, cliente: bm.cliente, processo: proc || null });
      }
    }
    return all;
  }, [boardMatches, processos]);

  // Categorização
  const noTrelloESistema = boardMatches.filter((b) => b.cliente !== null);
  const apenasNoTrello = boardMatches.filter((b) => b.cliente === null);

  const clientesNoTrelloIds = new Set(noTrelloESistema.map((b) => b.cliente!.id));
  const apenasNoSistema = clientes.filter((c) => !clientesNoTrelloIds.has(c.id));

  // Cards sem processo correspondente (board já tem cliente)
  const cardsSemProcesso = cardMatches.filter((cm) => cm.processo === null);

  // Filtros de busca
  const filtrar = <T extends { boardName?: string; cliente?: ClienteRow | null; nome?: string; card?: TrelloCard }>(arr: T[]): T[] => {
    if (!search.trim()) return arr;
    const q = normalize(search);
    return arr.filter((item: any) => {
      const fields = [
        item.boardName,
        item.cliente?.nome,
        item.cliente?.codigo_identificador,
        item.nome,
        item.codigo_identificador,
        item.card?.name,
      ].filter(Boolean);
      return fields.some((f) => normalize(String(f)).includes(q));
    });
  };

  const exportarCSV = () => {
    const rows = [
      ...noTrelloESistema.map((b) => ({
        Status: "OK - Trello E ERP",
        Board: b.board.boardName,
        Cliente_ERP: b.cliente!.nome,
        Codigo: b.cliente!.codigo_identificador,
        Match: b.matchType,
        Cards: b.board.cards.length,
      })),
      ...apenasNoTrello.map((b) => ({
        Status: "FALTA NO ERP",
        Board: b.board.boardName,
        Cliente_ERP: "",
        Codigo: b.codigoTrello || "",
        Match: "",
        Cards: b.board.cards.length,
      })),
      ...apenasNoSistema.map((c) => ({
        Status: "FALTA NO TRELLO",
        Board: "",
        Cliente_ERP: c.nome,
        Codigo: c.codigo_identificador,
        Match: "",
        Cards: 0,
      })),
    ];
    downloadCSV(rows, `reconciliacao-trello-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  if (permLoading) return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;
  if (!isMaster()) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Reconciliação Trello ↔ ERP</h1>
          <p className="text-sm text-muted-foreground">
            Cruza boards/cards do Trello com clientes/processos cadastrados.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportarCSV} disabled={loading || trelloData.length === 0}>
            <Download className="h-4 w-4 mr-2" /> CSV
          </Button>
          <Button onClick={carregar} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Atualizar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Boards no Trello</div>
          <div className="text-2xl font-bold">{trelloData.length}</div>
        </Card>
        <Card className="p-4 border-emerald-500/30">
          <div className="text-xs text-emerald-500">✅ OK (Trello + ERP)</div>
          <div className="text-2xl font-bold text-emerald-500">{noTrelloESistema.length}</div>
        </Card>
        <Card className="p-4 border-amber-500/30">
          <div className="text-xs text-amber-500">⚠️ Falta no ERP</div>
          <div className="text-2xl font-bold text-amber-500">{apenasNoTrello.length}</div>
        </Card>
        <Card className="p-4 border-blue-500/30">
          <div className="text-xs text-blue-500">❓ Falta no Trello</div>
          <div className="text-2xl font-bold text-blue-500">{apenasNoSistema.length}</div>
        </Card>
      </div>

      <Input
        placeholder="Buscar por nome, código ou board..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />

      <Tabs defaultValue="falta-erp">
        <TabsList>
          <TabsTrigger value="falta-erp">
            <AlertTriangle className="h-4 w-4 mr-2 text-amber-500" />
            Falta no ERP ({apenasNoTrello.length})
          </TabsTrigger>
          <TabsTrigger value="falta-trello">
            <HelpCircle className="h-4 w-4 mr-2 text-blue-500" />
            Falta no Trello ({apenasNoSistema.length})
          </TabsTrigger>
          <TabsTrigger value="ok">
            <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-500" />
            OK ({noTrelloESistema.length})
          </TabsTrigger>
          <TabsTrigger value="cards-sem-processo">
            Cards sem processo ({cardsSemProcesso.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="falta-erp" className="space-y-2 mt-4">
          {filtrar(apenasNoTrello).map((b) => (
            <Card key={b.board.boardId} className="p-3 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{b.board.boardName}</div>
                <div className="text-xs text-muted-foreground">
                  {b.codigoTrello && <Badge variant="outline" className="mr-2">Cód: {b.codigoTrello}</Badge>}
                  {b.board.cards.length} card(s)
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button asChild variant="outline" size="sm">
                  <a href={`https://trello.com/b/${b.board.boardId}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
                <Button asChild size="sm">
                  <Link
                    to={`/cadastro-rapido?${new URLSearchParams({
                      ...(b.codigoTrello ? { cliente_codigo: b.codigoTrello } : {}),
                      razao_social: b.board.boardName.replace(/\b\d{6}\b\s*[-–—]?\s*/, "").trim(),
                    }).toString()}`}
                  >
                    Cadastrar no ERP
                  </Link>
                </Button>
              </div>
            </Card>
          ))}
          {apenasNoTrello.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum board órfão. ✨</p>
          )}
        </TabsContent>

        <TabsContent value="falta-trello" className="space-y-2 mt-4">
          {filtrar(apenasNoSistema).map((c) => (
            <Card key={c.id} className="p-3 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{c.nome}</div>
                <div className="text-xs text-muted-foreground">
                  Cód: {c.codigo_identificador} {c.cnpj && `· ${c.cnpj}`}
                </div>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to={`/clientes/${c.id}`}>Ver cliente</Link>
              </Button>
            </Card>
          ))}
          {apenasNoSistema.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground text-center py-8">Todos os clientes têm board. ✨</p>
          )}
        </TabsContent>

        <TabsContent value="ok" className="space-y-2 mt-4">
          {filtrar(noTrelloESistema).map((b) => (
            <Card key={b.board.boardId} className="p-3 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">
                  {b.cliente!.nome}{" "}
                  <Badge variant="outline" className="ml-1 text-xs">
                    {b.matchType === "codigo" ? "match: código" : "match: nome"}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  Trello: {b.board.boardName} · {b.board.cards.length} card(s)
                </div>
              </div>
              <Button asChild variant="outline" size="sm">
                <a href={`https://trello.com/b/${b.board.boardId}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="cards-sem-processo" className="space-y-2 mt-4">
          <p className="text-xs text-muted-foreground">
            Cards de boards já reconciliados, mas sem processo correspondente no ERP.
          </p>
          {filtrar(cardsSemProcesso).map((cm) => (
            <Card key={cm.card.id} className="p-3 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{cm.card.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {cm.cliente?.nome} · Board: {cm.boardName}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button asChild variant="outline" size="sm">
                  <a href={cm.card.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
                <Button asChild size="sm">
                  <Link
                    to={`/cadastro-rapido?${new URLSearchParams({
                      cliente_codigo: cm.cliente!.codigo_identificador,
                      razao_social: limparNomeCard(cm.card.name),
                      tipo: inferirTipo(cm.card.name),
                    }).toString()}`}
                  >
                    Cadastrar processo
                  </Link>
                </Button>
              </div>
            </Card>
          ))}
          {cardsSemProcesso.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground text-center py-8">Todos os cards têm processo. ✨</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
