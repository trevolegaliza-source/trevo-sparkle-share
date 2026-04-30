import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin } from 'lucide-react';
import { UF_NOMES } from '@/constants/estados-brasil';
import BrazilSVG from '@/assets/brazil-map';

function getColor(count: number): string {
  if (count === 0) return 'hsl(var(--muted))';
  if (count <= 2) return '#dcfce7';
  if (count <= 5) return '#86efac';
  if (count <= 10) return '#4C9F38';
  return '#166534';
}

const LEGENDA = [
  { label: '11+ clientes', color: '#166534' },
  { label: '6-10 clientes', color: '#4C9F38' },
  { label: '3-5 clientes', color: '#86efac' },
  { label: '1-2 clientes', color: '#dcfce7' },
  { label: 'Sem clientes', color: 'hsl(var(--muted))' },
];

export default function MapaBrasil() {
  const navigate = useNavigate();
  const [tooltip, setTooltip] = useState<{ uf: string; count: number; x: number; y: number } | null>(null);

  const { data: contagem, isLoading } = useQuery({
    queryKey: ['mapa_clientes_estado'],
    queryFn: async () => {
      const { data } = await supabase
        .from('clientes')
        .select('estado')
        .eq('is_archived', false)
        .not('estado', 'is', null);
      const result: Record<string, number> = {};
      data?.forEach((c: any) => {
        if (c.estado) result[c.estado] = (result[c.estado] || 0) + 1;
      });
      return result;
    },
  });

  const { totalClientes, totalEstados } = useMemo(() => {
    if (!contagem) return { totalClientes: 0, totalEstados: 0 };
    const vals = Object.values(contagem);
    return {
      totalClientes: vals.reduce((a, b) => a + b, 0),
      totalEstados: vals.length,
    };
  }, [contagem]);

  const colors = useMemo(() => {
    const c: Record<string, string> = {};
    const ufs = Object.keys(UF_NOMES);
    ufs.forEach(uf => { c[uf] = getColor(contagem?.[uf] || 0); });
    return c;
  }, [contagem]);

  const handleMouseEnter = (uf: string, e: React.MouseEvent) => {
    const rect = (e.currentTarget as SVGElement).closest('svg')?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({
      uf,
      count: contagem?.[uf] || 0,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  if (isLoading) {
    return (
      <Card className="border-border/60">
        <CardContent className="p-6">
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          <MapPin className="h-4 w-4" />
          Distribuição de Clientes por Estado
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Map */}
          <div className="relative flex-1 lg:flex-[7]">
            <div className="relative">
              <BrazilSVG
                colors={colors}
                onStateMouseEnter={handleMouseEnter}
                onStateMouseLeave={() => setTooltip(null)}
                onStateClick={(uf) => navigate(`/clientes?estado=${uf}`)}
              />
              {tooltip && (
                <div
                  className="absolute z-50 pointer-events-none px-3 py-2 rounded-lg border bg-popover text-popover-foreground shadow-md text-sm"
                  style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
                >
                  <p className="font-semibold">{UF_NOMES[tooltip.uf]} ({tooltip.uf})</p>
                  <p className="text-xs text-muted-foreground">{tooltip.count} cliente{tooltip.count !== 1 ? 's' : ''} ativo{tooltip.count !== 1 ? 's' : ''}</p>
                </div>
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="lg:flex-[3] flex flex-col justify-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Legenda</p>
            <div className="space-y-2">
              {LEGENDA.map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-sm flex-shrink-0 border border-border/40" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-foreground">{item.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border/40 space-y-1">
              <p className="text-sm text-foreground font-medium">Total: {totalClientes} cliente{totalClientes !== 1 ? 's' : ''}</p>
              <p className="text-xs text-muted-foreground">em {totalEstados} estado{totalEstados !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
