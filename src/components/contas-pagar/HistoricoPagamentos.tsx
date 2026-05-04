import { useState, useMemo } from 'react';
import { useHistoricoPagamentos } from '@/hooks/useContasPagar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Download, FileText, Search, CheckCircle2, Loader2 } from 'lucide-react';
import { CATEGORIAS_DESPESAS } from '@/constants/categorias-despesas';
import { abrirArquivoStorage } from '@/lib/storage-utils';
import { STORAGE_BUCKETS } from '@/constants/storage';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtData = (d: string | null | undefined) => {
  if (!d) return '-';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

type RangeOpcao = 'mes-atual' | 'mes-passado' | 'ultimos-30' | 'ultimos-90' | 'ano-atual' | 'custom';

function rangeFromOpcao(opcao: RangeOpcao): { inicio: string; fim: string } {
  const hoje = new Date();
  const fmtIso = (d: Date) => d.toISOString().split('T')[0];

  if (opcao === 'mes-atual') {
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    return { inicio: fmtIso(inicio), fim: fmtIso(fim) };
  }
  if (opcao === 'mes-passado') {
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
    return { inicio: fmtIso(inicio), fim: fmtIso(fim) };
  }
  if (opcao === 'ultimos-30') {
    const inicio = new Date(hoje); inicio.setDate(inicio.getDate() - 30);
    return { inicio: fmtIso(inicio), fim: fmtIso(hoje) };
  }
  if (opcao === 'ultimos-90') {
    const inicio = new Date(hoje); inicio.setDate(inicio.getDate() - 90);
    return { inicio: fmtIso(inicio), fim: fmtIso(hoje) };
  }
  if (opcao === 'ano-atual') {
    const inicio = new Date(hoje.getFullYear(), 0, 1);
    return { inicio: fmtIso(inicio), fim: fmtIso(hoje) };
  }
  // custom — caller controla
  return { inicio: fmtIso(hoje), fim: fmtIso(hoje) };
}

/**
 * Tab Histórico — lista todos os pagamentos efetuados (status='pago')
 * filtrados por intervalo de data_pagamento. Útil pra:
 *   - Conferência mensal "tudo que paguei em outubro"
 *   - Auditoria contábil
 *   - Exportar pra contador
 *
 * Mostra: data pagamento, descrição, categoria, valor, comprovante (se houver).
 * Permite filtrar por categoria e busca textual.
 */
export default function HistoricoPagamentos() {
  const [opcaoRange, setOpcaoRange] = useState<RangeOpcao>('mes-atual');
  const [customInicio, setCustomInicio] = useState(() => rangeFromOpcao('mes-atual').inicio);
  const [customFim, setCustomFim] = useState(() => rangeFromOpcao('mes-atual').fim);

  const { inicio, fim } = useMemo(() => {
    if (opcaoRange === 'custom') return { inicio: customInicio, fim: customFim };
    return rangeFromOpcao(opcaoRange);
  }, [opcaoRange, customInicio, customFim]);

  const { data: pagamentos = [], isLoading } = useHistoricoPagamentos(inicio, fim);

  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<string>('all');

  const filtradosRaw = useMemo(() => {
    return pagamentos.filter((p: any) => {
      if (filterCat !== 'all' && (p.categoria || 'outros') !== filterCat) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!p.descricao?.toLowerCase().includes(s)
          && !p.fornecedor?.toLowerCase().includes(s)
          && !p.subcategoria?.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [pagamentos, filterCat, search]);

  // Demanda Thales 04/05 (P0.2): agregar VT+VR do mesmo colaborador na
  // mesma data_vencimento em UMA linha "BENEFÍCIOS — VT+VR" no histórico.
  // Espelha a lógica da Visão (UI agrega, DB segue separado pro contador).
  // CSV continua exportando linhas RAW (detalhe contábil preservado).
  const filtrados = useMemo(() => mergeVtVrHistorico(filtradosRaw), [filtradosRaw]);

  const total = filtrados.reduce((s: number, p: any) => s + Number(p.valor || 0), 0);

  // Exporta CSV simples (data, descricao, categoria, subcategoria, fornecedor, valor)
  // IMPORTANTE: usa filtradosRaw (sem agregação VT+VR) — contador precisa
  // do detalhe contábil separado.
  const exportarCSV = () => {
    if (filtradosRaw.length === 0) return;
    const linhas = [
      ['Data Pagamento', 'Descrição', 'Categoria', 'Subcategoria', 'Fornecedor', 'Valor'].join(';'),
      ...filtradosRaw.map((p: any) => [
        p.data_pagamento || '',
        (p.descricao || '').replace(/;/g, ','),
        p.categoria || '',
        p.subcategoria || '',
        p.fornecedor || '',
        String(Number(p.valor || 0)).replace('.', ','),
      ].join(';')),
    ];
    const blob = new Blob(['\uFEFF' + linhas.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historico-pagamentos-${inicio}-a-${fim}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  // Counter raw vs agregado (mostra "10 → 5" no resumo)
  const totalRaw = filtradosRaw.length;
  const totalAgg = filtrados.length;

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <div className="grid gap-1.5">
            <Label className="text-xs">Período</Label>
            <Select value={opcaoRange} onValueChange={v => setOpcaoRange(v as RangeOpcao)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mes-atual">📅 Mês atual</SelectItem>
                <SelectItem value="mes-passado">⏮ Mês passado</SelectItem>
                <SelectItem value="ultimos-30">Últimos 30 dias</SelectItem>
                <SelectItem value="ultimos-90">Últimos 90 dias</SelectItem>
                <SelectItem value="ano-atual">📊 Ano atual</SelectItem>
                <SelectItem value="custom">🎯 Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {opcaoRange === 'custom' && (
            <>
              <div className="grid gap-1.5">
                <Label className="text-xs">De</Label>
                <Input type="date" value={customInicio} onChange={e => setCustomInicio(e.target.value)} className="w-40" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Até</Label>
                <Input type="date" value={customFim} onChange={e => setCustomFim(e.target.value)} className="w-40" />
              </div>
            </>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_auto] mt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar descrição, fornecedor, subcategoria..."
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {Object.entries(CATEGORIAS_DESPESAS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Resumo */}
      <Card className="p-4 bg-emerald-500/5 border-emerald-500/20">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total pago no período</p>
              <p className="text-2xl font-bold tabular-nums text-emerald-600">{fmt(total)}</p>
              <p className="text-xs text-muted-foreground">
                {totalAgg} linha{totalAgg !== 1 ? 's' : ''}
                {totalRaw !== totalAgg && (
                  <span> ({totalRaw} pagamento{totalRaw !== 1 ? 's' : ''} contábeis · VT+VR agrupados)</span>
                )}
                {' · '}
                de {fmtData(inicio)} a {fmtData(fim)}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={exportarCSV} disabled={filtrados.length === 0}>
            <Download className="h-3.5 w-3.5 mr-1" /> Exportar CSV
          </Button>
        </div>
      </Card>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando histórico...
        </div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum pagamento neste período.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map((p: any) => {
            const catInfo = CATEGORIAS_DESPESAS[(p.categoria || 'outros') as keyof typeof CATEGORIAS_DESPESAS];
            const isMerged = p.__merged === true;
            return (
              <div key={p.id} className="rounded-lg border border-border p-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {isMerged && <span className="mr-1">🍱</span>}
                      {p.descricao}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0" style={{ borderColor: catInfo?.color }}>
                        {catInfo?.label || p.categoria || 'Outros'}
                      </Badge>
                      {p.subcategoria && <span>· {p.subcategoria}</span>}
                      {p.fornecedor && <span>· {p.fornecedor}</span>}
                      <span className="ml-auto">Pago em {fmtData(p.data_pagamento)}</span>
                    </div>
                    {/* Breakdown VT/VR pra linha agregada */}
                    {isMerged && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                        VT {fmt(p.vtValor)} + VR {fmt(p.vrValor)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono font-semibold tabular-nums text-emerald-600">{fmt(Number(p.valor || 0))}</span>
                    {/* Comprovantes — pode haver até 2 distintos no agregado */}
                    {isMerged
                      ? p.comprovantes.map((c: { url: string; label: string }, i: number) => (
                          <Button
                            key={i}
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => abrirArquivoStorage(STORAGE_BUCKETS.CONTRACTS, c.url)}
                            title={`Comprovante ${c.label}`}
                          >
                            <FileText className="h-3.5 w-3.5" />
                            <span className="ml-1 text-[10px]">{c.label}</span>
                          </Button>
                        ))
                      : p.comprovante_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => abrirArquivoStorage(STORAGE_BUCKETS.CONTRACTS, p.comprovante_url)}
                            title="Ver comprovante"
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </Button>
                        )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Agrega VT + VR do mesmo colaborador na mesma data_vencimento numa linha
 * "BENEFÍCIOS — VT+VR — {nome}". Espelha a lógica do Visão (UI agrega,
 * DB segue separado pro contador). Usado SÓ pra display — CSV exporta
 * filtradosRaw (sem agregação).
 *
 * Detecção de VT/VR: subcategoria contém "vt"/"vale transporte" ou
 * "vr"/"vale refeição" (case-insensitive). Se faltar colaborador_id ou
 * só um lado existir, passa direto.
 *
 * Comprovantes: o agregado pode ter 0, 1 ou 2 comprovantes (caso bulk
 * UM PDF pra ambos vs marcado individual com PDFs separados). Lista
 * todos os disponíveis com label "VT"/"VR".
 */
function mergeVtVrHistorico(items: any[]): any[] {
  const out: any[] = [];
  const benefMap = new Map<string, { vt?: any; vr?: any }>();

  const isVt = (l: any) => {
    const s = (l.subcategoria || '').toLowerCase();
    return s.includes('vt') || s.includes('vale transporte') || s.includes('transporte');
  };
  const isVr = (l: any) => {
    const s = (l.subcategoria || '').toLowerCase();
    return s.includes('vr') || s.includes('vale refeição') || s.includes('refeição');
  };

  for (const l of items) {
    const vt = isVt(l);
    const vr = isVr(l);
    if ((vt || vr) && l.colaborador_id) {
      const key = `${l.colaborador_id}::${l.data_vencimento}`;
      const entry = benefMap.get(key) || {};
      if (vt) entry.vt = l; else entry.vr = l;
      benefMap.set(key, entry);
    } else {
      out.push(l);
    }
  }

  benefMap.forEach((pair, key) => {
    if (pair.vt && pair.vr) {
      // Extrair nome do colaborador da descrição (formato "VT — Nome" ou "VR — Nome")
      const cleanName = (desc: string) => {
        const parts = (desc || '').split('—');
        return parts.length > 1 ? parts[parts.length - 1].trim() : (desc || '').trim();
      };
      const nome = cleanName(pair.vt.descricao) || cleanName(pair.vr.descricao);
      const comprovantes: { url: string; label: string }[] = [];
      const cVt = pair.vt.comprovante_url || pair.vt.url_comprovante;
      const cVr = pair.vr.comprovante_url || pair.vr.url_comprovante;
      if (cVt) comprovantes.push({ url: cVt, label: 'VT' });
      // Só adiciona o do VR se for diferente (bulk reusa mesma URL)
      if (cVr && cVr !== cVt) comprovantes.push({ url: cVr, label: 'VR' });
      out.push({
        __merged: true,
        id: `merged-${key}`,
        descricao: `BENEFÍCIOS — VT+VR — ${nome}`,
        subcategoria: 'Benefícios (VT+VR)',
        categoria: 'folha',
        colaborador_id: pair.vt.colaborador_id,
        valor: Number(pair.vt.valor) + Number(pair.vr.valor),
        vtValor: Number(pair.vt.valor),
        vrValor: Number(pair.vr.valor),
        data_vencimento: pair.vt.data_vencimento,
        data_pagamento: pair.vt.data_pagamento || pair.vr.data_pagamento,
        comprovantes,
        items: [pair.vt, pair.vr],
      });
    } else {
      // Apenas um lado existe — passa direto
      if (pair.vt) out.push(pair.vt);
      if (pair.vr) out.push(pair.vr);
    }
  });

  // Ordena por data_pagamento desc (mais recente primeiro)
  out.sort((a, b) => (b.data_pagamento || '').localeCompare(a.data_pagamento || ''));
  return out;
}
