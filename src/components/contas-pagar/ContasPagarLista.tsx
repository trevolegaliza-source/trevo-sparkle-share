import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Pencil, CheckCircle, Trash2, Paperclip } from 'lucide-react';
import ComprovanteLightbox from './ComprovanteLightbox';
import { CATEGORIAS_DESPESAS, type CategoriaKey } from '@/constants/categorias-despesas';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import * as LucideIcons from 'lucide-react';
import type { KpiFilter } from './ContasPagarKPIs';

interface Props {
  lancamentos: any[];
  onEdit: (l: any) => void;
  onMarcarPago: (l: any) => void;
  onDelete: (l: any) => void;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  hideEdit?: boolean;
  hideDelete?: boolean;
  hideApprove?: boolean;
  kpiFilter?: KpiFilter;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function getStatusBadge(l: any) {
  const hoje = new Date().toISOString().split('T')[0];
  if (l.status === 'pago') return <Badge className="bg-primary/15 text-primary border-0">Pago</Badge>;
  if (l.status === 'pendente' && l.data_vencimento < hoje) return <Badge className="bg-destructive/15 text-destructive border-0">Vencido</Badge>;
  return <Badge className="bg-warning/15 text-warning border-0">Pendente</Badge>;
}

export default function ContasPagarLista({ lancamentos, onEdit, onMarcarPago, onDelete, selectionMode, selectedIds, onToggleSelect, hideEdit, hideDelete, hideApprove, kpiFilter }: Props) {
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  // P1.5 — lightbox compartilhado pra ver comprovante in-place
  const [lightboxLanc, setLightboxLanc] = useState<any | null>(null);

  const filtered = useMemo(() => {
    const hoje = new Date().toISOString().split('T')[0];
    return lancamentos.filter(l => {
      // KPI filter takes precedence
      if (kpiFilter && kpiFilter !== 'total') {
        if (kpiFilter === 'pago' && l.status !== 'pago') return false;
        if (kpiFilter === 'pendente' && !(l.status === 'pendente' && l.data_vencimento >= hoje)) return false;
        if (kpiFilter === 'vencido' && !(l.status === 'pendente' && l.data_vencimento < hoje)) return false;
      }
      if (filterCat !== 'all' && (l.categoria || 'outros') !== filterCat) return false;
      if (filterStatus !== 'all') {
        if (filterStatus === 'vencido') {
          if (!(l.status === 'pendente' && l.data_vencimento < hoje)) return false;
        } else if (l.status !== filterStatus) return false;
      }
      if (search) {
        const s = search.toLowerCase();
        if (
          !l.descricao?.toLowerCase().includes(s) &&
          !l.fornecedor?.toLowerCase().includes(s) &&
          !l.colaborador_nome?.toLowerCase().includes(s)
        ) return false;
      }
      return true;
    }).sort((a: any, b: any) => a.data_vencimento.localeCompare(b.data_vencimento));
  }, [lancamentos, search, filterCat, filterStatus, kpiFilter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar descrição, colaborador..." className="pl-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Categorias</SelectItem>
            {Object.entries(CATEGORIAS_DESPESAS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pendente">Pendentes</SelectItem>
            <SelectItem value="pago">Pagos</SelectItem>
            <SelectItem value="vencido">Vencidos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {selectionMode && <TableHead className="w-10" />}
              <TableHead>Venc.</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Colaborador</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={selectionMode ? 9 : 8} className="text-center text-muted-foreground py-8">Nenhuma despesa encontrada</TableCell></TableRow>
            ) : filtered.map(l => {
              const catKey = (l.categoria || 'outros') as CategoriaKey;
              const cat = CATEGORIAS_DESPESAS[catKey] || CATEGORIAS_DESPESAS.outros;
              const IconComp = (LucideIcons as any)[cat.icon] || LucideIcons.Circle;
              const isPago = l.status === 'pago';
              return (
                <TableRow key={l.id}>
                  {selectionMode && (
                    <TableCell>
                      {isPago ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div><Checkbox disabled checked={false} /></div>
                            </TooltipTrigger>
                            <TooltipContent>Lançamento já pago não pode ser excluído</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <Checkbox
                          checked={selectedIds?.has(l.id) || false}
                          onCheckedChange={() => onToggleSelect?.(l.id)}
                        />
                      )}
                    </TableCell>
                  )}
                  <TableCell className="text-sm whitespace-nowrap">
                    {new Date(l.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                  </TableCell>
                  <TableCell className="font-medium text-sm">{l.subcategoria || l.descricao}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{l.colaborador_nome || '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <IconComp className="h-3.5 w-3.5" style={{ color: cat.color }} />
                      <span className="text-xs" style={{ color: cat.color }}>{cat.label}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-bold text-sm">{fmt(Number(l.valor))}</TableCell>
                  <TableCell>{getStatusBadge(l)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {l.comprovante_url && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setLightboxLanc(l)}
                              >
                                <Paperclip className="h-3.5 w-3.5 text-emerald-500" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Ver comprovante</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {!hideApprove && l.status === 'pendente' && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onMarcarPago(l)} title="Marcar pago">
                          <CheckCircle className="h-3.5 w-3.5 text-primary" />
                        </Button>
                      )}
                      {!hideApprove && isPago && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onMarcarPago(l)} title="Editar pagamento / comprovante">
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-500/60" />
                        </Button>
                      )}
                      {!hideEdit && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(l)} title="Editar despesa">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {!hideDelete && !isPago && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(l)} title="Excluir">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* P1.5 — comprovante in-place, sem nova aba */}
      <ComprovanteLightbox
        open={!!lightboxLanc}
        onClose={() => setLightboxLanc(null)}
        comprovanteUrl={lightboxLanc?.comprovante_url || lightboxLanc?.url_comprovante}
        titulo={(() => {
          const desc = lightboxLanc?.descricao || '';
          const parts = desc.split('—');
          return (parts.length > 1 ? parts[parts.length - 1].trim() : desc).toUpperCase();
        })()}
        subtitulo={(() => {
          const sub = (lightboxLanc?.subcategoria || 'PAGAMENTO').toUpperCase();
          const dt = lightboxLanc?.data_pagamento
            ? new Date(lightboxLanc.data_pagamento + 'T12:00:00').toLocaleDateString('pt-BR')
            : (lightboxLanc?.data_vencimento ? new Date(lightboxLanc.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR') : '');
          return `${sub}${dt ? ' · ' + dt : ''}`;
        })()}
      />
    </div>
  );
}
