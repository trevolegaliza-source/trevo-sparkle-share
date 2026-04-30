import { Card, CardContent } from '@/components/ui/card';
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

  const mesesFuturos = [1, 2, 3].map(offset => {
    let m = mesAtual + offset;
    let a = anoAtual;
    if (m > 12) { m -= 12; a += 1; }
    return { mes: m, ano: a };
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

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Provisão de Despesas</h3>
      <div className="grid gap-4 sm:grid-cols-3">
        {mesesFuturos.map(({ mes, ano }) => {
          const { total, porCategoria } = calcularProvisao(mes, ano);
          return (
            <Card key={`${mes}-${ano}`} className="border-border bg-card" style={{ borderTopWidth: '3px', borderTopColor: 'hsl(var(--primary))' }}>
              <CardContent className="p-4">
                <p className="text-sm font-semibold text-foreground">{MESES[mes - 1]} {ano}</p>
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
