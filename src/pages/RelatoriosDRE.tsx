import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileDown, TrendingUp, TrendingDown, Minus, Loader2, BarChart3 } from 'lucide-react';
import { useDRE, type ComparativoTipo, type DRELinha } from '@/hooks/useDRE';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtPct = (v: number) => `${v.toFixed(1)}%`;

function VariacaoBadge({ valor }: { valor?: number }) {
  if (valor === undefined || valor === null) return null;
  const positivo = valor >= 0;
  return (
    <Badge variant="outline" className={cn(
      'text-[10px] font-mono gap-1',
      positivo ? 'text-emerald-400 border-emerald-400/30' : 'text-red-400 border-red-400/30',
    )}>
      {positivo ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {positivo ? '+' : ''}{valor.toFixed(1)}%
    </Badge>
  );
}

function LinhaRow({ linha, showComp }: { linha: DRELinha; showComp: boolean }) {
  const isSubtotal = linha.tipo === 'subtotal';
  const isMetrica = linha.tipo === 'metrica';

  return (
    <div className={cn(
      'grid items-center py-2 px-4 text-sm',
      showComp ? 'grid-cols-[1fr_auto_auto_auto]' : 'grid-cols-[1fr_auto]',
      isSubtotal && 'bg-muted/30 font-bold border-t border-border/50',
      isMetrica && 'italic text-muted-foreground text-xs',
      !isSubtotal && !isMetrica && 'pl-10',
    )}>
      <span className="truncate">
        {isSubtotal && <span className="text-muted-foreground mr-2">{linha.codigo}</span>}
        {linha.nome}
      </span>
      <span className={cn(
        'text-right tabular-nums min-w-[120px]',
        isMetrica ? '' : isSubtotal && linha.valor < 0 ? 'text-red-400' : isSubtotal && linha.valor > 0 ? 'text-emerald-400' : '',
      )}>
        {isMetrica ? fmtPct(linha.valor) : fmt(linha.valor)}
      </span>
      {showComp && (
        <>
          <span className="text-right tabular-nums min-w-[120px] text-muted-foreground">
            {linha.valorComparativo !== undefined
              ? (isMetrica ? fmtPct(linha.valorComparativo) : fmt(linha.valorComparativo))
              : '—'}
          </span>
          <span className="text-right min-w-[80px]">
            {!isMetrica && <VariacaoBadge valor={linha.variacao} />}
          </span>
        </>
      )}
    </div>
  );
}

function exportarPDF(linhas: DRELinha[], mes: number, ano: number, showComp: boolean) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const w = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(22, 163, 74);
  doc.rect(0, 0, w, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('TREVO LEGALIZA', 20, 18);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Assessoria societária com atuação em todo o território nacional', 20, 26);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`DRE — ${MESES[mes - 1]} ${ano}`, 20, 35);

  doc.setTextColor(0, 0, 0);
  let y = 50;

  for (const linha of linhas) {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    const isSubtotal = linha.tipo === 'subtotal';
    const isMetrica = linha.tipo === 'metrica';

    if (isSubtotal) {
      doc.setFillColor(240, 240, 240);
      doc.rect(15, y - 4, w - 30, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
    } else if (isMetrica) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
    }

    const xNome = isSubtotal ? 18 : 28;
    const label = isSubtotal ? `${linha.codigo} ${linha.nome}` : linha.nome;
    doc.text(label, xNome, y);

    const valStr = isMetrica ? fmtPct(linha.valor) : fmt(linha.valor);
    doc.text(valStr, w - 20, y, { align: 'right' });

    doc.setTextColor(0, 0, 0);
    y += isSubtotal ? 8 : 6;
  }

  // Footer
  y = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(7);
  doc.setTextColor(130, 130, 130);
  doc.text('Trevo Legaliza — CNPJ 50.059.711/0001-95 — trevolegaliza.com.br', w / 2, y, { align: 'center' });

  doc.save(`DRE_${MESES[mes - 1]}_${ano}.pdf`);
}

export default function RelatoriosDRE() {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [comparativo, setComparativo] = useState<ComparativoTipo>('mes_anterior');
  const [centroCusto, setCentroCusto] = useState('todos');

  const { data: dre, isLoading } = useDRE(mes, ano, comparativo, centroCusto);
  const showComp = comparativo !== 'nenhum';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            DRE — Demonstração do Resultado
          </h1>
          <p className="text-sm text-muted-foreground">Visão gerencial com EBITDA e margens</p>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          disabled={!dre}
          onClick={() => dre && exportarPDF(dre.linhas, mes, ano, showComp)}
        >
          <FileDown className="h-4 w-4" /> Exportar PDF
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={String(mes)} onValueChange={v => setMes(Number(v))}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MESES.map((m, i) => (
              <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(ano)} onValueChange={v => setAno(Number(v))}>
          <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[ano - 2, ano - 1, ano, ano + 1].map(a => (
              <SelectItem key={a} value={String(a)}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={comparativo} onValueChange={v => setComparativo(v as ComparativoTipo)}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="nenhum">Sem comparativo</SelectItem>
            <SelectItem value="mes_anterior">vs Mês Anterior</SelectItem>
            <SelectItem value="mesmo_mes_ano_anterior">vs Mesmo Mês (ano ant.)</SelectItem>
          </SelectContent>
        </Select>

        <Select value={centroCusto} onValueChange={setCentroCusto}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os centros</SelectItem>
            <SelectItem value="operacional">Operacional</SelectItem>
            <SelectItem value="administrativo">Administrativo</SelectItem>
            <SelectItem value="comercial">Comercial</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      {dre && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Receita Líquida', valor: dre.receitaLiquida, cor: 'text-emerald-400' },
            { label: 'EBITDA', valor: dre.ebitda, cor: dre.ebitda >= 0 ? 'text-emerald-400' : 'text-red-400' },
            { label: 'Margem EBITDA', valor: dre.margemEbitda, pct: true, cor: 'text-blue-400' },
            { label: 'Resultado Líquido', valor: dre.resultadoLiquido, cor: dre.resultadoLiquido >= 0 ? 'text-emerald-400' : 'text-red-400' },
          ].map((kpi, i) => (
            <Card key={i} className="glass-card">
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className={cn('text-xl font-bold tabular-nums mt-1', kpi.cor)}>
                  {kpi.pct ? fmtPct(kpi.valor) : fmt(kpi.valor)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* DRE Table */}
      <Card className="glass-card overflow-hidden">
        <CardContent className="p-0">
          {/* Header row */}
          <div className={cn(
            'grid items-center py-3 px-4 text-xs font-semibold text-muted-foreground border-b border-border/50 bg-muted/20',
            showComp ? 'grid-cols-[1fr_auto_auto_auto]' : 'grid-cols-[1fr_auto]',
          )}>
            <span>Conta</span>
            <span className="text-right min-w-[120px]">{MESES[mes - 1]}/{ano}</span>
            {showComp && (
              <>
                <span className="text-right min-w-[120px]">Comparativo</span>
                <span className="text-right min-w-[80px]">Var.</span>
              </>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !dre ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Minus className="h-8 w-8 mb-2" />
              <p className="text-sm">Nenhum dado para o período selecionado</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {dre.linhas.map((linha, i) => (
                <LinhaRow key={i} linha={linha} showComp={showComp} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
