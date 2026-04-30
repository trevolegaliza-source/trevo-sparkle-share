import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, User } from 'lucide-react';
import type { ClienteDB } from '@/types/financial';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  cliente: ClienteDB;
  processosNoMes: number;
  nextSlot: number;
}

export default function FichaCliente({ cliente, processosNoMes, nextSlot }: Props) {
  const valorBase = Number(cliente.valor_base ?? 0);
  const desconto = Number(cliente.desconto_progressivo ?? 0);
  const piso = cliente.valor_limite_desconto != null ? Number(cliente.valor_limite_desconto) : null;
  const isPrePago = cliente.tipo === 'PRE_PAGO';
  const isMensalista = cliente.tipo === 'MENSALISTA';
  const saldo = Number((cliente as any).saldo_prepago ?? 0);
  const franquia = Number((cliente as any).franquia_processos ?? 0);

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          Ficha do Cliente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <p className="font-semibold text-foreground">{cliente.apelido || cliente.nome}</p>
          {cliente.cnpj && <p className="text-xs text-muted-foreground">CNPJ: {cliente.cnpj}</p>}
          <Badge variant="outline" className="mt-1 text-[10px]">
            {isMensalista ? 'Mensalista' : isPrePago ? 'Pré-Pago' : 'Avulso'}
          </Badge>
        </div>

        {(cliente.telefone || cliente.email) && (
          <div className="text-xs text-muted-foreground space-y-0.5">
            {cliente.telefone && <p>📱 {cliente.telefone}</p>}
            {cliente.email && <p>✉️ {cliente.email}</p>}
          </div>
        )}

        <div className="h-px bg-border" />

        {/* PRE_PAGO: show balance */}
        {isPrePago && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="text-xs text-muted-foreground">💰 Saldo Pré-Pago</p>
            <p className={`text-lg font-bold ${saldo >= 0 ? 'text-primary' : 'text-destructive'}`}>{fmt(saldo)}</p>
          </div>
        )}

        {/* MENSALISTA: show franchise */}
        {isMensalista && franquia > 0 && (
          <div className="rounded-lg border border-success/30 bg-success/5 p-3">
            <p className="text-xs text-muted-foreground">Franquia</p>
            <p className="text-sm font-medium">
              {processosNoMes}/{franquia} processos
              {processosNoMes < franquia ? (
                <span className="text-success ml-1">✅ Dentro</span>
              ) : (
                <span className="text-warning ml-1">⚠ Excedente</span>
              )}
            </p>
          </div>
        )}

        {!isPrePago && (
          <div className="space-y-1 text-xs">
            <p className="font-medium text-muted-foreground">Configuração Financeira</p>
            <div className="grid grid-cols-2 gap-1">
              <span className="text-muted-foreground">Valor Base:</span>
              <span className="font-medium">{fmt(valorBase)}</span>
              <span className="text-muted-foreground">Desc. Progr.:</span>
              <span className="font-medium">{desconto}%</span>
              {piso != null && (
                <>
                  <span className="text-muted-foreground">Valor Piso:</span>
                  <span className="font-medium">{fmt(piso)}</span>
                </>
              )}
              {!isMensalista && (
                <>
                  <span className="text-muted-foreground">Dia Cobrança:</span>
                  <span className="font-medium">{cliente.dia_cobranca ?? 3} dias</span>
                </>
              )}
            </div>
          </div>
        )}

        {!isPrePago && (
          <>
            <div className="h-px bg-border" />
            <div className="text-xs space-y-1">
              <p>Processos este mês: <span className="font-bold text-foreground">{processosNoMes}</span></p>
              {!isMensalista && (
                <p>Próximo slot: <span className="font-bold text-primary">{nextSlot}º</span>
                  {desconto > 0 && <span className="text-muted-foreground"> ({desconto}% acumulado)</span>}
                </p>
              )}
            </div>
          </>
        )}

        <a
          href={`/clientes/${cliente.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          Editar Cliente <ExternalLink className="h-3 w-3" />
        </a>
      </CardContent>
    </Card>
  );
}
