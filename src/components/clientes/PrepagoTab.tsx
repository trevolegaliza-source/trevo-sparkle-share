import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, FileBarChart } from 'lucide-react';
import { usePrepagoMovimentacoes } from '@/hooks/usePrepagoMovimentacoes';
import { gerarRelatorioPrepagoPDF } from '@/lib/relatorio-prepago-pdf';
import RecargaModal from './RecargaModal';
import type { ClienteDB } from '@/types/financial';
import { toast } from 'sonner';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

interface Props {
  cliente: ClienteDB;
  onReload: () => void;
}

export default function PrepagoTab({ cliente, onReload }: Props) {
  const { data: movimentacoes = [], isLoading } = usePrepagoMovimentacoes(cliente.id);
  const [showRecarga, setShowRecarga] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const saldo = Number((cliente as any).saldo_prepago ?? 0);

  const handleGerarPDF = async () => {
    setGeneratingPdf(true);
    try {
      await gerarRelatorioPrepagoPDF({
        cliente: {
          nome: cliente.nome,
          cnpj: (cliente as any).cnpj || null,
          apelido: cliente.apelido || null,
        },
        saldoAtual: saldo,
        ultimaRecarga: Number((cliente as any).saldo_ultima_recarga ?? 0),
        dataUltimaRecarga: (cliente as any).data_ultima_recarga || null,
        movimentacoes,
      });
      toast.success('PDF gerado com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao gerar PDF: ' + err.message);
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Extrato Pré-Pago</CardTitle>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={handleGerarPDF} disabled={generatingPdf}>
            <FileBarChart className="h-3.5 w-3.5" /> {generatingPdf ? 'Gerando...' : 'Gerar PDF'}
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setShowRecarga(true)}>
            <Plus className="h-3.5 w-3.5" /> Nova Recarga
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="text-xs text-muted-foreground">Saldo Atual</p>
          <p className={`text-2xl font-bold ${saldo >= 0 ? 'text-primary' : 'text-destructive'}`}>{fmt(saldo)}</p>
          {(cliente as any).data_ultima_recarga && (
            <p className="text-xs text-muted-foreground mt-1">
              Última recarga: {fmt(Number((cliente as any).saldo_ultima_recarga ?? 0))} em {fmtDate((cliente as any).data_ultima_recarga)}
            </p>
          )}
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : movimentacoes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma movimentação registrada.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Data</TableHead>
                <TableHead className="text-xs">Descrição</TableHead>
                <TableHead className="text-xs text-right">Débito</TableHead>
                <TableHead className="text-xs text-right">Crédito</TableHead>
                <TableHead className="text-xs text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movimentacoes.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="text-xs">{fmtDate(m.created_at)}</TableCell>
                  <TableCell className="text-xs">{m.descricao}</TableCell>
                  <TableCell className="text-xs text-right text-destructive">
                    {m.tipo === 'consumo' ? fmt(m.valor) : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-right text-success">
                    {m.tipo === 'recarga' ? fmt(m.valor) : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-right font-medium">{fmt(m.saldo_posterior)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <RecargaModal
        open={showRecarga}
        onOpenChange={setShowRecarga}
        clienteId={cliente.id}
        clienteNome={cliente.apelido || cliente.nome}
        saldoAtual={saldo}
        onSuccess={onReload}
      />
    </Card>
  );
}
