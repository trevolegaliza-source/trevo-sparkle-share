import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import HonorariosInlineRepeater, { type InlineNegotiationRow } from '@/components/clientes/HonorariosInlineRepeater';
import { isValidCNPJ, maskCodigo } from '@/lib/cnpj';
import { formatCEP, buscarCEP } from '@/lib/cep';
import { UFS_BRASIL } from '@/constants/estados-brasil';
import { toast } from 'sonner';

interface EditCadastroDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editCadastroForm: Record<string, any>;
  setEditCadastroForm: (updater: (f: Record<string, any>) => Record<string, any>) => void;
  buscandoCep: boolean;
  setBuscandoCep: (v: boolean) => void;
  editHonorariosRows: InlineNegotiationRow[];
  setEditHonorariosRows: (rows: InlineNegotiationRow[]) => void;
  savingCadastro: boolean;
  onCnpjEditChange: (value: string) => void;
  onSaveCadastro: () => void;
}

export default function EditCadastroDialog({
  open,
  onOpenChange,
  editCadastroForm,
  setEditCadastroForm,
  buscandoCep,
  setBuscandoCep,
  editHonorariosRows,
  setEditHonorariosRows,
  savingCadastro,
  onCnpjEditChange,
  onSaveCadastro,
}: EditCadastroDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Cadastro</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label className="text-muted-foreground">Nome da Contabilidade *</Label>
              <Input value={editCadastroForm.nome || ''} onChange={e => setEditCadastroForm(f => ({ ...f, nome: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label className="text-muted-foreground">Apelido</Label>
              <Input value={editCadastroForm.apelido || ''} onChange={e => setEditCadastroForm(f => ({ ...f, apelido: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label className="text-muted-foreground">Nome do Contador</Label>
              <Input value={editCadastroForm.nome_contador || ''} onChange={e => setEditCadastroForm(f => ({ ...f, nome_contador: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label className="text-muted-foreground">CNPJ</Label>
              <Input
                value={editCadastroForm.cnpj || ''}
                onChange={e => onCnpjEditChange(e.target.value)}
                placeholder="00.000.000/0000-00"
                maxLength={18}
              />
              {editCadastroForm.cnpj && editCadastroForm.cnpj.replace(/\D/g, '').length > 0 && !isValidCNPJ(editCadastroForm.cnpj) && (
                <p className="text-[10px] text-destructive">CNPJ deve conter 14 dígitos</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label className="text-muted-foreground">Código do Cliente</Label>
              <Input
                value={maskCodigo(editCadastroForm.codigo_identificador || '')}
                onChange={e => setEditCadastroForm(f => ({ ...f, codigo_identificador: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                placeholder="000.000 (auto)"
                maxLength={7}
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-muted-foreground">Email</Label>
              <Input value={editCadastroForm.email || ''} onChange={e => setEditCadastroForm(f => ({ ...f, email: e.target.value }))} />
            </div>
          </div>

          {/* Endereço */}
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label className="text-muted-foreground">CEP</Label>
              <div className="relative">
                <Input
                  value={formatCEP(editCadastroForm.cep || '')}
                  onChange={async (e) => {
                    const masked = formatCEP(e.target.value);
                    setEditCadastroForm(f => ({ ...f, cep: masked }));
                    const digits = masked.replace(/\D/g, '');
                    if (digits.length === 8) {
                      setBuscandoCep(true);
                      const result = await buscarCEP(digits);
                      setBuscandoCep(false);
                      if (result) {
                        setEditCadastroForm(f => ({ ...f, logradouro: result.logradouro, bairro: result.bairro, cidade: result.cidade, estado: result.estado }));
                      } else {
                        toast.info('CEP não encontrado na base. Preencha os campos manualmente.');
                      }
                    }
                  }}
                  placeholder="00000-000"
                  maxLength={9}
                />
                {buscandoCep && <span className="absolute right-2 top-2.5 text-xs text-muted-foreground animate-pulse">...</span>}
              </div>
            </div>
            <div className="grid gap-2">
              <Label className="text-muted-foreground">Estado (UF)</Label>
              <Select value={editCadastroForm.estado || ''} onValueChange={(v) => setEditCadastroForm(f => ({ ...f, estado: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {UFS_BRASIL.map(uf => (
                    <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label className="text-muted-foreground">Cidade</Label>
              <Input value={editCadastroForm.cidade || ''} onChange={e => setEditCadastroForm(f => ({ ...f, cidade: e.target.value }))} placeholder="Ex: São Paulo" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label className="text-muted-foreground">Logradouro</Label>
            <Input value={editCadastroForm.logradouro || ''} onChange={e => setEditCadastroForm(f => ({ ...f, logradouro: e.target.value }))} placeholder="Rua, Avenida..." />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label className="text-muted-foreground">Número</Label>
              <Input value={editCadastroForm.numero || ''} onChange={e => setEditCadastroForm(f => ({ ...f, numero: e.target.value }))} placeholder="Nº" />
            </div>
            <div className="grid gap-2">
              <Label className="text-muted-foreground">Complemento</Label>
              <Input value={editCadastroForm.complemento || ''} onChange={e => setEditCadastroForm(f => ({ ...f, complemento: e.target.value }))} placeholder="Sala, Andar..." />
            </div>
            <div className="grid gap-2">
              <Label className="text-muted-foreground">Bairro</Label>
              <Input value={editCadastroForm.bairro || ''} onChange={e => setEditCadastroForm(f => ({ ...f, bairro: e.target.value }))} placeholder="Bairro" />
            </div>
          </div>

          <div className="grid gap-2">
            <Label className="text-muted-foreground">Telefone</Label>
            <Input value={editCadastroForm.telefone || ''} onChange={e => setEditCadastroForm(f => ({ ...f, telefone: e.target.value }))} />
          </div>

          {/* Contato para Cobrança */}
          <div className="space-y-3 rounded-lg border border-border/40 bg-muted/20 p-3">
            <div>
              <Label className="text-sm font-semibold">Contato para Cobrança</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Se o contato financeiro for diferente do contador, preencha abaixo. Caso contrário, a cobrança será enviada para o contador.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Nome do responsável financeiro</Label>
                <Input
                  value={editCadastroForm.nome_contato_financeiro || ''}
                  onChange={e => setEditCadastroForm(f => ({ ...f, nome_contato_financeiro: e.target.value }))}
                  placeholder={editCadastroForm.nome_contador || 'Ex: Fernando Barbosa'}
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Telefone financeiro (WhatsApp)</Label>
                <Input
                  type="tel"
                  inputMode="numeric"
                  value={editCadastroForm.telefone_financeiro || ''}
                  onChange={e => setEditCadastroForm(f => ({ ...f, telefone_financeiro: e.target.value }))}
                  placeholder={editCadastroForm.telefone || '(11) 99999-9999'}
                  style={{ fontSize: 16 }}
                />
              </div>
            </div>
          </div>
          <div className="grid gap-2">
            <Label className="text-muted-foreground">Modalidade do Cliente</Label>
            <Select value={editCadastroForm.tipo} onValueChange={(v) => setEditCadastroForm(f => ({ ...f, tipo: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MENSALISTA">Mensalista</SelectItem>
                <SelectItem value="AVULSO_4D">Avulso</SelectItem>
                <SelectItem value="PRE_PAGO">Pré-Pago</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ═══ Financial fields by modality ═══ */}
          {editCadastroForm.tipo === 'AVULSO_4D' && (
            <div className="space-y-3 rounded-lg border border-border/40 bg-muted/20 p-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Faturamento</Label>
                  <Select value={editCadastroForm.momento_faturamento || 'na_solicitacao'} onValueChange={v => setEditCadastroForm(f => ({ ...f, momento_faturamento: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="na_solicitacao">Na Solicitação</SelectItem>
                      <SelectItem value="no_deferimento">No Deferimento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Forma de Cobrança</Label>
                <RadioGroup
                  value={editCadastroForm.forma_cobranca || 'por_processo'}
                  onValueChange={(v: string) => setEditCadastroForm(f => ({ ...f, forma_cobranca: v }))}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="por_processo" id="ec-fc-processo" />
                    <Label htmlFor="ec-fc-processo" className="text-xs cursor-pointer">Por processo (D+X dias)</Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="fatura_mensal" id="ec-fc-mensal" />
                    <Label htmlFor="ec-fc-mensal" className="text-xs cursor-pointer">Fatura mensal (dia fixo)</Label>
                  </div>
                </RadioGroup>
              </div>
              {editCadastroForm.forma_cobranca === 'por_processo' ? (
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Vencimento após solicitação</Label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">D+</span>
                      <Input type="number" min={1} max={60} value={editCadastroForm.dia_cobranca || ''} onChange={e => setEditCadastroForm(f => ({ ...f, dia_cobranca: e.target.value }))} placeholder="4" className="w-20" />
                      <span className="text-xs text-muted-foreground">dias</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Dia de vencimento da fatura</Label>
                    <Input type="number" min={1} max={31} value={editCadastroForm.dia_vencimento_mensal || ''} onChange={e => setEditCadastroForm(f => ({ ...f, dia_vencimento_mensal: e.target.value }))} placeholder="15" />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Valor Base (R$)</Label>
                  <Input type="number" step="0.01" value={editCadastroForm.valor_base || ''} onChange={e => setEditCadastroForm(f => ({ ...f, valor_base: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Desc. Progr. (%)</Label>
                  <Input type="number" step="0.1" value={editCadastroForm.desconto_progressivo || ''} onChange={e => setEditCadastroForm(f => ({ ...f, desconto_progressivo: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Limite/Piso (R$)</Label>
                  <Input type="number" step="0.01" value={editCadastroForm.valor_limite_desconto || ''} onChange={e => setEditCadastroForm(f => ({ ...f, valor_limite_desconto: e.target.value }))} />
                </div>
              </div>
            </div>
          )}

          {editCadastroForm.tipo === 'MENSALISTA' && (
            <div className="space-y-3 rounded-lg border border-border/40 bg-muted/20 p-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Mensalidade (R$) *</Label>
                  <Input type="number" step="0.01" value={editCadastroForm.mensalidade || ''} onChange={e => setEditCadastroForm(f => ({ ...f, mensalidade: e.target.value }))} placeholder="0,00" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Franquia Processos *</Label>
                  <Input type="number" min={0} value={editCadastroForm.franquia_processos || ''} onChange={e => setEditCadastroForm(f => ({ ...f, franquia_processos: e.target.value }))} placeholder="Qtd inclusos" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Dia Vencimento</Label>
                  <Input type="number" min={1} max={31} value={editCadastroForm.dia_vencimento_mensal || ''} onChange={e => setEditCadastroForm(f => ({ ...f, dia_vencimento_mensal: e.target.value }))} placeholder="10" />
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="flex-1 border-t border-border/40" />
                <span>Processos Excedentes</span>
                <span className="flex-1 border-t border-border/40" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Valor Base Excedente (R$)</Label>
                  <Input type="number" step="0.01" value={editCadastroForm.valor_base || ''} onChange={e => setEditCadastroForm(f => ({ ...f, valor_base: e.target.value }))} placeholder="0,00" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Desc. Progr. Exc. (%)</Label>
                  <Input type="number" step="0.1" value={editCadastroForm.desconto_progressivo || ''} onChange={e => setEditCadastroForm(f => ({ ...f, desconto_progressivo: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Limite/Piso Exc. (R$)</Label>
                  <Input type="number" step="0.01" value={editCadastroForm.valor_limite_desconto || ''} onChange={e => setEditCadastroForm(f => ({ ...f, valor_limite_desconto: e.target.value }))} />
                </div>
              </div>
            </div>
          )}

          {editCadastroForm.tipo === 'PRE_PAGO' && (
            <div className="space-y-3 rounded-lg border border-border/40 bg-muted/20 p-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Saldo Atual (R$)</Label>
                  <Input type="number" step="0.01" value={editCadastroForm.saldo_prepago || ''} onChange={e => setEditCadastroForm(f => ({ ...f, saldo_prepago: e.target.value }))} placeholder="Valor depositado" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Valor por Processo (R$)</Label>
                  <Input type="number" step="0.01" value={editCadastroForm.valor_base || ''} onChange={e => setEditCadastroForm(f => ({ ...f, valor_base: e.target.value }))} placeholder="Cobrado do saldo" />
                </div>
              </div>
            </div>
          )}

          {/* Honorários Específicos inline */}
          <div className="pt-3 border-t border-border/40">
            <HonorariosInlineRepeater rows={editHonorariosRows} onChange={setEditHonorariosRows} />
          </div>

          {/* Observações Gerais — antes era uma Tab separada, consolidada aqui em 13/05/2026 noite (auditoria). */}
          <div className="pt-3 border-t border-border/40">
            <Label className="text-sm font-semibold">Observações Gerais</Label>
            <p className="text-xs text-muted-foreground mb-2">Condições especiais, anotações operacionais, etc.</p>
            <textarea
              className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              placeholder="Observações sobre o cliente, condições especiais, etc."
              value={editCadastroForm.observacoes || ''}
              onChange={(e) => setEditCadastroForm(f => ({ ...f, observacoes: e.target.value }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSaveCadastro} disabled={savingCadastro}>
            {savingCadastro ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Salvando...
              </span>
            ) : 'Salvar Cadastro'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
