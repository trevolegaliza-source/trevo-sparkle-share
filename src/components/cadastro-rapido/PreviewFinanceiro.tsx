import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calculator } from 'lucide-react';
import type { ClienteDB } from '@/types/financial';
import { calcularDescontoProgressivo } from '@/hooks/useFinanceiro';
import { usePermissions } from '@/hooks/usePermissions';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const mask = '•••••';

interface Props {
  cliente: ClienteDB;
  processosNoMes: number;
  filaLength: number;
  prioridade: 'normal' | 'urgente';
  metodoPreco: 'automatico' | 'manual' | 'servico_preacordado';
  valorManual: string;
  boasVindas: boolean;
  boasVindasPct: string;
  mudancaUF: boolean;
  isAvulso: boolean;
}

export interface PreviewResult {
  valorFinal: number;
  slotNumero: number;
  descontoAplicado: number;
  valorAntesBoasVindas: number;
}

export function calcPreview(props: Props): PreviewResult {
  const { cliente, processosNoMes, filaLength, prioridade, metodoPreco, valorManual, boasVindas, boasVindasPct, mudancaUF, isAvulso } = props;
  const isPrePago = cliente.tipo === 'PRE_PAGO';
  const isMensalista = cliente.tipo === 'MENSALISTA';
  const franquia = Number((cliente as any).franquia_processos ?? 0);

  // PRE_PAGO or manual
  if (isPrePago || isAvulso || metodoPreco === 'manual' || metodoPreco === 'servico_preacordado') {
    const valorBaseManual = Number(valorManual) || 0;
    return {
      valorFinal: valorBaseManual,
      slotNumero: processosNoMes + filaLength + 1,
      descontoAplicado: 0,
      valorAntesBoasVindas: valorBaseManual,
    };
  }

  // MENSALISTA within franchise
  if (isMensalista && franquia > 0 && (processosNoMes + filaLength) < franquia) {
    return {
      valorFinal: 0,
      slotNumero: processosNoMes + filaLength + 1,
      descontoAplicado: 0,
      valorAntesBoasVindas: 0,
    };
  }

  // MENSALISTA exceeded franchise
  const valorBase = Number(cliente.valor_base ?? 0);
  const descontoPercent = Number(cliente.desconto_progressivo ?? 0);
  const valorLimite = cliente.valor_limite_desconto != null ? Number(cliente.valor_limite_desconto) : null;

  let slotOffset: number;
  if (isMensalista && franquia > 0) {
    slotOffset = Math.max(0, processosNoMes + filaLength - franquia);
  } else {
    slotOffset = processosNoMes + filaLength;
  }

  // URGÊNCIA: valor fixo = base × 1.5, SEM desconto progressivo
  if (prioridade === 'urgente') {
    let urgBase = valorBase * 1.5;
    if (mudancaUF) urgBase *= 2;
    let urgFinal = urgBase;
    if (boasVindas) urgFinal *= (1 - Number(boasVindasPct) / 100);
    return {
      valorFinal: Math.round(urgFinal * 100) / 100,
      slotNumero: slotOffset + 1,
      descontoAplicado: 0,
      valorAntesBoasVindas: Math.round(urgBase * 100) / 100,
    };
  }

  if (mudancaUF && descontoPercent > 0) {
    const calc1 = calcularDescontoProgressivo(valorBase, descontoPercent, slotOffset, valorLimite);
    const calc2 = calcularDescontoProgressivo(valorBase, descontoPercent, slotOffset + 1, valorLimite);
    const totalBase = calc1.valorFinal + calc2.valorFinal;
    let total = totalBase;
    if (boasVindas) total *= (1 - Number(boasVindasPct) / 100);
    return {
      valorFinal: Math.round(total * 100) / 100,
      slotNumero: calc1.processoNumero,
      descontoAplicado: calc1.descontoAcumulado + calc2.descontoAcumulado,
      valorAntesBoasVindas: Math.round(totalBase * 100) / 100,
    };
  }

  const calc = calcularDescontoProgressivo(valorBase, descontoPercent, slotOffset, valorLimite);
  const finalBase = mudancaUF ? calc.valorFinal * 2 : calc.valorFinal;
  let final = finalBase;
  if (boasVindas) final *= (1 - Number(boasVindasPct) / 100);

  return {
    valorFinal: Math.round(final * 100) / 100,
    slotNumero: calc.processoNumero,
    descontoAplicado: calc.descontoAcumulado,
    valorAntesBoasVindas: Math.round(finalBase * 100) / 100,
  };
}

