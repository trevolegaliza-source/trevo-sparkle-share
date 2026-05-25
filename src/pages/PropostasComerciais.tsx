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
  Sparkles, Send, CheckCircle, TrendingUp,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { SkeletonList } from '@/components/ui/skeleton-patterns';
import { EmptyState } from '@/components/ui/empty-state';
import { copyToClipboard } from '@/lib/clipboard';

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

const MODALIDADE_LABEL: Record<string, string> = {
  avulso: 'Avulso',
  pro_5: 'PRO (5/mês)',
  enterprise_10: 'ENTERPRISE (10/mês)',
  custom: 'Customizado',
};

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
    const telefone = (orc.prospect_telefone || '').replace(/\D/g, '').replace(/^/, '55').replace(/^5555/, '55');
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
            <Button onClick={() => navigate('/orcamentos/novo?tipo=terceirizacao')} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
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
                  <Button onClick={() => navigate('/orcamentos/novo?tipo=terceirizacao')} className="bg-emerald-600 hover:bg-emerald-700">
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
                    onClick={() => navigate(`/orcamentos/novo?id=${orc.id}`)}
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
