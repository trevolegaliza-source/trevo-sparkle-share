import { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle, Phone, Search, FileText } from 'lucide-react';
import type { LancamentoReceber, ValorAdicionalSimple } from '@/hooks/useContasReceber';
import { diasAtraso, useMarcarRecebidoLote } from '@/hooks/useContasReceber';
import { downloadCSV, formatBRLPlain, formatDateBR } from '@/lib/export-utils';
import { toast } from 'sonner';

interface Props {
  lancamentos: LancamentoReceber[];
  taxasPorProcesso: Record<string, ValorAdicionalSimple[]>;
  onMarcarPago?: (l: LancamentoReceber) => void;
  onCobrar?: (l: LancamentoReceber) => void;
}

type Ordenacao = 'venc_asc' | 'venc_desc' | 'valor_asc' | 'valor_desc' | 'cliente_az' | 'atraso_desc';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function ContasReceberLista({ lancamentos, taxasPorProcesso, onMarcarPago, onCobrar }: Props) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [ordenacao, setOrdenacao] = useState<Ordenacao>('venc_asc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const marcarLote = useMarcarRecebidoLote();

  const hoje = new Date().toISOString().split('T')[0];

  const filtered = useMemo(() => {
    let result = lancamentos;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(l =>
        l.descricao.toLowerCase().includes(s) ||
        (l.cliente?.nome || '').toLowerCase().includes(s)
      );
    }
    if (filterStatus === 'pendente') result = result.filter(l => l.status === 'pendente' && l.data_vencimento >= hoje);
    else if (filterStatus === 'pago') result = result.filter(l => l.status === 'pago');
    else if (filterStatus === 'vencido') result = result.filter(l => l.status === 'pendente' && l.data_vencimento < hoje);

    result = [...result].sort((a, b) => {
      switch (ordenacao) {
        case 'venc_asc': return a.data_vencimento.localeCompare(b.data_vencimento);
        case 'venc_desc': return b.data_vencimento.localeCompare(a.data_vencimento);
        case 'valor_asc': return Number(a.valor) - Number(b.valor);
        case 'valor_desc': return Number(b.valor) - Number(a.valor);
        case 'cliente_az': return (a.cliente?.nome || '').localeCompare(b.cliente?.nome || '');
        case 'atraso_desc': return diasAtraso(b.data_vencimento, b.status) - diasAtraso(a.data_vencimento, a.status);
        default: return 0;
      }
    });
    return result;
  }, [lancamentos, search, filterStatus, ordenacao, hoje]);

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(l => l.id)));
  };

  const selectedItems = filtered.filter(l => selected.has(l.id));
  const selectedTotal = selectedItems.reduce((s, l) => s + Number(l.valor), 0);

  const handleExportCSV = () => {
    const data = filtered.map(l => ({
      Cliente: l.cliente?.nome || '-',
      Descrição: l.descricao,
      Valor: formatBRLPlain(Number(l.valor)),
      Vencimento: formatDateBR(l.data_vencimento),
      Status: l.status,
      'Dias Atraso': diasAtraso(l.data_vencimento, l.status),
    }));
    downloadCSV(data, `contas-receber-${new Date().toISOString().split('T')[0]}.csv`);
    toast.success('CSV exportado!');
  };

  const handleMarcarLote = () => {
    const pendentes = selectedItems.filter(l => l.status === 'pendente');
    if (!pendentes.length) { toast.error('Nenhum pendente selecionado'); return; }
    marcarLote.mutate({ ids: pendentes.map(l => l.id), data_pagamento: new Date().toISOString().split('T')[0] }, {
      onSuccess: () => setSelected(new Set()),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." className="pl-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pendente">Pendentes</SelectItem>
            <SelectItem value="pago">Pagos</SelectItem>
            <SelectItem value="vencido">Vencidos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={ordenacao} onValueChange={v => setOrdenacao(v as Ordenacao)}>
          <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="venc_asc">Vencimento ↑</SelectItem>
            <SelectItem value="venc_desc">Vencimento ↓</SelectItem>
            <SelectItem value="valor_asc">Valor ↑</SelectItem>
            <SelectItem value="valor_desc">Valor ↓</SelectItem>
            <SelectItem value="cliente_az">Cliente A-Z</SelectItem>
            <SelectItem value="atraso_desc">Dias Atraso ↓</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-9" onClick={handleExportCSV}>
          <FileText className="h-3.5 w-3.5 mr-1" /> CSV
        </Button>
      </div>

      <div className="rounded-lg border border-border/60 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"><Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} /></TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Taxas</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead className="text-center">Atraso</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(l => {
              const taxas = l.processo_id ? (taxasPorProcesso[l.processo_id] || []) : [];
              const taxaTotal = taxas.reduce((s, t) => s + Number(t.valor), 0);
              const total = Number(l.valor) + taxaTotal;
              const dias = diasAtraso(l.data_vencimento, l.status);
              return (
                <TableRow key={l.id}>
                  <TableCell><Checkbox checked={selected.has(l.id)} onCheckedChange={() => toggleSelect(l.id)} /></TableCell>
                  <TableCell className="text-sm font-medium">{l.cliente?.nome || '-'}</TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">{l.descricao}</TableCell>
                  <TableCell className="text-right text-sm">{fmt(Number(l.valor))}</TableCell>
                  <TableCell className="text-right text-sm">{taxaTotal > 0 ? fmt(taxaTotal) : '-'}</TableCell>
                  <TableCell className="text-right font-medium text-sm text-primary">{fmt(total)}</TableCell>
                  <TableCell className="text-sm">{new Date(l.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell className="text-center">
                    {l.status === 'pago' ? <span className="text-xs text-muted-foreground">—</span> : dias > 0 ? <span className="text-xs text-destructive font-medium">-{dias}d</span> : <span className="text-xs text-success">em dia</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {l.status === 'pago' ? <Badge className="bg-success/15 text-success border-0 text-[10px]">Pago</Badge>
                      : dias > 0 ? <Badge className="bg-destructive/15 text-destructive border-0 text-[10px]">Vencido</Badge>
                      : <Badge className="bg-warning/15 text-warning border-0 text-[10px]">Pendente</Badge>}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      {l.status === 'pendente' && onMarcarPago && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-success" onClick={() => onMarcarPago(l)}><CheckCircle className="h-3.5 w-3.5" /></Button>
                      )}
                      {l.status === 'pendente' && onCobrar && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-warning" onClick={() => onCobrar(l)}><Phone className="h-3.5 w-3.5" /></Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Nenhum lançamento encontrado</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {selected.size > 0 && (
        <div className="sticky bottom-4 flex items-center justify-between gap-4 rounded-lg border bg-card p-3 shadow-lg">
          <span className="text-sm">{selected.size} selecionado{selected.size > 1 ? 's' : ''} ({fmt(selectedTotal)})</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleMarcarLote}>Marcar como Pagos</Button>
            <Button size="sm" variant="outline" onClick={handleExportCSV}>Exportar</Button>
          </div>
        </div>
      )}
    </div>
  );
}
