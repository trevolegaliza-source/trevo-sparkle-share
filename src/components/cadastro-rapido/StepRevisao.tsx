import { Button } from '@/components/ui/button';
import { ArrowLeft, Check, ListPlus } from 'lucide-react';
import type { ClienteDB } from '@/types/financial';
import { TIPO_PROCESSO_LABELS, type TipoProcesso } from '@/types/financial';
import { usePermissions } from '@/hooks/usePermissions';

interface ProcessoResumo {
  razaoSocial: string;
  tipo: string;
  prioridade: 'normal' | 'urgente';
  mudancaUF: boolean;
  metodoPreco: 'automatico' | 'manual' | 'servico_preacordado';
  valorManual: string;
  boasVindas: boolean;
  boasVindasPct: string;
  jaPago: boolean;
  observacoes: string;
  descricaoAvulso: string;
}

interface Props {
  cliente: ClienteDB;
  processo: ProcessoResumo;
  valorCalculado: number;
  slotNumero: number;
  descontoAplicado: number;
  onBack: () => void;
  onSave: () => void;
  onAddToQueue: () => void;
  isSaving: boolean;
  filaLength: number;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function StepRevisao({
  cliente,
  processo,
  valorCalculado,
  slotNumero,
  descontoAplicado,
  onBack,
  onSave,
  onAddToQueue,
  isSaving,
  filaLength,
}: Props) {
  const { podeVerValores, role } = usePermissions();
  // Operacional precisa ver valores no Cadastro Rápido para confirmar antes de salvar
  const podeVer = podeVerValores() || role === 'operacional';
  const vfmt = (v: number) => podeVer ? fmt(v) : '•••••';
  const tipoLabel = TIPO_PROCESSO_LABELS[processo.tipo as TipoProcesso] || processo.tipo;
  const valorBase = Number(cliente.valor_base ?? 0);
  const isManual = processo.metodoPreco === 'manual' || processo.tipo === 'avulso';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Revisão</h2>
        <p className="text-sm text-muted-foreground">Confirme os dados antes de salvar</p>
      </div>

      <div className="rounded-lg border border-border bg-muted/20 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Resumo do Processo</h3>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Cliente</span>
            <p className="font-medium">{cliente.apelido || cliente.nome}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Razão Social</span>
            <p className="font-medium">{processo.razaoSocial}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Tipo</span>
            <p className="font-medium">{tipoLabel}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Prioridade</span>
            <p className="font-medium">{processo.prioridade === 'urgente' ? '🔴 Urgente (+50%)' : 'Normal'}</p>
          </div>
          {processo.mudancaUF && (
            <div className="col-span-2">
              <span className="text-warning text-sm font-medium">🔄 Mudança de UF (2 slots)</span>
            </div>
          )}
        </div>

        <div className="h-px bg-border" />

        <div className="space-y-2 text-sm">
          {!isManual && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor Base</span>
                <span>{vfmt(valorBase)}</span>
              </div>
              {descontoAplicado > 0 && (
                <div className="flex justify-between text-info">
                  <span>Desconto (slot {slotNumero})</span>
                  <span>-{vfmt(descontoAplicado)}</span>
                </div>
              )}
              {processo.prioridade === 'urgente' && (
                <div className="flex justify-between text-warning">
                  <span>Urgência (+50%)</span>
                  <span>incluído</span>
                </div>
              )}
              {processo.boasVindas && (
                <div className="flex justify-between text-success">
                  <span>Boas-vindas (-{processo.boasVindasPct}%)</span>
                  <span>incluído</span>
                </div>
              )}
            </>
          )}
          {isManual && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor Manual</span>
              <span>{vfmt(valorCalculado)}</span>
            </div>
          )}
          <div className="h-px bg-border" />
          <div className="flex justify-between text-base font-bold">
            <span>VALOR FINAL</span>
            <span className="text-primary">{vfmt(valorCalculado)}</span>
          </div>
        </div>

        {processo.jaPago && (
          <div className="rounded-md bg-success/10 px-3 py-2 text-xs text-success font-medium">
            ✅ Marcado como já pago — entrará direto como Honorário Pago
          </div>
        )}

        {processo.observacoes && (
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">Obs:</span> {processo.observacoes}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 pt-2">
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onAddToQueue} className="gap-2">
              <ListPlus className="h-4 w-4" /> Adicionar à Fila
            </Button>
            <Button onClick={onSave} disabled={isSaving} className="gap-2">
              <Check className="h-4 w-4" />
              {isSaving ? 'Salvando...' : filaLength > 0 ? `Salvar Todos (${filaLength + 1})` : 'Confirmar e Salvar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
