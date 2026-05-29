import { Edit2, Save, X, Tag as TagIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ValorProtegido } from '@/components/auth/ValorProtegido';
import { useClientePrecosPorTipo } from '@/hooks/useFinanceiro';
import type { ClienteDB } from '@/types/financial';

interface TabFinanceiroConfigProps {
  cliente: ClienteDB;
  isMensalista: boolean;
  isPrePago: boolean;
  isDeferimento: boolean;
  editing: boolean;
  editForm: Partial<ClienteDB>;
  isSaving: boolean;
  onStartEditing: () => void;
  onCancelEditing: () => void;
  onChangeEditForm: (updater: (f: Partial<ClienteDB>) => Partial<ClienteDB>) => void;
  onSaveParams: () => void;
  onOpenPrecosTipo: () => void;
  formatCurrencyOrZero: (value: number | null | undefined) => string;
  formatValueOrZero: (value: number | null | undefined) => string;
}

export default function TabFinanceiroConfig({
  cliente,
  isMensalista,
  isPrePago,
  isDeferimento,
  editing,
  editForm,
  isSaving,
  onStartEditing,
  onCancelEditing,
  onChangeEditForm,
  onSaveParams,
  onOpenPrecosTipo,
  formatCurrencyOrZero,
  formatValueOrZero,
}: TabFinanceiroConfigProps) {
  return (
    <Card className="border-border/60">
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Parâmetros Financeiros</CardTitle>
        {!editing ? (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={onStartEditing}>
            <Edit2 className="h-3.5 w-3.5" /> Editar Parâmetros
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={onCancelEditing}><X className="h-3.5 w-3.5 mr-1" />Cancelar</Button>
            <Button size="sm" className="gap-1.5" onClick={onSaveParams} disabled={isSaving}><Save className="h-3.5 w-3.5" />Salvar</Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-xs text-muted-foreground">Tipo de Cliente</Label>
            <p className="font-medium">{isMensalista ? 'Mensalista' : isPrePago ? 'Pré-Pago' : 'Avulso'}</p>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Momento do Faturamento</Label>
            {editing ? (
              <Select value={(editForm as any).momento_faturamento || 'na_solicitacao'} onValueChange={(v) => onChangeEditForm(f => ({ ...f, momento_faturamento: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="na_solicitacao">Na Solicitação</SelectItem>
                  <SelectItem value="no_deferimento">No Deferimento</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <p className="font-medium">{isDeferimento ? 'No Deferimento' : 'Na Solicitação'}</p>
            )}
          </div>
          {isMensalista ? (
            <>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Valor da Mensalidade</Label>
                {editing ? (
                  <Input type="number" step="0.01" value={(editForm as any).mensalidade ?? ''} onChange={e => onChangeEditForm(f => ({ ...f, mensalidade: e.target.value ? Number(e.target.value) : null }))} placeholder="0,00" />
                ) : (
                  <p className="font-medium"><ValorProtegido valor={Number((cliente as any).mensalidade ?? 0)} /></p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Franquia de Processos/mês</Label>
                {editing ? (
                  <Input type="number" min={0} value={(editForm as any).franquia_processos ?? ''} onChange={e => onChangeEditForm(f => ({ ...f, franquia_processos: e.target.value ? Number(e.target.value) : 0 }))} placeholder="0" />
                ) : (
                  <p className="font-medium">{(cliente as any).franquia_processos ?? 0} processos</p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Vencimento</Label>
                {editing ? (
                  <Input type="number" min={1} max={31} value={(editForm as any).vencimento ?? (editForm as any).dia_vencimento_mensal ?? ''} onChange={e => { const v = e.target.value ? Number(e.target.value) : null; onChangeEditForm(f => ({ ...f, vencimento: v, dia_vencimento_mensal: v ?? undefined })); }} />
                ) : (
                  <p className="font-medium">Dia {(cliente as any).vencimento ?? cliente.dia_vencimento_mensal ?? 0}</p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Valor Base (proc. excedente)</Label>
                {editing ? (
                  <Input type="number" step="0.01" value={(editForm as any).valor_base ?? ''} onChange={e => onChangeEditForm(f => ({ ...f, valor_base: e.target.value ? Number(e.target.value) : null }))} placeholder="0,00" />
                ) : (
                  <p className="font-medium"><ValorProtegido valor={Number((cliente as any).valor_base ?? 0)} /></p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Desc. Progressivo % (excedente)</Label>
                {editing ? (
                  <Input type="number" step="0.1" value={(editForm as any).desconto_progressivo ?? ''} onChange={e => onChangeEditForm(f => ({ ...f, desconto_progressivo: e.target.value ? Number(e.target.value) : null }))} placeholder="0" />
                ) : (
                  <p className="font-medium">{formatValueOrZero((cliente as any).desconto_progressivo)}%</p>
                )}
              </div>
              <div className="col-span-2 p-3 rounded-lg bg-muted/30 border border-border/40">
                <p className="text-xs text-muted-foreground">
                  Processos dentro da franquia: R$ 0,00. Processos excedentes usam valor base com desconto progressivo configurado acima.
                </p>
              </div>
            </>
          ) : isPrePago ? (
            <>
              <div className="col-span-2 rounded-lg border border-primary/30 bg-primary/5 p-4">
                <p className="text-xs text-muted-foreground">Saldo Atual</p>
                <p className={`text-2xl font-bold ${Number((cliente as any).saldo_prepago ?? 0) >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  <ValorProtegido valor={Number((cliente as any).saldo_prepago ?? 0)} className={`text-2xl font-bold ${Number((cliente as any).saldo_prepago ?? 0) >= 0 ? 'text-primary' : 'text-destructive'}`} />
                </p>
                {(cliente as any).data_ultima_recarga && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Última recarga: {formatCurrencyOrZero((cliente as any).saldo_ultima_recarga)} em {new Date((cliente as any).data_ultima_recarga).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>
              <div className="col-span-2 p-3 rounded-lg bg-muted/30 border border-border/40">
                <p className="text-xs text-muted-foreground">
                  Para clientes pré-pagos, o valor de cada processo é definido nos Serviços Pré-Acordados. O saldo é debitado automaticamente ao cadastrar o processo.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-1.5 col-span-2">
                <Label className="text-xs text-muted-foreground">Forma de Cobrança</Label>
                {editing ? (
                  <RadioGroup
                    value={Number((editForm as any).dia_vencimento_mensal) > 0 ? 'fatura_mensal' : 'por_processo'}
                    onValueChange={(v) => {
                      if (v === 'por_processo') {
                        onChangeEditForm(f => ({ ...f, dia_vencimento_mensal: null, dia_cobranca: (f as any).dia_cobranca ?? 4 }));
                      } else {
                        onChangeEditForm(f => ({ ...f, dia_vencimento_mensal: 15, dia_cobranca: null }));
                      }
                    }}
                    className="flex gap-4"
                  >
                    <div className="flex items-center gap-1.5">
                      <RadioGroupItem value="por_processo" id="edit-fc-processo" />
                      <Label htmlFor="edit-fc-processo" className="text-xs cursor-pointer">Por processo (D+X dias)</Label>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <RadioGroupItem value="fatura_mensal" id="edit-fc-mensal" />
                      <Label htmlFor="edit-fc-mensal" className="text-xs cursor-pointer">Fatura mensal (dia fixo)</Label>
                    </div>
                  </RadioGroup>
                ) : (
                  <p className="font-medium">
                    {Number(cliente.dia_vencimento_mensal) > 0 ? `Fatura mensal — dia ${cliente.dia_vencimento_mensal}` : `Por processo — D+${(cliente as any).dia_cobranca ?? 4}`}
                  </p>
                )}
              </div>
              {editing && Number((editForm as any).dia_vencimento_mensal) > 0 ? (
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Dia de vencimento da fatura</Label>
                  <Input type="number" min={1} max={31} value={(editForm as any).dia_vencimento_mensal ?? ''} onChange={e => onChangeEditForm(f => ({ ...f, dia_vencimento_mensal: e.target.value ? Number(e.target.value) : null }))} placeholder="15" />
                </div>
              ) : editing ? (
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Vencimento após solicitação</Label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">D+</span>
                    <Input type="number" min={1} max={60} value={(editForm as any).dia_cobranca ?? ''} onChange={e => onChangeEditForm(f => ({ ...f, dia_cobranca: e.target.value ? Number(e.target.value) : null }))} placeholder="4" className="w-20" />
                    <span className="text-xs text-muted-foreground">dias</span>
                  </div>
                </div>
              ) : null}
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Valor Base</Label>
                {editing ? (
                  <Input type="number" step="0.01" value={(editForm as any).valor_base ?? ''} onChange={e => onChangeEditForm(f => ({ ...f, valor_base: e.target.value ? Number(e.target.value) : null }))} placeholder="0,00" />
                ) : (
                  <p className="font-medium"><ValorProtegido valor={Number((cliente as any).valor_base ?? 0)} /></p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Desconto Progressivo (%)</Label>
                {editing ? (
                  <Input type="number" step="0.1" value={(editForm as any).desconto_progressivo ?? ''} onChange={e => onChangeEditForm(f => ({ ...f, desconto_progressivo: e.target.value ? Number(e.target.value) : null }))} placeholder="0" />
                ) : (
                  <p className="font-medium">{formatValueOrZero((cliente as any).desconto_progressivo)}%</p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Valor Limite de Desconto</Label>
                {editing ? (
                  <Input type="number" step="0.01" value={(editForm as any).valor_limite_desconto ?? ''} onChange={e => onChangeEditForm(f => ({ ...f, valor_limite_desconto: e.target.value ? Number(e.target.value) : null }))} placeholder="0,00" />
                ) : (
                  <p className="font-medium"><ValorProtegido valor={Number((cliente as any).valor_limite_desconto ?? 0)} /></p>
                )}
              </div>
            </>
          )}
        </div>

        {/* 25/05/2026: Preços diferenciados por tipo (override do valor_base).
            Backend já consumia via get_preco_por_tipo() — antes desta UI
            era SQL manual (caso VITAE abertura R$540). */}
        {!isMensalista && (
          <PrecosPorTipoButton
            clienteId={cliente.id}
            onClick={onOpenPrecosTipo}
          />
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Botão pra abrir o dialog de preços por tipo. Sub-componente isolado pra
 * poder chamar useClientePrecosPorTipo() sem inflar o ClienteDetalhe.tsx.
 * Mostra badge com nº de regras configuradas.
 */
function PrecosPorTipoButton({
  clienteId,
  onClick,
}: { clienteId: string; onClick: () => void }) {
  const { data: precos } = useClientePrecosPorTipo(clienteId);
  const count = precos?.length ?? 0;
  return (
    <div className="mt-4 pt-4 border-t border-border/40">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onClick}
        className="gap-1.5"
      >
        <TagIcon className="h-3.5 w-3.5" />
        Preços diferenciados por tipo
        {count > 0 && (
          <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
            {count}
          </Badge>
        )}
      </Button>
      {count === 0 && (
        <p className="text-[11px] text-muted-foreground mt-1.5">
          Configure preços diferentes pra abertura/alteração/etc. (ex: cliente que negociou R$ 540 só pra abertura).
        </p>
      )}
    </div>
  );
}
