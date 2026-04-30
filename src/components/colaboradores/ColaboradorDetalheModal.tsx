import { useState, useRef } from 'react';
import ObrigacoesTimeline from './ObrigacoesTimeline';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Copy, TrendingUp, FileText, AlertCircle, Wallet, Upload, CheckCircle2, Star } from 'lucide-react';
import type { Colaborador } from '@/hooks/useColaboradores';
import { useUpdateColaborador } from '@/hooks/useColaboradores';
import { useLancamentos, useUpdateLancamento } from '@/hooks/useFinanceiro';
import { useAvaliacoes, useUpsertAvaliacao } from '@/hooks/useAvaliacoes';
import { calcularCustoMensal, getBusinessDaysInMonth } from '@/lib/business-days';
import { STATUS_LABELS, STATUS_STYLES } from '@/types/financial';
import type { StatusFinanceiro } from '@/types/financial';
import { supabase } from '@/integrations/supabase/client';
import { STORAGE_BUCKETS } from '@/constants/storage';
import { toast } from 'sonner';

interface Props {
  colab: Colaborador | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const TRIMESTRAL_MESES = [2, 5, 8, 11]; // Mar, Jun, Sep, Dec (0-indexed)

export default function ColaboradorDetalheModal({ colab, open, onOpenChange }: Props) {
  const { data: allLancamentos } = useLancamentos('pagar');
  const { data: avaliacoes } = useAvaliacoes(colab?.id ?? null);
  const update = useUpdateColaborador();
  const updateLancamento = useUpdateLancamento();
  const upsertAvaliacao = useUpsertAvaliacao();
  const [ocorrencia, setOcorrencia] = useState({ data: '', tipo: 'falta', desconto: true, obs: '' });
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Avaliação state
  const now = new Date();
  const [avalMes, setAvalMes] = useState(now.getMonth());
  const [avalAno, setAvalAno] = useState(now.getFullYear());
  const [avalFeedback, setAvalFeedback] = useState('');
  const [avalTrimestral, setAvalTrimestral] = useState('');

  if (!colab) return null;

  const diasUteis = getBusinessDaysInMonth();
  const custoMensal = calcularCustoMensal(Number(colab.salario_base), Number(colab.vt_diario), Number(colab.vr_diario), diasUteis);
  const custoAnual = custoMensal * 12;
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const lancamentos = (allLancamentos || []).filter(l => (l as any).colaborador_id === colab.id);
  const totalPago = lancamentos.filter(l => l.status === 'pago').reduce((s, l) => s + Number(l.valor), 0);
  const totalPendente = lancamentos.filter(l => l.status === 'pendente').reduce((s, l) => s + Number(l.valor), 0);

  const copyPix = () => {
    if (colab.pix_chave) {
      navigator.clipboard.writeText(colab.pix_chave);
      toast.success('Chave PIX copiada!');
    }
  };

  const viewComprovante = async (url: string) => {
    const { abrirArquivoStorage } = await import('@/lib/storage-utils');
    await abrirArquivoStorage(STORAGE_BUCKETS.CONTRACTS, url);
  };

  const handleReciboUpload = async (lancamentoId: string, file: File) => {
    setUploadingId(lancamentoId);
    try {
      const ext = (file.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '');
      const { empresaPath } = await import('@/lib/storage-path');
      const storagePath = await empresaPath(`recibos/${lancamentoId}.${ext}`);
      const { error: upErr } = await supabase.storage.from(STORAGE_BUCKETS.CONTRACTS).upload(storagePath, file, { upsert: true });
      if (upErr) throw upErr;
      updateLancamento.mutate({ id: lancamentoId, recibo_assinado_url: storagePath } as any, {
        onSuccess: () => toast.success('Recibo assinado anexado!'),
      });
    } catch (err: any) {
      toast.error('Erro no upload: ' + (err?.message || 'Desconhecido'));
    }
    setUploadingId(null);
  };

  const triggerReciboUpload = (lancamentoId: string) => {
    setUploadingId(lancamentoId);
    fileInputRef.current?.click();
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && uploadingId) {
      handleReciboUpload(uploadingId, file);
    }
    e.target.value = '';
  };

  // Load existing avaliacao when month/year changes
  const existingAval = (avaliacoes || []).find(a => a.mes === avalMes && a.ano === avalAno);
  const isTrimestral = TRIMESTRAL_MESES.includes(avalMes);

