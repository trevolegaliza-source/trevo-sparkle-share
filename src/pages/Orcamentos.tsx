import { useState, useEffect, useCallback } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useNavigate } from 'react-router-dom';
import { useOrcamentos, useOrcamentoKPIs, useDeleteOrcamento, useConverterOrcamentoEmProcesso, type Orcamento } from '@/hooks/useOrcamentos';
import { gerarOrcamentoPDF } from '@/lib/orcamento-pdf';
import { PageHeader } from '@/components/ui/page-header';
import { normalizeItem, DEFAULT_SECOES } from '@/components/orcamentos/types';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonList } from '@/components/ui/skeleton-patterns';
import { EmptyState } from '@/components/ui/empty-state';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Plus, FileText, Send, CheckCircle, TrendingUp, MoreHorizontal,
  Copy, Download, Trash2, Pencil, Link as LinkIcon, ArrowLeft, FileCheck, Eye, MessageCircle, DollarSign,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ContratoModal from '@/components/orcamentos/ContratoModal';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  rascunho: { label: 'Rascunho', color: 'bg-muted text-muted-foreground' },
  enviado: { label: 'Enviado', color: 'bg-blue-500/10 text-blue-500' },
  aprovado: { label: 'Aprovado', color: 'bg-primary/10 text-primary' },
  aguardando_pagamento: { label: 'Aguardando Pgto', color: 'bg-amber-500/10 text-amber-500' },
  convertido: { label: 'Convertido', color: 'bg-violet-500/10 text-violet-500' },
  recusado: { label: 'Recusado', color: 'bg-destructive/10 text-destructive' },
};

