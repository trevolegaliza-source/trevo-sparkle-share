import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, CreditCard } from 'lucide-react';
import { CATEGORIAS_DESPESAS, type CategoriaKey } from '@/constants/categorias-despesas';
import { useColaboradores } from '@/hooks/useColaboradores';
import { usePlanoContas } from '@/hooks/usePlanoContas';
import { supabase } from '@/integrations/supabase/client';
import { STORAGE_BUCKETS } from '@/constants/storage';
import { empresaPath } from '@/lib/storage-path';
import { toast } from 'sonner';
import { fetchFeriadosNacionais, proximoDiaUtil } from '@/lib/brasil-api';
import type { FeriadoNacional } from '@/lib/brasil-api';
import { useQueryClient } from '@tanstack/react-query';
import * as LucideIcons from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (lancamento: Record<string, any>, recorrente?: Record<string, any>) => void;
  editData?: any;
  defaultMes: number;
  defaultAno: number;
}

interface ParcelaPreview {
  num: number;
  total: number;
  valor: number;
  dataVencimento: string;
  dataFormatada: string;
  competenciaMes: number;
  competenciaAno: number;
}

function calcularParcelas(
  valorParcela: number,
  dataPrimeira: string,
  numParcelas: number,
  feriados: FeriadoNacional[],
): ParcelaPreview[] {
  if (!dataPrimeira || numParcelas < 1 || valorParcela <= 0) return [];
  const parcelas: ParcelaPreview[] = [];
  const base = new Date(dataPrimeira + 'T12:00:00');

  for (let i = 0; i < numParcelas; i++) {
    const d = new Date(base);
    d.setMonth(d.getMonth() + i);
    const adjusted = proximoDiaUtil(d, feriados);
    const iso = `${adjusted.getFullYear()}-${String(adjusted.getMonth() + 1).padStart(2, '0')}-${String(adjusted.getDate()).padStart(2, '0')}`;
    const fmt = `${String(adjusted.getDate()).padStart(2, '0')}/${String(adjusted.getMonth() + 1).padStart(2, '0')}/${adjusted.getFullYear()}`;
    parcelas.push({
      num: i + 1,
      total: numParcelas,
      valor: valorParcela,
      dataVencimento: iso,
      dataFormatada: fmt,
      competenciaMes: adjusted.getMonth() + 1,
      competenciaAno: adjusted.getFullYear(),
    });
  }
  return parcelas;
}

