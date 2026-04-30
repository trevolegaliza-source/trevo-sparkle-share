import { useState, useEffect, useCallback } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useNavigate } from 'react-router-dom';
import { useOrcamentos, useOrcamentoKPIs, useDeleteOrcamento, type Orcamento } from '@/hooks/useOrcamentos';
import { gerarOrcamentoPDF } from '@/lib/orcamento-pdf';
import { normalizeItem, DEFAULT_SECOES } from '@/components/orcamentos/types';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Plus, FileText, Send, CheckCircle, TrendingUp, MoreHorizontal,
  Copy, Download, Trash2, Pencil, Link as LinkIcon, ArrowLeft, FileCheck, Eye, MessageCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
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
  const [tab, setTab] = useState('rascunho');
  const { data: orcamentos, isLoading } = useOrcamentos(tab);
  const { data: kpis } = useOrcamentoKPIs();
  const deleteMutation = useDeleteOrcamento();
  const { podeCriar } = usePermissions();

  // Status counts
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    (async () => {
      const statuses = ['rascunho', 'enviado', 'aprovado', 'aguardando_pagamento', 'convertido', 'recusado'];
      const results: Record<string, number> = {};
      await Promise.all(statuses.map(async (s) => {
        const { count } = await supabase.from('orcamentos')
          .select('*', { count: 'exact', head: true })
          .eq('status', s);
        results[s] = count || 0;
      }));
      setCounts(results);
    })();
  }, [orcamentos]);

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
      const itens = f.itens.map(normalizeItem);
      const sub = itens.reduce((s: number, i: any) => s + (Number(i.honorario) || Number(i.valor) || 0) * (Number(i.quantidade) || 1), 0);
      const desc = sub * (f.desconto_pct / 100);
      const hasDetailed = itens.some((i: any) => i.taxa_min > 0 || i.taxa_max > 0 || i.prazo || i.docs_necessarios);
      const orcAny = orc as any;

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
    const valor = fmt(orc.valor_final);
    const validade = orc.validade_dias ?? 15;
    const num = String(orc.numero).padStart(3, '0');
    let msg = `Olá${orc.prospect_nome ? `, ${orc.prospect_nome}` : ''}! 🍀\n\nSegue sua proposta de honorários da *Trevo Legaliza*.\n\n📋 Proposta #${num}\n💰 Valor: *${valor}*\n⏱️ Válida por ${validade} dias\n\nAcesse e aprove online:\n${url}`;
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

  function renderActions(orc: Orcamento) {
    const status = orc.status || 'rascunho';
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {/* Edit */}
          {status !== 'convertido' && (
            <DropdownMenuItem onClick={() => {
              if (status === 'aprovado') handleEditApproved(orc);
              else navigate(`/orcamentos/novo?id=${orc.id}`);
            }}>
              <Pencil className="h-3.5 w-3.5 mr-2" />Editar
            </DropdownMenuItem>
          )}

          <DropdownMenuItem onClick={() => navigate(`/orcamentos/novo?duplicate=${orc.id}`)}>
            <Copy className="h-3.5 w-3.5 mr-2" />Duplicar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleCopyLink(orc)}>
            <LinkIcon className="h-3.5 w-3.5 mr-2" />Copiar Link
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleWhatsApp(orc)}>
            <MessageCircle className="h-3.5 w-3.5 mr-2" />Enviar por WhatsApp
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleDownloadPDF(orc)}>
            <Download className="h-3.5 w-3.5 mr-2" />Baixar PDF
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Status-specific actions */}
          {status === 'rascunho' && (
            <DropdownMenuItem onClick={() => marcarComoEnviado(orc.id)}>
              <Send className="h-3.5 w-3.5 mr-2" />Marcar como enviado
            </DropdownMenuItem>
          )}

          {status === 'enviado' && (
            <>
              <DropdownMenuItem onClick={() => marcarComoAprovado(orc.id)}>
                <CheckCircle className="h-3.5 w-3.5 mr-2" />Marcar como aprovado
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => voltarParaRascunho(orc.id)}>
                <ArrowLeft className="h-3.5 w-3.5 mr-2" />Voltar para rascunho
              </DropdownMenuItem>
            </>
          )}

          {status === 'aprovado' && (
            <>
              {isWhiteLabel(orc) ? (
                <DropdownMenuItem disabled className="text-muted-foreground text-xs">
                  Contrato indisponível — orçamento white-label
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => setContratoOrc(orc)}>
                  <FileCheck className="h-3.5 w-3.5 mr-2" />Gerar contrato
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => voltarParaEnviado(orc.id)}>
                <ArrowLeft className="h-3.5 w-3.5 mr-2" />Voltar para enviado
              </DropdownMenuItem>
            </>
          )}

          {status === 'aguardando_pagamento' && (
            <>
              <DropdownMenuItem onClick={() => marcarComoPago(orc.id)}>
                <CheckCircle className="h-3.5 w-3.5 mr-2" />Marcar como pago (convertido)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => voltarParaEnviado(orc.id)}>
                <ArrowLeft className="h-3.5 w-3.5 mr-2" />Voltar para enviado
              </DropdownMenuItem>
            </>
          )}

          {status === 'recusado' && (
            <DropdownMenuItem onClick={() => voltarParaEnviado(orc.id)}>
              <ArrowLeft className="h-3.5 w-3.5 mr-2" />Reenviar proposta
            </DropdownMenuItem>
          )}

          {status === 'convertido' && (
            <DropdownMenuItem onClick={() => verContrato(orc.id)}>
              <Eye className="h-3.5 w-3.5 mr-2" />Ver contrato
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => deleteMutation.mutate(orc.id)} className="text-destructive">
            <Trash2 className="h-3.5 w-3.5 mr-2" />Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Orçamentos</h1>
          <p className="text-sm text-muted-foreground">Propostas comerciais personalizadas</p>
        </div>
        {podeCriar('orcamentos') && (
          <Button onClick={() => navigate('/orcamentos/novo')} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Orçamento
          </Button>
        )}
      </div>

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
          <TabsTrigger value="rascunho">Rascunhos {counts.rascunho ? `(${counts.rascunho})` : ''}</TabsTrigger>
          <TabsTrigger value="enviado">Enviados {counts.enviado ? `(${counts.enviado})` : ''}</TabsTrigger>
          <TabsTrigger value="aguardando_pagamento">
            Aguardando Pgto {counts.aguardando_pagamento ? `(${counts.aguardando_pagamento})` : ''}
          </TabsTrigger>
          <TabsTrigger value="convertido">Convertidos {counts.convertido ? `(${counts.convertido})` : ''}</TabsTrigger>
          <TabsTrigger value="recusado">Recusados {counts.recusado ? `(${counts.recusado})` : ''}</TabsTrigger>
          <TabsTrigger value="todos">Todos</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
          ) : !orcamentos?.length ? (
            <Card className="p-8 text-center">
              <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-sm text-muted-foreground">Nenhum orçamento encontrado</p>
              <Button variant="outline" className="mt-3" onClick={() => navigate('/orcamentos/novo')}>
                Criar primeiro orçamento
              </Button>
            </Card>
          ) : (
            <div className="space-y-2">
              {orcamentos.map(orc => {
                const st = STATUS_MAP[orc.status] || STATUS_MAP.rascunho;
                const itemCount = Array.isArray(orc.servicos) ? orc.servicos.length : 0;
                return (
                  <Card key={orc.id} className="p-4 hover:border-primary/30 transition-colors cursor-pointer" onClick={() => {
                    if (orc.status === 'aprovado') handleEditApproved(orc);
                    else if (orc.status !== 'convertido') navigate(`/orcamentos/novo?id=${orc.id}`);
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
