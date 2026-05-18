import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSaveOrcamento, type Orcamento } from '@/hooks/useOrcamentos';
import { gerarOrcamentoPDF, sanitizeFilename, downloadBlob } from '@/lib/orcamento-pdf';
import { useOrcamentoPDFs } from '@/hooks/useOrcamentoPDFs';
import { Button } from '@/components/ui/button';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, FileText, Save, Copy, Loader2, ChevronDown,
  Link as LinkIcon, CheckCircle2, XCircle, Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import {
  type OrcamentoForm, type OrcamentoModo, type OrcamentoItem, type OrcamentoPDFMode,
  type OrcamentoDestinatario,
  DEFAULT_SECOES, createItem, normalizeItem, getItemValor,
} from '@/components/orcamentos/types';
import { ItemCardRedesign } from '@/components/orcamentos/ItemCardRedesign';
import { PacotesEditor } from '@/components/orcamentos/PacotesEditor';
import '@/styles/orcamento-redesign.css';

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
  // ordem_execucao removido em Sprint 2.A.2 — campo paralelo a `contexto`
  // que nunca tinha input no form. PDF e PropostaPublica continuam lendo
  // dados legados se houver (fallback vazio).
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
  // Sprint autônoma 13/05 noite: status + share_token agora live na tela
  // pra eliminar fluxo de 3 telas. Carregado em edit/duplicate, atualizado
  // ao salvar, exibido em badge + dropdown de mudança direta.
  const [orcamentoStatus, setOrcamentoStatus] = useState<string>('rascunho');
  const [shareToken, setShareToken] = useState<string | null>(null);
  // Resposta do cliente — populada quando cliente aprovou via link público.
  // itens_selecionados é o que o cliente marcou (subset dos itens propostos);
  // se vazio/null, painel não renderiza. Usado pra mostrar visualmente o que
  // foi aprovado vs descartado e o estado da cobrança gerada.
  const [respostaCliente, setRespostaCliente] = useState<{
    itens_selecionados: Array<{ id: string; descricao: string; valor_contador: number }> | null;
    aprovado_em: string | null;
    pago_em: string | null;
    valor_aprovado: number;
    cobranca_pago_em: string | null;
    cobranca_status: string | null;
    asaas_status: string | null;
    cobranca_share_token: string | null;
  } | null>(null);
  const [pacotesOpen, setPacotesOpen] = useState(false);
  // PRINT 02 #4a: id do item recém-adicionado pra dar highlight temporário
  const [novoItemId, setNovoItemId] = useState<string | null>(null);
  // Trevo → Cliente Final: pergunta se contador é o cliente final (null=não respondeu)
  const [contadorEhClienteFinal, setContadorEhClienteFinal] = useState<boolean | null>(null);
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
    // CODE-004 (17/05/2026): staleTime 5min — lista de clientes muda pouco,
    // refetch a cada remount era desperdício (OrcamentoNovo remonta toda vez
    // que abre/edita orçamento).
    staleTime: 5 * 60 * 1000,
  });

  // Load existing orcamento if editing
  useEffect(() => {
    if (!editId) return;
    (async () => {
      const { data } = await supabase.from('orcamentos').select('*').eq('id', editId).single();
      if (!data) return;
      const orc = data as unknown as Orcamento & { contexto?: string; pacotes?: any; secoes?: any; destinatario?: string };
      setOrcamentoNumero(orc.numero);
      setOrcamentoStatus(orc.status || 'rascunho');
      setShareToken(orc.share_token || null);

      // Carrega resposta do cliente se já aprovou. Sprint 2.A.4 popula
      // orcamentos.itens_selecionados quando cliente confirma na proposta pública.
      const itensSelecionados = Array.isArray((orc as any).itens_selecionados)
        ? (orc as any).itens_selecionados as Array<{ id: string; descricao: string; valor_contador: number }>
        : null;
      if (itensSelecionados && itensSelecionados.length > 0) {
        const valorAprovado = itensSelecionados.reduce((s, i) => s + Number(i.valor_contador || 0), 0);
        // Busca cobranca pra mostrar estado de pagamento
        let cobrancaInfo: { share_token: string | null; status: string | null; asaas_pago_em: string | null; asaas_status: string | null } = {
          share_token: null, status: null, asaas_pago_em: null, asaas_status: null,
        };
        if ((orc as any).lancamento_id) {
          const { data: cb } = await supabase
            .from('cobrancas')
            .select('share_token, status, asaas_pago_em, asaas_status')
            .contains('lancamento_ids', [(orc as any).lancamento_id])
            .maybeSingle();
          if (cb) cobrancaInfo = cb as any;
        }
        setRespostaCliente({
          itens_selecionados: itensSelecionados,
          aprovado_em: (orc as any).aprovado_em || null,
          pago_em: (orc as any).pago_em || null,
          valor_aprovado: valorAprovado,
          cobranca_pago_em: cobrancaInfo.asaas_pago_em,
          cobranca_status: cobrancaInfo.status,
          asaas_status: cobrancaInfo.asaas_status,
          cobranca_share_token: cobrancaInfo.share_token,
        });
      } else {
        setRespostaCliente(null);
      }

      let itens: OrcamentoItem[] = [];
      try {
        const raw = orc.servicos as any;
        if (Array.isArray(raw) && raw.length > 0) {
          itens = raw.map(normalizeItem);
        }
      } catch { /* ignore */ }

      const hasDetailedData = itens.some(i => i.taxa_min > 0 || i.taxa_max > 0 || i.prazo || i.docs_necessarios);
      const hasContexto = !!(orc as any).contexto;
      // Modo "Detalhado" removido em 14/05/2026 — sempre simples ate v2 do PDF
      const modo: OrcamentoModo = 'simples';
      void hasDetailedData; void hasContexto;

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
      // Modo "Detalhado" removido em 14/05/2026 — sempre simples ate v2 do PDF
      const modo: OrcamentoModo = 'simples';
      void hasDetailedData;
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
    // PRINT 02 #4a (14/05/2026): novo item entra no TOPO da lista + scroll suave
    // pra ficar visível + animação fade-in via highlight temporário.
    // Antes: item entrava no fim sem feedback algum.
    const novoItem = createItem({ ordem: 0 });
    setForm(f => ({
      ...f,
      itens: [novoItem, ...f.itens.map((it, i) => ({ ...it, ordem: i + 1 }))],
    }));
    // Highlight visual: scroll suave pro topo da lista + flash sutil
    setNovoItemId(novoItem.id);
    setTimeout(() => {
      const el = document.getElementById(`item-${novoItem.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Foca o primeiro input de descrição
        const input = el.querySelector<HTMLInputElement>('input[type="text"], input:not([type])');
        if (input) setTimeout(() => input.focus(), 400);
      }
    }, 50);
    // Remove highlight depois de 1.5s
    setTimeout(() => setNovoItemId(null), 1500);
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
    setForm(f => {
      // No header do escritorio mostra apelido se houver (mais curto, fica bonito).
      const escritorioNome = c.apelido || c.nome;
      // No fluxo "Trevo→Cliente Final + contador é o próprio cliente", o card
      // "Empresa a ser regularizada" é escondido — usamos os dados do contador.
      // BUG 18/05: prospect_nome deve usar NOME COMPLETO (não apelido) pra
      // aparecer formal na proposta pública. Apelido fica só no header do admin.
      const ehFluxoContadorClienteFinal = f.destinatario === 'cliente_direto' && contadorEhClienteFinal === true;
      const prospectNomeCompleto = c.nome || c.apelido;
      return {
        ...f,
        cliente_id: c.id,
        escritorio_nome: escritorioNome,
        escritorio_cnpj: c.cnpj || '',
        escritorio_email: c.email || '',
        escritorio_telefone: c.telefone || '',
        prospect_nome: ehFluxoContadorClienteFinal ? prospectNomeCompleto : f.prospect_nome,
        prospect_cnpj: ehFluxoContadorClienteFinal ? (c.cnpj || '') : f.prospect_cnpj,
        prospect_email: ehFluxoContadorClienteFinal ? (c.email || '') : f.prospect_email,
        prospect_telefone: ehFluxoContadorClienteFinal ? (c.telefone || '') : f.prospect_telefone,
      };
    });
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
      pacotes: form.pacotes as any,
      secoes: form.secoes as any,
      riscos: form.riscos as any,
      etapas_fluxo: form.etapas_fluxo as any,
      beneficios_capa: form.beneficios_capa as any,
      headline_cenario: form.headline_cenario || null,
      cenarios: form.cenarios as any,
      senha_link: (form as any).senha_link || null,
      status,
      // Agent 1 BUG-002 (18/05): NÃO passar created_by — trigger SQL preenche
      // com auth.uid() automaticamente. Antes passava null explícito, mas
      // trigger só dispara se NEW.created_by IS NULL — ok mas inútil. Remove.
      pdf_url: null,
    };
  }

  async function handleSave(status: string = 'rascunho') {
    const ehFluxoContadorClienteFinal = form.destinatario === 'cliente_direto' && contadorEhClienteFinal === true;
    if (!form.prospect_nome?.trim() && !ehFluxoContadorClienteFinal) {
      toast.error('Informe o nome da empresa a regularizar');
      return;
    }
    if (ehFluxoContadorClienteFinal && !form.cliente_id) {
      toast.error('Selecione o contador');
      return;
    }
    // UX-140 (17/05/2026): "Salvar e Enviar" sem itens criava proposta vazia
    // que cliente abria e via 0 serviços. Rascunho pode salvar incompleto, mas
    // status `enviado`+ exige pelo menos 1 item.
    if (status !== 'rascunho') {
      const itensValidos = form.itens.filter(i => i.descricao.trim());
      if (itensValidos.length === 0) {
        toast.error('Adicione pelo menos um item antes de enviar');
        return;
      }
    }
    try {
      const payload: any = buildPayload(status);
      if (orcamentoId) payload.id = orcamentoId;
      const id = await saveMutation.mutateAsync(payload);
      setOrcamentoId(id);
      setOrcamentoStatus(status);
      // Agent 1 BUG-001 (18/05): buscar `numero` ao criar novo orçamento
      // (antes ficava 0 → "ORC-0000" no header + PDF). Editar já carregava
      // certo. Combinado com share_token numa query só.
      if (!shareToken || !orcamentoNumero) {
        const { data } = await supabase.from('orcamentos').select('share_token, numero').eq('id', id).single();
        if (data?.share_token) setShareToken(data.share_token);
        if ((data as any)?.numero) setOrcamentoNumero((data as any).numero);
      }
      const msg: Record<string, string> = {
        rascunho: 'Rascunho salvo!',
        enviado: 'Proposta enviada! Link público pronto.',
        aprovado: 'Marcado como aprovado.',
        aguardando_pagamento: 'Marcado como aguardando pagamento.',
        recusado: 'Marcado como recusado.',
      };
      toast.success(msg[status] || 'Salvo!');
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err.message || ''));
    }
  }

  // Sprint autônoma 13/05 noite: muda status SEM passar pelo flow de buildPayload
  // (que reescreve tudo). Útil pra transições rápidas (rascunho→enviado, etc).
  async function handleChangeStatus(novoStatus: string) {
    if (!orcamentoId) {
      toast.error('Salve o orçamento antes de mudar status.');
      return;
    }
    // Bloqueia mudancas manuais pra status que requerem dados associados
    // (fluxo aprovacao publica cria processo+lancamento+cobranca atomicamente)
    if (novoStatus === 'aguardando_pagamento' || novoStatus === 'convertido') {
      toast.error(`Status "${novoStatus}" só pode ser atingido pelo fluxo do cliente aprovando o link público — não pode ser definido manualmente.`);
      return;
    }
    try {
      const { error } = await supabase
        .from('orcamentos')
        .update({ status: novoStatus, updated_at: new Date().toISOString() } as any)
        .eq('id', orcamentoId);
      if (error) throw error;
      setOrcamentoStatus(novoStatus);
      const labels: Record<string, string> = {
        rascunho: '✏️ Rascunho',
        enviado: '📤 Enviado',
        aprovado: '✅ Aprovado',
        aguardando_pagamento: '⏳ Aguardando Pagamento',
        recusado: '❌ Recusado',
        convertido: '🎉 Convertido',
      };
      toast.success(`Status alterado: ${labels[novoStatus] || novoStatus}`);
    } catch (err: any) {
      toast.error('Erro ao mudar status: ' + (err.message || ''));
    }
  }

  function buildPDFParams(modo?: OrcamentoPDFMode) {
    let itensValidos = form.itens.filter(i => i.descricao.trim());
    // Quando orçamento foi aprovado/pago, filtra pelos itens marcados pelo cliente
    // pra não emitir PDF com valor cheio depois que cliente desmarcou opcionais.
    const idsAprovados = respostaCliente?.itens_selecionados
      ? new Set(respostaCliente.itens_selecionados.map(i => i.id))
      : null;
    const filtraSelecionados = idsAprovados && ['aguardando_pagamento', 'convertido'].includes(orcamentoStatus);
    if (filtraSelecionados) {
      itensValidos = itensValidos.filter(i => idsAprovados!.has(i.id));
    }
    // Recalcula totals com itens filtrados pra refletir o valor aprovado real
    const subForPDF = filtraSelecionados
      ? itensValidos.reduce((s, i) => s + getItemValor(i) * i.quantidade, 0)
      : subtotal;
    const totalForPDF = filtraSelecionados
      ? subForPDF - subForPDF * (form.desconto_pct / 100)
      : totalFinal;
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
      desconto_pct: form.desconto_pct,
      subtotal: subForPDF,
      total: totalForPDF,
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
      is_convertido: orcamentoStatus === 'convertido',
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
    const ehFluxoContadorClienteFinal = form.destinatario === 'cliente_direto' && contadorEhClienteFinal === true;
    if (!form.prospect_nome?.trim() && !ehFluxoContadorClienteFinal) throw new Error('Informe o nome da empresa');
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
    const ehFluxoContadorClienteFinal = form.destinatario === 'cliente_direto' && contadorEhClienteFinal === true;
    if (!form.prospect_nome.trim() && !ehFluxoContadorClienteFinal) { toast.error('Preencha o nome da empresa'); return; }
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

  async function handleCopyLink() {
    if (!shareToken) {
      toast.error('Salve o orçamento primeiro para gerar o link.');
      return;
    }
    // UX-143 (17/05/2026): antes só era warning — user copiava, mandava no
    // WhatsApp, cliente abria e via 404. Agora bloqueia copy e força clicar
    // "Salvar e Enviar" primeiro.
    if (orcamentoStatus === 'rascunho') {
      toast.error('Orçamento ainda é RASCUNHO. Clica "Salvar e Enviar" antes de compartilhar o link (senão cliente vê 404).', { duration: 8000 });
      return;
    }
    const url = `https://app.trevolegaliza.com/proposta/${shareToken}`;
    await navigator.clipboard.writeText(url);

    if (form.destinatario === 'contador' && (form as any).senha_link) {
      toast.success(`Link copiado! Senha: ${(form as any).senha_link}`);
    } else if (form.destinatario === 'contador') {
      toast.success('Link copiado! ⚠️ Sem senha definida.');
    } else {
      toast.success('Link copiado!');
    }
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

  // Redesign 14/05/2026 — markup do design system Trevo (orcamento-redesign.css)
  const showWhitelabel = form.destinatario === 'cliente_via_contador';
  const showAdvancedPricingByDefault = form.destinatario === 'contador';
  const hideAdvancedPricing = form.destinatario === 'cliente_direto';
  const totalObrigatorio = form.itens
    .filter((i) => !i.isOptional)
    .reduce((s, i) => s + getItemValor(i) * (i.quantidade || 1), 0);
  const totalOpcional = totalFinal - totalObrigatorio;
  const statusLabel: Record<string, string> = {
    rascunho: '✏️ Rascunho',
    enviado: '📤 Enviado',
    aprovado: '✅ Aprovado',
    aguardando_pagamento: '⏳ Aguardando Pagamento',
    convertido: '🎉 Convertido',
    recusado: '❌ Recusado',
  };

  return (
    <div className="on-shell" data-screen-label="Editar Proposta">
      {/* ─── Header ───────────────────────────────────────── */}
      <header className="on-head">
        <div className="on-head-left">
          <div className="on-head-accent" />
          <div>
            <h1>{editId ? 'Editar Proposta' : 'Nova Proposta Comercial'}</h1>
            <p className="sub">Preencha os dados e gere um PDF profissional em minutos.</p>
            {orcamentoId && (
              <div className="on-id">
                <span style={{ opacity: 0.7 }}>#</span>
                <b>ORC-{String(orcamentoNumero).padStart(4, '0')}</b>
                <span style={{ color: 'var(--fg-4)' }}>·</span>
                <span>ID {orcamentoId.slice(0, 8)}</span>
              </div>
            )}
          </div>
        </div>
        <div className="on-head-actions">
          {orcamentoId && (
            <div className="on-status-pill">
              <span className="dot" /> <span className="lbl">Status:</span> {statusLabel[orcamentoStatus] || orcamentoStatus}
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => handleSave('rascunho')} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-1" /> Salvar Rascunho
          </Button>
          {(orcamentoStatus === 'rascunho' || !orcamentoId) && (
            <Button size="sm" onClick={() => handleSave('enviado')} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4 mr-1" /> Salvar e Enviar
            </Button>
          )}
          {orcamentoId && orcamentoStatus !== 'rascunho' && orcamentoStatus !== 'convertido' && (
            <Select value="" onValueChange={(v) => v && handleChangeStatus(v)}>
              <SelectTrigger className="h-9 w-44 text-xs">
                <SelectValue placeholder="Mudar status →" />
              </SelectTrigger>
              <SelectContent>
                {orcamentoStatus !== 'rascunho' && <SelectItem value="rascunho">✏️ Voltar pra Rascunho</SelectItem>}
                {orcamentoStatus !== 'enviado' && <SelectItem value="enviado">📤 Marcar como Enviado</SelectItem>}
                {orcamentoStatus !== 'aprovado' && <SelectItem value="aprovado">✅ Marcar Aprovado</SelectItem>}
                {orcamentoStatus !== 'recusado' && <SelectItem value="recusado">❌ Marcar Recusado</SelectItem>}
              </SelectContent>
            </Select>
          )}
          {orcamentoId && (
            <Button variant="outline" size="sm" onClick={handleDuplicate}>
              <Copy className="h-4 w-4 mr-1" /> Duplicar
            </Button>
          )}
          {shareToken && form.destinatario !== 'cliente_via_contador' && (
            <Button variant="outline" size="sm" onClick={handleCopyLink}>
              <LinkIcon className="h-4 w-4 mr-1" /> Copiar Link
            </Button>
          )}
        </div>
      </header>

      {/* ─── Resposta do cliente (so quando aprovado ou pago) ─── */}
      {respostaCliente && respostaCliente.itens_selecionados && (() => {
        const aprovados = new Set(respostaCliente.itens_selecionados.map(i => i.id));
        const valorTotal = form.itens.reduce((s, i) => s + getItemValor(i) * (i.quantidade || 1), 0);
        const valorAprovado = respostaCliente.valor_aprovado;
        const pago = orcamentoStatus === 'convertido' || respostaCliente.cobranca_status === 'paga' || respostaCliente.asaas_status === 'RECEIVED' || respostaCliente.asaas_status === 'CONFIRMED';
        const dataPago = respostaCliente.pago_em || respostaCliente.cobranca_pago_em;
        return (
          <section className="on-card on-resp" style={{ marginBottom: 16 }}>
            <div className="on-card-head">
              <div className="meta" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(34,197,94,0.18)', color: 'var(--brand-trevo)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  {pago ? <CheckCircle2 size={18} /> : <Loader2 size={18} />}
                </div>
                <div>
                  <div className="on-card-title">Resposta do cliente</div>
                  <div className="on-card-desc">
                    {pago
                      ? `Pago via Asaas em ${dataPago ? new Date(dataPago).toLocaleDateString('pt-BR') : '—'} · `
                      : respostaCliente.aprovado_em
                        ? `Aprovado em ${new Date(respostaCliente.aprovado_em).toLocaleDateString('pt-BR')} · `
                        : 'Aguardando aprovação · '}
                    <b style={{ color: 'var(--brand-trevo)' }}>{fmt(valorAprovado)}</b>
                    {' · '}
                    {respostaCliente.itens_selecionados.length} de {form.itens.length} itens aprovados
                  </div>
                </div>
              </div>
              {respostaCliente.cobranca_share_token && (
                <Button variant="outline" size="sm" onClick={() => window.open(`/cobranca/${respostaCliente.cobranca_share_token}`, '_blank')}>
                  <Eye className="h-3.5 w-3.5 mr-1" /> Ver cobrança
                </Button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {form.itens.map((item) => {
                const aprovou = aprovados.has(item.id);
                const valor = getItemValor(item) * (item.quantidade || 1);
                return (
                  <div key={item.id} className={`on-resp-line ${aprovou ? 'ok' : 'no'}`}>
                    <div className="on-flex">
                      <span className={`on-resp-icon ${aprovou ? 'ok' : 'no'}`}>
                        {aprovou ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      </span>
                      <span className="nm">{item.descricao || '(sem nome)'}</span>
                    </div>
                    <span className="on-mono" style={{ color: aprovou ? 'var(--brand-trevo)' : 'var(--fg-4)', fontWeight: 600 }}>
                      {fmt(valor)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--fg-3)', display: 'flex', justifyContent: 'space-between' }}>
              <span>{respostaCliente.itens_selecionados.length} de {form.itens.length} itens</span>
              <span style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>
                <span style={{ textDecoration: 'line-through', color: 'var(--fg-4)', marginRight: 8 }}>{fmt(valorTotal)}</span>
                <span style={{ fontWeight: 700, color: 'var(--fg-1)' }}>{fmt(valorAprovado)}</span>
              </span>
            </div>
          </section>
        );
      })()}

      {/* ─── Main split ──────────────────────────────────── */}
      <div className="on-grid">
        <div className="on-form">

          {/* Modo "Detalhado" removido em 14/05/2026 — versão do PDF detalhada
              estava com qualidade visual ruim. Roadmap: "PDF Detalhado v2".
              Por enquanto, todos os orçamentos saem como PDF simples (template
              minimalista bonito, focado na lista + total).
              `form.modo` segue sempre 'simples'. */}

          {/* ② Para quem é este orçamento? */}
          <section className="on-card">
            <div className="on-card-head">
              <div className="meta">
                <div className="on-card-step"><span className="num">02</span> Destinatário</div>
                <div className="on-card-title">Para quem é este orçamento?</div>
                <div className="on-card-desc">Define o branding do PDF, os campos visíveis e o link público.</div>
              </div>
            </div>
            <div className="on-seg on-seg-3">
              {([
                { id: 'contador' as const, ico: '📊', ttl: 'Trevo → Contador', desc: 'Painel interno com margens, custos e sugestão de precificação.' },
                { id: 'cliente_via_contador' as const, ico: '📄', ttl: 'Contador → Cliente Final', desc: 'White-label com branding do escritório contábil.' },
                { id: 'cliente_direto' as const, ico: '🍀', ttl: 'Trevo → Cliente Final', desc: 'Atendimento direto com branding Trevo Legaliza.' },
              ]).map((opt) => (
                <label key={opt.id} className={`on-seg-opt ${form.destinatario === opt.id ? 'active' : ''}`}>
                  <input type="radio" name="dest" checked={form.destinatario === opt.id} onChange={() => setForm(f => ({ ...f, destinatario: opt.id }))} style={{ display: 'none' }} />
                  <span className="ico">{opt.ico}</span>
                  <div className="body">
                    <div className="ttl">{opt.ttl}</div>
                    <div className="desc">{opt.desc}</div>
                  </div>
                  <span className="check" />
                </label>
              ))}
            </div>

            {/* Quando "Trevo → Cliente Final" → pergunta se contador é o cliente */}
            {form.destinatario === 'cliente_direto' && (
              <div className="on-reveal">
                <div className="on-reveal-q">
                  <i>O contador é o próprio cliente final?</i>
                </div>
                <div className="on-reveal-row">
                  <button
                    type="button"
                    className={`on-chip ${contadorEhClienteFinal === false ? 'active' : ''}`}
                    onClick={() => {
                      setContadorEhClienteFinal(false);
                      // Limpa dados do escritório e do prospect (auto-preenchidos no fluxo anterior)
                      setForm(f => ({
                        ...f, cliente_id: null,
                        escritorio_nome: '', escritorio_cnpj: '', escritorio_email: '', escritorio_telefone: '',
                        prospect_nome: '', prospect_cnpj: '', prospect_email: '', prospect_telefone: '',
                      }));
                    }}
                  >
                    ✕ Não, é uma empresa diferente
                  </button>
                  <button
                    type="button"
                    className={`on-chip ${contadorEhClienteFinal === true ? 'active' : ''}`}
                    onClick={() => setContadorEhClienteFinal(true)}
                  >
                    ✓ Sim, é o próprio contador
                  </button>
                  {contadorEhClienteFinal === true && (
                    <>
                      <span style={{ color: 'var(--fg-4)', fontSize: 11.5 }}>→</span>
                      <Select
                        value={form.cliente_id || ''}
                        onValueChange={(id) => handleSelectEscritorio(id)}
                      >
                        <SelectTrigger className="on-select" style={{ minWidth: 260 }}>
                          <SelectValue placeholder="Selecionar contador cadastrado..." />
                        </SelectTrigger>
                        <SelectContent>
                          {(clientes || []).map(c => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.apelido || c.nome} {c.cnpj ? `· ${c.cnpj}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  )}
                </div>
                <div className="on-hint" style={{ marginTop: 10 }}>
                  Quando o próprio contador é o cliente final, usamos os dados do escritório cadastrado em vez de pedir CNPJ/empresa de novo.
                </div>
              </div>
            )}
          </section>

          {/* Escritório contábil — oculto em cliente_direto (Trevo→Cliente Final),
              independente de "contador eh cliente final": se for "Sim", os dados
              vêm pelo selector; se "Não", não tem escritório no fluxo direto. */}
          {form.destinatario !== 'cliente_direto' && (
            <section className="on-card">
              <div className="on-card-head">
                <div className="meta">
                  <div className="on-card-step">Escritório contábil</div>
                  <div className="on-card-title">{showWhitelabel ? 'Escritório contábil (branding do PDF)' : 'Escritório contábil'}</div>
                  <div className="on-card-desc">
                    {showWhitelabel ? 'Nome, logo e contatos que aparecerão no cabeçalho do PDF white-label.' : 'Para registro interno e contato durante a tramitação.'}
                  </div>
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label className="on-label">Selecionar escritório cadastrado</label>
                <Select value={form.cliente_id || ''} onValueChange={handleSelectEscritorio}>
                  <SelectTrigger className="on-select" style={{ width: '100%' }}>
                    <SelectValue placeholder="Buscar escritório cadastrado..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(clientes || []).map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.apelido || c.nome} {c.cnpj ? `· ${c.cnpj}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="on-row">
                <div>
                  <label className="on-label">Nome do escritório *</label>
                  <input className="on-input" value={form.escritorio_nome} onChange={(e) => setForm(f => ({ ...f, escritorio_nome: e.target.value }))} placeholder="Ex: AL Assessoria" />
                </div>
                <div>
                  <label className="on-label">CNPJ</label>
                  <input className="on-input" value={form.escritorio_cnpj} onChange={(e) => setForm(f => ({ ...f, escritorio_cnpj: e.target.value }))} placeholder="00.000.000/0000-00" />
                </div>
                <div>
                  <label className="on-label">E-mail</label>
                  <input className="on-input" value={form.escritorio_email} onChange={(e) => setForm(f => ({ ...f, escritorio_email: e.target.value }))} placeholder="contato@escritorio.com" />
                </div>
                <div>
                  <label className="on-label">Telefone</label>
                  <input className="on-input" value={form.escritorio_telefone} onChange={(e) => setForm(f => ({ ...f, escritorio_telefone: e.target.value }))} placeholder="(11) 99999-9999" />
                </div>
              </div>
            </section>
          )}

          {/* Empresa a ser regularizada — escondida quando cliente_direto +
              contador é o próprio cliente (usa dados do contador selecionado) */}
          {!(form.destinatario === 'cliente_direto' && contadorEhClienteFinal === true) && (
            <section className="on-card">
              <div className="on-card-head">
                <div className="meta">
                  <div className="on-card-step">Cliente final</div>
                  <div className="on-card-title">Empresa a ser regularizada</div>
                  <div className="on-card-desc">Esta é a empresa que receberá os serviços.</div>
                </div>
              </div>
              <div className="on-row">
                <div style={{ gridColumn: 'span 2' }}>
                  <label className="on-label">Razão social *</label>
                  <input className="on-input" value={form.prospect_nome} onChange={(e) => setForm(f => ({ ...f, prospect_nome: e.target.value }))} placeholder="Ex: Clínica Mater Senior Saúde e Longevidade Ltda" />
                </div>
                <div>
                  <label className="on-label">CNPJ</label>
                  <input className="on-input" value={form.prospect_cnpj} onChange={(e) => setForm(f => ({ ...f, prospect_cnpj: e.target.value }))} placeholder="00.000.000/0000-00" />
                </div>
                <div>
                  <label className="on-label">Pessoa de contato</label>
                  <input className="on-input" value={(form as any).prospect_contato || ''} onChange={(e) => setForm(f => ({ ...f, prospect_contato: e.target.value } as any))} placeholder="Ex: Dra. Marília Andrade" />
                  <div className="on-hint">Usado nas mensagens de WhatsApp e e-mail.</div>
                </div>
                <div>
                  <label className="on-label">E-mail de contato</label>
                  <input className="on-input" value={form.prospect_email} onChange={(e) => setForm(f => ({ ...f, prospect_email: e.target.value }))} placeholder="contato@empresa.com" />
                </div>
                <div>
                  <label className="on-label">Telefone / WhatsApp</label>
                  <input className="on-input" value={form.prospect_telefone} onChange={(e) => setForm(f => ({ ...f, prospect_telefone: e.target.value }))} placeholder="(11) 99999-9999" />
                </div>
              </div>
            </section>
          )}

          {/* Contexto e apresentação */}
          <section className="on-card">
            <div className="on-card-head">
              <div className="meta">
                <div className="on-card-step">Diagnóstico</div>
                <div className="on-card-title">Contexto e apresentação</div>
                <div className="on-card-desc">Descreva a situação atual do cliente. Aparece no topo do PDF e do link público.</div>
              </div>
              <span className="on-info"><LinkIcon size={11} /> Vai no link público</span>
            </div>
            <div className="on-rt">
              <RichTextEditor
                value={form.contexto}
                onChange={(html) => setForm(f => ({ ...f, contexto: html }))}
                placeholder="Ex: Empresa sem Alvará Sanitário e sem CRM PJ. Atualmente em risco de interdição..."
                minHeight="100px"
              />
            </div>
          </section>

          {/* Itens da proposta */}
          <section className="on-card">
            <div className="on-card-head">
              <div className="meta">
                <div className="on-card-step">Catálogo</div>
                <div className="on-card-title">Itens da proposta</div>
                <div className="on-card-desc">
                  Cada item pode ser obrigatório (cliente não desmarca) ou opcional (cliente escolhe ao aprovar).
                </div>
              </div>
              <div className="on-flex" style={{ gap: 6 }}>
                <span className="on-chip">🔒 {form.itens.filter(i => !i.isOptional).length} obrigatórios</span>
                <span className="on-chip">○ {form.itens.filter(i => i.isOptional).length} opcionais</span>
              </div>
            </div>

            <div className="on-items">
              {form.itens.map((item, idx) => (
                <ItemCardRedesign
                  key={item.id}
                  item={item}
                  idx={idx}
                  isNew={novoItemId === item.id}
                  showAdvancedPricingByDefault={showAdvancedPricingByDefault}
                  hideAdvancedPricing={hideAdvancedPricing}
                  onChange={updateItem}
                  onRemove={removeItem}
                />
              ))}
            </div>

            <div className="on-add-bar" style={{ marginTop: 14 }}>
              <button type="button" className="on-add-btn" onClick={addItem}>
                <Plus size={16} /> Adicionar item
              </button>
              <div style={{ fontSize: 11, color: 'var(--fg-4)' }}>
                Novo item entra no topo da lista com destaque animado.
              </div>
            </div>

            <div className="on-totals">
              <div>
                <div className="on-totals-lbl">Total da proposta</div>
                <div className="on-totals-meta">
                  Obrigatórios: <b style={{ color: 'var(--brand-trevo)' }}>{fmt(totalObrigatorio)}</b>
                  {' · '}
                  Opcionais: <b style={{ color: 'var(--warning, #f59e0b)' }}>{fmt(totalOpcional)}</b>
                </div>
              </div>
              <div className="on-totals-val">{fmt(totalFinal)}</div>
            </div>
          </section>

          {/* Pacotes (collapsible) */}
          <section className="on-card">
            <button
              type="button"
              className={`on-collapse-btn ${pacotesOpen ? 'open' : ''}`}
              onClick={() => setPacotesOpen(v => !v)}
            >
              <div className="meta" style={{ textAlign: 'left' }}>
                <div className="on-card-step">Opcional</div>
                <div className="on-card-title">Pacotes pré-montados</div>
                <div className="on-card-desc">Agrupe itens em um pacote com desconto.</div>
              </div>
              <ChevronDown size={16} style={{ color: 'var(--fg-3)' }} />
            </button>
            {pacotesOpen && (
              <div className="on-collapse-body">
                <PacotesEditor
                  pacotes={form.pacotes}
                  itens={form.itens}
                  onChange={(pacotes) => setForm(f => ({ ...f, pacotes }))}
                />
              </div>
            )}
          </section>

          {/* Condições */}
          <section className="on-card">
            <div className="on-card-head">
              <div className="meta">
                <div className="on-card-step">Termos</div>
                <div className="on-card-title">Condições</div>
              </div>
            </div>
            <div className="on-row-3" style={{ marginBottom: 14 }}>
              <div>
                <label className="on-label">Validade (dias)</label>
                <input className="on-input" type="number" value={form.validade_dias} onChange={(e) => setForm(f => ({ ...f, validade_dias: parseInt(e.target.value) || 15 }))} />
              </div>
              <div>
                <label className="on-label">Desconto geral (%)</label>
                <input className="on-input" type="number" value={form.desconto_pct || ''} onChange={(e) => setForm(f => ({ ...f, desconto_pct: parseFloat(e.target.value) || 0 }))} placeholder="0" />
              </div>
              <div>
                <label className="on-label">Prazo de execução</label>
                <input className="on-input" value={form.prazo_execucao} onChange={(e) => setForm(f => ({ ...f, prazo_execucao: e.target.value }))} placeholder="Até 15 dias úteis após retorno" />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label className="on-label">Senha do link (proteção pro contador)</label>
              <input className="on-input" value={(form as any).senha_link || ''} onChange={(e) => setForm(f => ({ ...f, senha_link: e.target.value } as any))} placeholder="Ex: fato2026 (deixe vazio para link sem senha)" />
              <div className="on-hint">O contador precisará digitar esta senha pra acessar a proposta pelo link público.</div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label className="on-label">Condições de pagamento</label>
              <div className="on-rt">
                <RichTextEditor
                  value={form.pagamento}
                  onChange={(html) => setForm(f => ({ ...f, pagamento: html }))}
                  placeholder="Pagamento à vista via PIX ou boleto bancário."
                  minHeight="60px"
                />
              </div>
            </div>

            <div>
              <label className="on-label">Observações</label>
              <textarea className="on-textarea" value={form.observacoes} onChange={(e) => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={3} placeholder="Taxas governamentais não inclusas, documentação necessária, etc." />
            </div>
          </section>
        </div>

        {/* ─── Aside: preview + ações ──────────────────── */}
        <aside className="on-aside">
          <div className="t-label-upper" style={{ marginBottom: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--fg-3)', textTransform: 'uppercase' }}>Pré-visualização</div>
          <div className="on-prev">
            <div className="on-prev-inner">
              <div className="on-prev-brand">
                <div className="on-prev-name">{showWhitelabel ? (form.escritorio_nome || 'Escritório') : 'Trevo Legaliza'}</div>
                <div className="on-prev-tag">Proposta Comercial</div>
              </div>
              <div className="on-prev-divider" />
              <div className="on-prev-totlbl">Total</div>
              <div>
                <span className="on-prev-total">{fmt(totalFinal)}</span>
                {totalObrigatorio !== totalFinal && totalObrigatorio > 0 && (
                  <span className="on-prev-strike">{fmt(totalObrigatorio)} obrig.</span>
                )}
              </div>
              <div className="on-prev-items">
                {form.itens.slice(0, 4).map((it) => (
                  <div key={it.id} className={`on-prev-it ${!it.isOptional ? '' : 'opt'}`}>
                    <span className="nm"><span className="dot" />{it.descricao || 'Item sem nome'}</span>
                    <span className="va">{fmt(getItemValor(it) * (it.quantidade || 1))}</span>
                  </div>
                ))}
              </div>
              <div className="on-prev-foot">
                Validade: {form.validade_dias} dias
              </div>
            </div>
          </div>

          <div className="on-aside-cta">
            <Button
              size="sm"
              disabled={gerando}
              onClick={async () => {
                setGerando(true);
                try {
                  const blob = await gerarOrcamentoPDF(buildPDFParams(modoPDF));
                  downloadBlob(blob, buildFilename(modoPDF));
                  if (orcamentoId) await salvarPDF(blob, modoPDF);
                } catch (err: any) {
                  toast.error('Erro ao gerar PDF: ' + (err.message || ''));
                } finally {
                  setGerando(false);
                }
              }}
            >
              <FileText className="h-4 w-4 mr-1" /> Gerar PDF — {showAdvancedPricingByDefault ? 'Interno' : 'Cliente final'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleSave('rascunho')}>
              <Save className="h-4 w-4 mr-1" /> Salvar rascunho
            </Button>
            {shareToken && form.destinatario !== 'cliente_via_contador' && (
              <Button variant="outline" size="sm" onClick={handleCopyLink}>
                <LinkIcon className="h-4 w-4 mr-1" /> Copiar link público
              </Button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
