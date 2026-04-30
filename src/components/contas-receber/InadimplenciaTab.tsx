import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, MessageSquare, CheckCircle } from 'lucide-react';
import type { LancamentoReceber } from '@/hooks/useContasReceber';
import { diasAtraso } from '@/hooks/useContasReceber';
import FaixasInadimplencia, { getFaixa } from './FaixasInadimplencia';

interface Props {
  lancamentos: LancamentoReceber[];
  onMarcarPago?: (l: LancamentoReceber) => void;
  onRegistrarContato?: (l: LancamentoReceber) => void;
  onReenviarCobranca?: (l: LancamentoReceber) => void;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function InadimplenciaTab({ lancamentos, onMarcarPago, onRegistrarContato, onReenviarCobranca }: Props) {
  const [faixaSelecionada, setFaixaSelecionada] = useState<string | null>(null);

  const hoje = new Date().toISOString().split('T')[0];
  const vencidos = lancamentos.filter(l => l.status === 'pendente' && l.data_vencimento < hoje);

  const FAIXAS_RANGE: Record<string, [number, number]> = {
    '1-7': [1, 7], '8-15': [8, 15], '16-30': [16, 30], '30+': [31, 99999],
  };

  let filtrados = vencidos;
  if (faixaSelecionada && FAIXAS_RANGE[faixaSelecionada]) {
    const [min, max] = FAIXAS_RANGE[faixaSelecionada];
    filtrados = vencidos.filter(l => {
      const d = diasAtraso(l.data_vencimento, l.status);
      return d >= min && d <= max;
    });
  }

  filtrados.sort((a, b) => diasAtraso(b.data_vencimento, b.status) - diasAtraso(a.data_vencimento, a.status));

  if (vencidos.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <p className="text-sm">🎉 Nenhuma inadimplência no período selecionado</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FaixasInadimplencia vencidos={vencidos} faixaSelecionada={faixaSelecionada} onSelectFaixa={setFaixaSelecionada} />

      <div className="space-y-3">
        {filtrados.map(l => {
          const dias = diasAtraso(l.data_vencimento, l.status);
          const faixa = getFaixa(dias);
          return (
            <div key={l.id} className="rounded-lg border border-border/60 bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="bg-destructive/15 text-destructive border-0 text-[10px]">-{dias} dias</Badge>
                  <span className="font-semibold text-sm">{l.cliente?.nome || 'Desconhecido'}</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{l.descricao}</p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>Valor: <span className="text-foreground font-medium">{fmt(Number(l.valor))}</span></span>
                <span>Vencimento: {new Date(l.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
              </div>
              {((l.tentativas_cobranca || 0) > 0 || l.notas_cobranca) && (
                <div className="text-xs space-y-1 border-t pt-2">
                  <p className="text-muted-foreground">
                    Tentativas: {l.tentativas_cobranca || 0}
                    {l.data_ultimo_contato && <> | Último contato: {new Date(l.data_ultimo_contato + 'T00:00:00').toLocaleDateString('pt-BR')}</>}
                  </p>
                  {l.notas_cobranca && (
                    <p className="text-muted-foreground whitespace-pre-line bg-muted/50 rounded p-2">{l.notas_cobranca}</p>
                  )}
                </div>
              )}
              {(onRegistrarContato || onReenviarCobranca || onMarcarPago) && (
              <div className="flex items-center gap-2">
                {onRegistrarContato && (
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onRegistrarContato(l)}>
                    <MessageSquare className="h-3.5 w-3.5 mr-1" /> Registrar Contato
                  </Button>
                )}
                {onReenviarCobranca && (
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onReenviarCobranca(l)}>
                    <Phone className="h-3.5 w-3.5 mr-1" /> Reenviar Cobrança
                  </Button>
                )}
                {onMarcarPago && (
                  <Button variant="outline" size="sm" className="h-7 text-xs text-success" onClick={() => onMarcarPago(l)}>
                    <CheckCircle className="h-3.5 w-3.5 mr-1" /> Pago
                  </Button>
                )}
              </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
