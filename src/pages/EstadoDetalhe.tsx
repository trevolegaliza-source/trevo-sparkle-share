import { useState, useEffect, useMemo } from 'react';
import { GlassCard } from '@/components/ui/glass-card';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MapaEstadoMunicipios } from '@/components/mapa/MapaEstadoMunicipios';
import { RatingStars } from '@/components/mapa/RatingStars';
import { toast } from 'sonner';
import { UF_NOMES } from '@/constants/estados-brasil';
import {
  useEstadoDetalhe, useSalvarContato, useRemoverContato,
  useSalvarNotaEstado, useMunicipiosIBGE,
  type ContatoEstado,
} from '@/hooks/useInteligenciaGeografica';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft, Plus, Trash2, ExternalLink, Users, MapPin, Building, Phone,
  Mail, Globe, BookOpen, DollarSign, Pencil, ChevronDown,
} from 'lucide-react';
import { useTheme } from 'next-themes';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const TIPO_LABELS: Record<string, string> = {
  junta_comercial: 'Junta Comercial',
  cartorio: 'Cartório',
  conselho: 'Conselho de Classe',
  prefeitura: 'Prefeitura',
  outro: 'Outro Órgão',
};

const TIPO_ICONS: Record<string, typeof Building> = {
  junta_comercial: Building,
  cartorio: BookOpen,
  conselho: Users,
  prefeitura: MapPin,
  outro: Globe,
};

const LEGENDA_ITENS = [
  { tipo: 'junta_comercial', label: 'Junta Comercial', cor: '#f59e0b', emoji: '📍' },
  { tipo: 'outro', label: 'Escritório Regional', cor: '#3b82f6', emoji: '🏢' },
  { tipo: 'cartorio', label: 'Cartório', cor: '#8b5cf6', emoji: '⚖️' },
  { tipo: 'conselho', label: 'Conselho de Classe', cor: '#ec4899', emoji: '🎓' },
  { tipo: 'prefeitura', label: 'Prefeitura', cor: '#22c55e', emoji: '🏛️' },
];

const PIN_EMOJI: Record<string, string> = {
  junta_comercial: '📍', outro: '🏢', cartorio: '⚖️', conselho: '🎓', prefeitura: '🏛️',
};

const COLOR_OPTIONS = ['#6b7280','#ef4444','#f59e0b','#22c55e','#3b82f6','#8b5cf6','#ec4899','#06b6d4','#f97316'];

const emptyForm = (): Partial<ContatoEstado> & { pin_cor?: string } => ({
  tipo: 'junta_comercial', nome: '', municipio: null, site_url: null,
  telefone: null, email: null, contato_interno: null, endereco: null, observacoes: null, rating: 0,
  pin_cor: undefined,
});

const GREEN = '#22c55e';

