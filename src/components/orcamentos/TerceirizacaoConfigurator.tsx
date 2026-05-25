/**
 * Configurador de Proposta de Terceirização — Fase 1 (MVP).
 *
 * Espelha o app.web do Apps Script: chips on/off com recálculo em tempo real
 * do valor base e dos planos PRO/ENTERPRISE. Pensado pra usar AO VIVO na
 * reunião comercial — Thales clica nos chips na frente do cliente.
 */
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Building2, FileText, ListChecks, DollarSign } from 'lucide-react';
import {
  type ServicoSocietario, type NaturezaJuridica, type ItemIncluso, type Modalidade,
  SERVICO_LABELS, NATUREZA_LABELS, ITEM_INCLUSO_META, PLANOS,
  calcularTerceirizacao, fmtBRL,
} from '@/lib/terceirizacao-engine';

export interface TerceirizacaoState {
  prospect_nome: string;
  prospect_cnpj: string;
  prospect_email: string;
  prospect_telefone: string;
  prospect_contato: string;          // representante legal
  modalidade: Modalidade;
  servicos: ServicoSocietario[];
  naturezas: NaturezaJuridica[];
  inclusos: ItemIncluso[];
  validade_dias: number;
}

interface Props {
  value: TerceirizacaoState;
  onChange: (next: TerceirizacaoState) => void;
}

