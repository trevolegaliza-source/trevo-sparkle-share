import { Badge } from '@/components/ui/badge';
import { useLancamentos } from '@/hooks/useFinanceiro';
import type { Colaborador } from '@/hooks/useColaboradores';

const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

interface Props {
  colab: Colaborador;
}

export default function ObrigacoesTimeline({ colab }: Props) {
  const now = new Date();
  const mes = now.getMonth() + 1;
  const ano = now.getFullYear();
  const { data: allLancamentos } = useLancamentos('pagar');
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const lancamentos = (allLancamentos || [])
    .filter(l => (l as any).colaborador_id === colab.id)
    .sort((a, b) => new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime());

  const total = lancamentos.reduce((s, l) => s + Number(l.valor), 0);

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-foreground">
        {MESES_PT[now.getMonth()]} {ano} — Obrigações de {colab.nome}
      </p>
      <div className="space-y-1">
        {lancamentos.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma verba gerada para este mês. Clique em "Gerar Verbas" na tela de Colaboradores.</p>
        ) : lancamentos.map(l => {
          const venc = new Date(l.data_vencimento);
          const isPago = l.status === 'pago';
          const isVencido = !isPago && venc < now;
          const icon = isPago ? '✅' : isVencido ? '🔴' : '⏳';
          const desc = l.descricao.replace(` - ${colab.nome}`, '').replace(colab.nome, '').trim();

          return (
            <div key={l.id} className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-sm">{icon}</span>
                <span className="text-xs text-muted-foreground w-12">
                  {venc.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                </span>
                <span className="text-xs text-foreground">{desc || l.descricao}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">{fmt(Number(l.valor))}</span>
                <Badge className={`border-0 text-[9px] ${
                  isPago ? 'bg-success/10 text-success' : 
                  isVencido ? 'bg-destructive/10 text-destructive' : 
                  'bg-warning/10 text-warning'
                }`}>
                  {isPago ? 'Pago' : isVencido ? 'Vencido' : 'Pendente'}
                </Badge>
              </div>
            </div>
          );
        })}
      </div>
      {lancamentos.length > 0 && (
        <div className="flex justify-between border-t border-border/60 pt-2 px-1">
          <span className="text-sm font-bold text-foreground">TOTAL</span>
          <span className="text-sm font-bold text-primary">{fmt(total)}</span>
        </div>
      )}
    </div>
  );
}
