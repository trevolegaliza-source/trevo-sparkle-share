import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSaveOrcamento, type Orcamento } from '@/hooks/useOrcamentos';
import { gerarOrcamentoPDF, sanitizeFilename, downloadBlob } from '@/lib/orcamento-pdf';
import { useOrcamentoPDFs } from '@/hooks/useOrcamentoPDFs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Plus, FileText, Save, FileDown, ArrowLeft, Copy, ExternalLink, Loader2, ChevronDown, Trash2,
  Link as LinkIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import {
  type OrcamentoForm, type OrcamentoModo, type OrcamentoItem, type OrcamentoPDFMode,
  type OrcamentoDestinatario,
  DEFAULT_SECOES, createItem, normalizeItem, getItemValor,
} from '@/components/orcamentos/types';
import { ItemCardSimples } from '@/components/orcamentos/ItemCardSimples';
import { ItemCardDetalhado } from '@/components/orcamentos/ItemCardDetalhado';
import { PacotesEditor } from '@/components/orcamentos/PacotesEditor';
import { PreviewDetalhado } from '@/components/orcamentos/PreviewDetalhado';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const defaultForm = (): OrcamentoForm => ({
  destinatario: 'contador',
  prospect_nome: '',
  prospect_cnpj: '',
  prospect_email: '',
  prospect_telefone: '',
  prospect_contato: '',
  escritorio_nome: '',
  escritorio_cnpj: '',
  escritorio_email: '',
  escritorio_telefone: '',
  cliente_id: null,
  modo: 'simples',
  contexto: '',
  ordem_execucao: '',
  itens: [createItem()],
  pacotes: [],
  secoes: [...DEFAULT_SECOES],
  desconto_pct: 0,
  validade_dias: 15,
  prazo_execucao: 'Prazo de execução: até 15 dias úteis após recebimento da documentação completa.',
  pagamento: 'Pagamento à vista via PIX ou boleto bancário.',
  observacoes: '',
  headline_cenario: '',
  riscos: [],
  beneficios_capa: [],
  etapas_fluxo: [],
  cenarios: [],
  senha_link: '',
} as any);

function destinatarioToModoPDF(d: OrcamentoDestinatario): OrcamentoPDFMode {
  if (d === 'contador') return 'contador';
  if (d === 'cliente_via_contador') return 'cliente';
  return 'direto';
}

