/**
 * Proposta Comercial (Terceirização) — preenchimento e edição.
 * 25/05/2026: refactor completo pós-feedback Thales.
 *
 * Decisões:
 *  - Page TOTALMENTE separada de OrcamentoNovo. Zero código compartilhado.
 *  - Campos 100% em branco (sem placeholders de empresa real).
 *  - Liberdade total: edita label/valor de cada item, adiciona itens,
 *    sobrescreve valor final, anota internamente.
 *  - Layout 2 colunas no desktop: form à esquerda, preview de preços à direita
 *    (sticky). No mobile, preview vira card no topo.
 *  - Sem toggle de tipo — esta page É proposta comercial.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import {
  ArrowLeft, Building2, FileText, ListChecks, DollarSign,
  Lock, Loader2, Save, Send, Sparkles,
} from 'lucide-react';
import { useSaveOrcamento } from '@/hooks/useOrcamentos';
import { toast } from 'sonner';
import {
  type ItemEditavel, type Modalidade, type PrecosPorTipo,
  SERVICOS_DEFAULT, NATUREZAS_DEFAULT, INCLUSOS_DEFAULT, PLANOS,
  REGRAS_RAPIDAS_ATIVAS_DEFAULT,
  calcularTerceirizacao, valorPrincipalPorModalidade, fmtBRL,
} from '@/lib/terceirizacao-engine';
import { ListaEditavel } from '@/components/proposta-comercial/ListaEditavel';
import { RegrasRapidas } from '@/components/proposta-comercial/RegrasRapidas';
import { PrecosPorTipoProcesso } from '@/components/proposta-comercial/PrecosPorTipoProcesso';
import { cn } from '@/lib/utils';

interface State {
  // Prospect (cliente)
  prospect_nome: string;
  prospect_cnpj: string;
  prospect_contato: string;
  prospect_email: string;
  prospect_telefone: string;

  // Escopo (editável)
  servicos: ItemEditavel[];
  naturezas: ItemEditavel[];
  inclusos: ItemEditavel[];

  // Modalidade + valor
  modalidade: Modalidade;
  valor_final_override: number | null;   // se preenchido, manda no cálculo
  volume_custom: number | null;          // pra modalidade=custom
  desconto_custom: number | null;        // pra modalidade=custom
  precos_por_tipo: PrecosPorTipo;        // pra modalidade=preco_por_tipo
  valor_abertura: number | null;         // valor específico pra abertura (caso comum: maior que demais)
  dia_pagamento: number | null;          // dia do mês pra cobrança (1-31)

  // Textos
  regras_rapidas_ativas: string[];       // ids do catálogo de cláusulas
  observacoes_publicas: string;          // cliente vê (texto livre adicional)
  anotacoes_internas: string;            // só Thales vê

  // Mídia
  video_url: string;                     // URL de vídeo (YouTube/Vimeo/MP4) — opcional

  // Meta
  validade_dias: number;
}

function emptyState(): State {
  return {
    prospect_nome: '',
    prospect_cnpj: '',
    prospect_contato: '',
    prospect_email: '',
    prospect_telefone: '',
    servicos: SERVICOS_DEFAULT,
    naturezas: NATUREZAS_DEFAULT,
    inclusos: INCLUSOS_DEFAULT,
    modalidade: 'avulso',
    valor_final_override: 680,       // 26/05: pré-preenchido em R$ 680
    volume_custom: null,
    desconto_custom: null,
    precos_por_tipo: {},
    valor_abertura: null,            // 26/05: opcional, sobrescreve abertura
    dia_pagamento: null,             // 26/05: dia do mês pra cobrança
    regras_rapidas_ativas: REGRAS_RAPIDAS_ATIVAS_DEFAULT,
    observacoes_publicas: '',
    anotacoes_internas: '',
    video_url: '',
    validade_dias: 15,
  };
}

export default function PropostaComercialNova() {
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const fromUrl = searchParams.get('id'); // compat com legacy ?id=

  const propostaId = editId || fromUrl || null;
  const [state, setState] = useState<State>(emptyState());
  const [orcamentoNumero, setOrcamentoNumero] = useState<number | null>(null);
  const [orcamentoStatus, setOrcamentoStatus] = useState<string>('rascunho');
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(!!propostaId);

  const saveMutation = useSaveOrcamento();
  const [salvando, setSalvando] = useState(false);

  // ─── Load existente (edit) ───────────────────────────────────────────────
  useEffect(() => {
    if (!propostaId) return;
    (async () => {
      const { data, error } = await supabase
        .from('orcamentos')
        .select('*')
        .eq('id', propostaId)
        .single();
      if (error || !data || (data as any).tipo_proposta !== 'terceirizacao') {
        toast.error('Proposta não encontrada ou tipo inválido.');
        navigate('/propostas-comerciais', { replace: true });
        return;
      }
      const d = data as any;
      setState({
        prospect_nome: d.prospect_nome || '',
        prospect_cnpj: d.prospect_cnpj || '',
        prospect_contato: d.prospect_contato || '',
        prospect_email: d.prospect_email || '',
        prospect_telefone: d.prospect_telefone || '',
        servicos: Array.isArray(d.terc_servicos) ? d.terc_servicos : SERVICOS_DEFAULT,
        naturezas: Array.isArray(d.terc_naturezas) ? d.terc_naturezas : NATUREZAS_DEFAULT,
        inclusos: Array.isArray(d.terc_inclusos) ? d.terc_inclusos : INCLUSOS_DEFAULT,
        modalidade: d.terc_modalidade || 'avulso',
        valor_final_override: d.terc_valor_final_override ?? null,
        volume_custom: d.terc_volume_custom ?? null,
        desconto_custom: d.terc_desconto_custom ?? null,
        precos_por_tipo: (d.terc_precos_por_tipo && typeof d.terc_precos_por_tipo === 'object') ? d.terc_precos_por_tipo : {},
        valor_abertura: d.terc_valor_abertura ?? null,
        dia_pagamento: d.terc_dia_pagamento ?? null,
        regras_rapidas_ativas: Array.isArray(d.terc_regras_rapidas_ativas) ? d.terc_regras_rapidas_ativas : [],
        observacoes_publicas: d.terc_observacoes_publicas || '',
        anotacoes_internas: d.terc_anotacoes_internas || '',
        video_url: d.terc_video_url || '',
        validade_dias: d.validade_dias || 15,
      });
      setOrcamentoNumero(d.numero || null);
      setOrcamentoStatus(d.status || 'rascunho');
      setShareToken(d.share_token || null);
      setLoadingEdit(false);
    })();
  }, [propostaId, navigate]);

  // ─── Cálculo (memoizado) ─────────────────────────────────────────────────
  const calc = useMemo(() => calcularTerceirizacao(state.inclusos, {
    descontoProOverride: state.modalidade === 'custom' && state.desconto_custom ? state.desconto_custom : undefined,
  }), [state.inclusos, state.modalidade, state.desconto_custom]);

  const valorPrincipal = useMemo(
    () => valorPrincipalPorModalidade(calc, state.modalidade, state.valor_final_override),
    [calc, state.modalidade, state.valor_final_override]
  );

  // ─── Save ────────────────────────────────────────────────────────────────
  const validar = (statusAlvo: string): boolean => {
    if (!state.prospect_nome.trim()) {
      toast.error('Informe a razão social do cliente.');
      return false;
    }
    if (statusAlvo !== 'rascunho') {
      const algumServico = state.servicos.some((s) => s.ativo);
      const algumIncluso = state.inclusos.some((i) => i.ativo);
      if (!algumServico) {
        toast.error('Marque pelo menos 1 serviço societário antes de enviar.');
        return false;
      }
      if (!algumIncluso) {
        toast.error('Marque pelo menos 1 item incluso antes de enviar.');
        return false;
      }
    }
    return true;
  };

  const handleSave = async (statusAlvo: string = 'rascunho') => {
    if (!validar(statusAlvo)) return;
    setSalvando(true);
    try {
      const payload: any = {
        tipo_proposta: 'terceirizacao',
        prospect_nome: state.prospect_nome,
        prospect_cnpj: state.prospect_cnpj || null,
        prospect_email: state.prospect_email || null,
        prospect_telefone: state.prospect_telefone || null,
        prospect_contato: state.prospect_contato || null,
        destinatario: 'contador',
        servicos: [] as any,
        naturezas: [] as any,
        escopo: [] as any,
        tipo_contrato: state.modalidade,
        valor_base: calc.valorBase,
        valor_final: valorPrincipal,
        desconto_pct: 0,
        qtd_processos: 1,
        desconto_progressivo_ativo: false,
        desconto_progressivo_pct: 0,
        desconto_progressivo_limite: 0,
        validade_dias: state.validade_dias,
        pagamento: null,
        sla: null,
        observacoes: null,
        prazo_execucao: null,
        contexto: null,
        pacotes: [] as any,
        secoes: [] as any,
        riscos: [] as any,
        etapas_fluxo: [] as any,
        beneficios_capa: [] as any,
        headline_cenario: null,
        cenarios: [] as any,
        senha_link: null,
        status: statusAlvo,
        pdf_url: null,
        terc_modalidade: state.modalidade,
        terc_servicos: state.servicos as any,
        terc_naturezas: state.naturezas as any,
        terc_inclusos: state.inclusos as any,
        terc_valor_base: calc.valorBase,
        terc_valor_pro: calc.valorPro,
        terc_valor_enterprise: 0,
        terc_valor_final_override: state.valor_final_override,
        terc_volume_custom: state.volume_custom,
        terc_desconto_custom: state.desconto_custom,
        terc_precos_por_tipo: state.precos_por_tipo as any,
        terc_valor_abertura: state.valor_abertura,
        terc_dia_pagamento: state.dia_pagamento,
        terc_regras_rapidas_ativas: state.regras_rapidas_ativas as any,
        terc_observacoes_publicas: state.observacoes_publicas || null,
        terc_anotacoes_internas: state.anotacoes_internas || null,
        terc_video_url: state.video_url || null,
        terc_clicksign_status: 'nao_enviado',
      };
      if (propostaId) payload.id = propostaId;
      const id = await saveMutation.mutateAsync(payload);
      if (!propostaId) {
        // Foi criação → navega pra modo edit
        navigate(`/propostas-comerciais/editar/${id}`, { replace: true });
      } else {
        setOrcamentoStatus(statusAlvo);
      }
      toast.success(statusAlvo === 'enviado' ? 'Proposta enviada — link público pronto.' : 'Rascunho salvo.');
    } catch (e: any) {
      toast.error('Erro: ' + (e.message || 'falhou'));
    } finally {
      setSalvando(false);
    }
  };

  // ─── Autosave ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!state.prospect_nome.trim()) return;
    if (orcamentoStatus !== 'rascunho' && propostaId) return;
    if (salvando) return;
    const t = setTimeout(() => handleSave('rascunho'), 5000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, orcamentoStatus]);

  if (loadingEdit) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/propostas-comerciais')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              {propostaId ? 'Editar Proposta Comercial' : 'Nova Proposta Comercial'}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Terceirização do departamento societário
              {orcamentoNumero && (
                <> · <span className="font-mono">PROP-{String(orcamentoNumero).padStart(4, '0')}</span></>
              )}
              {orcamentoStatus && orcamentoStatus !== 'rascunho' && (
                <> · <Badge variant="outline" className="ml-1 text-[10px]">{orcamentoStatus}</Badge></>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(orcamentoStatus === 'rascunho' || !propostaId) ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSave('rascunho')}
                disabled={salvando}
              >
                {salvando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                Salvar rascunho
              </Button>
              <Button
                size="sm"
                onClick={() => handleSave('enviado')}
                disabled={salvando}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Send className="h-4 w-4 mr-1" /> Enviar proposta
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={() => handleSave(orcamentoStatus)}
              disabled={salvando}
            >
              {salvando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Salvar alterações
            </Button>
          )}
        </div>
      </div>

      {/* ─── Grid 2 colunas (form esquerda + preview direita sticky) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* ─── COLUNA ESQUERDA: FORM ─── */}
        <div className="space-y-5 min-w-0">

          {/* Dados do cliente */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Building2 className="h-4 w-4" /> DADOS DO CLIENTE (CONTRATANTE)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Razão social *</Label>
                  <Input
                    value={state.prospect_nome}
                    onChange={(e) => setState({ ...state, prospect_nome: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>CNPJ</Label>
                  <Input
                    value={state.prospect_cnpj}
                    onChange={(e) => setState({ ...state, prospect_cnpj: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Representante legal</Label>
                  <Input
                    value={state.prospect_contato}
                    onChange={(e) => setState({ ...state, prospect_contato: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={state.prospect_email}
                    onChange={(e) => setState({ ...state, prospect_email: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Telefone</Label>
                  <Input
                    value={state.prospect_telefone}
                    onChange={(e) => setState({ ...state, prospect_telefone: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Escopo editável */}
          <ListaEditavel
            titulo="SERVIÇOS SOCIETÁRIOS"
            subtitulo="O que a Trevo executará pra este cliente. Clique nos chips pra incluir/excluir, ou personalize."
            icon={FileText}
            itens={state.servicos}
            onChange={(servicos) => setState({ ...state, servicos })}
          />

          <ListaEditavel
            titulo="NATUREZA JURÍDICA ATENDIDA"
            subtitulo="Quais tipos de empresa serão atendidas."
            icon={Building2}
            itens={state.naturezas}
            onChange={(naturezas) => setState({ ...state, naturezas })}
          />

          <ListaEditavel
            titulo="O QUE ESTÁ INCLUSO NO PROCESSO"
            subtitulo="Cada item marcado adiciona ao valor base. Itens desmarcados aparecem riscados pro cliente."
            icon={ListChecks}
            itens={state.inclusos}
            onChange={(inclusos) => setState({ ...state, inclusos })}
            mostrarValor
            mostrarDescricao
          />

          {/* Modalidade + Valor */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <DollarSign className="h-4 w-4" /> MODALIDADE COMERCIAL
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Modalidade</Label>
                  <Select
                    value={state.modalidade}
                    onValueChange={(v) => setState({ ...state, modalidade: v as Modalidade })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="avulso">Avulso — Pontual</SelectItem>
                      <SelectItem value="pro_5">PRO — 5 processos/mês (-15%)</SelectItem>
                      <SelectItem value="preco_por_tipo">Preço por tipo de processo</SelectItem>
                      <SelectItem value="custom">Customizado (volume + desconto livres)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Validade da proposta (dias)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={90}
                    value={state.validade_dias}
                    onChange={(e) => setState({ ...state, validade_dias: Math.max(1, Number(e.target.value) || 15) })}
                  />
                </div>
              </div>

              {/* Preço por tipo de processo */}
              {state.modalidade === 'preco_por_tipo' && (
                <PrecosPorTipoProcesso
                  value={state.precos_por_tipo}
                  onChange={(precos_por_tipo) => setState({ ...state, precos_por_tipo })}
                />
              )}

              {/* Custom fields */}
              {state.modalidade === 'custom' && (
                <div className="grid grid-cols-2 gap-3 p-3 rounded-md bg-amber-50/50 border border-amber-200">
                  <div className="space-y-1.5">
                    <Label>Volume (processos/mês)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={state.volume_custom ?? ''}
                      onChange={(e) => setState({ ...state, volume_custom: Number(e.target.value) || null })}
                      placeholder="ex: 15"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Desconto (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={50}
                      step="0.1"
                      value={state.desconto_custom ?? ''}
                      onChange={(e) => setState({ ...state, desconto_custom: Number(e.target.value) || null })}
                      placeholder="ex: 25"
                    />
                  </div>
                </div>
              )}

              {/* Override de valor final */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  Valor final (padrão para alteração / baixa / transformação)
                  <span className="text-[10px] font-normal text-muted-foreground">— se preenchido, sobrescreve cálculo automático</span>
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={state.valor_final_override ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    setState({ ...state, valor_final_override: v ? Number(v) : null });
                  }}
                  placeholder={fmtBRL(valorPrincipalPorModalidade(calc, state.modalidade, null))}
                  className="tabular-nums"
                />
              </div>

              {/* Valor específico pra Abertura de Empresa */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    Valor específico de Abertura
                    <span className="text-[10px] font-normal text-muted-foreground">— sobrescreve só pra abertura</span>
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={state.valor_abertura ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      setState({ ...state, valor_abertura: v ? Number(v) : null });
                    }}
                    placeholder="R$ 0,00"
                    className="tabular-nums"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Dia de pagamento (do mês)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={state.dia_pagamento ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      setState({ ...state, dia_pagamento: v ? Math.max(1, Math.min(31, Number(v))) : null });
                    }}
                    placeholder="ex: 5, 10, 15..."
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Vídeo institucional / pitch (opcional) */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <FileText className="h-4 w-4" /> VÍDEO NA LANDING PÚBLICA (opcional)
              </div>
              <p className="text-xs text-muted-foreground">
                Cole URL de YouTube, Vimeo ou MP4 direto. Aparece em destaque
                logo abaixo do hero. Deixe vazio pra esconder a seção.
              </p>
              <Input
                value={state.video_url}
                onChange={(e) => setState({ ...state, video_url: e.target.value })}
                placeholder="https://youtube.com/watch?v=... ou https://vimeo.com/..."
              />
              {state.video_url && (
                <p className="text-[11px] text-emerald-700">
                  ✓ Vídeo será exibido pro cliente
                </p>
              )}
            </CardContent>
          </Card>

          {/* Observações públicas (cláusulas + texto livre) */}
          <RegrasRapidas
            regrasAtivas={state.regras_rapidas_ativas}
            textoLivre={state.observacoes_publicas}
            onChangeRegras={(regras_rapidas_ativas) => setState({ ...state, regras_rapidas_ativas })}
            onChangeTexto={(observacoes_publicas) => setState({ ...state, observacoes_publicas })}
          />

          {/* Anotações internas */}
          <Card className="bg-amber-50/30 border-amber-200 dark:bg-amber-950/10">
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
                <Lock className="h-4 w-4" /> ANOTAÇÕES INTERNAS (só você)
              </div>
              <p className="text-xs text-amber-900/70 dark:text-amber-200/70">
                NÃO aparece pro cliente. Use pra notas de negociação, pontos a lembrar, contexto.
              </p>
              <Textarea
                value={state.anotacoes_internas}
                onChange={(e) => setState({ ...state, anotacoes_internas: e.target.value })}
                rows={4}
                placeholder="Ex: Cliente mencionou ter outro contador concorrente — atenção ao SLA..."
                className="bg-white/60"
              />
            </CardContent>
          </Card>
        </div>

        {/* ─── COLUNA DIREITA: PREVIEW STICKY ─── */}
        <aside className="lg:sticky lg:top-6 self-start space-y-3">
          <Card className="border-2 border-emerald-300 bg-emerald-50/40 dark:bg-emerald-950/20">
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                💰 PREVIEW EM TEMPO REAL
              </div>

              {state.valor_final_override !== null && state.valor_final_override > 0 && (
                <div className="text-[10px] uppercase tracking-wider font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-1 rounded">
                  Override ativo · {fmtBRL(state.valor_final_override)}
                </div>
              )}

              <PreviewBox
                titulo={
                  state.modalidade === 'avulso' ? 'Avulso (selecionado)' :
                  state.modalidade === 'pro_5' ? 'PRO (selecionado)' :
                  state.modalidade === 'preco_por_tipo' ? 'Por tipo de processo' :
                  'Custom (selecionado)'
                }
                valor={state.modalidade === 'preco_por_tipo' ? '—' : fmtBRL(valorPrincipal)}
                subtitulo={
                  state.modalidade === 'preco_por_tipo' ? 'preços variam por categoria abaixo' :
                  state.modalidade === 'pro_5' ? 'por mês' :
                  'por processo'
                }
                destacado
              />

              {state.modalidade !== 'preco_por_tipo' && (
                <div className="pt-3 border-t border-emerald-200 space-y-2">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Comparativo</p>
                  <PreviewLinha label="Avulso (base)" valor={fmtBRL(calc.valorBase)} ativo={state.modalidade === 'avulso'} />
                  <PreviewLinha label={`PRO — ${fmtBRL(calc.valorPro)}/un × 5`} valor={fmtBRL(calc.totalMensalPro) + '/mês'} ativo={state.modalidade === 'pro_5'} />
                </div>
              )}

              {state.modalidade === 'preco_por_tipo' && Object.keys(state.precos_por_tipo).length > 0 && (
                <div className="pt-3 border-t border-emerald-200 space-y-1">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Preços por tipo</p>
                  {Object.entries(state.precos_por_tipo).map(([tipo, valor]) =>
                    valor && valor > 0 ? (
                      <div key={tipo} className="flex justify-between text-xs px-2 py-1">
                        <span className="capitalize">{tipo}</span>
                        <span className="tabular-nums font-semibold">{fmtBRL(valor)}</span>
                      </div>
                    ) : null
                  )}
                </div>
              )}

              {calc.detalhamentoAdicional.length > 0 && (
                <div className="pt-3 border-t border-emerald-200 space-y-1">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Composição do valor base</p>
                  <div className="text-[11px] text-muted-foreground space-y-0.5">
                    <div className="flex justify-between"><span>Mínimo operacional</span><span className="tabular-nums">{fmtBRL(380)}</span></div>
                    {calc.detalhamentoAdicional.map((d, i) => (
                      <div key={i} className="flex justify-between">
                        <span className="truncate pr-2">+ {d.label}</span>
                        <span className="tabular-nums">{fmtBRL(d.valor)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-1 border-t border-dashed font-semibold text-foreground">
                      <span>Total base</span><span className="tabular-nums">{fmtBRL(calc.valorBase)}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {shareToken && orcamentoStatus !== 'rascunho' && (
            <Card>
              <CardContent className="pt-6 space-y-2">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Link público</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/proposta/${shareToken}`);
                    toast.success('Link copiado!');
                  }}
                >
                  Copiar link
                </Button>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

function PreviewBox({ titulo, valor, subtitulo, destacado }: { titulo: string; valor: string; subtitulo: string; destacado?: boolean }) {
  return (
    <div className={cn(
      'rounded-lg p-4 border-2',
      destacado ? 'border-emerald-500 bg-white dark:bg-emerald-950/40' : 'border-border bg-card'
    )}>
      <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{titulo}</p>
      <p className="text-2xl font-bold mt-1 tabular-nums">{valor}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{subtitulo}</p>
    </div>
  );
}

function PreviewLinha({ label, valor, ativo }: { label: string; valor: string; ativo: boolean }) {
  return (
    <div className={cn(
      'flex justify-between items-center text-xs px-2 py-1.5 rounded',
      ativo ? 'bg-emerald-100 dark:bg-emerald-900/40 font-semibold' : 'text-muted-foreground'
    )}>
      <span className="truncate pr-2">{label}</span>
      <span className="tabular-nums shrink-0">{valor}</span>
    </div>
  );
}
