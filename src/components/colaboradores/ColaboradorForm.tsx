import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, User, Briefcase, CalendarDays, TrendingUp } from 'lucide-react';
import CustoResumoCard from './CustoResumoCard';
import { useState } from 'react';

export interface ColaboradorFormData {
  nome: string;
  email: string;
  regime: 'CLT' | 'PJ' | 'INDEFINIDO';
  salario_base: string;
  vt_diario: string;
  vr_diario: string;
  status: 'ativo' | 'inativo';
  possui_adiantamento: boolean;
  adiantamento_tipo: 'percentual' | 'fixo';
  adiantamento_valor: string;
  dia_pagamento_integral: string;
  pix_tipo: string;
  pix_chave: string;
  valor_das: string;
  aumento_previsto_valor: string;
  aumento_previsto_data: string;
  data_inicio: string;
  aniversario: string;
  // New fields
  dia_adiantamento: string;
  dia_salario: string;
  dia_vt_vr: string;
  dia_das: string;
  tipo_transporte: 'vt' | 'auxilio_combustivel';
  auxilio_combustivel_valor: string;
  trello_username: string;
  fgts_percentual: string;
  inss_patronal_percentual: string;
  provisionar_13: boolean;
  provisionar_ferias: boolean;
  observacoes_pagamento: string;
}

export const EMPTY_FORM: ColaboradorFormData = {
  nome: '', email: '', regime: 'CLT', salario_base: '', vt_diario: '', vr_diario: '',
  status: 'ativo', possui_adiantamento: true, adiantamento_tipo: 'percentual', adiantamento_valor: '',
  dia_pagamento_integral: '5',
  pix_tipo: '', pix_chave: '', valor_das: '',
  aumento_previsto_valor: '', aumento_previsto_data: '',
  data_inicio: '', aniversario: '',
  dia_adiantamento: '20', dia_salario: '5', dia_vt_vr: '0', dia_das: '20',
  tipo_transporte: 'vt', auxilio_combustivel_valor: '',
  trello_username: '',
  fgts_percentual: '8', inss_patronal_percentual: '20',
  provisionar_13: true, provisionar_ferias: true,
  observacoes_pagamento: '',
};

interface Props {
  form: ColaboradorFormData;
  setForm: React.Dispatch<React.SetStateAction<ColaboradorFormData>>;
  onSubmit: (e: React.FormEvent) => void;
  isPending: boolean;
  isEdit: boolean;
  diasUteis: number;
}

