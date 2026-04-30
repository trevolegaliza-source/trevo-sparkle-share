import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { X, Loader2, Info } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useCreateCliente } from '@/hooks/useFinanceiro';
import { maskCNPJ, isValidCNPJ } from '@/lib/cnpj';
import { formatCEP, buscarCEP, buscarCoordenadas } from '@/lib/cep';
import { toast } from 'sonner';
import type { TipoCliente } from '@/types/financial';
import { UFS_BRASIL } from '@/constants/estados-brasil';

interface Props {
  onClose: () => void;
  onCreated: (id: string) => void;
}

export default function NovoClienteInline({ onClose, onCreated }: Props) {
  const [form, setForm] = useState({
    codigo_identificador: '',
    nome: '',
    apelido: '',
    cnpj: '',
    nome_contador: '',
    email: '',
    telefone: '',
    tipo: 'AVULSO_4D' as TipoCliente,
    valor_base: '',
    desconto_progressivo: '',
    valor_limite_desconto: '',
    observacoes: '',
    estado: '',
    cidade: '',
    cep: '',
    momento_faturamento: 'na_solicitacao',
    dia_vencimento_mensal: '',
    dia_cobranca: '4',
    forma_cobranca: 'por_processo' as 'por_processo' | 'fatura_mensal',
    mensalidade: '',
    franquia_processos: '',
    saldo_prepago: '',
  });
  const [codigoManual, setCodigoManual] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const createCliente = useCreateCliente();

  const handleCnpjChange = (value: string) => {
    const masked = maskCNPJ(value);
    const digits = masked.replace(/\D/g, '');
    const newCodigo = !codigoManual && digits.length >= 6
      ? `${digits.slice(0, 3)}.${digits.slice(3, 6)}`
      : !codigoManual ? digits.slice(0, digits.length) : form.codigo_identificador;
    setForm(f => ({ ...f, cnpj: masked, codigo_identificador: newCodigo }));
  };

  const handleCodigoChange = (value: string) => {
    setCodigoManual(true);
    setForm(f => ({ ...f, codigo_identificador: value }));
  };

  const handleCepChange = async (value: string) => {
    const masked = formatCEP(value);
    setForm(f => ({ ...f, cep: masked }));

    const digits = masked.replace(/\D/g, '');
    if (digits.length === 8) {
      setBuscandoCep(true);
      const result = await buscarCEP(digits);
      setBuscandoCep(false);
      if (result) {
        setForm(f => ({
          ...f,
          cidade: result.cidade,
          estado: result.estado,
        }));
      } else {
        toast.info('CEP não encontrado na base. Preencha os campos manualmente.');
      }
    }
  };

  const handleTipoChange = (v: TipoCliente) => {
    setForm(f => ({
      ...f,
      tipo: v,
      // Reset financial fields when switching type
      valor_base: '',
      desconto_progressivo: '',
      valor_limite_desconto: '',
      momento_faturamento: v === 'AVULSO_4D' ? 'na_solicitacao' : f.momento_faturamento,
      dia_vencimento_mensal: v === 'MENSALISTA' ? '10' : '15',
      dia_cobranca: '4',
      forma_cobranca: 'por_processo',
      mensalidade: '',
      franquia_processos: '',
      saldo_prepago: '',
    }));
  };

  const isFormaProcesso = form.forma_cobranca === 'por_processo';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cnpjDigits = form.cnpj.replace(/\D/g, '');
    if (cnpjDigits.length > 0 && !isValidCNPJ(form.cnpj)) {
      toast.error('CNPJ inválido');
      return;
    }
    if (!form.codigo_identificador.trim()) {
      toast.error('Preencha o Código do Cliente (ou digite o CNPJ)');
      return;
    }
    if (form.tipo === 'MENSALISTA') {
      if (!form.mensalidade || Number(form.mensalidade) <= 0) {
        toast.error('Preencha o Valor da Mensalidade');
        return;
      }
      if (!form.franquia_processos || Number(form.franquia_processos) <= 0) {
        toast.error('Preencha a Franquia de Processos');
        return;
      }
    }

    const cepDigits = form.cep.replace(/\D/g, '');

    let latitude: number | null = null;
    let longitude: number | null = null;
    if (form.cidade && form.estado) {
      const coords = await buscarCoordenadas('', form.cidade, form.estado);
      if (coords) {
        latitude = coords.lat;
        longitude = coords.lng;
      }
    }

    const isAvulso = form.tipo === 'AVULSO_4D';
    const isMensalista = form.tipo === 'MENSALISTA';
    const isPrePago = form.tipo === 'PRE_PAGO';

    createCliente.mutate(
      {
        codigo_identificador: form.codigo_identificador.trim(),
        nome: form.nome,
        apelido: form.apelido || null,
        cnpj: cnpjDigits || null,
        nome_contador: form.nome_contador || null,
        tipo: form.tipo,
        email: form.email || null,
        telefone: form.telefone || null,
        observacoes: form.observacoes || null,
        estado: form.estado || null,
        cidade: form.cidade || null,
        cep: cepDigits || null,
        latitude,
        longitude,
        // Avulso fields
        momento_faturamento: isAvulso ? form.momento_faturamento : isMensalista ? 'na_solicitacao' : null,
        dia_vencimento_mensal: isAvulso ? (isFormaProcesso ? null : (Number(form.dia_vencimento_mensal) || 15)) : isMensalista ? (Number(form.dia_vencimento_mensal) || 10) : null,
        dia_cobranca: isAvulso && isFormaProcesso && form.dia_cobranca ? Number(form.dia_cobranca) : null,
        valor_base: (isAvulso || isMensalista) && form.valor_base ? Number(form.valor_base) : isPrePago && form.valor_base ? Number(form.valor_base) : null,
        desconto_progressivo: (isAvulso || isMensalista) && form.desconto_progressivo ? Number(form.desconto_progressivo) : null,
        valor_limite_desconto: (isAvulso || isMensalista) && form.valor_limite_desconto ? Number(form.valor_limite_desconto) : null,
        // Mensalista fields
        mensalidade: isMensalista && form.mensalidade ? Number(form.mensalidade) : null,
        franquia_processos: isMensalista && form.franquia_processos ? Number(form.franquia_processos) : 0,
        // Pré-Pago fields
        saldo_prepago: isPrePago && form.saldo_prepago ? Number(form.saldo_prepago) : 0,
        is_archived: false,
      } as any,
      {
        onSuccess: (data: any) => {
          const id = data?.id || data?.[0]?.id;
          if (id) onCreated(id);
        },
      }
    );
  };

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3 flex-row items-center justify-between">
        <CardTitle className="text-sm">Novo Cliente (Rápido)</CardTitle>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-3">
          {/* Nome + Apelido */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nome *</Label>
              <Input required value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome da contabilidade" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Apelido</Label>
              <Input value={form.apelido} onChange={e => setForm(f => ({ ...f, apelido: e.target.value }))} placeholder="Ex: Athena" />
            </div>
          </div>

          {/* CNPJ + Código */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">CNPJ</Label>
              <Input value={form.cnpj} onChange={e => handleCnpjChange(e.target.value)} placeholder="00.000.000/0000-00" maxLength={18} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Código do Cliente *</Label>
              <Input required value={form.codigo_identificador} onChange={e => handleCodigoChange(e.target.value)} placeholder="Preencha o CNPJ" />
            </div>
          </div>

          {/* Nome do Contador */}
          <div className="space-y-1">
            <Label className="text-xs">Nome do Contador</Label>
            <Input value={form.nome_contador} onChange={e => setForm(f => ({ ...f, nome_contador: e.target.value }))} placeholder="Nome do contador responsável" />
          </div>

          {/* Email + Telefone */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Telefone</Label>
              <Input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} />
            </div>
          </div>

          {/* CEP + Cidade + Estado */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">CEP</Label>
              <div className="relative">
                <Input value={form.cep} onChange={e => handleCepChange(e.target.value)} placeholder="00000-000" maxLength={9} />
                {buscandoCep && <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cidade</Label>
              <Input value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} placeholder="Auto via CEP" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Estado (UF)</Label>
              <Select value={form.estado} onValueChange={v => setForm(f => ({ ...f, estado: v }))}>
                <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>
                  {UFS_BRASIL.map(uf => (
                    <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator className="my-1" />

          {/* Tipo selector */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Modalidade do Cliente</Label>
            <Select value={form.tipo} onValueChange={v => handleTipoChange(v as TipoCliente)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="AVULSO_4D">Avulso</SelectItem>
                <SelectItem value="MENSALISTA">Mensalista</SelectItem>
                <SelectItem value="PRE_PAGO">Pré-Pago</SelectItem>
                <SelectItem value="PRECO_POR_TIPO">Preço por Tipo</SelectItem>
              </SelectContent>
            </Select>
            {form.tipo === 'PRECO_POR_TIPO' && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Cliente paga valor fixo por tipo de processo (abertura/alteração/etc).
                Configure os preços depois de salvar, em <strong>Editar Cliente → Preços por Tipo</strong>.
              </p>
            )}
          </div>

          {/* ═══ AVULSO fields ═══ */}
          {form.tipo === 'AVULSO_4D' && (
            <div className="space-y-3 rounded-lg border border-border/40 bg-muted/20 p-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Faturamento</Label>
                  <Select value={form.momento_faturamento} onValueChange={v => setForm(f => ({ ...f, momento_faturamento: v }))}>
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
                  value={form.forma_cobranca}
                  onValueChange={(v: 'por_processo' | 'fatura_mensal') => setForm(f => ({ ...f, forma_cobranca: v }))}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="por_processo" id="fc-processo" />
                    <Label htmlFor="fc-processo" className="text-xs cursor-pointer">Por processo (D+X dias)</Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="fatura_mensal" id="fc-mensal" />
                    <Label htmlFor="fc-mensal" className="text-xs cursor-pointer">Fatura mensal (dia fixo)</Label>
                  </div>
                </RadioGroup>
              </div>

              {isFormaProcesso ? (
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Vencimento após solicitação</Label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">D+</span>
                      <Input type="number" min={1} max={60} value={form.dia_cobranca} onChange={e => setForm(f => ({ ...f, dia_cobranca: e.target.value }))} placeholder="4" className="w-20" />
                      <span className="text-xs text-muted-foreground">dias</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Dia de vencimento da fatura</Label>
                    <Input type="number" min={1} max={31} value={form.dia_vencimento_mensal} onChange={e => setForm(f => ({ ...f, dia_vencimento_mensal: e.target.value }))} placeholder="15" />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Valor Base (R$)</Label>
                  <Input type="number" step="0.01" value={form.valor_base} onChange={e => setForm(f => ({ ...f, valor_base: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Desc. Progr. (%)</Label>
                  <Input type="number" step="0.1" value={form.desconto_progressivo} onChange={e => setForm(f => ({ ...f, desconto_progressivo: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Limite/Piso (R$)</Label>
                  <Input type="number" step="0.01" value={form.valor_limite_desconto} onChange={e => setForm(f => ({ ...f, valor_limite_desconto: e.target.value }))} />
                </div>
              </div>
            </div>
          )}

          {/* ═══ MENSALISTA fields ═══ */}
          {form.tipo === 'MENSALISTA' && (
            <div className="space-y-3 rounded-lg border border-border/40 bg-muted/20 p-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Mensalidade (R$) *</Label>
                  <Input type="number" step="0.01" required value={form.mensalidade} onChange={e => setForm(f => ({ ...f, mensalidade: e.target.value }))} placeholder="0,00" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Franquia Processos *</Label>
                  <Input type="number" min={0} required value={form.franquia_processos} onChange={e => setForm(f => ({ ...f, franquia_processos: e.target.value }))} placeholder="Qtd inclusos" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Dia Vencimento</Label>
                  <Input type="number" min={1} max={31} value={form.dia_vencimento_mensal} onChange={e => setForm(f => ({ ...f, dia_vencimento_mensal: e.target.value }))} placeholder="10" />
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Separator className="flex-1" />
                <span>Processos Excedentes</span>
                <Separator className="flex-1" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Valor Base Excedente (R$)</Label>
                  <Input type="number" step="0.01" value={form.valor_base} onChange={e => setForm(f => ({ ...f, valor_base: e.target.value }))} placeholder="0,00" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Desc. Progr. Exc. (%)</Label>
                  <Input type="number" step="0.1" value={form.desconto_progressivo} onChange={e => setForm(f => ({ ...f, desconto_progressivo: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Limite/Piso Exc. (R$)</Label>
                  <Input type="number" step="0.01" value={form.valor_limite_desconto} onChange={e => setForm(f => ({ ...f, valor_limite_desconto: e.target.value }))} />
                </div>
              </div>

              <div className="flex items-start gap-1.5 rounded bg-muted/40 p-2 text-[10px] text-muted-foreground">
                <Info className="h-3 w-3 mt-0.5 shrink-0" />
                Processos dentro da franquia: R$ 0,00. Excedentes usam valor base com desconto progressivo.
              </div>
            </div>
          )}

          {/* ═══ PRÉ-PAGO fields ═══ */}
          {form.tipo === 'PRE_PAGO' && (
            <div className="space-y-3 rounded-lg border border-border/40 bg-muted/20 p-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Saldo Inicial (R$)</Label>
                  <Input type="number" step="0.01" value={form.saldo_prepago} onChange={e => setForm(f => ({ ...f, saldo_prepago: e.target.value }))} placeholder="Valor depositado" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Valor por Processo (R$)</Label>
                  <Input type="number" step="0.01" value={form.valor_base} onChange={e => setForm(f => ({ ...f, valor_base: e.target.value }))} placeholder="Cobrado do saldo" />
                </div>
              </div>
              <div className="flex items-start gap-1.5 rounded bg-muted/40 p-2 text-[10px] text-muted-foreground">
                <Info className="h-3 w-3 mt-0.5 shrink-0" />
                O saldo será debitado a cada processo cadastrado. Quando insuficiente, o sistema bloqueará novos cadastros.
              </div>
            </div>
          )}

          {/* Observações */}
          <div className="space-y-1">
            <Label className="text-xs">Observações</Label>
            <Textarea rows={2} value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Notas sobre o cliente..." />
          </div>

          <Button type="submit" size="sm" disabled={createCliente.isPending} className="w-fit">
            {createCliente.isPending ? 'Criando...' : 'Cadastrar e Selecionar'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
