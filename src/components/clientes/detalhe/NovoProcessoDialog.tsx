import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { TIPO_PROCESSO_LABELS } from '@/types/financial';
import type { ClienteDB } from '@/types/financial';
import type { ProcessoFormState, DescontoPreview } from './types';

interface NovoProcessoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente: ClienteDB;
  isMensalista: boolean;
  processoForm: ProcessoFormState;
  setProcessoForm: (updater: (f: ProcessoFormState) => ProcessoFormState) => void;
  isManualPrice: boolean;
  isNegotiatedService: boolean;
  isFirstProcessNovo: boolean;
  aplicarBoasVindas: boolean;
  setAplicarBoasVindas: (v: boolean) => void;
  boasVindasPct: string;
  setBoasVindasPct: (v: string) => void;
  descontoPreview: DescontoPreview | null;
  negotiations: Array<{ id: string; service_name: string; fixed_price: number; billing_trigger: string; trigger_days: number }> | undefined;
  colaboradores: Array<{ id: string; nome: string; status: string }> | undefined;
  isCreating: boolean;
  onCreate: () => void;
}

export default function NovoProcessoDialog({
  open,
  onOpenChange,
  cliente,
  isMensalista,
  processoForm,
  setProcessoForm,
  isManualPrice,
  isNegotiatedService,
  isFirstProcessNovo,
  aplicarBoasVindas,
  setAplicarBoasVindas,
  boasVindasPct,
  setBoasVindasPct,
  descontoPreview,
  negotiations,
  colaboradores,
  isCreating,
  onCreate,
}: NovoProcessoDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Processo — {cliente.apelido || cliente.nome}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Razão Social */}
          <div className="grid gap-1.5">
            <Label>Razão Social *</Label>
            <Input value={processoForm.razao_social} onChange={e => setProcessoForm(f => ({ ...f, razao_social: e.target.value }))} placeholder="Nome da empresa" />
          </div>

          {/* Tipo + Prioridade */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>Tipo de Serviço *</Label>
              <Select
                value={processoForm.negotiated_service_id || processoForm.tipo}
                onValueChange={v => {
                  const neg = negotiations?.find(n => n.id === v);
                  if (neg) {
                    setProcessoForm(f => ({
                      ...f,
                      negotiated_service_id: neg.id,
                      tipo: 'avulso',
                      definir_manual: true,
                      valor_manual: String(neg.fixed_price),
                    }));
                  } else {
                    setProcessoForm(f => ({
                      ...f,
                      negotiated_service_id: '',
                      tipo: v,
                      definir_manual: false,
                      valor_manual: '',
                    }));
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
              {isNegotiatedService && (
                <p className="text-[10px] text-primary">Valor fixo negociado aplicado.</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label>Prioridade</Label>
              <Select value={processoForm.prioridade} onValueChange={v => setProcessoForm(f => ({ ...f, prioridade: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="urgente">Urgente (+50%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Responsável */}
          <div className="grid gap-1.5">
            <Label>Responsável</Label>
            <Select value={processoForm.responsavel || '__none__'} onValueChange={v => setProcessoForm(f => ({ ...f, responsavel: v === '__none__' ? '' : v }))}>
              <SelectTrigger><SelectValue placeholder="Selecionar (opcional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nenhum</SelectItem>
                {(colaboradores || []).filter(c => c.status === 'ativo').map(c => (
                  <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Mudança de UF */}
          {(processoForm.tipo === 'alteracao' || processoForm.tipo === 'transformacao') && !isNegotiatedService && (
            <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3">
              <Checkbox
                id="np-mudanca_uf"
                checked={processoForm.mudanca_uf}
                onCheckedChange={(checked) => setProcessoForm(f => ({ ...f, mudanca_uf: !!checked }))}
              />
              <div>
                <Label htmlFor="np-mudanca_uf" className="text-sm font-medium cursor-pointer">Mudança de UF (2 slots)</Label>
                <p className="text-[10px] text-muted-foreground">Será tratado como 2 processos para faturamento</p>
              </div>
            </div>
          )}

          {/* ── Precificação ── */}
          <div className="space-y-3 rounded-lg border border-border/60 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Precificação</p>
            <RadioGroup
              value={isNegotiatedService ? 'manual' : (processoForm.definir_manual ? 'manual' : 'auto')}
              onValueChange={v => setProcessoForm(f => ({ ...f, definir_manual: v === 'manual', negotiated_service_id: v === 'auto' ? '' : f.negotiated_service_id, valor_manual: v === 'auto' ? '' : f.valor_manual }))}
              className="flex gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="auto" id="np-preco-auto" disabled={isNegotiatedService} />
                <Label htmlFor="np-preco-auto" className="text-sm cursor-pointer">Automático</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="manual" id="np-preco-manual" />
                <Label htmlFor="np-preco-manual" className="text-sm cursor-pointer">Valor Manual</Label>
              </div>
            </RadioGroup>

            {/* Auto preview */}
            {!isManualPrice && !isNegotiatedService && descontoPreview && (
              <div className="rounded-md bg-muted/40 p-2.5 text-sm space-y-0.5">
                {processoForm.prioridade === 'urgente' ? (
                  <p className="font-semibold">
                    Slot nº {descontoPreview.slot} • MÉTODO TREVO (+50%) • Valor:{' '}
                    <span className="text-primary">{descontoPreview.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span> • Sem desconto progressivo
                  </p>
                ) : (
                  <>
                    <p className="text-muted-foreground">{descontoPreview.label}</p>
                    <p className="font-semibold">
                      Valor: <span className="text-primary">{descontoPreview.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                      {descontoPreview.desconto > 0 && (
                        <span className="text-xs text-muted-foreground ml-2">
                          (Desc: {descontoPreview.desconto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                        </span>
                      )}
                    </p>
                  </>
                )}
                {aplicarBoasVindas && (
                  <p className="text-xs text-primary">🎉 Boas-vindas {boasVindasPct}% aplicado</p>
                )}
              </div>
            )}

            {isFirstProcessNovo && (
              <div className="rounded-lg border border-success/40 bg-success/10 p-3 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-success">🎉 Primeiro processo deste cliente</p>
                    <p className="text-xs text-muted-foreground">Deseja aplicar desconto de boas-vindas neste cadastro?</p>
                  </div>
                  <Switch
                    checked={aplicarBoasVindas}
                    onCheckedChange={(checked) => {
                      setAplicarBoasVindas(checked);
                      setProcessoForm((f) => ({
                        ...f,
                        boas_vindas: checked,
                        boas_vindas_pct: checked ? (boasVindasPct || '50') : '50',
                      }));
                    }}
                  />
                </div>

                {aplicarBoasVindas && (
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Percentual</Label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      className="w-20 h-8"
                      value={boasVindasPct}
                      onChange={(e) => {
                        const pct = e.target.value;
                        setBoasVindasPct(pct);
                        setProcessoForm((f) => ({ ...f, boas_vindas: true, boas_vindas_pct: pct || '50' }));
                      }}
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                )}
              </div>
            )}

            {/* Manual fields */}
            {isManualPrice && (
              <div className="space-y-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs">Valor (R$)</Label>
                  <Input type="number" step="0.01" value={processoForm.valor_manual} onChange={e => setProcessoForm(f => ({ ...f, valor_manual: e.target.value }))} placeholder="0,00" />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Motivo</Label>
                  <Input value={processoForm.motivo_manual} onChange={e => setProcessoForm(f => ({ ...f, motivo_manual: e.target.value }))} placeholder="Ex: Cortesia, negociação especial..." />
                </div>
              </div>
            )}
          </div>

          {/* Dentro do Plano — somente mensalistas */}
          {isMensalista && (
            <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label className="text-sm font-medium">Este processo está no escopo do plano mensal?</Label>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant={processoForm.dentro_do_plano ? 'default' : 'outline'} onClick={() => setProcessoForm(f => ({ ...f, dentro_do_plano: true, valor_avulso: 0, justificativa_avulso: '' }))} className={processoForm.dentro_do_plano ? 'bg-green-600 hover:bg-green-700' : ''}>✅ Sim</Button>
                  <Button type="button" size="sm" variant={!processoForm.dentro_do_plano ? 'default' : 'outline'} onClick={() => setProcessoForm(f => ({ ...f, dentro_do_plano: false }))} className={!processoForm.dentro_do_plano ? 'bg-amber-600 hover:bg-amber-700' : ''}>❌ Não</Button>
                </div>
              </div>
              {processoForm.dentro_do_plano && <p className="text-xs text-muted-foreground">Coberto pela mensalidade.</p>}
              {!processoForm.dentro_do_plano && (
                <div className="space-y-2 mt-2 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
                  <Label className="text-sm text-amber-600 font-medium">💰 Honorário avulso</Label>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">R$</span>
                    <Input type="number" value={processoForm.valor_avulso || ''} onChange={e => setProcessoForm(f => ({ ...f, valor_avulso: parseFloat(e.target.value) || 0 }))} placeholder="0,00" className="w-40" step="0.01" />
                  </div>
                  <Input value={processoForm.justificativa_avulso} onChange={e => setProcessoForm(f => ({ ...f, justificativa_avulso: e.target.value }))} placeholder="Justificativa (opcional)" className="text-sm" />
                </div>
              )}
            </div>
          )}

          {/* Já Pago */}
          <div className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
            <Switch
              id="np-ja-pago"
              checked={processoForm.ja_pago}
              onCheckedChange={(checked) => setProcessoForm(f => ({ ...f, ja_pago: checked }))}
            />
            <div>
              <Label htmlFor="np-ja-pago" className="text-sm font-medium cursor-pointer">Já Pago</Label>
              <p className="text-[10px] text-muted-foreground">Cria o lançamento como pago e finaliza o processo</p>
            </div>
          </div>

          {/* Boas-vindas badge (se ativo) */}
          {aplicarBoasVindas && (
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
              <p className="text-sm font-medium flex items-center gap-2">🎉 Desconto de boas-vindas: {boasVindasPct}%</p>
            </div>
          )}

          {/* Data de Entrada */}
          <div className="grid gap-1.5">
            <Label>Data de Entrada do Processo</Label>
            <Input
              type="date"
              value={processoForm.data_entrada}
              onChange={e => setProcessoForm(f => ({ ...f, data_entrada: e.target.value }))}
            />
            <p className="text-[10px] text-muted-foreground">
              Padrão: hoje. Altere para cadastrar processos retroativos.
            </p>
          </div>

          {/* Observações */}
          <div className="grid gap-1.5">
            <Label>Observações</Label>
            <Textarea
              value={processoForm.observacoes}
              onChange={e => setProcessoForm(f => ({ ...f, observacoes: e.target.value }))}
              placeholder="Notas adicionais sobre o processo..."
              className="min-h-[60px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onCreate} disabled={isCreating}>
            {isCreating ? 'Criando...' : 'Criar Processo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
