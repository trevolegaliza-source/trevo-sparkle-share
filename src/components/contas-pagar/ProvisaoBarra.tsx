import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { CATEGORIAS_DESPESAS, type CategoriaKey } from '@/constants/categorias-despesas';
import type { DespesaRecorrente } from '@/hooks/useContasPagar';

interface Props {
  recorrentes: DespesaRecorrente[];
  mesAtual: number;
  anoAtual: number;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtShort = (v: number) => {
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(1)}k`;
  return `R$ ${v.toFixed(0)}`;
};

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export default function ProvisaoBarra({ recorrentes, mesAtual, anoAtual }: Props) {
  const ativas = recorrentes.filter(r => r.ativo);

  // P2.6: incluímos o mês ATUAL como baseline pra cálculo de variação,
  // mas só renderizamos os 3 futuros. Variação do primeiro futuro é
  // contra o atual; do segundo contra o primeiro; etc.
  const mesesParaCalcular = [0, 1, 2, 3].map(offset => {
    let m = mesAtual + offset;
    let a = anoAtual;
    while (m > 12) { m -= 12; a += 1; }
    return { mes: m, ano: a, offset };
  });

  const calcularProvisao = (mes: number, ano: number) => {
    const lastDay = new Date(ano, mes, 0).getDate();
    const startOfMonth = `${ano}-${String(mes).padStart(2, '0')}-01`;
    const endOfMonth = `${ano}-${String(mes).padStart(2, '0')}-${lastDay}`;

    const valid = ativas.filter(r => {
      if (r.data_inicio > endOfMonth) return false;
      if (r.data_fim && r.data_fim < startOfMonth) return false;
      return true;
    });

    const total = valid.reduce((s, r) => s + Number(r.valor), 0);

    const porCategoria: Record<string, number> = {};
    valid.forEach(r => {
      const key = r.categoria || 'outros';
      porCategoria[key] = (porCategoria[key] || 0) + Number(r.valor);
    });

    return { total, porCategoria };
  };

  // Pré-calcula tudo (atual + 3 futuros) pra ter variação fácil
  const provisoes = mesesParaCalcular.map(m => ({
    ...m,
    ...calcularProvisao(m.mes, m.ano),
  }));

  // Variação % entre o mês N e o mês N-1
  const variacao = (atual: number, anterior: number): { pct: number; signal: 'up' | 'down' | 'flat' } => {
    if (anterior === 0) return { pct: 0, signal: 'flat' };
    const pct = ((atual - anterior) / anterior) * 100;
    if (Math.abs(pct) < 1) return { pct, signal: 'flat' };
    return { pct, signal: pct > 0 ? 'up' : 'down' };
  };

  // Só mostra os 3 futuros (offset 1, 2, 3); offset 0 é só baseline
  const mesesFuturos = provisoes.slice(1);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Provisão de Despesas</h3>
      <div className="grid gap-4 sm:grid-cols-3">
        {mesesFuturos.map((m, idx) => {
          const { mes, ano, total, porCategoria } = m;
          const anterior = provisoes[idx]; // idx aqui é índice em mesesFuturos; provisoes[idx] é o mês anterior (offset menor)
          const v = variacao(total, anterior.total);
          const Arrow = v.signal === 'up' ? TrendingUp : v.signal === 'down' ? TrendingDown : Minus;
          // Despesa subindo = ruim (vermelho); descendo = bom (verde)
          const corTrend = v.signal === 'up' ? 'text-destructive' : v.signal === 'down' ? 'text-emerald-600' : 'text-muted-foreground';
          const labelAnterior = `vs ${MESES[anterior.mes - 1]}`;

          return (
            <Card key={`${mes}-${ano}`} className="border-border bg-card" style={{ borderTopWidth: '3px', borderTopColor: 'hsl(var(--primary))' }}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{MESES[mes - 1]} {ano}</p>
                  {/* P2.6: variação % vs mês anterior. Subir = vermelho (custo crescendo). */}
                  {v.signal !== 'flat' && (
                    <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${corTrend}`} title={`${labelAnterior}: ${fmt(anterior.total)}`}>
                      <Arrow className="h-3 w-3" />
                      {v.pct > 0 ? '+' : ''}{v.pct.toFixed(1)}%
                    </span>
                  )}
                  {v.signal === 'flat' && (
                    <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground" title={labelAnterior}>
                      <Minus className="h-3 w-3" /> estável
                    </span>
                  )}
                </div>
                <p className="text-xl font-extrabold text-foreground mt-1">{fmt(total)}</p>
                <div className="mt-3 space-y-1">
                  {Object.entries(porCategoria)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 4)
                    .map(([key, valor]) => {
                      const cat = CATEGORIAS_DESPESAS[key as CategoriaKey] || CATEGORIAS_DESPESAS.outros;
                      return (
                        <div key={key} className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{cat.label}</span>
                          <span className="font-medium" style={{ color: cat.color }}>{fmtShort(valor)}</span>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