export function TerceirizacaoConfigurator({ value, onChange }: Props) {
  const calc = useMemo(() => calcularTerceirizacao(value.inclusos), [value.inclusos]);

  const toggleArr = <T extends string>(arr: T[], item: T): T[] =>
    arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];

  return (
    <div className="space-y-6">
      {/* ─── Prospect ─── */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Building2 className="h-4 w-4" /> DADOS DO CLIENTE (CONTRATANTE)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Razão social *</Label>
              <Input
                value={value.prospect_nome}
                onChange={(e) => onChange({ ...value, prospect_nome: e.target.value })}
                placeholder="CONTADORIA ASSESSORIA E CONSULTORIA LTDA"
              />
            </div>
            <div className="space-y-1.5">
              <Label>CNPJ *</Label>
              <Input
                value={value.prospect_cnpj}
                onChange={(e) => onChange({ ...value, prospect_cnpj: e.target.value })}
                placeholder="57.175.666/0001-06"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Representante legal</Label>
              <Input
                value={value.prospect_contato}
                onChange={(e) => onChange({ ...value, prospect_contato: e.target.value })}
                placeholder="EDENILSON CARLOS VITORINO"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={value.prospect_email}
                onChange={(e) => onChange({ ...value, prospect_email: e.target.value })}
                placeholder="contato@cliente.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input
                value={value.prospect_telefone}
                onChange={(e) => onChange({ ...value, prospect_telefone: e.target.value })}
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Escopo: Serviços Societários ─── */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <FileText className="h-4 w-4" /> SERVIÇOS SOCIETÁRIOS
          </div>
          <p className="text-xs text-muted-foreground">
            Clique pra incluir/excluir do escopo contratado. Itens não selecionados aparecem riscados na proposta.
          </p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(SERVICO_LABELS) as ServicoSocietario[]).map((srv) => {
              const ativo = value.servicos.includes(srv);
              return (
                <button
                  key={srv}
                  type="button"
                  onClick={() => onChange({ ...value, servicos: toggleArr(value.servicos, srv) })}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium border transition-all',
                    ativo
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                      : 'bg-muted/30 border-border text-muted-foreground line-through hover:bg-muted/60'
                  )}
                >
                  {SERVICO_LABELS[srv]}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ─── Escopo: Natureza Jurídica ─── */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Building2 className="h-4 w-4" /> NATUREZA JURÍDICA ATENDIDA
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(NATUREZA_LABELS) as NaturezaJuridica[]).map((nat) => {
              const ativo = value.naturezas.includes(nat);
              return (
                <button
                  key={nat}
                  type="button"
                  onClick={() => onChange({ ...value, naturezas: toggleArr(value.naturezas, nat) })}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium border transition-all',
                    ativo
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                      : 'bg-muted/30 border-border text-muted-foreground line-through hover:bg-muted/60'
                  )}
                >
                  {NATUREZA_LABELS[nat]}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ─── O que está incluído ─── */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <ListChecks className="h-4 w-4" /> O QUE ESTÁ INCLUÍDO NO PROCESSO
          </div>
          <p className="text-xs text-muted-foreground">
            Cada item marcado adiciona ao valor base. Itens desmarcados aparecem ~~riscados~~ na proposta (cliente vê o que NÃO contratou).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {(Object.keys(ITEM_INCLUSO_META) as ItemIncluso[]).map((item) => {
              const meta = ITEM_INCLUSO_META[item];
              const ativo = value.inclusos.includes(item);
              return (
                <label
                  key={item}
                  className={cn(
                    'flex items-start gap-2 p-3 rounded-md border cursor-pointer transition-all',
                    ativo ? 'border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20' : 'border-border bg-muted/20 hover:bg-muted/40',
                    meta.obrigatorio && 'opacity-90 cursor-not-allowed'
                  )}
                >
                  <Checkbox
                    checked={ativo}
                    disabled={meta.obrigatorio}
                    onCheckedChange={(c) => {
                      if (meta.obrigatorio) return;
                      const next = c === true
                        ? [...value.inclusos.filter((i) => i !== item), item]
                        : value.inclusos.filter((i) => i !== item);
                      onChange({ ...value, inclusos: next });
                    }}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className={cn(
                        'text-sm font-medium',
                        !ativo && 'line-through text-muted-foreground'
                      )}>
                        {meta.label}
                      </span>
                      {meta.obrigatorio && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1">obrigatório</Badge>
                      )}
                      {meta.precoAdicional > 0 && (
                        <Badge variant="secondary" className="text-[9px] h-4 px-1">
                          +{fmtBRL(meta.precoAdicional)}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {meta.descricao}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ─── Modalidade ─── */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <DollarSign className="h-4 w-4" /> MODALIDADE COMERCIAL
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Modalidade *</Label>
              <Select
                value={value.modalidade}
                onValueChange={(v) => onChange({ ...value, modalidade: v as Modalidade })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="avulso">Avulso — pontual ({fmtBRL(calc.valorBase)}/processo)</SelectItem>
                  <SelectItem value="pro_5">PRO — 5 processos/mês ({fmtBRL(calc.totalMensalPro)}/mês)</SelectItem>
                  <SelectItem value="enterprise_10">ENTERPRISE — 10 processos/mês ({fmtBRL(calc.totalMensalEnterprise)}/mês)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Validade da proposta (dias)</Label>
              <Input
                type="number"
                min={1}
                max={90}
                value={value.validade_dias}
                onChange={(e) => onChange({ ...value, validade_dias: Math.max(1, Number(e.target.value) || 15) })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Preview de preços em tempo real (sticky-like) ─── */}
      <Card className="border-2 border-primary/30 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-sm font-semibold mb-3">
            💰 PREVIEW (atualizando em tempo real)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <PriceBox
              titulo="Avulso (por processo)"
              valor={fmtBRL(calc.valorBase)}
              subtitulo={`Base ${fmtBRL(380)} + ${fmtBRL(calc.valorBase - 380)} de itens`}
              destacado={value.modalidade === 'avulso'}
            />
            <PriceBox
              titulo="PRO (5/mês, -15%)"
              valor={fmtBRL(calc.totalMensalPro)}
              subtitulo={`${fmtBRL(calc.valorPro)}/un`}
              destacado={value.modalidade === 'pro_5'}
            />
            <PriceBox
              titulo="ENTERPRISE (10/mês, -20%)"
              valor={fmtBRL(calc.totalMensalEnterprise)}
              subtitulo={`${fmtBRL(calc.valorEnterprise)}/un`}
              destacado={value.modalidade === 'enterprise_10'}
            />
          </div>
          {calc.itensDesmarcados.length > 0 && (
            <p className="text-xs text-muted-foreground mt-3">
              Cliente vai ver riscados: {calc.itensDesmarcados.map((i) => ITEM_INCLUSO_META[i].label).join(', ')}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PriceBox({
  titulo, valor, subtitulo, destacado,
}: { titulo: string; valor: string; subtitulo: string; destacado: boolean }) {
  return (
    <div
      className={cn(
        'rounded-lg p-3 border-2 transition-all',
        destacado
          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
          : 'border-border bg-card opacity-70'
      )}
    >
      <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{titulo}</p>
      <p className="text-xl font-bold mt-1 tabular-nums">{valor}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{subtitulo}</p>
    </div>
  );
}