export default function OrcamentoNovo() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const duplicateId = searchParams.get('duplicate');

  const [form, setForm] = useState<OrcamentoForm>(defaultForm());
  const [orcamentoId, setOrcamentoId] = useState<string | null>(editId);
  const [orcamentoNumero, setOrcamentoNumero] = useState<number>(0);
  const [pacotesOpen, setPacotesOpen] = useState(false);
  const [cenariosOpen, setCenariosOpen] = useState(false);
  const [fluxoOpen, setFluxoOpen] = useState(false);
  const [riscosOpen, setRiscosOpen] = useState(false);
  const [beneficiosOpen, setBeneficiosOpen] = useState(false);
  const saveMutation = useSaveOrcamento();
  const { pdfs, salvarPDF } = useOrcamentoPDFs(orcamentoId);
  const [gerando, setGerando] = useState(false);

  const modoPDF = destinatarioToModoPDF(form.destinatario);
  const isDetalhado = form.modo === 'detalhado';

  const { data: clientes } = useQuery({
    queryKey: ['clientes_select'],
    queryFn: async () => {
      const { data } = await supabase.from('clientes').select('id, nome, apelido, cnpj, email, telefone').eq('is_archived', false).order('nome');
      return data || [];
    },
  });

  // Load existing orcamento if editing
  useEffect(() => {
    if (!editId) return;
    (async () => {
      const { data } = await supabase.from('orcamentos').select('*').eq('id', editId).single();
      if (!data) return;
      const orc = data as unknown as Orcamento & { contexto?: string; ordem_execucao?: string; pacotes?: any; secoes?: any; destinatario?: string };
      setOrcamentoNumero(orc.numero);

      let itens: OrcamentoItem[] = [];
      try {
        const raw = orc.servicos as any;
        if (Array.isArray(raw) && raw.length > 0) {
          itens = raw.map(normalizeItem);
        }
      } catch { /* ignore */ }

      const hasDetailedData = itens.some(i => i.taxa_min > 0 || i.taxa_max > 0 || i.prazo || i.docs_necessarios);
      const hasContexto = !!(orc as any).contexto;
      const modo: OrcamentoModo = (hasDetailedData || hasContexto) ? 'detalhado' : 'simples';

      const rawPacotes = (orc as any).pacotes;
      const rawSecoes = (orc as any).secoes;

      // Try to infer escritorio from selected client
      const selectedCliente = clientes?.find(c => c.id === orc.cliente_id);

      setForm({
        destinatario: ((orc as any).destinatario as OrcamentoDestinatario) || 'contador',
        prospect_nome: orc.prospect_nome,
        prospect_cnpj: orc.prospect_cnpj || '',
        prospect_email: orc.prospect_email || '',
        prospect_telefone: orc.prospect_telefone || '',
        prospect_contato: orc.prospect_contato || '',
        escritorio_nome: selectedCliente?.apelido || selectedCliente?.nome || '',
        escritorio_cnpj: selectedCliente?.cnpj || '',
        escritorio_email: selectedCliente?.email || '',
        escritorio_telefone: selectedCliente?.telefone || '',
        cliente_id: orc.cliente_id || null,
        modo,
        contexto: (orc as any).contexto || '',
        ordem_execucao: (orc as any).ordem_execucao || '',
        itens: itens.length ? itens : [createItem()],
        pacotes: Array.isArray(rawPacotes) ? rawPacotes : [],
        secoes: Array.isArray(rawSecoes) && rawSecoes.length > 0 ? rawSecoes : [...DEFAULT_SECOES],
        desconto_pct: orc.desconto_pct,
        validade_dias: orc.validade_dias,
        prazo_execucao: orc.prazo_execucao || '',
        pagamento: orc.pagamento || '',
        observacoes: orc.observacoes || '',
        headline_cenario: (orc as any).headline_cenario || '',
        riscos: Array.isArray((orc as any).riscos) ? (orc as any).riscos : [],
        beneficios_capa: Array.isArray((orc as any).beneficios_capa) ? (orc as any).beneficios_capa : [],
        etapas_fluxo: Array.isArray((orc as any).etapas_fluxo) ? (orc as any).etapas_fluxo : [],
        cenarios: Array.isArray((orc as any).cenarios) ? (orc as any).cenarios : [],
        senha_link: (orc as any).senha_link || '',
      } as any);
    })();
  }, [editId, clientes]);

  // Load and duplicate existing orcamento
  useEffect(() => {
    if (!duplicateId || editId) return;
    (async () => {
      const { data } = await supabase.from('orcamentos').select('*').eq('id', duplicateId).single();
      if (!data) return;
      const orc = data as any;

      let itens: OrcamentoItem[] = [];
      try {
        const raw = orc.servicos as any;
        if (Array.isArray(raw) && raw.length > 0) {
          itens = raw.map(normalizeItem);
        }
      } catch { /* ignore */ }

      const hasDetailedData = itens.some(i => i.taxa_min > 0 || i.taxa_max > 0 || i.prazo || i.docs_necessarios);
      const modo: OrcamentoModo = (hasDetailedData || orc.contexto) ? 'detalhado' : 'simples';
      const rawPacotes = orc.pacotes;
      const rawSecoes = orc.secoes;
      const selectedCliente = clientes?.find(c => c.id === orc.cliente_id);

      setForm({
        destinatario: (orc.destinatario as OrcamentoDestinatario) || 'contador',
        prospect_nome: orc.prospect_nome + ' (cópia)',
        prospect_cnpj: orc.prospect_cnpj || '',
        prospect_email: orc.prospect_email || '',
        prospect_telefone: orc.prospect_telefone || '',
        prospect_contato: orc.prospect_contato || '',
        escritorio_nome: selectedCliente?.apelido || selectedCliente?.nome || '',
        escritorio_cnpj: selectedCliente?.cnpj || '',
        escritorio_email: selectedCliente?.email || '',
        escritorio_telefone: selectedCliente?.telefone || '',
        cliente_id: orc.cliente_id || null,
        modo,
        contexto: orc.contexto || '',
        ordem_execucao: orc.ordem_execucao || '',
        itens: itens.length ? itens : [createItem()],
        pacotes: Array.isArray(rawPacotes) ? rawPacotes : [],
        secoes: Array.isArray(rawSecoes) && rawSecoes.length > 0 ? rawSecoes : [...DEFAULT_SECOES],
        desconto_pct: orc.desconto_pct,
        validade_dias: orc.validade_dias,
        prazo_execucao: orc.prazo_execucao || '',
        pagamento: orc.pagamento || '',
        observacoes: orc.observacoes || '',
        headline_cenario: orc.headline_cenario || '',
        riscos: Array.isArray(orc.riscos) ? orc.riscos : [],
        beneficios_capa: Array.isArray(orc.beneficios_capa) ? orc.beneficios_capa : [],
        etapas_fluxo: Array.isArray(orc.etapas_fluxo) ? orc.etapas_fluxo : [],
        cenarios: Array.isArray(orc.cenarios) ? orc.cenarios : [],
        senha_link: '',
      } as any);

      toast.info('Orçamento duplicado! Edite e salve como novo.');
    })();
  }, [duplicateId, editId, clientes]);

  const subtotal = useMemo(() =>
    form.itens.reduce((s, i) => s + getItemValor(i) * i.quantidade, 0),
    [form.itens]
  );
  const descontoValor = subtotal * (form.desconto_pct / 100);
  const totalFinal = subtotal - descontoValor;

  function addItem() {
    setForm(f => ({
      ...f,
      itens: [...f.itens, createItem({ ordem: f.itens.length + 1 })],
    }));
  }

  function updateItem(idx: number, field: keyof OrcamentoItem, value: any) {
    setForm(f => ({
      ...f,
      itens: f.itens.map((item, i) => i === idx ? { ...item, [field]: value } : item),
    }));
  }

  function removeItem(idx: number) {
    setForm(f => ({ ...f, itens: f.itens.filter((_, i) => i !== idx) }));
  }

  function handleSelectEscritorio(clienteId: string) {
    const c = clientes?.find(cl => cl.id === clienteId);
    if (!c) return;
    setForm(f => ({
      ...f,
      cliente_id: c.id,
      escritorio_nome: c.apelido || c.nome,
      escritorio_cnpj: c.cnpj || '',
      escritorio_email: c.email || '',
      escritorio_telefone: c.telefone || '',
    }));
  }

  function handleAddSecao() {
    const nome = prompt('Nome da nova seção:');
    if (!nome) return;
    const key = nome.toLowerCase().replace(/[^a-z0-9]/g, '_');
    setForm(f => ({
      ...f,
      secoes: [...f.secoes, { key, label: nome, descricao: '' }],
    }));
  }

  function buildPayload(status: string) {
    return {
      prospect_nome: form.prospect_nome,
      prospect_cnpj: form.prospect_cnpj || null,
      prospect_email: form.prospect_email || null,
      prospect_telefone: form.prospect_telefone || null,
      prospect_contato: form.prospect_contato || null,
      cliente_id: form.cliente_id,
      destinatario: form.destinatario,
      servicos: form.itens as any,
      naturezas: [] as any,
      escopo: [] as any,
      tipo_contrato: 'avulso',
      valor_base: subtotal,
      valor_final: totalFinal,
      desconto_pct: form.desconto_pct,
      qtd_processos: 1,
      desconto_progressivo_ativo: false,
      desconto_progressivo_pct: 0,
      desconto_progressivo_limite: 0,
      validade_dias: form.validade_dias,
      pagamento: form.pagamento || null,
      sla: null,
      observacoes: form.observacoes || null,
      prazo_execucao: form.prazo_execucao || null,
      contexto: form.contexto || null,
      ordem_execucao: form.ordem_execucao || null,
      pacotes: form.pacotes as any,
      secoes: form.secoes as any,
      riscos: form.riscos as any,
      etapas_fluxo: form.etapas_fluxo as any,
      beneficios_capa: form.beneficios_capa as any,
      headline_cenario: form.headline_cenario || null,
      cenarios: form.cenarios as any,
      senha_link: (form as any).senha_link || null,
      status,
      created_by: null,
      pdf_url: null,
    };
  }

  async function handleSave(status: string = 'rascunho') {
    if (!form.prospect_nome?.trim()) {
      toast.error('Informe o nome da empresa a regularizar');
      return;
    }
    try {
      const payload: any = buildPayload(status);
      if (orcamentoId) payload.id = orcamentoId;
      const id = await saveMutation.mutateAsync(payload);
      setOrcamentoId(id);
      toast.success(status === 'enviado' ? 'Proposta salva e pronta!' : 'Rascunho salvo!');
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err.message || ''));
    }
  }

  function buildPDFParams(modo?: OrcamentoPDFMode) {
    const itensValidos = form.itens.filter(i => i.descricao.trim());
    return {
      modo: form.modo,
      modoPDF: modo || modoPDF,
      destinatario: form.destinatario,
      escritorioNome: form.escritorio_nome,
      escritorioEmail: form.escritorio_email,
      escritorioTelefone: form.escritorio_telefone,
      escritorioCnpj: form.escritorio_cnpj,
      // Legacy compat
      clienteNome: form.escritorio_nome,
      contadorNome: form.escritorio_nome,
      contadorEmail: form.escritorio_email,
      contadorTelefone: form.escritorio_telefone,
      prospect_nome: form.prospect_nome,
      prospect_cnpj: form.prospect_cnpj,
      itens: itensValidos,
      pacotes: form.pacotes,
      secoes: form.secoes,
      contexto: form.contexto,
      ordem_execucao: form.ordem_execucao,
      desconto_pct: form.desconto_pct,
      subtotal,
      total: totalFinal,
      validade_dias: form.validade_dias,
      prazo_execucao: form.prazo_execucao,
      pagamento: form.pagamento,
      observacoes: form.observacoes,
      numero: orcamentoNumero || 0,
      data_emissao: new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }),
      riscos: form.riscos,
      etapas_fluxo: form.etapas_fluxo,
      beneficios_capa: form.beneficios_capa,
      headline_cenario: form.headline_cenario,
      cenarios: form.cenarios,
    };
  }

  function buildFilename(modo: OrcamentoPDFMode) {
    const nome = sanitizeFilename(form.prospect_nome || 'proposta');
    const sufixos: Record<OrcamentoPDFMode, string> = {
      contador: '_interno',
      cliente: '_cliente',
      direto: '_direto_trevo',
    };
    return `Proposta_${nome}${sufixos[modo]}_${new Date().toISOString().split('T')[0]}.pdf`;
  }

  async function salvarOrcamento(): Promise<string> {
    if (!form.prospect_nome?.trim()) throw new Error('Informe o nome da empresa');
    const payload: any = buildPayload('rascunho');
    if (orcamentoId) {
      payload.id = orcamentoId;
      delete payload.status; // Não sobrescrever status ao salvar orçamento existente
    }
    const id = await saveMutation.mutateAsync(payload);
    setOrcamentoId(id);
    return id;
  }

  async function handleGerarPDF() {
    if (!form.prospect_nome.trim()) { toast.error('Preencha o nome da empresa'); return; }
    const itensValidos = form.itens.filter(i => i.descricao.trim());
    if (itensValidos.length === 0) { toast.error('Adicione pelo menos um item'); return; }

    const modo = modoPDF;
    setGerando(true);
    try {
      const savedId = await salvarOrcamento();
      const blob = await gerarOrcamentoPDF(buildPDFParams(modo));
      const filename = buildFilename(modo);

      const result = await salvarPDF.mutateAsync({ blob, modo, orcamentoId: savedId, filename });
      downloadBlob(blob, filename);
      const modoLabels: Record<OrcamentoPDFMode, string> = {
        contador: 'interna',
        cliente: 'do cliente',
        direto: 'direta Trevo',
      };
      toast.success(`Proposta ${modoLabels[modo]} gerada e salva! (v${result.versao})`);
    } catch (err: any) {
      toast.error('Erro ao gerar PDF: ' + (err.message || ''));
      console.error(err);
    } finally {
      setGerando(false);
    }
  }

  function handleCopyLink() {
    if (!orcamentoId) {
      toast.error('Salve o orçamento primeiro para gerar o link.');
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('orcamentos')
        .select('share_token, senha_link')
        .eq('id', orcamentoId)
        .single();

      if (!data || !(data as any).share_token) {
        toast.error('Token não encontrado. Salve o orçamento novamente.');
        return;
      }

      const url = `https://trevolegaliza.lovable.app/proposta/${(data as any).share_token}`;
      navigator.clipboard.writeText(url);

      if (form.destinatario === 'contador' && (form as any).senha_link) {
        toast.success(`Link copiado! Senha: ${(form as any).senha_link}`);
      } else if (form.destinatario === 'contador') {
        toast.success('Link copiado! ⚠️ Sem senha definida.');
      } else {
        toast.success('Link copiado!');
      }
    })();
  }

  function handleDuplicate() {
    setForm(f => ({ ...f, prospect_nome: f.prospect_nome + ' (cópia)' }));
    setOrcamentoId(null);
    setOrcamentoNumero(0);
    toast.success('Duplicado! Salve para criar um novo orçamento.');
  }

  const validItems = form.itens.filter(i => i.descricao.trim());

  // Simple mode preview
  const previewSimples = (
    <div className="bg-gradient-to-br from-[hsl(120,60%,8%)] to-[hsl(120,40%,12%)] p-5 text-white rounded-lg">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg font-extrabold">
          <span className="text-primary">Trevo</span>{' '}
          <span className="opacity-60">Legaliza</span>
        </span>
      </div>
      <p className="text-[10px] font-bold uppercase tracking-[3px] text-primary/80 mb-1">Proposta Comercial</p>
      {form.prospect_nome && (
        <div className="mb-4">
          <p className="text-[10px] text-primary/60">Preparada para</p>
          <p className="font-bold text-sm">{form.prospect_nome}</p>
          {form.prospect_cnpj && <p className="text-[10px] opacity-40">{form.prospect_cnpj}</p>}
        </div>
      )}
      {validItems.length > 0 && (
        <div className="space-y-1.5 mb-4">
          {validItems.map((item, idx) => (
            <div key={item.id} className="flex justify-between text-xs">
              <span className="opacity-70 truncate mr-3">
                {idx + 1}. {item.descricao}{item.quantidade > 1 ? ` (×${item.quantidade})` : ''}
              </span>
              <span className="font-bold whitespace-nowrap">{fmt(getItemValor(item) * item.quantidade)}</span>
            </div>
          ))}
        </div>
      )}
      {form.desconto_pct > 0 && subtotal > 0 && (
        <div className="flex justify-between text-xs border-t border-white/10 pt-2">
          <span className="opacity-50">Desconto ({form.desconto_pct}%)</span>
          <span className="text-primary/80">-{fmt(descontoValor)}</span>
        </div>
      )}
      <div className="flex justify-between border-t border-white/20 pt-3 mt-3">
        <span className="text-primary/80 font-bold text-[10px] uppercase">Total</span>
        <span className="text-xl font-extrabold">{fmt(totalFinal)}</span>
      </div>
      <p className="mt-3 text-[10px] opacity-30">
        Válida por {form.validade_dias} dias
        {form.pagamento ? ` · ${form.pagamento.substring(0, 50)}${form.pagamento.length > 50 ? '...' : ''}` : ''}
      </p>
    </div>
  );

  const destinatarioLabels: Record<OrcamentoDestinatario, { emoji: string; label: string }> = {
    contador: { emoji: '📊', label: 'Interno' },
    cliente_via_contador: { emoji: '📄', label: 'Cliente' },
    cliente_direto: { emoji: '🍀', label: 'Direto' },
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/orcamentos')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {editId ? 'Editar Proposta' : 'Nova Proposta Comercial'}
            </h1>
            <p className="text-xs text-muted-foreground">
              Preencha os dados e gere um PDF profissional em minutos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleSave('rascunho')} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-1" /> Salvar Rascunho
          </Button>
          {orcamentoId && (
            <Button variant="outline" size="sm" onClick={handleDuplicate}>
              <Copy className="h-4 w-4 mr-1" /> Duplicar
            </Button>
          )}
          {orcamentoId && form.destinatario !== 'cliente_via_contador' && (
            <Button variant="outline" size="sm" onClick={handleCopyLink} className="gap-1">
              <LinkIcon className="h-4 w-4" /> Copiar Link
            </Button>
          )}
        </div>
      </div>

      {/* Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* LEFT: Form (60%) */}
        <div className="lg:col-span-3 space-y-5">

          {/* SEÇÃO 1: Para quem é este orçamento? */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-3">Para quem é este orçamento?</h3>
            <RadioGroup
              value={form.destinatario}
              onValueChange={(v: OrcamentoDestinatario) => setForm(f => ({ ...f, destinatario: v }))}
              className="space-y-3"
            >
              <label htmlFor="dest-contador" className={cn(
                "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                form.destinatario === 'contador' ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'
              )}>
                <RadioGroupItem value="contador" id="dest-contador" className="mt-0.5" />
                <div>
                  <div className="font-medium text-sm">📊 Trevo → Contador</div>
                  <div className="text-xs text-muted-foreground">Painel interno com margens e precificação</div>
                </div>
              </label>
              <label htmlFor="dest-cliente-via" className={cn(
                "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                form.destinatario === 'cliente_via_contador' ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'
              )}>
                <RadioGroupItem value="cliente_via_contador" id="dest-cliente-via" className="mt-0.5" />
                <div>
                  <div className="font-medium text-sm">📄 Contador → Cliente Final</div>
                  <div className="text-xs text-muted-foreground">White-label com branding do escritório</div>
                </div>
              </label>
              <label htmlFor="dest-direto" className={cn(
                "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                form.destinatario === 'cliente_direto' ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'
              )}>
                <RadioGroupItem value="cliente_direto" id="dest-direto" className="mt-0.5" />
                <div>
                  <div className="font-medium text-sm">🍀 Trevo → Cliente Final</div>
                  <div className="text-xs text-muted-foreground">Atendimento direto com branding Trevo</div>
                </div>
              </label>
            </RadioGroup>
          </Card>

          {/* SEÇÃO 2: Escritório Contábil (oculto se direto) */}
          {form.destinatario !== 'cliente_direto' && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-3">Escritório Contábil</h3>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Selecionar escritório cadastrado</Label>
                  <Select onValueChange={handleSelectEscritorio} value={form.cliente_id || undefined}>
                    <SelectTrigger>
                      <SelectValue placeholder="Buscar escritório cadastrado..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes?.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.apelido || c.nome}{c.cnpj ? ` · ${c.cnpj}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Nome do escritório *</Label>
                    <Input value={form.escritorio_nome} onChange={e => setForm(f => ({ ...f, escritorio_nome: e.target.value }))} placeholder="Ex: AL Assessoria" />
                  </div>
                  <div>
                    <Label className="text-xs">CNPJ do escritório</Label>
                    <Input value={form.escritorio_cnpj} onChange={e => setForm(f => ({ ...f, escritorio_cnpj: e.target.value }))} placeholder="00.000.000/0000-00" />
                  </div>
                  <div>
                    <Label className="text-xs">Email do escritório</Label>
                    <Input value={form.escritorio_email} onChange={e => setForm(f => ({ ...f, escritorio_email: e.target.value }))} placeholder="email@escritorio.com" />
                  </div>
                  <div>
                    <Label className="text-xs">Telefone do escritório</Label>
                    <Input value={form.escritorio_telefone} onChange={e => setForm(f => ({ ...f, escritorio_telefone: e.target.value }))} placeholder="(11) 99999-9999" />
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* SEÇÃO 3: Empresa a ser regularizada */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-1">Empresa a ser regularizada</h3>
            <p className="text-xs text-muted-foreground mb-3">Esta é a empresa que receberá os serviços</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Razão social da empresa *</Label>
                <Input value={form.prospect_nome} onChange={e => setForm(f => ({ ...f, prospect_nome: e.target.value }))} placeholder="Ex: Clínica Mater Senior Saúde e Longevidade Ltda" />
              </div>
              <div>
                <Label className="text-xs">CNPJ</Label>
                <Input value={form.prospect_cnpj} onChange={e => setForm(f => ({ ...f, prospect_cnpj: e.target.value }))} placeholder="00.000.000/0000-00" />
              </div>
              <div>
                <Label className="text-xs">Email de contato</Label>
                <Input value={form.prospect_email} onChange={e => setForm(f => ({ ...f, prospect_email: e.target.value }))} placeholder="email@empresa.com" />
              </div>
              <div>
                <Label className="text-xs">Telefone</Label>
                <Input value={form.prospect_telefone} onChange={e => setForm(f => ({ ...f, prospect_telefone: e.target.value }))} placeholder="(11) 99999-9999" />
              </div>
            </div>
          </Card>

          {/* SEÇÃO 4: Contexto e Apresentação */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-3">Contexto e Apresentação</h3>
            <div className="space-y-5">
              <div>
                <Label className="text-xs">Headline do cenário (opcional)</Label>
                <Input
                  value={form.headline_cenario}
                  onChange={e => setForm(f => ({ ...f, headline_cenario: e.target.value }))}
                  placeholder="Ex: A regularização não é uma formalidade — é o que permite a empresa operar sem riscos."
                />
                <p className="text-[10px] text-muted-foreground mt-1">Se vazio, não aparecerá no PDF.</p>
              </div>
              <div>
                <Label className="text-xs">Descreva a situação atual</Label>
                <RichTextEditor
                  value={form.contexto}
                  onChange={(html) => setForm(f => ({ ...f, contexto: html }))}
                  placeholder="Ex: Empresa sem Alvará Sanitário e sem CRM PJ. Atualmente em risco de interdição..."
                  minHeight="100px"
                />
              </div>
            </div>
          </Card>

          {/* SEÇÃO 5: Cenários (colapsável) */}
          <Collapsible open={cenariosOpen} onOpenChange={setCenariosOpen}>
            <Card className="p-5">
              <CollapsibleTrigger className="flex items-center justify-between w-full">
                <h3 className="text-sm font-semibold">Cenários</h3>
                <ChevronDown className={cn("h-4 w-4 transition-transform", cenariosOpen && "rotate-180")} />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-muted-foreground">
                    Use cenários quando o cliente deve escolher entre opções mutuamente exclusivas (ex: Subsidiária vs Filial). Itens sem cenário serão somados em todos.
                  </p>
                  <Button variant="outline" size="sm" className="shrink-0 ml-2" onClick={() => {
                    setForm(f => ({
                      ...f,
                      cenarios: [...f.cenarios, {
                        id: crypto.randomUUID(),
                        nome: `Opção ${String.fromCharCode(65 + f.cenarios.length)}`,
                        descricao: '',
                        ordem: f.cenarios.length + 1,
                      }],
                    }));
                  }}>
                    <Plus className="h-4 w-4 mr-1" /> Adicionar Cenário
                  </Button>
                </div>
                {form.cenarios.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">Nenhum cenário criado — todos os itens serão somados juntos.</p>
                )}
                <div className="space-y-2">
                  {form.cenarios.map((cen, idx) => (
                    <div key={cen.id} className="flex items-start gap-2 p-3 rounded-lg border">
                      <Badge variant="outline" className="mt-1 shrink-0 font-bold">{String.fromCharCode(65 + idx)}</Badge>
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <Input
                          value={cen.nome}
                          onChange={e => {
                            const updated = [...form.cenarios];
                            updated[idx] = { ...updated[idx], nome: e.target.value };
                            setForm(f => ({ ...f, cenarios: updated }));
                          }}
                          placeholder="Nome do cenário (ex: Opção A — Subsidiária)"
                          className="text-sm font-medium"
                        />
                        <Input
                          value={cen.descricao || ''}
                          onChange={e => {
                            const updated = [...form.cenarios];
                            updated[idx] = { ...updated[idx], descricao: e.target.value };
                            setForm(f => ({ ...f, cenarios: updated }));
                          }}
                          placeholder="Descrição curta (ex: Ágil e econômica)"
                          className="text-sm"
                        />
                      </div>
                      <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => {
                        const cenId = cen.id;
                        setForm(f => ({
                          ...f,
                          cenarios: f.cenarios.filter((_, i) => i !== idx).map((c, i) => ({ ...c, ordem: i + 1 })),
                          itens: f.itens.map(item => item.cenarioId === cenId ? { ...item, cenarioId: undefined } : item),
                        }));
                      }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* SEÇÃO 6: Itens da Proposta */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Itens da Proposta</h3>
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar Item
              </Button>
            </div>

            <div className="space-y-3">
              {form.itens.map((item, idx) => (
                <div key={item.id} className="space-y-2">
                  {isDetalhado ? (
                    <ItemCardDetalhado
                      item={item}
                      idx={idx}
                      secoes={form.secoes}
                      modoContador={modoPDF === 'contador'}
                      onChange={updateItem}
                      onRemove={removeItem}
                      onAddSecao={handleAddSecao}
                    />
                  ) : (
                    <ItemCardSimples
                      item={item}
                      idx={idx}
                      onChange={updateItem}
                      onRemove={removeItem}
                    />
                  )}

                  {/* Valor de venda editável — modo direto */}
                  {form.destinatario === 'cliente_direto' && (
                    <div className="pl-2 space-y-1">
                      <div className="flex items-center gap-3">
                        <div className="w-44">
                          <Label className="text-xs text-emerald-700 font-medium">Valor de venda R$</Label>
                          <Input
                            type="number"
                            value={item.valorVendaDireto ?? (item.valor_mercado || item.honorario_minimo_contador || item.honorario || '')}
                            onChange={e => updateItem(idx, 'valorVendaDireto', parseFloat(e.target.value) || 0)}
                            placeholder="0,00"
                            className="text-right"
                          />
                        </div>
                        {(item.valor_mercado || item.honorario_minimo_contador) ? (
                          <p className="text-xs text-muted-foreground mt-5">
                            Sugestão: {fmt(item.valor_mercado || item.honorario_minimo_contador || 0)} (mercado)
                          </p>
                        ) : null}
                      </div>
                      {item.honorario > 0 && (() => {
                        const venda = item.valorVendaDireto ?? (item.valor_mercado || item.honorario_minimo_contador || item.honorario);
                        const margem = venda - item.honorario;
                        const pct = Math.round((margem / item.honorario) * 100);
                        return (
                          <p className="text-xs text-emerald-600 font-medium">
                            Sua margem: {fmt(margem)} ({pct}%)
                          </p>
                        );
                      })()}
                    </div>
                  )}

                  {/* Toggle Obrigatório/Opcional */}
                  <div className="flex items-center gap-2 pl-2">
                    <Switch
                      checked={item.isOptional || false}
                      onCheckedChange={(checked) => updateItem(idx, 'isOptional', checked)}
                      className="scale-75"
                    />
                    <span className={cn("text-xs", item.isOptional ? "text-amber-600 font-medium" : "text-muted-foreground")}>
                      {item.isOptional ? 'Opcional' : 'Obrigatório'}
                    </span>
                  </div>

                  {/* Cenário selector (only if cenários exist) */}
                  {form.cenarios.length > 0 && (
                    <div className="flex items-center gap-2 pl-2">
                      <Label className="text-xs text-muted-foreground whitespace-nowrap">Cenário:</Label>
                      <Select
                        value={item.cenarioId || '_none'}
                        onValueChange={(v) => updateItem(idx, 'cenarioId', v === '_none' ? undefined : v)}
                      >
                        <SelectTrigger className="h-8 text-xs w-48">
                          <SelectValue placeholder="Sem cenário" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">Sem cenário (avulso)</SelectItem>
                          {form.cenarios.map((cen, ci) => (
                            <SelectItem key={cen.id} value={cen.id}>
                              {String.fromCharCode(65 + ci)} — {cen.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              ))}

              {form.itens.length === 0 && (
                <div className="text-center py-8 border-2 border-dashed rounded-lg text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Adicione o primeiro item da proposta</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={addItem}>
                    <Plus className="h-4 w-4 mr-1" /> Adicionar Item
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {/* SEÇÃO 7: Fluxo de Execução (colapsável) */}
          <Collapsible open={fluxoOpen} onOpenChange={setFluxoOpen}>
            <Card className="p-5">
              <CollapsibleTrigger className="flex items-center justify-between w-full">
                <h3 className="text-sm font-semibold">Fluxo de Execução</h3>
                <ChevronDown className={cn("h-4 w-4 transition-transform", fluxoOpen && "rotate-180")} />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <p className="text-[10px] text-muted-foreground mb-2">Deixe vazio se não quiser incluir o fluxo visual no PDF.</p>
                <div className="space-y-2">
                  {form.etapas_fluxo.map((etapa, idx) => (
                    <div key={etapa.id} className="flex items-start gap-2">
                      <span className="flex items-center justify-center h-9 w-9 shrink-0 rounded-full bg-primary/10 text-primary text-xs font-bold">
                        {idx + 1}
                      </span>
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <Input
                          value={etapa.nome}
                          onChange={e => {
                            const updated = [...form.etapas_fluxo];
                            updated[idx] = { ...updated[idx], nome: e.target.value, ordem: idx + 1 };
                            setForm(f => ({ ...f, etapas_fluxo: updated }));
                          }}
                          placeholder="Nome (ex: Licença Bombeiros)"
                          className="text-sm"
                        />
                        <Input
                          value={etapa.prazo || ''}
                          onChange={e => {
                            const updated = [...form.etapas_fluxo];
                            updated[idx] = { ...updated[idx], prazo: e.target.value };
                            setForm(f => ({ ...f, etapas_fluxo: updated }));
                          }}
                          placeholder="Prazo (ex: 15-45 dias)"
                          className="text-sm"
                        />
                      </div>
                      <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => {
                        setForm(f => ({
                          ...f,
                          etapas_fluxo: f.etapas_fluxo
                            .filter((_, i) => i !== idx)
                            .map((et, i) => ({ ...et, ordem: i + 1 })),
                        }));
                      }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="mt-2 gap-1" onClick={() => {
                  setForm(f => ({
                    ...f,
                    etapas_fluxo: [...f.etapas_fluxo, { id: crypto.randomUUID(), nome: '', prazo: '', ordem: f.etapas_fluxo.length + 1 }],
                  }));
                }}>
                  <Plus className="h-3 w-3" /> Adicionar etapa
                </Button>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* SEÇÃO 8: Riscos (colapsável) */}
          <Collapsible open={riscosOpen} onOpenChange={setRiscosOpen}>
            <Card className="p-5">
              <CollapsibleTrigger className="flex items-center justify-between w-full">
                <h3 className="text-sm font-semibold">Riscos da Operação</h3>
                <ChevronDown className={cn("h-4 w-4 transition-transform", riscosOpen && "rotate-180")} />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <p className="text-[10px] text-muted-foreground mb-2">Deixe vazio se não houver riscos aplicáveis. Se vazio, o box de riscos NÃO aparecerá no PDF.</p>
                <div className="space-y-2">
                  {form.riscos.map((risco, idx) => (
                    <div key={risco.id} className="flex items-start gap-2">
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <Input
                          value={risco.penalidade}
                          onChange={e => {
                            const updated = [...form.riscos];
                            updated[idx] = { ...updated[idx], penalidade: e.target.value };
                            setForm(f => ({ ...f, riscos: updated }));
                          }}
                          placeholder="Penalidade (ex: Multa por autuação)"
                          className="text-sm"
                        />
                        <Input
                          value={risco.condicao || ''}
                          onChange={e => {
                            const updated = [...form.riscos];
                            updated[idx] = { ...updated[idx], condicao: e.target.value };
                            setForm(f => ({ ...f, riscos: updated }));
                          }}
                          placeholder="Condição (ex: Até R$ 50.000)"
                          className="text-sm"
                        />
                      </div>
                      <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => {
                        setForm(f => ({ ...f, riscos: f.riscos.filter((_, i) => i !== idx) }));
                      }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="mt-2 gap-1" onClick={() => {
                  setForm(f => ({ ...f, riscos: [...f.riscos, { id: crypto.randomUUID(), penalidade: '', condicao: '' }] }));
                }}>
                  <Plus className="h-3 w-3" /> Adicionar risco
                </Button>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* SEÇÃO 9: Benefícios (colapsável) */}
          <Collapsible open={beneficiosOpen} onOpenChange={setBeneficiosOpen}>
            <Card className="p-5">
              <CollapsibleTrigger className="flex items-center justify-between w-full">
                <h3 className="text-sm font-semibold">Benefícios da Capa</h3>
                <ChevronDown className={cn("h-4 w-4 transition-transform", beneficiosOpen && "rotate-180")} />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <p className="text-[10px] text-muted-foreground mb-2">Até 3 benefícios que aparecem na capa do PDF. Deixe vazio para não exibir.</p>
                <div className="space-y-2">
                  {form.beneficios_capa.map((ben, idx) => (
                    <div key={ben.id} className="flex items-start gap-2">
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <Input
                          value={ben.titulo}
                          onChange={e => {
                            const updated = [...form.beneficios_capa];
                            updated[idx] = { ...updated[idx], titulo: e.target.value };
                            setForm(f => ({ ...f, beneficios_capa: updated }));
                          }}
                          placeholder="Título (ex: Operação sem riscos)"
                          maxLength={30}
                          className="text-sm"
                        />
                        <Input
                          value={ben.descricao}
                          onChange={e => {
                            const updated = [...form.beneficios_capa];
                            updated[idx] = { ...updated[idx], descricao: e.target.value };
                            setForm(f => ({ ...f, beneficios_capa: updated }));
                          }}
                          placeholder="Descrição (ex: Elimina risco de multas)"
                          maxLength={80}
                          className="text-sm"
                        />
                      </div>
                      <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => {
                        setForm(f => ({ ...f, beneficios_capa: f.beneficios_capa.filter((_, i) => i !== idx) }));
                      }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 gap-1"
                  disabled={form.beneficios_capa.length >= 3}
                  onClick={() => {
                    setForm(f => ({ ...f, beneficios_capa: [...f.beneficios_capa, { id: crypto.randomUUID(), titulo: '', descricao: '' }] }));
                  }}
                >
                  <Plus className="h-3 w-3" /> Adicionar benefício {form.beneficios_capa.length >= 3 && '(máx 3)'}
                </Button>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* SEÇÃO 10: Pacotes (colapsável) */}
          <Collapsible open={pacotesOpen} onOpenChange={setPacotesOpen}>
            <Card className="p-5">
              <CollapsibleTrigger className="flex items-center justify-between w-full">
                <h3 className="text-sm font-semibold">Pacotes</h3>
                <ChevronDown className={cn("h-4 w-4 transition-transform", pacotesOpen && "rotate-180")} />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <PacotesEditor
                  pacotes={form.pacotes}
                  itens={form.itens}
                  onChange={pacotes => setForm(f => ({ ...f, pacotes }))}
                />
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* SEÇÃO 11: Condições */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-3">Condições</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Validade (dias)</Label>
                  <Input type="number" value={form.validade_dias} onChange={e => setForm(f => ({ ...f, validade_dias: parseInt(e.target.value) || 15 }))} />
                </div>
                <div>
                  <Label className="text-xs">Desconto geral (%)</Label>
                  <Input type="number" value={form.desconto_pct || ''} onChange={e => setForm(f => ({ ...f, desconto_pct: parseFloat(e.target.value) || 0 }))} min={0} max={100} />
                </div>
                <div>
                  <Label className="text-xs">Prazo de execução</Label>
                  <Input value={form.prazo_execucao} onChange={e => setForm(f => ({ ...f, prazo_execucao: e.target.value }))} placeholder="Ex: 15 dias úteis" />
                </div>
              </div>
              {form.destinatario === 'contador' && (
                <div>
                  <Label className="text-xs">Senha do link (proteção para o contador)</Label>
                  <Input 
                    value={(form as any).senha_link || ''} 
                    onChange={e => setForm(f => ({ ...f, senha_link: e.target.value }))} 
                    placeholder="Ex: fato2026 (deixe vazio para link sem senha)"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    O contador precisará digitar esta senha para acessar a proposta pelo link.
                  </p>
                </div>
              )}
              <div>
                <Label className="text-xs">Condições de pagamento</Label>
                <RichTextEditor
                  value={form.pagamento}
                  onChange={(html) => setForm(f => ({ ...f, pagamento: html }))}
                  placeholder="Ex: Pagamento à vista via PIX ou boleto bancário."
                  minHeight="80px"
                />
              </div>
              <div>
                <Label className="text-xs">Observações</Label>
                <RichTextEditor
                  value={form.observacoes}
                  onChange={(html) => setForm(f => ({ ...f, observacoes: html }))}
                  placeholder="Taxas governamentais não inclusas, documentação necessária, etc."
                  minHeight="80px"
                />
              </div>
            </div>
          </Card>

          {/* SEÇÃO 8: Formato do PDF */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-3">Formato de apresentação</h3>
            <RadioGroup
              value={form.modo}
              onValueChange={(v: OrcamentoModo) => setForm(f => ({ ...f, modo: v }))}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="simples" id="modo-simples" />
                <Label htmlFor="modo-simples" className="text-sm cursor-pointer">
                  Simples <span className="text-xs text-muted-foreground">— Lista de serviços com total</span>
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="detalhado" id="modo-detalhado" />
                <Label htmlFor="modo-detalhado" className="text-sm cursor-pointer">
                  Detalhado <span className="text-xs text-muted-foreground">— Cards completos com prazo, documentos e detalhes</span>
                </Label>
              </div>
            </RadioGroup>
          </Card>
        </div>

        {/* RIGHT: Preview (40%) */}
        <div className="lg:col-span-2">
          <div className="sticky top-20 space-y-4">
            {/* Destinatário indicator */}
            <div className="flex items-center gap-2">
              <Badge variant={modoPDF === 'contador' ? 'default' : 'secondary'} className="text-xs">
                {destinatarioLabels[form.destinatario].emoji} {destinatarioLabels[form.destinatario].label}
              </Badge>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">{isDetalhado ? 'Detalhado' : 'Simples'}</span>
            </div>

            <Card className="overflow-hidden">
              {isDetalhado ? (
                <PreviewDetalhado
                  prospect_nome={form.prospect_nome}
                  prospect_cnpj={form.prospect_cnpj}
                  itens={form.itens}
                  pacotes={form.pacotes}
                  secoes={form.secoes}
                  modoContador={modoPDF === 'contador'}
                  desconto_pct={form.desconto_pct}
                  validade_dias={form.validade_dias}
                  pagamento={form.pagamento}
                />
              ) : previewSimples}
            </Card>

            {/* Action Buttons */}
            <div className="space-y-2">
              <Button
                onClick={handleGerarPDF}
                disabled={gerando}
                className={cn(
                  "w-full gap-2",
                  modoPDF === 'contador' ? 'bg-emerald-600 hover:bg-emerald-700' :
                  modoPDF === 'direto' ? 'bg-emerald-600 hover:bg-emerald-700' :
                  'bg-blue-600 hover:bg-blue-700'
                )}
                size="lg"
              >
                {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                {gerando ? 'Gerando...' : `Gerar PDF ${destinatarioLabels[form.destinatario].emoji} ${destinatarioLabels[form.destinatario].label}`}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => handleSave('rascunho')} disabled={saveMutation.isPending} className="gap-1">
                  <Save className="h-4 w-4" /> Salvar
                </Button>
                <Button variant="outline" onClick={handleDuplicate} className="gap-1">
                  <Copy className="h-4 w-4" /> Duplicar
                </Button>
              </div>
            </div>

            {/* Quick edit hint */}
            {pdfs && pdfs.some(p => p.modo === 'cliente' && p.status === 'ativo') && (
              <div className="p-3 rounded-lg border border-blue-500/20 bg-blue-500/5">
                <p className="text-xs text-blue-400 font-medium">
                  💡 Para atualizar valores do cliente: edite os campos "Sugestão Mínima" nos itens acima e gere nova versão.
                </p>
              </div>
            )}

            {/* PDF History */}
            {pdfs && pdfs.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Propostas Geradas
                </h4>
                <div className="space-y-2">
                  {pdfs.map(pdf => (
                    <div
                      key={pdf.id}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-lg border text-sm',
                        pdf.status === 'cancelado' ? 'opacity-50 bg-muted/30' : 'bg-card'
                      )}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={pdf.modo === 'contador' ? 'default' : 'secondary'} className="text-[10px]">
                          {pdf.modo === 'contador' ? '📊 Interno' : pdf.modo === 'direto' ? '🍀 Direto' : '📄 Cliente'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          v{pdf.versao} · {new Date(pdf.gerado_em).toLocaleDateString('pt-BR')} {new Date(pdf.gerado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {pdf.status === 'cancelado' && pdf.cancelado_em && (
                          <Badge variant="destructive" className="text-[9px]">
                            Cancelado em {new Date(pdf.cancelado_em).toLocaleDateString('pt-BR')}
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={async () => {
                          const { data, error } = await supabase.storage
                            .from('documentos')
                            .createSignedUrl(pdf.storage_path, 3600);
                          if (error || !data?.signedUrl) {
                            toast.error('Erro ao abrir PDF');
                            return;
                          }
                          window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
                        }}>
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={async () => {
                          const { data, error } = await supabase.storage
                            .from('documentos')
                            .createSignedUrl(pdf.storage_path, 3600);
                          if (error || !data?.signedUrl) {
                            toast.error('Erro ao gerar link');
                            return;
                          }
                          await navigator.clipboard.writeText(data.signedUrl);
                          toast.success('Link copiado! (válido por 1h)');
                        }}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
