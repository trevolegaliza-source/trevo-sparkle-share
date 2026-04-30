import { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEstadosResumo } from '@/hooks/useInteligenciaGeografica';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { UF_NOMES } from '@/constants/estados-brasil';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Users, Kanban, DollarSign, ChevronRight } from 'lucide-react';
import { MapaBrasilEnterprise, type EstadoData } from '@/components/mapa/MapaBrasilEnterprise';
import { useTheme } from 'next-themes';
import { GlassCard } from '@/components/ui/glass-card';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function InteligenciaGeografica() {
  const navigate = useNavigate();
  const { data: estadoData, isLoading } = useEstadosResumo();
  const [hoveredUF, setHoveredUF] = useState<string | null>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';

  // Fetch average rating per state
  const { data: ratingsPorEstado } = useQuery({
    queryKey: ['ratings_por_estado'],
    queryFn: async () => {
      const { data } = await (supabase.from('contatos_estado' as any) as any)
        .select('uf, rating');
      const map: Record<string, { soma: number; count: number }> = {};
      (data || []).forEach((c: any) => {
        if (!c.uf || !c.rating) return;
        if (!map[c.uf]) map[c.uf] = { soma: 0, count: 0 };
        map[c.uf].soma += c.rating;
        map[c.uf].count++;
      });
      const result: Record<string, number> = {};
      for (const [uf, v] of Object.entries(map)) {
        result[uf] = v.soma / v.count;
      }
      return result;
    },
    staleTime: 2 * 60 * 1000,
  });

  const handleHover = useCallback((uf: string | null) => {
    setHoveredUF(uf);
  }, []);

  const estadosComDados: EstadoData[] = useMemo(() => {
    if (!estadoData) return [];
    return Object.keys(UF_NOMES).map(uf => ({
      uf,
      nome: UF_NOMES[uf],
      clientes: estadoData[uf]?.qtdClientes || 0,
      processos: estadoData[uf]?.qtdProcessos || 0,
      receita: estadoData[uf]?.receita || 0,
    }));
  }, [estadoData]);

  const ranking = useMemo(() => {
    return estadosComDados.filter(e => e.clientes > 0).sort((a, b) => b.clientes - a.clientes);
  }, [estadosComDados]);

  const totals = useMemo(() => {
    if (!estadoData) return { clientes: 0, processos: 0, estados: 0, receita: 0 };
    const vals = Object.values(estadoData);
    return {
      clientes: vals.reduce((s, e) => s + e.qtdClientes, 0),
      processos: vals.reduce((s, e) => s + e.qtdProcessos, 0),
      estados: vals.filter(e => e.qtdClientes > 0).length,
      receita: vals.reduce((s, e) => s + e.receita, 0),
    };
  }, [estadoData]);

  const dadosExibidos = hoveredUF
    ? estadosComDados.find(d => d.uf === hoveredUF)
    : null;

  // Theme-aware colors
  const textColor = isDark ? '#e6edf3' : '#1e293b';
  const mutedColor = isDark ? '#8b949e' : '#64748b';
  const dimColor = isDark ? '#484f58' : '#94a3b8';
  const cardBg = isDark ? '#161b22' : '#ffffff';
  const cardBorder = isDark ? '#30363d' : '#e2e8f0';
  const containerBg = isDark ? '#0b0e14' : '#f8fafc';

  if (isLoading) {
    return (
      <div className="space-y-6" style={{ background: containerBg }}>
        <Skeleton className="h-8 w-80" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const kpis = [
    {
      label: hoveredUF ? 'Estado' : 'Estados Ativos',
      valor: hoveredUF ? hoveredUF : totals.estados,
      Icon: MapPin,
    },
    {
      label: 'Clientes',
      valor: dadosExibidos ? dadosExibidos.clientes : totals.clientes,
      Icon: Users,
    },
    {
      label: 'Processos',
      valor: dadosExibidos ? dadosExibidos.processos : totals.processos,
      Icon: Kanban,
    },
    {
      label: 'Receita',
      valor: fmt(dadosExibidos ? dadosExibidos.receita : totals.receita),
      Icon: DollarSign,
      isReceita: true,
    },
  ];

  const kpiSubLabel = hoveredUF ? (UF_NOMES[hoveredUF] || hoveredUF) : 'Total Brasil';

  return (
    <div className="p-6 rounded-xl space-y-6" style={{ background: containerBg }}>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: textColor }}>
          <MapPin className="h-6 w-6" style={{ color: GREEN_BRIGHT }} /> Inteligência Geográfica
        </h1>
        <p className="text-sm" style={{ color: mutedColor }}>CRM Territorial — Clientes, órgãos e contatos por estado</p>
      </div>

      {/* KPIs */}
      <div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpis.map(kpi => (
            <GlassCard key={kpi.label} variant="service" glowColor={kpi.isReceita ? 'rgba(34, 197, 94, 0.12)' : 'rgba(59, 130, 246, 0.1)'}>
              <div className="flex items-center gap-2 mb-2">
                <kpi.Icon className="h-4 w-4" style={{ color: GREEN_BRIGHT }} />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{kpi.label}</span>
              </div>
              <p className={`text-2xl font-extrabold`} style={{ color: kpi.isReceita ? GREEN_BRIGHT : textColor }}>
                {kpi.valor}
              </p>
              <p className="text-[10px] mt-1 text-muted-foreground/70">{kpiSubLabel}</p>
            </GlassCard>
          ))}
        </div>

        <div className="h-8 flex items-center justify-center">
          {hoveredUF ? (
            <button onClick={() => navigate(`/inteligencia-geografica/${hoveredUF}`)}
              className="text-xs hover:underline transition-opacity duration-200" style={{ color: GREEN_BRIGHT }}>
              Ver detalhes de {UF_NOMES[hoveredUF]} →
            </button>
          ) : (
            <span className="text-xs" style={{ color: dimColor }}>Passe o mouse sobre um estado</span>
          )}
        </div>
      </div>

      {/* Map + Ranking */}
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 lg:flex-[7]">
          <MapaBrasilEnterprise
            dadosEstados={estadosComDados}
            onHover={handleHover}
          />
        </div>

        {/* Ranking */}
        <GlassCard variant="sm" glowColor="rgba(34, 197, 94, 0.08)" className="lg:flex-[3]">
          <h3 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: GREEN_BRIGHT }}>Ranking por Estado</h3>
          {ranking.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: mutedColor }}>Nenhum cliente cadastrado</p>
          ) : (
            <div className="space-y-1">
              {ranking.slice(0, 12).map((e, i) => {
                const ratingMedio = ratingsPorEstado?.[e.uf] || 0;
                return (
                  <div key={e.uf}
                    className="flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer transition-colors"
                    style={{ color: textColor }}
                    onClick={() => navigate(`/inteligencia-geografica/${e.uf}`)}
                    onMouseEnter={(ev) => (ev.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)')}
                    onMouseLeave={(ev) => (ev.currentTarget.style.background = 'transparent')}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold w-5" style={{ color: mutedColor }}>{i + 1}.</span>
                      <span className="font-bold text-sm">{e.uf}</span>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-3 text-xs">
                        <span style={{ color: mutedColor }}>{e.clientes} cli</span>
                        <span className="font-bold" style={{ color: GREEN_BRIGHT }}>{fmt(e.receita)}</span>
                        <ChevronRight className="h-3 w-3" style={{ color: mutedColor }} />
                      </div>
                      {ratingMedio > 0 && (
                        <div className="text-[10px] mt-0.5" style={{ color: '#f59e0b' }}>
                          {'⭐'.repeat(Math.round(ratingMedio))} {ratingMedio.toFixed(1)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {ranking.length > 12 && (
                <p className="text-xs text-center pt-2" style={{ color: mutedColor }}>+ {ranking.length - 12} estados</p>
              )}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}

const GREEN_BRIGHT = '#22c55e';
