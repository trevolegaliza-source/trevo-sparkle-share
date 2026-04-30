import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/usePermissions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ArrowRight, AlertTriangle } from 'lucide-react';
import type { ServiceNegotiation } from '@/hooks/useServiceNegotiations';

export interface ValorFormData {
  metodoPreco: 'automatico' | 'manual' | 'servico_preacordado';
  valorManual: string;
  motivoManual: string;
  boasVindas: boolean;
  boasVindasPct: string;
  jaPago: boolean;
  observacoes: string;
  servicoPreAcordadoId: string;
}

interface Props {
  form: ValorFormData;
  onChange: (form: ValorFormData) => void;
  isFirstProcess: boolean;
  isAvulso: boolean;
  clienteTipo: string;
  negotiations: ServiceNegotiation[];
  saldoPrepago: number;
  valorPreview: number;
  franquiaProcessos: number;
  processosNoMes: number;
  onBack: () => void;
  onNext: () => void;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function StepValor({ form, onChange, isFirstProcess, isAvulso, clienteTipo, negotiations, saldoPrepago, valorPreview, franquiaProcessos, processosNoMes, onBack, onNext }: Props) {
  const { podeVerValores, role } = usePermissions();
  // Operacional precisa ver valores no Cadastro Rápido para confirmar antes de salvar
  const podeVer = podeVerValores() || role === 'operacional';
  const vfmt = (v: number) => podeVer ? fmt(v) : '•••••';
  const update = (field: keyof ValorFormData, value: any) => onChange({ ...form, [field]: value });
  const isPrePago = clienteTipo === 'PRE_PAGO';
  const isMensalista = clienteTipo === 'MENSALISTA';
  const dentroFranquia = isMensalista && franquiaProcessos > 0 && processosNoMes < franquiaProcessos;
  const saldoInsuficiente = isPrePago && valorPreview > saldoPrepago;

  const selectedNeg = negotiations.find(n => n.id === form.servicoPreAcordadoId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Configuração Financeira</h2>
        <p className="text-sm text-muted-foreground">
          {isPrePago ? 'Selecione o serviço pré-acordado' : isMensalista && dentroFranquia ? 'Processo dentro da franquia' : 'Defina como o valor será calculado'}
        </p>
      </div>

      {/* PRE_PAGO: force service selection */}
      {isPrePago && (
        <div className="space-y-3">
          <Label>Serviço Pré-Acordado *</Label>
          <Select value={form.servicoPreAcordadoId} onValueChange={v => {
            const neg = negotiations.find(n => n.id === v);
            const valor = neg ? String((neg as any).valor_prepago > 0 ? (neg as any).valor_prepago : neg.fixed_price) : '';
            onChange({ ...form, servicoPreAcordadoId: v, metodoPreco: 'servico_preacordado', valorManual: valor });
          }}>
            <SelectTrigger><SelectValue placeholder="Selecione um serviço..." /></SelectTrigger>
            <SelectContent>
              {negotiations.map(n => (
                <SelectItem key={n.id} value={n.id}>
                  {n.service_name} — {vfmt((n as any).valor_prepago > 0 ? (n as any).valor_prepago : n.fixed_price)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {negotiations.length === 0 && (
            <p className="text-xs text-warning">Nenhum serviço pré-acordado cadastrado. Configure na aba "Serviços" do cliente.</p>
          )}

          {saldoInsuficiente && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-2">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-semibold text-sm">Saldo Insuficiente</span>
              </div>
              <div className="text-xs space-y-1">
                <p>Valor do serviço: {vfmt(valorPreview)}</p>
                <p>Saldo atual: {vfmt(saldoPrepago)}</p>
                <p className="text-destructive font-medium">Diferença: {vfmt(valorPreview - saldoPrepago)}</p>
              </div>
              <p className="text-xs text-muted-foreground">O cliente precisa realizar uma recarga para prosseguir.</p>
            </div>
          )}
        </div>
      )}

      {/* MENSALISTA within franchise */}
      {isMensalista && dentroFranquia && (
        <div className="rounded-lg border border-success/30 bg-success/5 p-4">
          <p className="text-sm font-medium text-success">✅ Dentro da Franquia</p>
          <p className="text-xs text-muted-foreground mt-1">
            Processo {processosNoMes + 1} de {franquiaProcessos} — Valor: R$ 0,00
          </p>
        </div>
      )}

      {/* AVULSO or MENSALISTA excedente: show auto/manual */}
      {!isPrePago && !(isMensalista && dentroFranquia) && !isAvulso && (
        <div className="space-y-2">
          <Label>Método de precificação</Label>
          <RadioGroup
            value={form.metodoPreco}
            onValueChange={v => update('metodoPreco', v as 'automatico' | 'manual')}
            className="flex gap-6"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="automatico" id="preco-auto" />
              <Label htmlFor="preco-auto" className="font-normal cursor-pointer">
                Automático{isMensalista ? ' (excedente)' : ' (desconto progressivo)'}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="manual" id="preco-manual" />
              <Label htmlFor="preco-manual" className="font-normal cursor-pointer">Valor Manual</Label>
            </div>
          </RadioGroup>
        </div>
      )}

      {(form.metodoPreco === 'manual' || isAvulso) && !isPrePago && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="space-y-2">
            <Label>Valor (R$) *</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={form.valorManual}
              onChange={e => update('valorManual', e.target.value)}
            />
          </div>
          {!isAvulso && (
            <div className="space-y-2">
              <Label>Motivo do valor manual</Label>
              <Input
                placeholder="Ex: Negociação especial, cortesia..."
                value={form.motivoManual}
                onChange={e => update('motivoManual', e.target.value)}
              />
            </div>
          )}
        </div>
      )}

      {isFirstProcess && !isAvulso && !isPrePago && (
        <div className="rounded-lg border border-success/30 bg-success/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium text-success">🎁 Desconto de Boas-vindas</Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">Primeiro processo deste cliente</p>
            </div>
            <Switch checked={form.boasVindas} onCheckedChange={v => update('boasVindas', v)} />
          </div>
          {form.boasVindas && (
            <div className="space-y-1">
              <Label className="text-xs">Percentual (%)</Label>
              <Input
                type="number"
                min={1}
                max={100}
                className="w-32"
                value={form.boasVindasPct}
                onChange={e => update('boasVindasPct', e.target.value)}
              />
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 p-3">
        <div>
          <Label className="text-sm font-medium">Já foi pago/liquidado?</Label>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {form.jaPago ? 'Entrará direto como Honorário Pago' : 'Seguirá o fluxo normal de cobrança'}
          </p>
        </div>
        <Switch checked={form.jaPago} onCheckedChange={v => update('jaPago', v)} />
      </div>

      <div className="space-y-2">
        <Label>Observações</Label>
        <Textarea
          placeholder="Protocolo, detalhes, etc."
          value={form.observacoes}
          onChange={e => update('observacoes', e.target.value)}
          rows={3}
        />
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <Button onClick={onNext} className="gap-2" disabled={isPrePago && (saldoInsuficiente || !form.servicoPreAcordadoId)}>
          Próximo <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
