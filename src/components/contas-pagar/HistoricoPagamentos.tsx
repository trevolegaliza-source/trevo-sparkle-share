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

  const filtrados = useMemo(() => {
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

  const total = filtrados.reduce((s: number, p: any) => s + Number(p.valor || 0), 0);

  // Exporta CSV simples (data, descricao, categoria, subcategoria, fornecedor, valor)
  const exportarCSV = () => {
    if (filtrados.length === 0) return;
    const linhas = [
      ['Data Pagamento', 'Descrição', 'Categoria', 'Subcategoria', 'Fornecedor', 'Valor'].join(';'),
      ...filtrados.map((p: any) => [
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
                {filtrados.length} pagamento{filtrados.length !== 1 ? 's' : ''}
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
            return (
              <div key={p.id} className="rounded-lg border border-border p-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{p.descricao}</p>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0" style={{ borderColor: catInfo?.color }}>
                        {catInfo?.label || p.categoria || 'Outros'}
                      </Badge>
                      {p.subcategoria && <span>· {p.subcategoria}</span>}
                      {p.fornecedor && <span>· {p.fornecedor}</span>}
                      <span className="ml-auto">Pago em {fmtData(p.data_pagamento)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono font-semibold tabular-nums text-emerald-600">{fmt(Number(p.valor || 0))}</span>
                    {p.comprovante_url && (
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