  const handleSaveAvaliacao = () => {
    if (!avalFeedback.trim() && !avalTrimestral.trim()) return toast.error('Preencha ao menos o feedback.');
    upsertAvaliacao.mutate({
      colaborador_id: colab.id,
      mes: avalMes,
      ano: avalAno,
      feedback: avalFeedback.trim() || existingAval?.feedback || null,
      conclusao_trimestral: isTrimestral ? (avalTrimestral.trim() || existingAval?.conclusao_trimestral || null) : null,
    });
  };

  const loadAvaliacao = (mes: number, ano: number) => {
    setAvalMes(mes);
    setAvalAno(ano);
    const existing = (avaliacoes || []).find(a => a.mes === mes && a.ano === ano);
    setAvalFeedback(existing?.feedback || '');
    setAvalTrimestral(existing?.conclusao_trimestral || '');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
              {colab.nome.charAt(0)}
            </div>
            <div>
              <span>{colab.nome}</span>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className={
                  colab.regime === 'CLT' ? 'border-info/40 text-info text-[10px]' :
                  colab.regime === 'PJ' ? 'border-warning/40 text-warning text-[10px]' :
                  'border-muted-foreground/40 text-muted-foreground text-[10px]'
                }>
                  {colab.regime}
                </Badge>
                <Badge className={`border-0 text-[10px] ${colab.status === 'ativo' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                  {colab.status === 'ativo' ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={onFileSelected} />

        <Tabs defaultValue="dashboard" className="mt-2">
          <TabsList className="w-full grid grid-cols-7 h-9">
            <TabsTrigger value="dashboard" className="text-xs">Dashboard</TabsTrigger>
            <TabsTrigger value="obrigacoes" className="text-xs">Obrigações</TabsTrigger>
            <TabsTrigger value="historico" className="text-xs">Histórico</TabsTrigger>
            <TabsTrigger value="avaliacoes" className="text-xs">Avaliações</TabsTrigger>
            <TabsTrigger value="gestao" className="text-xs">Gestão</TabsTrigger>
            <TabsTrigger value="ocorrencias" className="text-xs">Ocorrências</TabsTrigger>
            <TabsTrigger value="bancario" className="text-xs">Bancário</TabsTrigger>
          </TabsList>

          {/* Obrigações do Mês */}
          <TabsContent value="obrigacoes" className="mt-4">
            <ObrigacoesTimeline colab={colab} />
          </TabsContent>

          {/* Dashboard */}
          <TabsContent value="dashboard" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <Card className="border-border/60">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Custo Mensal</p>
                  <p className="text-xl font-bold text-primary">{fmt(custoMensal)}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Sal + (VT+VR) × {diasUteis} dias</p>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Custo Anual Estimado</p>
                  <p className="text-xl font-bold text-foreground">{fmt(custoAnual)}</p>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Total Pago</p>
                  <p className="text-lg font-semibold text-success">{fmt(totalPago)}</p>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Pendente</p>
                  <p className="text-lg font-semibold text-warning">{fmt(totalPendente)}</p>
                </CardContent>
              </Card>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-xs text-muted-foreground">Salário Base</p>
                <p className="font-semibold text-foreground">{fmt(Number(colab.salario_base))}</p>
              </div>
              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-xs text-muted-foreground">VT Diário</p>
                <p className="font-semibold text-foreground">{fmt(Number(colab.vt_diario))}</p>
              </div>
              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-xs text-muted-foreground">VR Diário</p>
                <p className="font-semibold text-foreground">{fmt(Number(colab.vr_diario))}</p>
              </div>
            </div>
            {colab.data_inicio && (
              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-xs text-muted-foreground">Data de Início</p>
                <p className="font-semibold text-foreground">{new Date(colab.data_inicio + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
              </div>
            )}
          </TabsContent>

          {/* Histórico */}
          <TabsContent value="historico" className="mt-4">
            <div className="rounded-lg border border-border/60 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-foreground">Descrição</TableHead>
                    <TableHead className="text-foreground">Vencimento</TableHead>
                    <TableHead className="text-right text-foreground">Valor</TableHead>
                    <TableHead className="text-center text-foreground">Status</TableHead>
                    <TableHead className="text-center text-foreground">Documentos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lancamentos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum lançamento encontrado</TableCell>
                    </TableRow>
                  ) : lancamentos.map(l => {
                    const hasComprovante = !!(l as any).comprovante_url;
                    const hasRecibo = !!(l as any).recibo_assinado_url;
                    const isPago = l.status === 'pago';

                    return (
                      <TableRow key={l.id}>
                        <TableCell className="text-foreground text-sm">{l.descricao}</TableCell>
                        <TableCell className="text-foreground text-sm">{new Date(l.data_vencimento).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell className="text-right font-medium text-foreground">{fmt(Number(l.valor))}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={`${STATUS_STYLES[l.status as StatusFinanceiro]} border-0 text-[10px]`}>
                            {STATUS_LABELS[l.status as StatusFinanceiro]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            {hasComprovante ? (
                              <Button variant="ghost" size="sm"
                                className="h-6 px-1.5 text-[10px] gap-1 text-success hover:text-success"
                                onClick={() => viewComprovante((l as any).comprovante_url)}>
                                <CheckCircle2 className="h-3 w-3" /> Bancário ✅
                              </Button>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">—</span>
                            )}
                            {hasRecibo ? (
                              <Button variant="ghost" size="sm"
                                className="h-6 px-1.5 text-[10px] gap-1 text-success hover:text-success"
                                onClick={() => viewComprovante((l as any).recibo_assinado_url)}>
                                <FileText className="h-3 w-3" /> Recibo 📄
                              </Button>
                            ) : isPago ? (
                              <Button variant="ghost" size="sm"
                                className="h-6 px-1.5 text-[10px] gap-1 text-primary hover:text-primary"
                                onClick={() => triggerReciboUpload(l.id)}
                                disabled={uploadingId === l.id}>
                                <Upload className="h-3 w-3" />
                                {uploadingId === l.id ? '...' : 'Recibo'}
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Avaliações */}
          <TabsContent value="avaliacoes" className="space-y-4 mt-4">
            <Card className="border-border/60">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">Feedback Mensal</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-foreground">Mês</Label>
                    <Select value={String(avalMes)} onValueChange={v => loadAvaliacao(Number(v), avalAno)}>
                      <SelectTrigger className="h-8 text-foreground"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MESES_PT.map((m, i) => (
                          <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-foreground">Ano</Label>
                    <Select value={String(avalAno)} onValueChange={v => loadAvaliacao(avalMes, Number(v))}>
                      <SelectTrigger className="h-8 text-foreground"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[2024, 2025, 2026, 2027].map(y => (
                          <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs text-foreground">Feedback — {MESES_PT[avalMes]} {avalAno}</Label>
                  <Textarea
                    className="min-h-[80px]"
                    placeholder="Escreva o feedback mensal do colaborador..."
                    value={avalFeedback}
                    onChange={e => setAvalFeedback(e.target.value)}
                  />
                </div>
                {isTrimestral && (
                  <div className="grid gap-1.5 rounded-lg border-2 border-primary/30 bg-primary/5 p-3">
                    <Label className="text-xs text-primary font-bold uppercase tracking-wider">
                      🎯 Conclusão do Trimestre / OKR — {MESES_PT[avalMes]} {avalAno}
                    </Label>
                    <Textarea
                      className="min-h-[80px] border-primary/20"
                      placeholder="Conclusão trimestral, metas atingidas, OKRs..."
                      value={avalTrimestral}
                      onChange={e => setAvalTrimestral(e.target.value)}
                    />
                  </div>
                )}
                <Button size="sm" onClick={handleSaveAvaliacao} disabled={upsertAvaliacao.isPending}>
                  {upsertAvaliacao.isPending ? 'Salvando...' : 'Salvar Avaliação'}
                </Button>
              </CardContent>
            </Card>

            {/* Historical avaliacoes */}
            {(avaliacoes || []).length > 0 && (
              <Card className="border-border/60">
                <CardContent className="p-4 space-y-2">
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Histórico de Avaliações</p>
                  {(avaliacoes || []).map(a => (
                    <div key={a.id} className="rounded-lg border border-border/60 p-3 space-y-1 cursor-pointer hover:bg-muted/30"
                      onClick={() => loadAvaliacao(a.mes, a.ano)}>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-foreground">{MESES_PT[a.mes]} {a.ano}</p>
                        {TRIMESTRAL_MESES.includes(a.mes) && a.conclusao_trimestral && (
                          <Badge className="bg-primary/10 text-primary border-0 text-[10px]">Trimestral</Badge>
                        )}
                      </div>
                      {a.feedback && <p className="text-xs text-muted-foreground line-clamp-2">{a.feedback}</p>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Gestão Profissional */}
          <TabsContent value="gestao" className="space-y-4 mt-4">
            <Card className="border-border/60">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">Aumento Previsto</p>
                </div>
                {colab.aumento_previsto_valor && Number(colab.aumento_previsto_valor) > 0 ? (
                  <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
                    <p className="text-sm text-foreground">
                      Novo salário: <strong className="text-primary">{fmt(Number(colab.aumento_previsto_valor))}</strong>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Programado para: {colab.aumento_previsto_data || '—'}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum aumento programado.</p>
                )}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-xs text-muted-foreground">Regime</p>
                    <p className="font-semibold text-foreground">{colab.regime}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-xs text-muted-foreground">Adiantamento</p>
                    <p className="font-semibold text-foreground">
                      {colab.possui_adiantamento
                        ? (colab.adiantamento_tipo === 'percentual'
                          ? `${colab.adiantamento_valor}% do salário`
                          : fmt(Number(colab.adiantamento_valor)))
                        : `Integral (Dia ${colab.dia_pagamento_integral || 5})`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            {Number(colab.valor_das) > 0 && (
              <Card className="border-border/60">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Guia DAS (MEI)</p>
                  <p className="text-lg font-semibold text-foreground">{fmt(Number(colab.valor_das))}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Ocorrências */}
          <TabsContent value="ocorrencias" className="space-y-4 mt-4">
            <Card className="border-border/60">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-warning" />
                  <p className="text-sm font-semibold text-foreground">Registrar Ocorrência</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-foreground">Data</Label>
                    <Input type="date" className="h-8" value={ocorrencia.data}
                      onChange={e => setOcorrencia(o => ({ ...o, data: e.target.value }))} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-foreground">Tipo</Label>
                    <select
                      className="h-8 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                      value={ocorrencia.tipo}
                      onChange={e => setOcorrencia(o => ({ ...o, tipo: e.target.value }))}
                    >
                      <option value="falta">Falta</option>
                      <option value="suspensao">Suspensão</option>
                      <option value="observacao">Observação</option>
                    </select>
                  </div>
                </div>
                {(ocorrencia.tipo === 'falta' || ocorrencia.tipo === 'suspensao') && (
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input type="checkbox" checked={ocorrencia.desconto}
                      onChange={e => setOcorrencia(o => ({ ...o, desconto: e.target.checked }))}
                      className="rounded" />
                    Descontar VT/VR deste dia
                  </label>
                )}
                <Textarea placeholder="Observações..." className="min-h-[60px]" value={ocorrencia.obs}
                  onChange={e => setOcorrencia(o => ({ ...o, obs: e.target.value }))} />
                <Button size="sm" variant="outline" onClick={() => {
                  toast.info('Ocorrência registrada (funcionalidade em expansão).');
                  setOcorrencia({ data: '', tipo: 'falta', desconto: true, obs: '' });
                }}>
                  Registrar
                </Button>
              </CardContent>
            </Card>
            <p className="text-xs text-muted-foreground text-center">
              Histórico de ocorrências será expandido em breve.
            </p>
          </TabsContent>

          {/* Dados Bancários */}
          <TabsContent value="bancario" className="space-y-4 mt-4">
            <Card className="border-border/60">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">Chave PIX</p>
                </div>
                {colab.pix_chave ? (
                  <div className="flex items-center justify-between rounded-lg bg-primary/5 border border-primary/20 p-3">
                    <div>
                      <p className="text-xs text-muted-foreground">{colab.pix_tipo?.toUpperCase() || 'CHAVE'}</p>
                      <p className="font-mono text-sm text-foreground">{colab.pix_chave}</p>
                    </div>
                    <Button size="sm" variant="outline" className="h-7" onClick={copyPix}>
                      <Copy className="h-3 w-3 mr-1" /> Copiar
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma chave PIX cadastrada.</p>
                )}
                {colab.email && (
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="text-sm text-foreground">{colab.email}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
