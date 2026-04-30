import { Card, CardContent } from '@/components/ui/card';

interface Props {
  salario: number;
  vtDiario: number;
  vrDiario: number;
  das: number;
  regime: string;
  fgtsPct: number;
  inssPct: number;
  prov13: boolean;
  provFerias: boolean;
  diasUteis: number;
  tipoTransporte?: 'vt' | 'auxilio_combustivel';
  auxilioCombustivelValor?: number;
}

export default function CustoResumoCard({ salario, vtDiario, vrDiario, das, regime, fgtsPct, inssPct, prov13, provFerias, diasUteis, tipoTransporte = 'vt', auxilioCombustivelValor = 0 }: Props) {
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const vtMensal = tipoTransporte === 'auxilio_combustivel' ? auxilioCombustivelValor : vtDiario * diasUteis;
  const vrMensal = vrDiario * diasUteis;
  const fgts = regime === 'CLT' ? salario * (fgtsPct / 100) : 0;
  const inss = regime === 'CLT' ? salario * (inssPct / 100) : 0;
  const p13 = regime === 'CLT' && prov13 ? salario / 12 : 0;
  const pFer = regime === 'CLT' && provFerias ? (salario + salario / 3) / 12 : 0;
  const total = salario + vtMensal + vrMensal + das + fgts + inss + p13 + pFer;

  const vtLabel = tipoTransporte === 'auxilio_combustivel' ? 'Aux. Combustível (fixo)' : `VT (${diasUteis} dias)`;
  const lines: { label: string; value: number; clt?: boolean }[] = [
    { label: 'Salário', value: salario },
    { label: vtLabel, value: vtMensal },
    { label: `VR (${diasUteis} dias)`, value: vrMensal },
  ];
  if (das > 0) lines.push({ label: 'DAS', value: das });
  if (regime === 'CLT') {
    lines.push({ label: `FGTS (${fgtsPct}%)`, value: fgts, clt: true });
    lines.push({ label: `INSS Patronal (${inssPct}%)`, value: inss, clt: true });
    if (prov13) lines.push({ label: 'Prov. 13º', value: p13, clt: true });
    if (provFerias) lines.push({ label: 'Prov. Férias', value: pFer, clt: true });
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-4 space-y-1">
        <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">📊 Custo Mensal Estimado</p>
        {lines.map((l, i) => (
          <div key={i} className="flex justify-between text-xs">
            <span className="text-muted-foreground">{l.label} {l.clt && <span className="text-[10px] text-info">CLT</span>}</span>
            <span className="text-foreground font-medium">{fmt(l.value)}</span>
          </div>
        ))}
        <div className="border-t border-border/60 pt-2 mt-2 flex justify-between">
          <span className="text-sm font-bold text-foreground">TOTAL</span>
          <span className="text-lg font-bold text-primary">{fmt(total)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