export default function DespesaFormModal({ open, onClose, onSave, editData, defaultMes, defaultAno }: Props) {
  const queryClient = useQueryClient();
  const { data: colaboradores } = useColaboradores();
  const { data: planoContas } = usePlanoContas();
  const activeColabs = (colaboradores || []).filter(c => c.status === 'ativo');
  const contasDespesa = (planoContas || []).filter(c => ['custo', 'despesa', 'despesa_financeira', 'deducao'].includes(c.tipo) && c.codigo.includes('.'));

  const [categoria, setCategoria] = useState<CategoriaKey>('infraestrutura');
  const [subcategoria, setSubcategoria] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [vencimento, setVencimento] = useState('');
  const [fornecedor, setFornecedor] = useState('');
  const [vincularColab, setVincularColab] = useState(false);
  const [colaboradorId, setColaboradorId] = useState('');
  const [compMes, setCompMes] = useState(defaultMes);
  const [compAno, setCompAno] = useState(defaultAno);
  const [observacoes, setObservacoes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [salvarRecorrente, setSalvarRecorrente] = useState(false);
  const [contaId, setContaId] = useState('');
  const [centroCusto, setCentroCusto] = useState('');
  const [saving, setSaving] = useState(false);

  // Parcelamento
  const [parcelado, setParcelado] = useState(false);
  const [numParcelas, setNumParcelas] = useState(2);
  const [dataPrimeiraParcela, setDataPrimeiraParcela] = useState('');
  const [feriados, setFeriados] = useState<FeriadoNacional[]>([]);

  // Fetch feriados when parcelado is toggled on
  useEffect(() => {
    if (!parcelado) return;
    const years = new Set<number>();
    const now = new Date();
    years.add(now.getFullYear());
    years.add(now.getFullYear() + 1);
    years.add(now.getFullYear() + 2);
    Promise.all([...years].map(y => fetchFeriadosNacionais(y)))
      .then(results => setFeriados(results.flat()));
  }, [parcelado]);

  const parcelas = useMemo(() => {
    if (!parcelado || !valor || !dataPrimeiraParcela) return [];
    return calcularParcelas(Number(valor), dataPrimeiraParcela, numParcelas, feriados);
  }, [parcelado, valor, dataPrimeiraParcela, numParcelas, feriados]);

  useEffect(() => {
    if (editData) {
      setCategoria((editData.categoria || 'outros') as CategoriaKey);
      setSubcategoria(editData.subcategoria || '');
      setDescricao(editData.descricao || '');
      setValor(String(editData.valor || ''));
      setVencimento(editData.data_vencimento || '');
      setFornecedor(editData.fornecedor || '');
      setColaboradorId(editData.colaborador_id || '');
      setVincularColab(!!editData.colaborador_id);
      setCompMes(editData.competencia_mes || defaultMes);
      setCompAno(editData.competencia_ano || defaultAno);
      setObservacoes(editData.observacoes_financeiro || '');
      setSalvarRecorrente(false);
      setParcelado(false);
      setContaId(editData.conta_id || '');
      setCentroCusto(editData.centro_custo || '');
    } else {
      resetForm();
    }
  }, [editData, open, defaultMes, defaultAno]);

  const resetForm = () => {
    setCategoria('infraestrutura');
    setSubcategoria('');
    setDescricao('');
    setValor('');
    setVencimento('');
    setFornecedor('');
    setVincularColab(false);
    setColaboradorId('');
    setCompMes(defaultMes);
    setCompAno(defaultAno);
    setObservacoes('');
    setFile(null);
    setSalvarRecorrente(false);
    setParcelado(false);
    setNumParcelas(2);
    setDataPrimeiraParcela('');
    setContaId('');
    setCentroCusto('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valor) return;
    if (!fornecedor.trim()) {
      toast.error('Fornecedor é obrigatório');
      return;
    }
    if (parcelado && !editData) {
      if (!dataPrimeiraParcela || numParcelas < 1) return;
    } else {
      if (!vencimento) return;
    }
    setSaving(true);

    let comprovanteUrl: string | null = null;
    if (file) {
      try {
        const ext = (file.name.split('.').pop() || 'pdf').toLowerCase();
        const path = await empresaPath(`comprovantes/${crypto.randomUUID()}.${ext}`);
        const { error } = await supabase.storage.from(STORAGE_BUCKETS.CONTRACTS).upload(path, file, { upsert: true });
        if (error) throw error;
        comprovanteUrl = path;
      } catch (err: any) {
        toast.error('Erro no upload: ' + err.message);
        setSaving(false);
        return;
      }
    }

    const descFinal = `${subcategoria || categoria}${descricao ? ' - ' + descricao : ''}`;

    // Parcelado mode: insert all parcelas directly
    if (parcelado && !editData && parcelas.length > 0) {
      const lancs = parcelas.map(p => ({
        tipo: 'pagar' as const,
        descricao: `${descFinal} · Parcela ${p.num}/${p.total}`,
        valor: p.valor,
        data_vencimento: p.dataVencimento,
        status: 'pendente' as const,
        categoria,
        subcategoria: subcategoria || null,
        fornecedor: fornecedor || null,
        colaborador_id: vincularColab && colaboradorId ? colaboradorId : null,
        competencia_mes: p.competenciaMes,
        competencia_ano: p.competenciaAno,
        etapa_financeiro: 'solicitacao_criada',
        observacoes_financeiro: observacoes || null,
        comprovante_url: comprovanteUrl || null,
        conta_id: contaId || null,
        centro_custo: centroCusto || null,
      }));

      try {
        const { error } = await supabase.from('lancamentos').insert(lancs as any);
        if (error) throw error;
        toast.success(`${lancs.length} parcelas lançadas com sucesso`);
      } catch (err: any) {
        toast.error('Erro ao criar parcelas: ' + err.message);
        setSaving(false);
        return;
      }

      setSaving(false);
      onClose();
      queryClient.invalidateQueries({ queryKey: ['lancamentos_pagar'] });
      queryClient.invalidateQueries({ queryKey: ['lancamentos_pagar_date'] });
      return;
    }

    // Normal single lancamento mode
    const lancamento: Record<string, any> = {
      tipo: 'pagar',
      descricao: descFinal,
      valor: Number(valor),
      data_vencimento: vencimento,
      status: editData?.status || 'pendente',
      categoria,
      subcategoria: subcategoria || null,
      fornecedor: fornecedor || null,
      colaborador_id: vincularColab && colaboradorId ? colaboradorId : null,
      competencia_mes: compMes,
      competencia_ano: compAno,
      etapa_financeiro: 'solicitacao_criada',
      observacoes_financeiro: observacoes || null,
      comprovante_url: comprovanteUrl || editData?.comprovante_url || null,
      conta_id: contaId || null,
      centro_custo: centroCusto || null,
    };

    if (editData?.id) lancamento.id = editData.id;

    let recorrente: Record<string, any> | undefined;
    if (salvarRecorrente && !editData) {
      const diaVenc = new Date(vencimento).getDate();
      recorrente = {
        descricao: descFinal,
        categoria,
        subcategoria: subcategoria || null,
        valor: Number(valor),
        dia_vencimento: diaVenc,
        fornecedor: fornecedor || null,
        colaborador_id: vincularColab && colaboradorId ? colaboradorId : null,
        ativo: true,
        data_inicio: vencimento,
      };
    }

    onSave(lancamento, recorrente);
    setSaving(false);
    onClose();
  };

  const subcategorias = CATEGORIAS_DESPESAS[categoria]?.subcategorias || [];

  const formatCurrency = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editData ? 'Editar Despesa' : 'Nova Despesa'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Categoria */}
          <div className="grid gap-2">
            <Label>Categoria *</Label>
            <Select value={categoria} onValueChange={v => { setCategoria(v as CategoriaKey); setSubcategoria(''); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORIAS_DESPESAS).map(([k, v]) => {
                  const Icon = (LucideIcons as any)[v.icon] || LucideIcons.Circle;
                  return (
                    <SelectItem key={k} value={k}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5" style={{ color: v.color }} />
                        {v.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Subcategoria */}
          <div className="grid gap-2">
            <Label>Subcategoria *</Label>
            <Select value={subcategoria} onValueChange={setSubcategoria}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {subcategorias.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Descrição */}
          <div className="grid gap-2">
            <Label>Descrição</Label>
            <Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Detalhes adicionais..." />
          </div>

          {/* Valor + Vencimento */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Valor {parcelado ? 'da Parcela' : ''} *</Label>
              <Input type="number" step="0.01" min="0" required value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" />
            </div>
            {!parcelado && (
              <div className="grid gap-2">
                <Label>Vencimento *</Label>
                <Input type="date" required value={vencimento} onChange={e => {
                  setVencimento(e.target.value);
                  if (e.target.value) {
                    const d = new Date(e.target.value);
                    setCompMes(d.getMonth() + 1);
                    setCompAno(d.getFullYear());
                  }
                }} />
              </div>
            )}
          </div>

          {/* Toggle Parcelado */}
          {!editData && (
            <div className="rounded-lg border border-border/60 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  💳 Lançar como Parcelado
                </Label>
                <Switch
                  checked={parcelado}
                  onCheckedChange={c => {
                    setParcelado(c);
                    if (c) {
                      setSalvarRecorrente(false);
                      if (!dataPrimeiraParcela && vencimento) {
                        setDataPrimeiraParcela(vencimento);
                      }
                    }
                  }}
                />
              </div>
              {parcelado && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label className="text-xs">Número de Parcelas *</Label>
                      <Input
                        type="number"
                        min={2}
                        max={60}
                        value={numParcelas}
                        onChange={e => setNumParcelas(Math.max(2, Number(e.target.value)))}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-xs">Vencimento da 1ª Parcela *</Label>
                      <Input
                        type="date"
                        required={parcelado}
                        value={dataPrimeiraParcela}
                        onChange={e => setDataPrimeiraParcela(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Prévia das parcelas */}
                  {parcelas.length > 0 && (
                    <div className="rounded-md bg-muted/50 p-3 space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">PRÉVIA DAS PARCELAS</p>
                      {parcelas.slice(0, 3).map(p => (
                        <div key={p.num} className="text-xs text-foreground flex justify-between">
                          <span>Parcela {p.num}/{p.total}</span>
                          <span>{formatCurrency(p.valor)}</span>
                          <span>{p.dataFormatada}</span>
                        </div>
                      ))}
                      {parcelas.length > 3 && (
                        <p className="text-xs text-muted-foreground italic mt-1">
                          ... e mais {parcelas.length - 3} parcela{parcelas.length - 3 > 1 ? 's' : ''}
                        </p>
                      )}
                      <div className="border-t border-border/40 mt-2 pt-2 flex justify-between text-xs font-semibold">
                        <span>TOTAL</span>
                        <span>{formatCurrency(Number(valor) * numParcelas)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Fornecedor */}
          <div className="grid gap-2">
            <Label>Fornecedor <span className="text-destructive">*</span></Label>
            <Input
              value={fornecedor}
              onChange={e => setFornecedor(e.target.value)}
              placeholder="Quem recebe o pagamento..."
              required
              aria-required="true"
            />
          </div>

          {/* Conta Contábil + Centro de Custo */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Conta Contábil</Label>
              <Select value={contaId} onValueChange={setContaId}>
                <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                <SelectContent>
                  {contasDespesa.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.codigo} — {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Centro de Custo</Label>
              <Select value={centroCusto} onValueChange={setCentroCusto}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="operacional">Operacional</SelectItem>
                  <SelectItem value="administrativo">Administrativo</SelectItem>
                  <SelectItem value="comercial">Comercial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Vincular Colaborador */}
          <div className="rounded-lg border border-border/60 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">🔗 Vincular Colaborador</Label>
              <Switch checked={vincularColab} onCheckedChange={c => { setVincularColab(c); if (!c) setColaboradorId(''); }} />
            </div>
            {vincularColab && (
              <Select value={colaboradorId} onValueChange={setColaboradorId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {activeColabs.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome} ({c.regime})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Competência - hide when parcelado since each parcela has its own */}
          {!parcelado && (
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Competência Mês</Label>
                <Input type="number" min={1} max={12} value={compMes} onChange={e => setCompMes(Number(e.target.value))} />
              </div>
              <div className="grid gap-2">
                <Label>Competência Ano</Label>
                <Input type="number" min={2020} max={2099} value={compAno} onChange={e => setCompAno(Number(e.target.value))} />
              </div>
            </div>
          )}

          {/* Observações */}
          <div className="grid gap-2">
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Notas internas..." rows={2} />
          </div>

          {/* Upload */}
          <div className="grid gap-2">
            <Label>📎 Anexar Comprovante</Label>
            <label className="flex items-center gap-2 cursor-pointer border border-dashed border-border rounded-lg p-3 hover:bg-muted/50 transition-colors">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{file ? file.name : 'Selecionar arquivo...'}</span>
              <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={e => setFile(e.target.files?.[0] || null)} />
            </label>
          </div>

          {/* Checkbox recorrente - hidden when parcelado is active */}
          {!editData && !parcelado && (
            <div className="flex items-center gap-2 rounded-lg border border-border/60 p-3">
              <Checkbox id="salvarRecorrente" checked={salvarRecorrente} onCheckedChange={c => setSalvarRecorrente(!!c)} />
              <label htmlFor="salvarRecorrente" className="text-sm cursor-pointer">Salvar também como Despesa Recorrente</label>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? 'Salvando...'
                : parcelado && !editData
                  ? `Lançar ${numParcelas} Parcelas`
                  : editData
                    ? 'Salvar Alterações'
                    : 'Salvar Despesa'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
