import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Building2, FileCheck, Download } from 'lucide-react';
import type { LancamentoReceber, ValorAdicionalSimple } from '@/hooks/useContasReceber';
import { diasAtraso } from '@/hooks/useContasReceber';
import { buscarExtratoPorId } from '@/hooks/useExtratos';
import { toast } from 'sonner';
import { downloadExtrato } from '@/lib/storage-utils';

interface ClienteGroup {
  clienteId: string;
  clienteNome: string;
  lancamentos: LancamentoReceber[];
}

interface Props {
  groups: ClienteGroup[];
  taxasPorProcesso: Record<string, ValorAdicionalSimple[]>;
}

function StatusBadge({ status, dataVencimento }: { status: string; dataVencimento: string }) {
  const dias = diasAtraso(dataVencimento, status);
  if (status === 'pago') return <Badge className="bg-success/15 text-success border-0 text-[10px]">Pago ✅</Badge>;
  if (dias > 0) return <Badge className="bg-destructive/15 text-destructive border-0 text-[10px]">Vencido há {dias}d</Badge>;
  return <Badge className="bg-warning/15 text-warning border-0 text-[10px]">Pendente ⏳</Badge>;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function ClienteAccordionItem({
  g, taxasPorProcesso,
}: {
  g: ClienteGroup;
  taxasPorProcesso: Record<string, ValorAdicionalSimple[]>;
}) {
  const hoje = new Date().toISOString().split('T')[0];
  const faturado = g.lancamentos.reduce((s, l) => s + Number(l.valor), 0);
  const recebido = g.lancamentos.filter(l => l.status === 'pago').reduce((s, l) => s + Number(l.valor), 0);
  const saldo = faturado - recebido;
  const vencidos = g.lancamentos.filter(l => l.status === 'pendente' && l.data_vencimento < hoje);
  const pendentes = g.lancamentos.filter(l => l.status === 'pendente' && l.data_vencimento >= hoje);
  const hasVencido = vencidos.length > 0;
  const hasPendente = pendentes.length > 0;
  const borderColor = hasVencido ? 'border-l-destructive' : hasPendente ? 'border-l-warning' : 'border-l-success';

  const lancamentosComExtrato = g.lancamentos.filter(l => (l as any).extrato_id);
  const lancamentosSemExtrato = g.lancamentos.filter(l => l.status === 'pendente' && !(l as any).extrato_id);
  const todosComExtrato = lancamentosSemExtrato.length === 0 && g.lancamentos.some(l => l.status === 'pendente');

  const handleBaixarExtrato = async (extratoId: string) => {
    try {
      const extrato = await buscarExtratoPorId(extratoId);
      if (!extrato) { toast.error('Extrato não encontrado'); return; }

      // Deriva o path real do pdf_url salvo (suporta layouts antigos e novos:
      // "extratos/<cli>/file" ou "<empresa>/extratos/<cli>/file")
      let storagePath = `extratos/${extrato.cliente_id}/${extrato.filename}`;
      if (extrato.pdf_url) {
        const marker = '/object/public/documentos/';
        const idx = extrato.pdf_url.indexOf(marker);
        if (idx >= 0) {
          storagePath = decodeURIComponent(extrato.pdf_url.substring(idx + marker.length));
        }
      }

      await downloadExtrato('documentos', storagePath, extrato.filename);
    } catch (err) {
      console.error('Erro ao baixar extrato:', err);
      toast.error('Erro ao baixar o extrato.');
    }
  };

  return (
    <AccordionItem value={g.clienteId} className={`border rounded-lg overflow-hidden border-l-4 ${borderColor}`}>
      <AccordionTrigger className="px-4 py-3 hover:no-underline">
        <div className="flex-1 text-left space-y-1">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-sm">{g.clienteNome}</span>
            {todosComExtrato && (
              <Badge className="bg-success/20 text-success border-0 text-[10px]">
                <FileCheck className="h-3 w-3 mr-1" />
                Extratos emitidos
              </Badge>
            )}
            {!todosComExtrato && lancamentosSemExtrato.length > 0 && (
              <Badge className="bg-warning/20 text-warning border-0 text-[10px]">
                {lancamentosSemExtrato.length} sem extrato
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Faturado: {fmt(faturado)}</span>
            <span>Recebido: {fmt(recebido)}</span>
            <span>Saldo: {fmt(saldo)}</span>
          </div>
          <div className="flex items-center gap-3">
            {hasVencido && <Badge className="bg-destructive/15 text-destructive border-0 text-[10px]">{vencidos.length} vencido{vencidos.length > 1 ? 's' : ''} ({fmt(vencidos.reduce((s, l) => s + Number(l.valor), 0))})</Badge>}
            {hasPendente && <Badge className="bg-warning/15 text-warning border-0 text-[10px]">{pendentes.length} pendente{pendentes.length > 1 ? 's' : ''}</Badge>}
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-0 pb-0">
        <div className="px-4 py-2 border-b bg-muted/20">
          <span className="text-xs text-muted-foreground">Lançamentos do período (somente consulta)</span>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Taxas</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead className="text-center">Extrato</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {g.lancamentos.map(l => {
              const taxas = l.processo_id ? (taxasPorProcesso[l.processo_id] || []) : [];
              const taxaTotal = taxas.reduce((s, t) => s + Number(t.valor), 0);
              const total = Number(l.valor) + taxaTotal;
              const extratoId = (l as any).extrato_id as string | null;
              return (
                <TableRow key={l.id}>
                  <TableCell className="text-sm">{l.descricao}</TableCell>
                  <TableCell className="text-right text-sm">{fmt(Number(l.valor))}</TableCell>
                  <TableCell className="text-right text-sm">{taxaTotal > 0 ? fmt(taxaTotal) : '-'}</TableCell>
                  <TableCell className="text-right font-medium text-sm text-primary">{fmt(total)}</TableCell>
                  <TableCell className="text-sm">{new Date(l.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell className="text-center"><StatusBadge status={l.status} dataVencimento={l.data_vencimento} /></TableCell>
                  <TableCell className="text-sm">
                    {l.status === 'pago' && l.data_pagamento
                      ? new Date(l.data_pagamento + 'T00:00:00').toLocaleDateString('pt-BR')
                      : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {extratoId ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 gap-1 text-xs"
                        onClick={() => handleBaixarExtrato(extratoId)}
                      >
                        <Download className="h-3.5 w-3.5 text-success" />
                        PDF
                      </Button>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
          <span>Subtotal {g.clienteNome}</span>
          <span>Faturado {fmt(faturado)} | Recebido {fmt(recebido)} | Em Aberto {fmt(saldo)}</span>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export default function ClienteAccordion({ groups, taxasPorProcesso }: Props) {
  const sorted = [...groups].sort((a, b) => {
    const hoje = new Date().toISOString().split('T')[0];
    const aVencido = a.lancamentos.some(l => l.status === 'pendente' && l.data_vencimento < hoje);
    const bVencido = b.lancamentos.some(l => l.status === 'pendente' && l.data_vencimento < hoje);
    if (aVencido && !bVencido) return -1;
    if (!aVencido && bVencido) return 1;
    const aPendente = a.lancamentos.some(l => l.status === 'pendente');
    const bPendente = b.lancamentos.some(l => l.status === 'pendente');
    if (aPendente && !bPendente) return -1;
    if (!aPendente && bPendente) return 1;
    return a.clienteNome.localeCompare(b.clienteNome);
  });

  return (
    <Accordion type="multiple" className="space-y-2">
      {sorted.map(g => (
        <ClienteAccordionItem
          key={g.clienteId}
          g={g}
          taxasPorProcesso={taxasPorProcesso}
        />
      ))}
    </Accordion>
  );
}