export default function PreviewFinanceiro(props: Props) {
  const { cliente, processosNoMes, filaLength, prioridade, mudancaUF, boasVindas, boasVindasPct, isAvulso, metodoPreco } = props;
  const { podeVerValores, role } = usePermissions();
  // Operacional precisa ver valores no Cadastro Rápido para confirmar antes de salvar
  const podeVer = podeVerValores() || role === 'operacional';
  const preview = calcPreview(props);
  const vfmt = (v: number) => podeVer ? fmt(v) : mask;
  const valorBase = Number(cliente.valor_base ?? 0);
  const isManual = metodoPreco === 'manual' || isAvulso;
  const isPrePago = cliente.tipo === 'PRE_PAGO';
  const isMensalista = cliente.tipo === 'MENSALISTA';
  const franquia = Number((cliente as any).franquia_processos ?? 0);
  const saldo = Number((cliente as any).saldo_prepago ?? 0);
  const dentroFranquia = isMensalista && franquia > 0 && (processosNoMes + filaLength) < franquia;
  const boasVindasDesconto = boasVindas ? Math.max(0, preview.valorAntesBoasVindas - preview.valorFinal) : 0;

  // Build progression line
  const descontoPercent = Number(cliente.desconto_progressivo ?? 0);
  const valorLimite = cliente.valor_limite_desconto != null ? Number(cliente.valor_limite_desconto) : null;
  const progression: { slot: number; valor: number }[] = [];
  if (!isManual && !isPrePago && !dentroFranquia && descontoPercent > 0) {
    const baseOffset = isMensalista && franquia > 0 ? Math.max(0, processosNoMes - franquia) : 0;
    const end = isMensalista && franquia > 0 ? Math.max(0, processosNoMes + filaLength - franquia) : processosNoMes + filaLength;
    for (let i = 0; i <= end; i++) {
      const c = calcularDescontoProgressivo(valorBase, descontoPercent, i, valorLimite);
      progression.push({ slot: c.processoNumero, valor: c.valorFinal });
    }
  }

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Calculator className="h-4 w-4 text-primary" />
          Preview Financeiro
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {/* PRE_PAGO preview */}
        {isPrePago && (
          <>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Serviço</span>
              <span className="font-medium">{vfmt(preview.valorFinal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Saldo Atual</span>
              <span className="font-medium">{vfmt(saldo)}</span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex justify-between font-bold">
              <span>Saldo Após</span>
              <span className={saldo - preview.valorFinal >= 0 ? 'text-success' : 'text-destructive'}>
                {vfmt(saldo - preview.valorFinal)} {saldo - preview.valorFinal >= 0 ? '✅' : '❌'}
              </span>
            </div>
          </>
        )}

        {/* MENSALISTA within franchise */}
        {isMensalista && dentroFranquia && (
          <>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Franquia</span>
              <span>{franquia} processos/mês</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Utilizados</span>
              <span>{processosNoMes + filaLength}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Restam</span>
              <span className="text-success font-medium">{franquia - processosNoMes - filaLength}</span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex justify-between font-bold">
              <span>Valor</span>
              <span className="text-success">R$ 0,00 ✅</span>
            </div>
          </>
        )}

        {/* MENSALISTA exceeded or AVULSO */}
        {!isPrePago && !(isMensalista && dentroFranquia) && (
          <>
            {isMensalista && franquia > 0 && (
              <div className="flex justify-between text-warning text-xs">
                <span>⚠ Franquia esgotada ({franquia}/{franquia})</span>
              </div>
            )}
            {!isManual && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor Base</span>
                  <span>{vfmt(valorBase)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Slot nº</span>
                  <span className="font-bold text-primary">{preview.slotNumero}º</span>
                </div>
                {preview.descontoAplicado > 0 && (
                  <div className="flex justify-between text-info">
                    <span>Desc. Progressivo</span>
                    <span>-{vfmt(preview.descontoAplicado)}</span>
                  </div>
                )}
              </>
            )}

            {prioridade === 'urgente' && (
              <div className="flex justify-between text-warning">
                <span>Urgência (+50%)</span>
                <span>incluído</span>
              </div>
            )}
            {mudancaUF && (
              <div className="flex justify-between text-warning">
                <span>Mudança de UF (2 slots)</span>
                <span>incluído</span>
              </div>
            )}
            {boasVindas && (
              <div className="flex justify-between text-success">
                <span>Boas-vindas (-{boasVindasPct}%)</span>
                <span>{boasVindasDesconto > 0 ? `-${vfmt(boasVindasDesconto)}` : 'incluído'}</span>
              </div>
            )}

            <div className="h-px bg-border" />

            <div className="flex justify-between text-base font-bold">
              <span>VALOR FINAL</span>
              <span className="text-primary">{vfmt(preview.valorFinal)}</span>
            </div>
          </>
        )}

        {progression.length > 1 && (
          <div className="pt-2">
            <p className="text-[10px] text-muted-foreground mb-1">Progressão:</p>
            <div className="flex flex-wrap gap-1">
              {progression.map((p, i) => (
                <span
                  key={i}
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    i === progression.length - 1
                      ? 'bg-primary/20 text-primary font-bold'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {p.slot}º {vfmt(p.valor)}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