function Section({ title, icon: Icon, defaultOpen = true, children }: { title: string; icon: any; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full rounded-lg border border-border/60 px-3 py-2 hover:bg-muted/30 transition-colors">
        <span className="flex items-center gap-2 text-xs font-semibold text-foreground uppercase tracking-wider">
          <Icon className="h-3.5 w-3.5 text-primary" /> {title}
        </span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3 space-y-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function ColaboradorForm({ form, setForm, onSubmit, isPending, isEdit, diasUteis }: Props) {
  const sal = Number(form.salario_base) || 0;
  const vt = Number(form.vt_diario) || 0;
  const vr = Number(form.vr_diario) || 0;
  const das = form.regime === 'INDEFINIDO' ? 0 : (Number(form.valor_das) || 0);

  return (
    <form onSubmit={onSubmit} className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
      {/* DADOS PESSOAIS */}
      <Section title="Dados Pessoais" icon={User}>
        <div className="grid gap-2">
          <Label className="text-foreground">Nome *</Label>
          <Input required value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
        </div>
        <div className="grid gap-2">
          <Label className="text-foreground">Email</Label>
          <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label className="text-foreground">Data de Início</Label>
            <Input type="date" value={form.data_inicio} onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))} />
          </div>
          <div className="grid gap-2">
            <Label className="text-foreground">Aniversário 🎂</Label>
            <Input type="date" value={form.aniversario} onChange={e => setForm(f => ({ ...f, aniversario: e.target.value }))} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label className="text-xs text-foreground">Tipo Chave PIX</Label>
            <Select value={form.pix_tipo || 'nenhum'} onValueChange={v => setForm(f => ({ ...f, pix_tipo: v === 'nenhum' ? '' : v }))}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">Nenhum</SelectItem>
                <SelectItem value="cpf">CPF</SelectItem>
                <SelectItem value="cnpj">CNPJ</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="telefone">Telefone</SelectItem>
                <SelectItem value="aleatoria">Chave Aleatória</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label className="text-xs text-foreground">Chave PIX</Label>
            <Input className="h-8" value={form.pix_chave} onChange={e => setForm(f => ({ ...f, pix_chave: e.target.value }))} />
          </div>
        </div>
        <div className="grid gap-2">
          <Label className="text-xs text-foreground">Usuário Trello (sem @)</Label>
          <Input
            className="h-8"
            value={form.trello_username}
            onChange={e => setForm(f => ({ ...f, trello_username: e.target.value.trim().toLowerCase() }))}
            placeholder="ex: joaosilva"
          />
          <p className="text-[10px] text-muted-foreground">Concede permissão de admin nos boards Trello protegidos.</p>
        </div>
      </Section>

      {/* CONTRATO E REMUNERAÇÃO */}
      <Section title="Contrato e Remuneração" icon={Briefcase}>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label className="text-foreground">Regime</Label>
            <Select value={form.regime} onValueChange={v => setForm(f => ({ ...f, regime: v as any }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CLT">CLT</SelectItem>
                <SelectItem value="PJ">PJ</SelectItem>
                <SelectItem value="INDEFINIDO">Indefinido</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label className="text-foreground">Status</Label>
            <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as any }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label className="text-foreground">Salário Base (R$)</Label>
            <Input type="number" step="0.01" min="0" value={form.salario_base} onChange={e => setForm(f => ({ ...f, salario_base: e.target.value }))} />
          </div>
          <div className="grid gap-2">
            <Label className="text-foreground">VR Diário (R$)</Label>
            <Input type="number" step="0.01" min="0" value={form.vr_diario} onChange={e => setForm(f => ({ ...f, vr_diario: e.target.value }))} />
          </div>
        </div>
        <div className="rounded-lg border border-border/60 p-3 space-y-3">
          <div className="grid gap-2">
            <Label className="text-xs font-semibold text-foreground uppercase tracking-wider">Tipo de Transporte</Label>
            <Select value={form.tipo_transporte} onValueChange={v => setForm(f => ({ ...f, tipo_transporte: v as any }))}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="vt">Vale Transporte (VT) — valor diário × dias úteis</SelectItem>
                <SelectItem value="auxilio_combustivel">Auxílio Combustível — valor fixo mensal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.tipo_transporte === 'vt' ? (
            <div className="grid gap-2">
              <Label className="text-foreground">VT Diário (R$)</Label>
              <Input type="number" step="0.01" min="0" value={form.vt_diario} onChange={e => setForm(f => ({ ...f, vt_diario: e.target.value }))} />
              <p className="text-[10px] text-muted-foreground">Multiplicado pelos dias úteis do mês</p>
            </div>
          ) : (
            <div className="grid gap-2">
              <Label className="text-foreground">Auxílio Combustível Fixo (R$)</Label>
              <Input type="number" step="0.01" min="0" value={form.auxilio_combustivel_valor} onChange={e => setForm(f => ({ ...f, auxilio_combustivel_valor: e.target.value }))} />
              <p className="text-[10px] text-muted-foreground">Valor fixo pago todo mês, independente dos dias úteis</p>
            </div>
          )}
        </div>
        {form.regime !== 'INDEFINIDO' && (
          <div className="grid gap-2">
            <Label className="text-foreground">Guia DAS / MEI (R$)</Label>
            <Input type="number" step="0.01" min="0" value={form.valor_das} onChange={e => setForm(f => ({ ...f, valor_das: e.target.value }))} placeholder="0.00" />
          </div>
        )}
        {form.regime === 'CLT' && (
          <div className="rounded-lg border border-info/30 bg-info/5 p-3 space-y-3">
            <p className="text-[10px] font-semibold text-info uppercase tracking-wider">Encargos CLT</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label className="text-xs text-foreground">FGTS (%)</Label>
                <Input className="h-8" type="number" step="0.01" min="0" value={form.fgts_percentual} onChange={e => setForm(f => ({ ...f, fgts_percentual: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs text-foreground">INSS Patronal (%)</Label>
                <Input className="h-8" type="number" step="0.01" min="0" value={form.inss_patronal_percentual} onChange={e => setForm(f => ({ ...f, inss_patronal_percentual: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={form.provisionar_13} onCheckedChange={v => setForm(f => ({ ...f, provisionar_13: !!v }))} />
                <span className="text-xs text-foreground">Provisionar 13º</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={form.provisionar_ferias} onCheckedChange={v => setForm(f => ({ ...f, provisionar_ferias: !!v }))} />
                <span className="text-xs text-foreground">Provisionar Férias</span>
              </label>
            </div>
          </div>
        )}
      </Section>

      {/* REGRAS DE PAGAMENTO */}
      <Section title="Regras de Pagamento" icon={CalendarDays}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-foreground">Possui Adiantamento?</p>
          <Switch checked={form.possui_adiantamento} onCheckedChange={v => setForm(f => ({ ...f, possui_adiantamento: v }))} />
        </div>
        {form.possui_adiantamento ? (
          <>
            <p className="text-[10px] text-muted-foreground">Pagamento dividido: adiantamento + restante do salário</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label className="text-xs text-foreground">Tipo</Label>
                <Select value={form.adiantamento_tipo} onValueChange={v => setForm(f => ({ ...f, adiantamento_tipo: v as any }))}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentual">% do Salário</SelectItem>
                    <SelectItem value="fixo">Valor Fixo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="text-xs text-foreground">{form.adiantamento_tipo === 'percentual' ? '%' : 'R$'}</Label>
                <Input className="h-8" type="number" step="0.01" min="0" value={form.adiantamento_valor}
                  onChange={e => setForm(f => ({ ...f, adiantamento_valor: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs text-foreground">Dia Adiant.</Label>
                <Input className="h-8" type="number" min="1" max="31" value={form.dia_adiantamento}
                  onChange={e => setForm(f => ({ ...f, dia_adiantamento: e.target.value }))} />
              </div>
            </div>
          </>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label className="text-xs text-foreground">Dia do Salário {form.possui_adiantamento ? '(Restante)' : ''}</Label>
            <Input className="h-8" type="number" min="1" max="31" value={form.dia_salario}
              onChange={e => setForm(f => ({ ...f, dia_salario: e.target.value }))} />
          </div>
          {(Number(form.vt_diario) > 0 || Number(form.vr_diario) > 0) && (
            <div className="grid gap-2">
              <Label className="text-xs text-foreground">Dia VT/VR (0=último útil)</Label>
              <Input className="h-8" type="number" min="0" max="31" value={form.dia_vt_vr}
                onChange={e => setForm(f => ({ ...f, dia_vt_vr: e.target.value }))} />
            </div>
          )}
        </div>
        {Number(form.valor_das) > 0 && (
          <div className="grid gap-2">
            <Label className="text-xs text-foreground">Dia do DAS</Label>
            <Input className="h-8" type="number" min="1" max="31" value={form.dia_das}
              onChange={e => setForm(f => ({ ...f, dia_das: e.target.value }))} />
          </div>
        )}
        <div className="grid gap-2">
          <Label className="text-xs text-foreground">Observações de Pagamento</Label>
          <Textarea className="min-h-[60px]" value={form.observacoes_pagamento}
            onChange={e => setForm(f => ({ ...f, observacoes_pagamento: e.target.value }))}
            placeholder="Regras especiais, preferências bancárias..." />
        </div>
      </Section>

      {/* AUMENTO PREVISTO */}
      <Section title="Previsão de Aumento" icon={TrendingUp} defaultOpen={false}>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label className="text-xs text-foreground">Novo Salário (R$)</Label>
            <Input className="h-8" type="number" step="0.01" min="0" value={form.aumento_previsto_valor}
              onChange={e => setForm(f => ({ ...f, aumento_previsto_valor: e.target.value }))} placeholder="0.00" />
          </div>
          <div className="grid gap-2">
            <Label className="text-xs text-foreground">Mês/Ano</Label>
            <Input className="h-8" type="month" value={form.aumento_previsto_data}
              onChange={e => setForm(f => ({ ...f, aumento_previsto_data: e.target.value }))} />
          </div>
        </div>
      </Section>

      {/* CUSTO RESUMO */}
      <CustoResumoCard
        salario={sal} vtDiario={vt} vrDiario={vr} das={das}
        regime={form.regime} fgtsPct={Number(form.fgts_percentual) || 8}
        inssPct={Number(form.inss_patronal_percentual) || 20}
        prov13={form.provisionar_13} provFerias={form.provisionar_ferias}
        diasUteis={diasUteis}
        tipoTransporte={form.tipo_transporte}
        auxilioCombustivelValor={Number(form.auxilio_combustivel_valor) || 0}
      />

      <Button type="submit" disabled={isPending} className="w-full">
        {isEdit ? 'Salvar' : 'Cadastrar'}
      </Button>
    </form>
  );
}