export default function EstadoDetalhe() {
  const { uf = '' } = useParams<{ uf: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const ufUpper = uf.toUpperCase();
  const nomeEstado = UF_NOMES[ufUpper] || ufUpper;
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';

  const { data, isLoading } = useEstadoDetalhe(ufUpper);
  const { data: municipios } = useMunicipiosIBGE(ufUpper);
  const salvarContato = useSalvarContato();
  const removerContato = useRemoverContato();
  const salvarNota = useSalvarNotaEstado();

  const { data: clientesMunicipio } = useQuery({
    queryKey: ['clientes_municipio_mapa', ufUpper],
    queryFn: async () => {
      const { data: clientes } = await supabase
        .from('clientes')
        .select('cidade')
        .eq('estado', ufUpper)
        .eq('is_archived', false);
      const map: Record<string, number> = {};
      (clientes || []).forEach((c: any) => {
        if (c.cidade) {
          const key = c.cidade.toUpperCase();
          map[key] = (map[key] || 0) + 1;
        }
      });
      return map;
    },
    enabled: !!ufUpper,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<Partial<ContatoEstado> & { pin_cor?: string }>(emptyForm());
  const [nota, setNota] = useState('');
  const [notaId, setNotaId] = useState<string | null>(null);
  const [buscaMunicipio, setBuscaMunicipio] = useState('');
  const [activeTab, setActiveTab] = useState('mapa');
  const [municipioSelecionado, setMunicipioSelecionado] = useState<string | null>(null);
  const [legendaConfig, setLegendaConfig] = useState<Record<string, { visivel: boolean; ratingMin: number; apenasComContato: boolean }>>({
    junta_comercial: { visivel: true, ratingMin: 0, apenasComContato: false },
    outro: { visivel: true, ratingMin: 0, apenasComContato: false },
    cartorio: { visivel: true, ratingMin: 0, apenasComContato: false },
    conselho: { visivel: true, ratingMin: 0, apenasComContato: false },
    prefeitura: { visivel: true, ratingMin: 0, apenasComContato: false },
  });

  useEffect(() => {
    if (data) {
      setNota(data.nota);
      setNotaId(data.notaId);
    }
  }, [data]);

  const [notaDirty, setNotaDirty] = useState(false);
  useEffect(() => {
    if (!notaDirty) return;
    const t = setTimeout(() => {
      salvarNota.mutate({ uf: ufUpper, conteudo: nota, notaId });
      setNotaDirty(false);
    }, 1500);
    return () => clearTimeout(t);
  }, [nota, notaDirty]);

  const openNew = (tipo?: string, municipio?: string) => {
    setForm({ ...emptyForm(), tipo: tipo || 'junta_comercial', municipio: municipio || null });
    setModalOpen(true);
  };

  const openEdit = (c: ContatoEstado) => {
    setForm({ ...c, pin_cor: (c as any).pin_cor || undefined });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.nome || !form.tipo) return;
    const payload: any = { ...form, uf: ufUpper, nome: form.nome!, tipo: form.tipo! };
    if (form.tipo === 'outro' && form.pin_cor) {
      payload.pin_cor = form.pin_cor;
    } else {
      payload.pin_cor = null;
    }
    salvarContato.mutate(payload, {
      onSuccess: () => setModalOpen(false),
    });
  };

  const handleUpdateRating = async (contatoId: string, rating: number) => {
    const { error } = await (supabase.from('contatos_estado' as any) as any)
      .update({ rating })
      .eq('id', contatoId);
    if (error) {
      toast.error('Erro ao atualizar avaliação');
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['estado_detalhe', ufUpper] });
    toast.success(`Avaliação atualizada: ${rating}/5 ⭐`);
  };

  const contatosByTipo = useMemo(() => {
    if (!data) return {};
    const grouped: Record<string, ContatoEstado[]> = {};
    data.contatos.forEach(c => {
      if (!grouped[c.tipo]) grouped[c.tipo] = [];
      grouped[c.tipo].push(c);
    });
    return grouped;
  }, [data]);

  const contatosMunicipio = useMemo(() => {
    if (!municipioSelecionado || !data) return [];
    return data.contatos.filter(c => c.municipio && c.municipio.toUpperCase() === municipioSelecionado.toUpperCase());
  }, [municipioSelecionado, data]);

  const municipiosFiltrados = useMemo(() => {
    if (!municipios) return [];
    const q = buscaMunicipio.toLowerCase();
    const filtered = q ? municipios.filter(m => m.nome.toLowerCase().includes(q)) : municipios;
    const contatosMunicipais = data?.contatos.filter(c => c.municipio) || [];
    const comInfo = new Set(contatosMunicipais.map(c => c.municipio));
    return filtered.sort((a, b) => {
      const aHas = comInfo.has(a.nome) ? 0 : 1;
      const bHas = comInfo.has(b.nome) ? 0 : 1;
      return aHas - bHas || a.nome.localeCompare(b.nome);
    });
  }, [municipios, buscaMunicipio, data]);

  // Theme-aware styles
  const cardBg = isDark ? '#161b22' : '#ffffff';
  const cardBorder = isDark ? '#30363d' : '#e2e8f0';
  const inputBg = isDark ? '#0b0e14' : '#f8fafc';
  const textColor = isDark ? '#e6edf3' : '#1e293b';
  const mutedColor = isDark ? '#8b949e' : '#64748b';
  const dimColor = isDark ? '#484f58' : '#94a3b8';
  const containerBg = isDark ? '#0b0e14' : '#f8fafc';

  const inputStyle: React.CSSProperties = {
    background: inputBg, border: `1px solid ${cardBorder}`, color: textColor,
  };

  if (isLoading) {
    return (
      <div className="geo-container min-h-screen p-6 space-y-6" style={{ background: containerBg }}>
        <Skeleton className="h-8 w-64" style={{ background: cardBg }} />
        <div className="grid grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-xl" style={{ background: cardBg }} />)}</div>
        <Skeleton className="h-64 rounded-xl" style={{ background: cardBg }} />
      </div>
    );
  }

  const qtdClientes = data?.clientes.length || 0;
  const qtdProcessos = data?.clientes.reduce((s, c) => s + c.processos, 0) || 0;
  const receita = data?.clientes.reduce((s, c) => s + c.receita, 0) || 0;
  const qtdContatos = data?.contatos.length || 0;

  const kpis = [
    { label: 'Clientes', value: qtdClientes, Icon: Users },
    { label: 'Processos', value: qtdProcessos, Icon: MapPin },
    { label: 'Receita', value: fmt(receita), Icon: DollarSign },
    { label: 'Contatos', value: qtdContatos, Icon: Phone },
  ];

  return (
    <div className="min-h-screen p-6 space-y-6" style={{ background: containerBg, color: textColor }}>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => navigate('/inteligencia-geografica')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors hover:bg-foreground/5"
          style={{ color: GREEN, border: '1px solid rgba(34,197,94,0.2)' }}
        >
          <ArrowLeft className="h-4 w-4" />
          🇧🇷 Brasil
        </button>
        <span style={{ color: cardBorder }}>/</span>
        <span className="text-sm font-bold" style={{ color: textColor }}>{nomeEstado}</span>
        {municipioSelecionado && (
          <>
            <span style={{ color: cardBorder }}>/</span>
            <span className="text-sm font-bold" style={{ color: GREEN }}>{municipioSelecionado}</span>
          </>
        )}
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold" style={{ color: textColor }}>{nomeEstado}</h1>
        <p className="text-sm" style={{ color: mutedColor }}>
          {ufUpper} · {qtdClientes} clientes · {qtdProcessos} processos · {fmt(receita)}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => {
          const glowMap: Record<string, string> = {
            Clientes: 'rgba(59, 130, 246, 0.1)',
            Processos: 'rgba(34, 197, 94, 0.1)',
            Receita: 'rgba(34, 197, 94, 0.12)',
            Contatos: 'rgba(168, 85, 247, 0.1)',
          };
          return (
            <GlassCard key={k.label} variant="service" glowColor={glowMap[k.label] || 'rgba(34, 197, 94, 0.1)'}>
              <div className="flex items-center gap-2 mb-2">
                <k.Icon className="h-4 w-4" style={{ color: GREEN }} />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{k.label}</span>
              </div>
              <p className="text-2xl font-extrabold" style={{ color: textColor }}>{k.value}</p>
            </GlassCard>
          );
        })}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="mapa" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="border-none mb-4" style={{ background: cardBg }}>
          {['mapa', 'orgaos', 'clientes', 'municipios', 'notas'].map(tab => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400"
              style={{ color: mutedColor }}
            >
              {tab === 'mapa' ? 'Mapa' : tab === 'orgaos' ? 'Órgãos e Contatos' : tab === 'clientes' ? 'Clientes' : tab === 'municipios' ? 'Municípios' : 'Notas'}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Tab: Mapa */}
        <TabsContent value="mapa" className="mt-2 space-y-3">
          <MapaEstadoMunicipios
            uf={ufUpper}
            clientesPorMunicipio={clientesMunicipio || {}}
            contatos={data?.contatos}
            legendaConfig={legendaConfig}
            onMunicipioClick={(nome) => {
              setMunicipioSelecionado(nome);
              setActiveTab('municipios');
              setBuscaMunicipio(nome);
              setTimeout(() => {
                document.getElementById('municipio-detalhe')?.scrollIntoView({ behavior: 'smooth' });
              }, 200);
            }}
          />

          {/* Interactive pin legend with popovers */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: dimColor }}>Pins:</span>
            {LEGENDA_ITENS.map(item => (
              <Popover key={item.tipo}>
                <PopoverTrigger asChild>
                  <button
                    className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg transition-all ${
                      legendaConfig[item.tipo]?.visivel ? 'opacity-100' : 'opacity-30'
                    }`}
                    style={{
                      border: `1px solid ${legendaConfig[item.tipo]?.visivel ? item.cor + '66' : cardBorder}`,
                      color: legendaConfig[item.tipo]?.visivel ? item.cor : dimColor,
                    }}
                  >
                    <span>{item.emoji}</span>
                    <span>{item.label}</span>
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-3" style={{ background: cardBg, borderColor: cardBorder }}>
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={legendaConfig[item.tipo]?.visivel}
                        onChange={() => setLegendaConfig(prev => ({
                          ...prev,
                          [item.tipo]: { ...prev[item.tipo], visivel: !prev[item.tipo].visivel }
                        }))}
                        style={{ accentColor: item.cor }}
                      />
                      <span className="text-xs" style={{ color: textColor }}>Mostrar no mapa</span>
                    </label>

                    <div>
                      <span className="text-[10px] uppercase tracking-wider" style={{ color: dimColor }}>Rating mínimo</span>
                      <div className="flex items-center gap-1 mt-1">
                        {[0,1,2,3,4,5].map(r => (
                          <button key={r}
                            onClick={() => setLegendaConfig(prev => ({
                              ...prev,
                              [item.tipo]: { ...prev[item.tipo], ratingMin: r }
                            }))}
                            className="w-6 h-6 rounded text-[10px] font-bold"
                            style={{
                              background: legendaConfig[item.tipo]?.ratingMin === r ? item.cor : inputBg,
                              border: `1px solid ${cardBorder}`,
                              color: legendaConfig[item.tipo]?.ratingMin === r ? '#fff' : mutedColor,
                            }}
                          >{r}</button>
                        ))}
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={legendaConfig[item.tipo]?.apenasComContato || false}
                        onChange={() => setLegendaConfig(prev => ({
                          ...prev,
                          [item.tipo]: { ...prev[item.tipo], apenasComContato: !prev[item.tipo].apenasComContato }
                        }))}
                        style={{ accentColor: item.cor }}
                      />
                      <span className="text-xs" style={{ color: textColor }}>Apenas com contato interno</span>
                    </label>
                  </div>
                </PopoverContent>
              </Popover>
            ))}
          </div>
        </TabsContent>

        {/* Tab: Órgãos e Contatos */}
        <TabsContent value="orgaos" className="space-y-4 mt-2">
          {Object.entries(TIPO_LABELS).map(([tipo, label]) => {
            const Icon = TIPO_ICONS[tipo] || Globe;
            const contatos = contatosByTipo[tipo] || [];
            return (
              <GlassCard variant="service" glowColor={
                tipo === 'junta_comercial' ? 'rgba(234, 179, 8, 0.1)' :
                tipo === 'outro' ? 'rgba(59, 130, 246, 0.1)' :
                tipo === 'cartorio' ? 'rgba(168, 85, 247, 0.1)' :
                tipo === 'conselho' ? 'rgba(236, 72, 153, 0.1)' :
                'rgba(34, 197, 94, 0.1)'
              }>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" style={{ color: GREEN }} />
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: textColor }}>{label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                      style={{ background: GREEN + '20', color: GREEN }}>
                      {contatos.length}
                    </span>
                  </div>
                  <button
                    onClick={() => openNew(tipo)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                    style={{ border: '1px solid rgba(34,197,94,0.3)', color: GREEN, background: 'transparent' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(34,197,94,0.1)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Plus className="h-3 w-3" /> Adicionar
                  </button>
                </div>

                {contatos.length === 0 ? (
                  <p className="text-sm" style={{ color: dimColor }}>Nenhum contato cadastrado</p>
                ) : (
                  <div className="space-y-2">
                    {contatos.map(c => (
                      <div key={c.id} className="p-3 rounded-lg" style={{ background: inputBg }}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-bold text-sm" style={{ color: textColor }}>
                                {c.nome}
                                {c.municipio && <span className="font-normal text-xs ml-2" style={{ color: mutedColor }}>· {c.municipio}</span>}
                              </p>
                              <RatingStars rating={c.rating || 0} onChange={(r) => handleUpdateRating(c.id, r)} size={12} />
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs" style={{ color: mutedColor }}>
                              {c.telefone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.telefone}</span>}
                              {c.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                              {c.site_url && (
                                <a href={c.site_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline" style={{ color: GREEN }}>
                                  <ExternalLink className="h-3 w-3" />{(() => { try { return new URL(c.site_url).hostname; } catch { return c.site_url; } })()}
                                </a>
                              )}
                            </div>
                            {c.contato_interno && <p className="text-xs" style={{ color: mutedColor }}>👤 {c.contato_interno}</p>}
                            {c.observacoes && (
                              <div className="mt-2 p-2 rounded text-xs" style={{ background: isDark ? '#0b0e1499' : '#f1f5f9', color: mutedColor, borderLeft: '2px solid rgba(34,197,94,0.2)' }}>
                                💬 {c.observacoes}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-0.5">
                            {c.site_url && (
                              <a href={c.site_url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md transition-colors hover:bg-foreground/5" title="Abrir site">
                                <ExternalLink className="h-3.5 w-3.5" style={{ color: GREEN }} />
                              </a>
                            )}
                            {c.telefone && (
                              <a href={`tel:${c.telefone}`} className="p-1.5 rounded-md transition-colors hover:bg-foreground/5" title="Ligar">
                                <Phone className="h-3.5 w-3.5" style={{ color: mutedColor }} />
                              </a>
                            )}
                            {c.email && (
                              <button onClick={() => { navigator.clipboard.writeText(c.email!); toast.success('Email copiado!'); }} className="p-1.5 rounded-md transition-colors hover:bg-foreground/5" title="Copiar email">
                                <Mail className="h-3.5 w-3.5" style={{ color: mutedColor }} />
                              </button>
                            )}
                            <button onClick={() => openEdit(c)} className="p-1.5 rounded-md transition-colors hover:bg-foreground/5" title="Editar">
                              <Pencil className="h-3.5 w-3.5" style={{ color: mutedColor }} />
                            </button>
                            <button onClick={() => removerContato.mutate({ id: c.id, uf: ufUpper })} className="p-1.5 rounded-md transition-colors hover:bg-red-500/10" title="Excluir">
                              <Trash2 className="h-3.5 w-3.5" style={{ color: '#f87171' }} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            );
          })}
        </TabsContent>

        {/* Tab: Clientes */}
        <TabsContent value="clientes" className="mt-2">
          {data?.clientes.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: dimColor }}>Nenhum cliente neste estado</p>
          ) : (
            <div className="space-y-2">
              {data?.clientes.map(c => (
                <div
                  key={c.id}
                  className="p-3 cursor-pointer transition-colors rounded-xl"
                  style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
                  onClick={() => navigate(`/clientes/${c.id}`)}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = GREEN)}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = cardBorder)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium" style={{ color: textColor }}>{c.apelido || c.nome}</p>
                      <p className="text-xs" style={{ color: mutedColor }}>{c.cnpj} · {c.processos} processos</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold" style={{ color: GREEN }}>{fmt(c.receita)}</p>
                      <p className="text-xs" style={{ color: mutedColor }}>{fmt(c.pago)} recebido</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab: Municípios */}
        <TabsContent value="municipios" className="space-y-3 mt-2">
          {/* Municipality detail panel */}
          {municipioSelecionado && (
            <div id="municipio-detalhe" className="p-4 rounded-xl" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-lg font-bold" style={{ color: textColor }}>
                    🏛️ {municipioSelecionado}
                  </h3>
                  <p className="text-xs" style={{ color: mutedColor }}>{ufUpper} · Dados do município</p>
                </div>
                <button onClick={() => setMunicipioSelecionado(null)}
                  className="text-xs hover:text-red-400 transition-colors" style={{ color: mutedColor }}>✕ Limpar seleção</button>
              </div>

              {contatosMunicipio.length > 0 ? (
                contatosMunicipio.map(c => (
                  <div key={c.id} className="p-3 rounded-lg mb-2" style={{ background: inputBg }}>
                    <div className="flex items-center gap-2">
                      <span>{PIN_EMOJI[c.tipo] || '📌'}</span>
                      <span className="font-bold text-sm" style={{ color: textColor }}>{c.nome}</span>
                      <RatingStars rating={c.rating || 0} onChange={(r) => handleUpdateRating(c.id, r)} size={12} />
                    </div>
                    {c.telefone && <p className="text-xs mt-1" style={{ color: mutedColor }}>📞 {c.telefone}</p>}
                    {c.observacoes && <p className="text-xs mt-1" style={{ color: isDark ? '#6b7280' : '#94a3b8' }}>💬 {c.observacoes}</p>}
                  </div>
                ))
              ) : (
                <p className="text-xs" style={{ color: mutedColor }}>Nenhum contato cadastrado neste município.</p>
              )}

              <button onClick={() => { setForm({ ...emptyForm(), municipio: municipioSelecionado, tipo: 'prefeitura' }); setModalOpen(true); }}
                className="mt-2 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                style={{ border: '1px solid rgba(34,197,94,0.3)', color: GREEN }}>
                <Plus className="h-3 w-3" /> Adicionar contato em {municipioSelecionado}
              </button>
            </div>
          )}

          <input
            placeholder="Buscar município..."
            value={buscaMunicipio}
            onChange={e => setBuscaMunicipio(e.target.value)}
            className="max-w-sm w-full px-3 py-2 rounded-lg text-sm"
            style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = GREEN)}
            onBlur={(e) => (e.target.style.borderColor = cardBorder)}
          />
          <div className="space-y-1 max-h-[500px] overflow-y-auto scrollbar-thin">
            {municipiosFiltrados.slice(0, 100).map(m => {
              const contatosMun = data?.contatos.filter(c => c.municipio === m.nome) || [];
              const temInfo = contatosMun.length > 0;
              return (
                <div key={m.id} className="rounded-lg p-2" style={{
                  background: temInfo ? 'rgba(34,197,94,0.05)' : 'transparent',
                  border: temInfo ? '1px solid rgba(34,197,94,0.2)' : '1px solid transparent',
                }}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm cursor-pointer" style={{ color: temInfo ? textColor : mutedColor, fontWeight: temInfo ? 600 : 400 }}
                      onClick={() => setMunicipioSelecionado(m.nome)}>{m.nome}</p>
                    <button
                      onClick={() => openNew('prefeitura', m.nome)}
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
                      style={{ color: mutedColor }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = GREEN)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = mutedColor)}
                    >
                      <Plus className="h-3 w-3" /> Info
                    </button>
                  </div>
                  {contatosMun.map(c => (
                    <div key={c.id} className="pl-4 mt-1 flex items-center justify-between text-xs" style={{ color: mutedColor }}>
                      <span>{c.nome} {c.telefone && `· ${c.telefone}`}</span>
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(c)} className="p-1 rounded hover:bg-foreground/5">
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button onClick={() => removerContato.mutate({ id: c.id, uf: ufUpper })} className="p-1 rounded hover:bg-red-500/10">
                          <Trash2 className="h-3 w-3" style={{ color: '#f87171' }} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
            {municipiosFiltrados.length > 100 && (
              <p className="text-xs text-center py-2" style={{ color: mutedColor }}>
                Mostrando 100 de {municipiosFiltrados.length} municípios. Refine a busca.
              </p>
            )}
          </div>
        </TabsContent>

        {/* Tab: Notas */}
        <TabsContent value="notas" className="mt-2">
          <div className="p-4 rounded-xl" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: mutedColor }}>
              Observações gerais — {nomeEstado}
            </h3>
            <textarea
              value={nota}
              onChange={e => { setNota(e.target.value); setNotaDirty(true); }}
              rows={10}
              placeholder={`Observações operacionais sobre ${nomeEstado}... (salva automaticamente)`}
              className="w-full rounded-lg p-3 text-sm resize-none"
              style={{ ...inputStyle, outline: 'none' }}
              onFocus={(e) => (e.target.style.borderColor = GREEN)}
              onBlur={(e) => (e.target.style.borderColor = cardBorder)}
            />
            <p className="text-xs mt-2" style={{ color: dimColor }}>Salva automaticamente após parar de digitar</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal de contato */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent style={{ background: cardBg, borderColor: cardBorder, color: textColor }}>
          <DialogHeader>
            <DialogTitle style={{ color: textColor }}>{form.id ? 'Editar' : 'Adicionar'} Contato — {ufUpper}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label style={{ color: mutedColor }}>Categoria *</Label>
              <Select value={form.tipo || 'outro'} onValueChange={v => setForm(p => ({ ...p, tipo: v }))}>
                <SelectTrigger style={inputStyle}><SelectValue /></SelectTrigger>
                <SelectContent style={{ background: cardBg, borderColor: cardBorder }}>
                  <SelectItem value="junta_comercial" style={{ color: textColor }}>📍 Junta Comercial (Matriz)</SelectItem>
                  <SelectItem value="outro" style={{ color: textColor }}>🏢 Escritório Regional</SelectItem>
                  <SelectItem value="cartorio" style={{ color: textColor }}>⚖️ Cartório</SelectItem>
                  <SelectItem value="conselho" style={{ color: textColor }}>🎓 Conselho de Classe</SelectItem>
                  <SelectItem value="prefeitura" style={{ color: textColor }}>🏛️ Prefeitura</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label style={{ color: mutedColor }}>Nome do Órgão *</Label>
              <Input value={form.nome || ''} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: JUCESP, 1º Cartório de SP" style={inputStyle} />
            </div>
            <div>
              <Label style={{ color: mutedColor }}>Município (para pin no mapa)</Label>
              <Input value={form.municipio || ''} onChange={e => setForm(p => ({ ...p, municipio: e.target.value || null }))} placeholder="Ex: São Paulo, Campinas (vazio = sede estadual)" style={inputStyle} />
              <p className="text-[10px] mt-1" style={{ color: dimColor }}>Deixe vazio para órgãos estaduais.</p>
            </div>
            <div>
              <Label style={{ color: mutedColor }}>Endereço Completo</Label>
              <Input value={form.endereco || ''} onChange={e => setForm(p => ({ ...p, endereco: e.target.value || null }))} placeholder="Rua, número, bairro, cidade - UF, CEP" style={inputStyle} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label style={{ color: mutedColor }}>Telefone</Label>
                <Input value={form.telefone || ''} onChange={e => setForm(p => ({ ...p, telefone: e.target.value || null }))} placeholder="(11) 3468-3050" style={inputStyle} />
              </div>
              <div>
                <Label style={{ color: mutedColor }}>Email</Label>
                <Input value={form.email || ''} onChange={e => setForm(p => ({ ...p, email: e.target.value || null }))} placeholder="contato@orgao.gov.br" style={inputStyle} />
              </div>
            </div>
            <div>
              <Label style={{ color: mutedColor }}>Site (URL)</Label>
              <Input value={form.site_url || ''} onChange={e => setForm(p => ({ ...p, site_url: e.target.value || null }))} placeholder="https://jucesp.sp.gov.br" style={inputStyle} />
            </div>
            <div>
              <Label style={{ color: mutedColor }}>Contato Interno (pessoa de referência)</Label>
              <Input value={form.contato_interno || ''} onChange={e => setForm(p => ({ ...p, contato_interno: e.target.value || null }))} placeholder="Ex: Maria Silva - Ramal 234" style={inputStyle} />
            </div>
            <div>
              <Label style={{ color: mutedColor }}>Observações</Label>
              <textarea
                value={form.observacoes || ''}
                onChange={e => setForm(p => ({ ...p, observacoes: e.target.value || null }))}
                rows={4}
                placeholder="Horário de atendimento, dicas internas, procedimentos especiais..."
                className="w-full rounded-lg p-3 text-sm"
                style={{ ...inputStyle, outline: 'none', resize: 'vertical' }}
              />
            </div>
            <div>
              <Label style={{ color: mutedColor }}>Avaliação</Label>
              <RatingStars rating={form.rating || 0} onChange={(r) => setForm(p => ({ ...p, rating: r }))} size={18} />
            </div>
            {/* Color picker for "outro" type */}
            {form.tipo === 'outro' && (
              <div>
                <Label style={{ color: mutedColor }}>Cor do Pin</Label>
                <div className="flex gap-2 mt-1">
                  {COLOR_OPTIONS.map(cor => (
                    <button
                      key={cor}
                      onClick={() => setForm(p => ({ ...p, pin_cor: cor }))}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${
                        form.pin_cor === cor ? 'scale-125' : ''
                      }`}
                      style={{ background: cor, borderColor: form.pin_cor === cor ? '#fff' : 'transparent' }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ border: `1px solid ${cardBorder}`, color: mutedColor, background: 'transparent' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!form.nome}
                className="px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-40"
                style={{ background: GREEN, color: '#0b0e14', border: 'none' }}
              >
                Salvar
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
