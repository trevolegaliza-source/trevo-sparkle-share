import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { TIPO_PROCESSO_LABELS, type TipoProcesso } from '@/types/financial';
import { EtiquetasCheckboxes } from '@/components/EtiquetasBadges';
import type { ServiceNegotiation } from '@/hooks/useServiceNegotiations';

export type ViaAnalise = 'matriz' | 'regional' | 'metodo_trevo';

export interface ProcessoFormData {
  razaoSocial: string;
  tipo: string;
  responsavel: string;
  prioridade: 'normal' | 'urgente';
  mudancaUF: boolean;
  descricaoAvulso: string;
  dataEntrada: string;
  dentroDoPlano: boolean;
  valorAvulso: number;
  justificativaAvulso: string;
  etiquetas: string[];
  viaAnalise: ViaAnalise;
}

interface Props {
  form: ProcessoFormData;
  onChange: (form: ProcessoFormData) => void;
  negotiations: ServiceNegotiation[];
  colaboradores: { id: string; nome: string }[];
  clienteTipo?: string;
  onBack: () => void;
  onNext: () => void;
}

export default function StepProcesso({ form, onChange, negotiations, colaboradores, clienteTipo, onBack, onNext }: Props) {
  const update = (field: keyof ProcessoFormData, value: any) => onChange({ ...form, [field]: value });
  const isAvulso = form.tipo === 'avulso';
  const isNeg = negotiations?.find(n => n.id === form.tipo);
  const isMensalista = clienteTipo === 'MENSALISTA';
  const canAdvance = form.razaoSocial.trim() && form.tipo && (!isAvulso || form.descricaoAvulso.trim());

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Dados do Processo</h2>
        <p className="text-sm text-muted-foreground">Informações sobre o serviço a ser realizado</p>
      </div>

      <div className="space-y-2">
        <Label>Razão Social *</Label>
        <Input
          required
          placeholder="Nome da empresa"
          value={form.razaoSocial}
          onChange={e => update('razaoSocial', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Tipo de Processo *</Label>
        <Select
          value={form.tipo}
          onValueChange={v => {
            const neg = negotiations?.find(n => n.id === v);
            if (neg) {
              onChange({ ...form, tipo: v, descricaoAvulso: '' });
            } else {
              onChange({ ...form, tipo: v as TipoProcesso, descricaoAvulso: v === 'avulso' ? form.descricaoAvulso : '' });
            }
          }}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(TIPO_PROCESSO_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
            {negotiations && negotiations.length > 0 && (
              <>
                <SelectItem disabled value="__header_neg" className="text-[10px] font-semibold text-muted-foreground">— Serviços Negociados —</SelectItem>
                {negotiations.map(n => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.service_name} — {Number(n.fixed_price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>
      </div>

      {isAvulso && (
        <div className="space-y-2">
          <Label>Descrição do Serviço Avulso *</Label>
          <Input
            placeholder="Ex: Inscrição Municipal, Certidão Negativa..."
            value={form.descricaoAvulso}
            onChange={e => update('descricaoAvulso', e.target.value)}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label>Responsável</Label>
        <Select value={form.responsavel || '__none__'} onValueChange={v => update('responsavel', v === '__none__' ? '' : v)}>
          <SelectTrigger><SelectValue placeholder="Selecionar (opcional)" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Nenhum</SelectItem>
            {colaboradores.map(c => (
              <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Prioridade</Label>
        <RadioGroup
          value={form.prioridade}
          onValueChange={v => update('prioridade', v as 'normal' | 'urgente')}
          className="flex gap-6"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="normal" id="prio-normal" />
            <Label htmlFor="prio-normal" className="font-normal cursor-pointer">Normal</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="urgente" id="prio-urgente" />
            <Label htmlFor="prio-urgente" className="font-normal cursor-pointer text-warning">Urgente (+50%)</Label>
          </div>
        </RadioGroup>
      </div>

      {/* Via de Análise (Matriz / Regional / Método Trevo) */}
      <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
        <Label className="text-sm font-medium">Via de análise na Junta Comercial *</Label>
        <p className="text-[11px] text-muted-foreground mb-2">
          Escolhida pelo cliente no formulário. Regional e Método Trevo bloqueiam cobrança até
          registrar a Taxa de Balcão paga em Valores Adicionais.
        </p>
        <RadioGroup
          value={form.viaAnalise}
          onValueChange={v => update('viaAnalise', v as ViaAnalise)}
          className="space-y-2"
        >
          <label className="flex items-start gap-3 cursor-pointer rounded-md p-2 hover:bg-muted/40">
            <RadioGroupItem value="matriz" id="via-matriz" className="mt-1" />
            <div className="flex-1">
              <p className="text-sm font-medium">⚪ Matriz (padrão)</p>
              <p className="text-[11px] text-muted-foreground">Apenas DARE / Taxa da Junta Comercial. Prazo indefinido.</p>
            </div>
          </label>
          <label className="flex items-start gap-3 cursor-pointer rounded-md p-2 hover:bg-muted/40">
            <RadioGroupItem value="regional" id="via-regional" className="mt-1" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-600">🟡 Escritório Regional</p>
              <p className="text-[11px] text-muted-foreground">Análise até 72h úteis. <strong>Exige Taxa de Balcão (R$ 189-231) paga e cobrada de volta do cliente.</strong></p>
            </div>
          </label>
          <label className="flex items-start gap-3 cursor-pointer rounded-md p-2 hover:bg-muted/40">
            <RadioGroupItem value="metodo_trevo" id="via-trevo" className="mt-1" />
            <div className="flex-1">
              <p className="text-sm font-medium text-emerald-600">🟢🚀 Método Trevo / Concierge</p>
              <p className="text-[11px] text-muted-foreground">Regional + acompanhamento especialista Trevo. Exige Taxa de Balcão + Honorário Método Trevo em Valores Adicionais.</p>
            </div>
          </label>
        </RadioGroup>
        {form.viaAnalise !== 'matriz' && (
          <div className="mt-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-700 dark:text-amber-400">
            ⚠ Depois de cadastrar o processo, lembra de entrar em <strong>Valores Adicionais</strong> e registrar a taxa paga + comprovante. Sem isso, o sistema vai <strong>bloquear</strong> o envio pra cobrança.
          </div>
        )}
      </div>

      {(form.tipo === 'alteracao' || isNeg) && !isAvulso && (
        <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3">
          <Checkbox
            id="mudanca-uf"
            checked={form.mudancaUF}
            onCheckedChange={checked => update('mudancaUF', !!checked)}
          />
          <div>
            <Label htmlFor="mudanca-uf" className="text-sm cursor-pointer">Mudança de UF (2 slots)</Label>
            <p className="text-[10px] text-muted-foreground">Será tratado como 2 processos para faturamento</p>
          </div>
        </div>
      )}

      {/* Dentro do Plano — somente mensalistas */}
      {isMensalista && (
        <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Label className="text-sm font-medium">Este processo está no escopo do plano mensal?</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={form.dentroDoPlano ? 'default' : 'outline'}
                onClick={() => {
                  onChange({ ...form, dentroDoPlano: true, valorAvulso: 0, justificativaAvulso: '' });
                }}
                className={form.dentroDoPlano ? 'bg-green-600 hover:bg-green-700' : ''}
              >
                ✅ Sim, dentro do plano
              </Button>
              <Button
                type="button"
                size="sm"
                variant={!form.dentroDoPlano ? 'default' : 'outline'}
                onClick={() => onChange({ ...form, dentroDoPlano: false })}
                className={!form.dentroDoPlano ? 'bg-amber-600 hover:bg-amber-700' : ''}
              >
                ❌ Não, fora do plano
              </Button>
            </div>
          </div>

          {form.dentroDoPlano && (
            <p className="text-xs text-muted-foreground">
              Processo coberto pela mensalidade. Contará no slot de desconto progressivo do mês.
            </p>
          )}

          {!form.dentroDoPlano && (
            <div className="space-y-2 mt-2 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
              <Label className="text-sm text-amber-600 font-medium">
                💰 Honorário avulso (além da mensalidade)
              </Label>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">R$</span>
                <Input
                  type="number"
                  value={form.valorAvulso || ''}
                  onChange={(e) => update('valorAvulso', parseFloat(e.target.value) || 0)}
                  placeholder="0,00"
                  className="w-40"
                  step="0.01"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Este valor será cobrado SEPARADAMENTE da mensalidade do cliente.
              </p>
              <div>
                <Label className="text-xs text-muted-foreground">Justificativa (opcional)</Label>
                <Input
                  value={form.justificativaAvulso}
                  onChange={(e) => update('justificativaAvulso', e.target.value)}
                  placeholder="Ex: Serviço fora do escopo contratado..."
                  className="text-sm"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Etiquetas */}
      <EtiquetasCheckboxes
        etiquetas={form.etiquetas || []}
        onChange={(novas) => update('etiquetas', novas)}
      />

      <div className="space-y-2">
        <Label>Data de Entrada do Processo</Label>
        <Input
          type="date"
          value={form.dataEntrada}
          onChange={e => update('dataEntrada', e.target.value)}
        />
        <p className="text-[10px] text-muted-foreground">
          Padrão: hoje. Altere para cadastrar processos retroativos.
        </p>
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <Button onClick={onNext} disabled={!canAdvance} className="gap-2">
          Próximo <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