export default function Orcamentos() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  // 18/05/2026: 3 abas funcionais em vez de 6 (rascunho/enviado/aguardando/convertido/recusado/todos).
  // Default 'em_andamento' = fila ativa que o user precisa olhar.
  const [tab, setTab] = useState('em_andamento');
  const { data: orcamentos, isLoading } = useOrcamentos(tab);
  const { data: kpis } = useOrcamentoKPIs();
  const deleteMutation = useDeleteOrcamento();
  const converterMutation = useConverterOrcamentoEmProcesso();
  const { podeCriar } = usePermissions();

  // Status counts — audit-sprint-3.6 (13/05/2026 noite): antes fazia 6
  // queries SELECT COUNT a cada mudança de aba. Agora 1 query que pega
  // só a coluna status e conta no client. ~6x menos roundtrips.
  const { data: counts = {} } = useQuery({
    queryKey: ['orcamentos_status_counts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('orcamentos').select('status');
      if (error) throw error;
      const acc: Record<string, number> = {};
      (data || []).forEach((r: any) => { acc[r.status] = (acc[r.status] || 0) + 1; });
      // Categorias agregadas (18/05/2026): 3 abas funcionais
      acc.em_andamento = (acc.rascunho || 0) + (acc.enviado || 0) + (acc.aguardando_pagamento || 0);
      acc.finalizadas = (acc.convertido || 0) + (acc.recusado || 0);
      return acc;
    },
    staleTime: 60_000,
  });

  // Contrato modal
  const [contratoOrc, setContratoOrc] = useState<Orcamento | null>(null);

  // Edit confirm for approved
  const [editConfirm, setEditConfirm] = useState<Orcamento | null>(null);

  // Ctrl+O shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
        e.preventDefault();
        navigate('/orcamentos/novo');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['orcamentos'] });
    qc.invalidateQueries({ queryKey: ['orcamento_kpis'] });
    qc.invalidateQueries({ queryKey: ['sidebar_counts'] });
  }, [qc]);

  // Status actions
  async function marcarComoEnviado(id: string) {
    const { error } = await supabase.from('orcamentos')
      .update({ status: 'enviado', enviado_em: new Date().toISOString() } as any)
      .eq('id', id);
    if (!error) { toast.success('Orçamento marcado como enviado'); invalidate(); }
    else toast.error('Erro: ' + error.message);
  }

  async function marcarComoAprovado(id: string) {
    const { error } = await supabase.from('orcamentos')
      .update({ status: 'aguardando_pagamento', aprovado_em: new Date().toISOString() } as any)
      .eq('id', id);
    if (!error) { toast.success('Orçamento aprovado! Aguardando pagamento.'); invalidate(); }
    else toast.error('Erro: ' + error.message);
  }

  async function marcarComoPago(id: string) {
    const { error } = await supabase.from('orcamentos')
      .update({ status: 'convertido', convertido_em: new Date().toISOString(), pago_em: new Date().toISOString() } as any)
      .eq('id', id);
    if (!error) { toast.success('Pagamento confirmado! Orçamento convertido.'); invalidate(); }
    else toast.error('Erro: ' + error.message);
  }

  async function voltarParaRascunho(id: string) {
    const { error } = await supabase.from('orcamentos')
      .update({ status: 'rascunho', enviado_em: null, aprovado_em: null } as any)
      .eq('id', id);
    if (!error) { toast.success('Orçamento revertido para rascunho'); invalidate(); }
    else toast.error('Erro: ' + error.message);
  }

  async function voltarParaEnviado(id: string) {
    const { error } = await supabase.from('orcamentos')
      .update({ status: 'enviado', aprovado_em: null } as any)
      .eq('id', id);
    if (!error) { toast.success('Orçamento revertido para enviado'); invalidate(); }
    else toast.error('Erro: ' + error.message);
  }

  // INT-001: converter orçamento em processo + lançamento. Chamada manual
  // (Thales/Letícia decide o momento). RPC é idempotente — se já convertido,
  // retorna referências existentes sem duplicar.
  async function handleConverter(orc: Orcamento) {
    if (!orc.cliente_id) {
      toast.error('Vincule o prospect a um cliente antes de converter (edite o orçamento e selecione o cliente).');
      return;
    }
    const ok = window.confirm(
      `Converter "${orc.prospect_nome}" (R$ ${orc.valor_final.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) em processo no Financeiro?\n\n`
      + `Vai criar:\n`
      + `• 1 processo (tipo "avulso") pro cliente vinculado\n`
      + `• 1 lançamento JÁ PAGO no Financeiro\n\n`
      + `Isso é idempotente — se já converteu antes, nada é duplicado.`
    );
    if (!ok) return;
    converterMutation.mutate(orc.id, {
      onSuccess: (data) => {
        if (data?.processo_id && orc.cliente_id) {
          // Pergunta se quer ver o processo criado
          setTimeout(() => {
            if (window.confirm('Conversão concluída. Abrir o cliente pra ver o processo criado?')) {
              navigate(`/clientes/${orc.cliente_id}`);
            }
          }, 100);
        }
      },
    });
  }

  async function handleVerCobranca(orc: Orcamento) {
    if (!orc.lancamento_id) {
      toast.error('Cobrança ainda não disponível para esse orçamento.');
      return;
    }
    const { data } = await supabase
      .from('cobrancas')
      .select('share_token')
      .contains('lancamento_ids', [orc.lancamento_id])
      .maybeSingle();
    if (data?.share_token) {
      window.open(`/cobranca/${data.share_token}`, '_blank');
    } else {
      toast.error('Cobrança não encontrada.');
    }
  }

  async function verContrato(orcId: string) {
    const { data } = await supabase.from('contratos')
      .select('pdf_url, numero_contrato')
      .eq('orcamento_id', orcId)
      .order('created_at', { ascending: false })
      .limit(1);
    if (data && data.length > 0 && data[0].pdf_url) {
      const { data: urlData } = await supabase.storage.from('contratos').createSignedUrl(data[0].pdf_url, 3600);
      if (urlData?.signedUrl) {
        window.open(urlData.signedUrl, '_blank');
      } else {
        toast.error('Erro ao obter URL do contrato');
      }
    } else {
      toast.error('Contrato não encontrado. Tente regenerar.');
    }
  }

  function formFromOrcamento(orc: Orcamento) {
    let itens: any[] = [];
    try {
      const raw = orc.servicos as any;
      if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'object' && 'descricao' in raw[0]) {
        itens = raw;
      }
    } catch { /* ignore */ }
    return { itens, desconto_pct: orc.desconto_pct };
  }

  async function handleDownloadPDF(orc: Orcamento) {
    try {
      const f = formFromOrcamento(orc);
      let itens = f.itens.map(normalizeItem);
      const orcAny = orc as any;

      // Quando orçamento foi aprovado/convertido, filtra pelos itens que o cliente
      // marcou (itens_selecionados). Antes o PDF do convertido mostrava todos os
      // itens originais com valor cheio, ignorando os que o cliente desmarcou.
      const itensSelecionados = Array.isArray(orcAny.itens_selecionados) ? orcAny.itens_selecionados : null;
      const filtraSelecionados =
        itensSelecionados && itensSelecionados.length > 0 &&
        ['aguardando_pagamento', 'convertido'].includes(orc.status);
      if (filtraSelecionados) {
        const idsAprovados = new Set<string>(itensSelecionados.map((i: any) => i.id));
        itens = itens.filter((i: any) => idsAprovados.has(i.id));
      }

      const sub = itens.reduce((s: number, i: any) => s + (Number(i.honorario) || Number(i.valor) || 0) * (Number(i.quantidade) || 1), 0);
      const desc = sub * (f.desconto_pct / 100);
      const hasDetailed = itens.some((i: any) => i.taxa_min > 0 || i.taxa_max > 0 || i.prazo || i.docs_necessarios);

      // Resolver dados do escritório
      let escritorioNome = orcAny.escritorio_nome || '';
      let escritorioCnpj = orcAny.escritorio_cnpj || '';
      let escritorioEmail = orcAny.escritorio_email || '';
      let escritorioTelefone = orcAny.escritorio_telefone || '';

      if (!escritorioNome && orc.cliente_id) {
        const { data: clienteData } = await supabase
          .from('clientes')
          .select('nome, apelido, cnpj, email, telefone')
          .eq('id', orc.cliente_id)
          .single();
        if (clienteData) {
          escritorioNome = clienteData.apelido || clienteData.nome || '';
          escritorioCnpj = clienteData.cnpj || '';
          escritorioEmail = clienteData.email || '';
          escritorioTelefone = clienteData.telefone || '';
        }
      }

      // Resolver destinatário e modo PDF
      const destinatario = orcAny.destinatario || 'contador';
      let modoPDF: 'contador' | 'cliente' | 'direto';
      if (destinatario === 'cliente_via_contador') modoPDF = 'cliente';
      else if (destinatario === 'cliente_direto') modoPDF = 'direto';
      else modoPDF = 'contador';

      const doc = await gerarOrcamentoPDF({
        modo: hasDetailed || orcAny.contexto ? 'detalhado' : 'simples',
        modoPDF,
        destinatario,
        escritorioNome,
        escritorioCnpj,
        escritorioEmail,
        escritorioTelefone,
        clienteNome: escritorioNome,
        contadorNome: escritorioNome,
        contadorEmail: escritorioEmail,
        contadorTelefone: escritorioTelefone,
        prospect_nome: orc.prospect_nome,
        prospect_cnpj: orc.prospect_cnpj,
        itens,
        pacotes: Array.isArray(orcAny.pacotes) ? orcAny.pacotes : [],
        secoes: Array.isArray(orcAny.secoes) && orcAny.secoes.length > 0 ? orcAny.secoes : [...DEFAULT_SECOES],
        contexto: orcAny.contexto || '',
        ordem_execucao: orcAny.ordem_execucao || '',
        desconto_pct: f.desconto_pct,
        subtotal: sub,
        total: sub - desc,
        validade_dias: orc.validade_dias,
        prazo_execucao: orc.prazo_execucao || '',
        pagamento: orc.pagamento,
        observacoes: orc.observacoes,
        numero: orc.numero,
        data_emissao: new Date(orc.created_at).toLocaleDateString('pt-BR'),
        riscos: Array.isArray(orcAny.riscos) ? orcAny.riscos : [],
        etapas_fluxo: Array.isArray(orcAny.etapas_fluxo) ? orcAny.etapas_fluxo : [],
        beneficios_capa: Array.isArray(orcAny.beneficios_capa) ? orcAny.beneficios_capa : [],
        headline_cenario: orcAny.headline_cenario || '',
        cenarios: Array.isArray(orcAny.cenarios) ? orcAny.cenarios : [],
        is_convertido: orc.status === 'convertido',
      });

      const sufixos: Record<string, string> = {
        contador: '_interno',
        cliente: '_cliente',
        direto: '_direto_trevo',
      };
      const clienteName = (orc.prospect_nome || 'proposta').replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 50);
      const filename = `Proposta_${clienteName}${sufixos[modoPDF] || ''}_${new Date().toISOString().split('T')[0]}.pdf`;
      const { downloadBlob } = await import('@/lib/orcamento-pdf');
      downloadBlob(doc, filename);
      toast.success('PDF gerado!');
    } catch (err: any) {
      toast.error('Erro ao gerar PDF: ' + (err.message || ''));
    }
  }

  function handleWhatsApp(orc: Orcamento) {
    const orcAny = orc as any;
    if (orcAny.destinatario === 'cliente_via_contador') {
      toast.error('Orçamentos white-label não possuem link público. Use o PDF.');
      return;
    }
    const url = `https://app.trevolegaliza.com/proposta/${orc.share_token}`;
    const num = String(orc.numero).padStart(3, '0');
    // Prioriza nome da pessoa de contato sobre razao social da empresa.
    // Antes: "Olá, ACME LTDA!" — formal e impessoal. Agora: "Olá, João!" se houver contato.
    const nomePessoa = (orc as any).prospect_contato?.trim();
    const nomeExibicao = nomePessoa || orc.prospect_nome;
    const nome = nomeExibicao ? `, ${nomeExibicao}` : '';

    // Calcula valor aprovado pelo cliente (subset de servicos via itens_selecionados)
    const itensSelecionados = Array.isArray(orcAny.itens_selecionados) ? orcAny.itens_selecionados : null;
    const valorAprovado = itensSelecionados && itensSelecionados.length > 0
      ? itensSelecionados.reduce((s: number, i: any) => s + Number(i.valor_contador || 0), 0)
      : orc.valor_final;

    let msg: string;
    if (orc.status === 'convertido') {
      // Contrato ativo — cliente já aprovou e pagou
      msg = `Olá${nome}! 🍀\n\nSeu contrato com a *Trevo Legaliza* está ativo.\n\n📋 Proposta #${num}\n💰 Valor: *${fmt(valorAprovado)}* (pago ✅)\n\nAcompanhe os detalhes:\n${url}`;
    } else if (orc.status === 'aguardando_pagamento') {
      // Cliente aprovou, falta pagar
      msg = `Olá${nome}! 🍀\n\nSua proposta da *Trevo Legaliza* foi aprovada e está aguardando pagamento.\n\n📋 Proposta #${num}\n💰 Valor: *${fmt(valorAprovado)}*\n\nFinalize o pagamento:\n${url}`;
    } else if (orc.status === 'recusado') {
      // Recusada — convite pra rever
      msg = `Olá${nome}! 🍀\n\nVocê recusou a proposta #${num} da *Trevo Legaliza*. Se mudou de ideia, ainda pode revisar:\n${url}`;
    } else {
      // Rascunho/enviado — proposta nova pra cliente avaliar
      const validade = orc.validade_dias ?? 15;
      msg = `Olá${nome}! 🍀\n\nSegue sua proposta de honorários da *Trevo Legaliza*.\n\n📋 Proposta #${num}\n💰 Valor: *${fmt(orc.valor_final)}*\n⏱️ Válida por ${validade} dias\n\nAcesse e aprove online:\n${url}`;
    }

    if (orcAny.destinatario === 'contador' && orcAny.senha_link) {
      msg += `\n\n🔒 Senha de acesso: *${orcAny.senha_link}*`;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  }

  function handleCopyLink(orc: Orcamento) {
    const orcAny = orc as any;
    // Modo cliente_via_contador NÃO tem link público
    if (orcAny.destinatario === 'cliente_via_contador') {
      toast.error('Orçamentos white-label não possuem link público. Use o PDF.');
      return;
    }
    const baseUrl = 'https://app.trevolegaliza.com';
    const url = `${baseUrl}/proposta/${orc.share_token}`;
    navigator.clipboard.writeText(url);
    
    if (orcAny.destinatario === 'contador' && orcAny.senha_link) {
      toast.success(`Link copiado! Senha: ${orcAny.senha_link}`);
    } else if (orcAny.destinatario === 'contador' && !orcAny.senha_link) {
      toast.success('Link copiado! ⚠️ Sem senha — qualquer um com o link pode acessar.');
    } else {
      toast.success('Link copiado!');
    }
  }

  function handleEditApproved(orc: Orcamento) {
    setEditConfirm(orc);
  }

  async function confirmEditApproved() {
    if (!editConfirm) return;
    await voltarParaRascunho(editConfirm.id);
    navigate(`/orcamentos/novo?id=${editConfirm.id}`);
    setEditConfirm(null);
  }

  const isWhiteLabel = (orc: Orcamento) => (orc as any).destinatario === 'cliente_via_contador';

  // 18/05/2026: menu de 3 pontinhos simplificado.
  // Antes: 8+ ações duplicadas (Editar, Duplicar, Copiar Link, WhatsApp, Baixar PDF,
  // Marcar como X, Voltar pra Y, Excluir). Todas as de "mudar status" e "duplicar"
  // agora vivem dentro do editor (no menu "Mais ações ▾") — click no card já abre.
  // Aqui mantemos só:
  //   - Atalhos rapidos (Copiar Link / WhatsApp) — vale nao entrar no editor
  //   - Ações pós-conversão (Ver cobrança, Abrir cliente, Ver contrato)
  //   - Converter em processo (aprovado/aguardando sem processo)
  //   - Excluir (destrutiva — separa do flow normal)
  function renderActions(orc: Orcamento) {
    const status = orc.status || 'rascunho';
    const isPublishable = status !== 'rascunho' && (orc as any).destinatario !== 'cliente_via_contador';
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Ações do orçamento"><MoreHorizontal className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {/* Atalhos rápidos (não vale entrar no editor pra isso) */}
          {isPublishable && (
            <>
              <DropdownMenuItem onClick={() => handleCopyLink(orc)}>
                <LinkIcon className="h-3.5 w-3.5 mr-2" />Copiar Link
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleWhatsApp(orc)}>
                <MessageCircle className="h-3.5 w-3.5 mr-2" />Enviar por WhatsApp
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          {/* Converter em processo (aprovado/aguardando_pagamento sem processo) */}
          {(status === 'aprovado' || status === 'aguardando_pagamento') && !orc.processo_id && (
            <DropdownMenuItem onClick={() => handleConverter(orc)} disabled={converterMutation.isPending}>
              <DollarSign className="h-3.5 w-3.5 mr-2" />Converter em processo
            </DropdownMenuItem>
          )}

          {/* Ações pós-conversão */}
          {status === 'convertido' && (
            <>
              {!orc.processo_id && (
                <DropdownMenuItem onClick={() => handleConverter(orc)} disabled={converterMutation.isPending}>
                  <DollarSign className="h-3.5 w-3.5 mr-2" />Criar processo no Financeiro
                </DropdownMenuItem>
              )}
              {orc.lancamento_id && (
                <DropdownMenuItem onClick={() => handleVerCobranca(orc)}>
                  <DollarSign className="h-3.5 w-3.5 mr-2" />Ver cobrança
                </DropdownMenuItem>
              )}
              {orc.processo_id && orc.cliente_id && (
                <DropdownMenuItem onClick={() => navigate(`/clientes/${orc.cliente_id}`)}>
                  <Eye className="h-3.5 w-3.5 mr-2" />Abrir cliente
                </DropdownMenuItem>
              )}
              {((orc as any).contrato_assinado_url || (orc as any).clicksign_document_key) && (
                <DropdownMenuItem onClick={() => verContrato(orc.id)}>
                  <Eye className="h-3.5 w-3.5 mr-2" />Ver contrato
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
            </>
          )}

          {(status === 'aprovado' || status === 'aguardando_pagamento') && <DropdownMenuSeparator />}

          <DropdownMenuItem onClick={() => deleteMutation.mutate(orc.id)} className="text-destructive">
            <Trash2 className="h-3.5 w-3.5 mr-2" />Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orçamentos"
        subtitle="Propostas comerciais personalizadas"
        actions={
          podeCriar('orcamentos') ? (
            <Button onClick={() => navigate('/orcamentos/novo')} className="gap-2">
              <Plus className="h-4 w-4" /> Novo Orçamento
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total', value: kpis?.total ?? 0, icon: FileText, color: 'text-foreground' },
          { label: 'Enviados', value: kpis?.enviados ?? 0, icon: Send, color: 'text-blue-500' },
          { label: 'Aguardando Pgto', value: kpis?.aguardandoPgto ?? 0, icon: CheckCircle, color: 'text-amber-500' },
          { label: 'Convertidos', value: kpis?.convertidos ?? 0, icon: TrendingUp, color: 'text-violet-500' },
          { label: 'Taxa Conversão', value: `${kpis?.taxa ?? 0}%`, icon: TrendingUp, color: 'text-primary' },
        ].map(k => (
          <Card key={k.label}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{k.label}</p>
                <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
              </div>
              <k.icon className={`h-5 w-5 ${k.color} opacity-50`} />
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="em_andamento">
            Em andamento {counts.em_andamento ? `(${counts.em_andamento})` : ''}
          </TabsTrigger>
          <TabsTrigger value="finalizadas">
            Finalizadas {counts.finalizadas ? `(${counts.finalizadas})` : ''}
          </TabsTrigger>
          <TabsTrigger value="todos">Todos</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <SkeletonList rows={4} />
          ) : !orcamentos?.length ? (
            <EmptyState
              icon={FileText}
              title={tab === 'em_andamento' ? 'Nenhum orçamento em andamento' : tab === 'finalizadas' ? 'Nenhuma proposta finalizada ainda' : 'Nenhum orçamento'}
              description={
                tab === 'em_andamento'
                  ? 'Crie seu primeiro orçamento — quando enviar pro cliente, ele aparece aqui esperando resposta.'
                  : tab === 'finalizadas'
                  ? 'Aqui vão aparecer propostas pagas (convertidas) ou recusadas. Vamos fechar a primeira!'
                  : 'Crie seu primeiro orçamento clicando em "Novo Orçamento".'
              }
              action={
                podeCriar('orcamentos') && (
                  <Button onClick={() => navigate('/orcamentos/novo')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Orçamento
                  </Button>
                )
              }
            />
          ) : (
            <div className="space-y-2">
              {orcamentos.map(orc => {
                const st = STATUS_MAP[orc.status] || STATUS_MAP.rascunho;
                const itemCount = Array.isArray(orc.servicos) ? orc.servicos.length : 0;
                return (
                  <Card key={orc.id}
                    className="p-4 border-0 shadow-sm hover:shadow-md hover:-translate-y-px transition-all cursor-pointer"
                    onClick={() => {
                    if (orc.status === 'aprovado') handleEditApproved(orc);
                    else navigate(`/orcamentos/novo?id=${orc.id}`);
                  }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-mono text-muted-foreground">#{String(orc.numero).padStart(3, '0')}</span>
                        <div>
                          <p className="text-sm font-semibold">{orc.prospect_nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {itemCount} {itemCount === 1 ? 'item' : 'itens'} · {new Date(orc.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                        <p className="text-sm font-bold">{fmt(orc.valor_final)}</p>
                        <Badge className={`text-[10px] ${st.color}`}>{st.label}</Badge>
                        {orc.status === 'recusado' && (orc as any).observacoes_recusa && (
                          <p className="text-xs text-destructive/70 mt-1 line-clamp-1">
                            Motivo: {(orc as any).observacoes_recusa}
                          </p>
                        )}
                        {renderActions(orc)}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Contrato modal */}
      {contratoOrc && (
        <ContratoModal
          open={!!contratoOrc}
          onOpenChange={(open) => { if (!open) setContratoOrc(null); }}
          orcamento={contratoOrc}
          onSuccess={invalidate}
        />
      )}

      {/* Edit approved confirmation */}
      <AlertDialog open={!!editConfirm} onOpenChange={(open) => { if (!open) setEditConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Editar orçamento aprovado?</AlertDialogTitle>
            <AlertDialogDescription>
              Editar este orçamento reverterá o status para rascunho. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmEditApproved}>Continuar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
