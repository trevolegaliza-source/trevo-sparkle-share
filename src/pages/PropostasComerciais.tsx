/**
 * Propostas Comerciais — fluxo de terceirização do departamento societário.
 * 25/05/2026: separado de "Orçamentos" (serviço pontual) por escolha do Thales.
 *
 * Compartilha a tabela `orcamentos` no banco mas filtra por tipo_proposta='terceirizacao'.
 * Botão "Nova" navega pra OrcamentoNovo?tipo=terceirizacao (auto-marca o toggle).
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrcamentos, useOrcamentoKPIs, useDeleteOrcamento, type Orcamento } from '@/hooks/useOrcamentos';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  Plus, MoreHorizontal, Link as LinkIcon, MessageCircle, Trash2,
  Sparkles, Send, CheckCircle, TrendingUp, Clock, XCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { SkeletonList } from '@/components/ui/skeleton-patterns';
import { EmptyState } from '@/components/ui/empty-state';
import { copyToClipboard } from '@/lib/clipboard';
import { MODALIDADE_LABEL } from '@/lib/terceirizacao-engine';

const getPropostaPublicUrl = (token: string) => `${window.location.origin}/proposta/${token}`;
import { toast } from 'sonner';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  rascunho: { label: 'Rascunho', color: 'bg-slate-100 text-slate-700' },
  enviado: { label: 'Enviado', color: 'bg-blue-100 text-blue-700' },
  aceito: { label: 'Aceito', color: 'bg-emerald-100 text-emerald-700' },
  aprovado: { label: 'Aprovado', color: 'bg-emerald-100 text-emerald-700' },
  aguardando_pagamento: { label: 'Aguardando Pgto', color: 'bg-amber-100 text-amber-700' },
  convertido: { label: 'Convertido', color: 'bg-violet-100 text-violet-700' },
  recusado: { label: 'Recusado', color: 'bg-rose-100 text-rose-700' },
  expirado: { label: 'Expirado', color: 'bg-slate-100 text-slate-600' },
};

// ITEM-033: import da fonte única `MODALIDADE_LABEL` do engine — antes
// estava duplicado aqui sem a entry 'preco_por_tipo' (mostrava '—').

const CATEGORIA_STATUS: Record<string, string[]> = {
  em_andamento: ['rascunho', 'enviado', 'aceito', 'aguardando_pagamento'],
  finalizadas: ['convertido', 'recusado', 'expirado'],
};

export default function PropostasComerciais() {
  const navigate = useNavigate();
  const { podeCriar, podeExcluir } = usePermissions();
  const [tab, setTab] = useState<'em_andamento' | 'finalizadas' | 'todos'>('em_andamento');

  const { data: kpis } = useOrcamentoKPIs('terceirizacao');
  const { data: orcamentos = [], isLoading } = useOrcamentos(tab, 'terceirizacao');
  const deleteMutation = useDeleteOrcamento();

  // Contadores por categoria pra mostrar nos tabs
  const { data: emAndamento = [] } = useOrcamentos('em_andamento', 'terceirizacao');
  const { data: finalizadas = [] } = useOrcamentos('finalizadas', 'terceirizacao');
  const counts = useMemo(() => ({
    em_andamento: emAndamento.length,
    finalizadas: finalizadas.length,
  }), [emAndamento.length, finalizadas.length]);

  const handleCopyLink = async (orc: Orcamento) => {
    if (!orc.share_token) return;
    const url = getPropostaPublicUrl(orc.share_token);
    const ok = await copyToClipboard(url);
    if (ok) toast.success('Link copiado!');
  };

  const handleWhatsApp = (orc: Orcamento) => {
    if (!orc.share_token || !orc.prospect_telefone) {
      toast.error('Sem telefone do cliente cadastrado.');
      return;
    }
    const url = getPropostaPublicUrl(orc.share_token);
    // ITEM-017 fix: regex simples e seguro. Normaliza pra formato E.164 brasileiro
    // (55 + DDD + número). Antes era `.replace(/^/, '55').replace(/^5555/, '55')`
    // que prependia 55 sempre e tentava corrigir — gerava `wa.me/55` se vazio.
    const digits = (orc.prospect_telefone || '').replace(/\D/g, '');
    if (digits.length < 10) {
      toast.error('Telefone inválido — precisa ter DDD + número (mín. 10 dígitos).');
      return;
    }
    // Se já vem com 55 no início (12+ dígitos), mantém. Senão prefixa.
    const telefone = digits.length >= 12 && digits.startsWith('55') ? digits : `55${digits}`;
    const msg = encodeURIComponent(
      `Olá! Segue sua proposta comercial de terceirização do departamento societário: ${url}`
    );
    window.open(`https://wa.me/${telefone}?text=${msg}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="🍀 Propostas Comerciais"
        subtitle="Terceirização do departamento societário — relação contínua"
        actions={
          podeCriar('orcamentos') ? (
            <Button onClick={() => navigate('/propostas-comerciais/nova')} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4" /> Nova Proposta
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total', value: kpis?.total ?? 0, icon: Sparkles, color: 'text-foreground' },
          { label: 'Enviados', value: kpis?.enviados ?? 0, icon: Send, color: 'text-blue-500' },
          { label: 'Aceitos', value: kpis?.aprovados ?? 0, icon: CheckCircle, color: 'text-emerald-500' },
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

      {/* Segunda linha: tempo médio + recusas detalhadas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Tempo médio até aceite</p>
              <p className="text-2xl font-bold text-emerald-600">
                {kpis?.tempoMedioAceite ? `${kpis.tempoMedioAceite} dias` : '—'}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {kpis?.tempoMedioAceite
                  ? kpis.tempoMedioAceite < 1
                    ? 'Aceite no mesmo dia em média'
                    : 'Da emissão até o aceite verbal'
                  : 'Sem aceites suficientes ainda'}
              </p>
            </div>
            <Clock className="h-5 w-5 text-emerald-500 opacity-50" />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Recusas por motivo</p>
                <p className="text-2xl font-bold text-rose-600">{kpis?.recusados ?? 0}</p>
              </div>
              <XCircle className="h-5 w-5 text-rose-500 opacity-50" />
            </div>
            {kpis?.motivosRecusa && (kpis.recusados ?? 0) > 0 ? (
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { id: 'preco', label: 'Preço', color: 'text-amber-600 bg-amber-50' },
                  { id: 'escopo', label: 'Escopo', color: 'text-blue-600 bg-blue-50' },
                  { id: 'timing', label: 'Timing', color: 'text-violet-600 bg-violet-50' },
                  { id: 'outro', label: 'Outro', color: 'text-slate-600 bg-slate-50' },
                ].map(m => (
                  <div key={m.id} className={`rounded-lg p-2 ${m.color}`}>
                    <p className="text-lg font-bold">{kpis.motivosRecusa[m.id] ?? 0}</p>
                    <p className="text-[10px] uppercase tracking-wider opacity-80">{m.label}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground italic">Nenhuma recusa registrada ainda.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="em_andamento">
            Em andamento {counts.em_andamento ? `(${counts.em_andamento})` : ''}
          </TabsTrigger>
          <TabsTrigger value="finalizadas">
            Finalizadas {counts.finalizadas ? `(${counts.finalizadas})` : ''}
          </TabsTrigger>
          <TabsTrigger value="todos">Todas</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <SkeletonList rows={4} />
          ) : !orcamentos?.length ? (
            <EmptyState
              icon={Sparkles}
              title={tab === 'em_andamento' ? 'Nenhuma proposta em andamento' : tab === 'finalizadas' ? 'Nenhuma proposta finalizada' : 'Nenhuma proposta comercial'}
              description={
                tab === 'em_andamento'
                  ? 'Crie a primeira proposta de terceirização — chips ao vivo, valor recalcula em tempo real.'
                  : tab === 'finalizadas'
                  ? 'Propostas convertidas (cliente fechou contrato) ou recusadas aparecem aqui.'
                  : 'Comece criando uma proposta — clique em "Nova Proposta" acima.'
              }
              action={
                podeCriar('orcamentos') && (
                  <Button onClick={() => navigate('/propostas-comerciais/nova')} className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Proposta
                  </Button>
                )
              }
            />
          ) : (
            <div className="space-y-2">
              {orcamentos.map(orc => {
                const st = STATUS_MAP[orc.status] || STATUS_MAP.rascunho;
                const modalidade = MODALIDADE_LABEL[(orc as any).terc_modalidade] || '—';
                return (
                  <Card
                    key={orc.id}
                    className="p-4 border-0 shadow-sm hover:shadow-md hover:-translate-y-px transition-all cursor-pointer"
                    onClick={() => navigate(`/propostas-comerciais/editar/${orc.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-mono text-muted-foreground">
                          PROP-{String(orc.numero).padStart(4, '0')}
                        </span>
                        <div>
                          <p className="text-sm font-semibold">{orc.prospect_nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {modalidade} · {new Date(orc.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                        <p className="text-sm font-bold">{fmt(orc.valor_final)}</p>
                        <Badge className={`text-[10px] ${st.color}`}>{st.label}</Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {orc.share_token && orc.status !== 'rascunho' && (
                              <>
                                <DropdownMenuItem onClick={() => handleCopyLink(orc)}>
                                  <LinkIcon className="h-3.5 w-3.5 mr-2" /> Copiar Link
                                </DropdownMenuItem>
                                {orc.prospect_telefone && (
                                  <DropdownMenuItem onClick={() => handleWhatsApp(orc)}>
                                    <MessageCircle className="h-3.5 w-3.5 mr-2" /> Enviar por WhatsApp
                                  </DropdownMenuItem>
                                )}
                              </>
                            )}
                            {podeExcluir('orcamentos') && (
                              <DropdownMenuItem
                                onClick={() => {
                                  if (window.confirm(`Excluir proposta PROP-${String(orc.numero).padStart(4, '0')}?`)) {
                                    deleteMutation.mutate(orc.id);
                                  }
                                }}
                                className="text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
