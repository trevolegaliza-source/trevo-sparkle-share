import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { geoCache } from '@/lib/geo-cache';
import { Search } from 'lucide-react';
import { UF_NOMES } from '@/constants/estados-brasil';
import { useTheme } from 'next-themes';
import type { ContatoEstado } from '@/hooks/useInteligenciaGeografica';

interface Props {
  uf: string;
  clientesPorMunicipio?: Record<string, number>;
  contatos?: ContatoEstado[];
  legendaConfig?: Record<string, { visivel: boolean; ratingMin: number; apenasComContato: boolean }>;
  onMunicipioClick?: (nome: string) => void;
}

const UF_TO_IBGE: Record<string, string> = {
  RO:'11',AC:'12',AM:'13',RR:'14',PA:'15',AP:'16',TO:'17',
  MA:'21',PI:'22',CE:'23',RN:'24',PB:'25',PE:'26',AL:'27',
  SE:'28',BA:'29',MG:'31',ES:'32',RJ:'33',SP:'35',PR:'41',
  SC:'42',RS:'43',MS:'50',MT:'51',GO:'52',DF:'53',
};

const GREEN_BRIGHT = '#22c55e';

const PIN_COLORS: Record<string, string> = {
  junta_comercial: '#f59e0b',
  outro: '#3b82f6',
  cartorio: '#8b5cf6',
  conselho: '#ec4899',
  prefeitura: '#22c55e',
};

const PIN_EMOJIS: Record<string, string> = {
  junta_comercial: '📍',
  outro: '🏢',
  cartorio: '⚖️',
  conselho: '🎓',
  prefeitura: '🏛️',
};

function getMunNome(d: any): string {
  return d.properties?.name || d.properties?.nome || d.properties?.NM_MUN || 'Município';
}

export function MapaEstadoMunicipios({ uf, clientesPorMunicipio = {}, contatos, legendaConfig, onMunicipioClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<any>(null);
  const projectionRef = useRef<any>(null);
  const pathGenRef = useRef<any>(null);
  const [geoData, setGeoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buscaMunicipio, setBuscaMunicipio] = useState('');
  const [zoomLevel, setZoomLevel] = useState(1);
  const clientesRef = useRef(clientesPorMunicipio);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';

  useEffect(() => { clientesRef.current = clientesPorMunicipio; }, [clientesPorMunicipio]);

  // Clean up old sessionStorage keys
  useEffect(() => {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (key.startsWith('mun_geo') || key.startsWith('municipios_geo'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => sessionStorage.removeItem(k));
    } catch (_) { /* ignore */ }
  }, []);

  // Load municipality GeoJSON
  useEffect(() => {
    const fetchMunicipios = async () => {
      setLoading(true);
      setError(null);
      try {
        const cacheKey = `municipios_${uf}`;
        const cached = geoCache.get(cacheKey);
        if (cached) { setGeoData(cached); setLoading(false); return; }

        const codigoIBGE = UF_TO_IBGE[uf];
        if (!codigoIBGE) throw new Error('UF não encontrada');

        const url = `https://raw.githubusercontent.com/tbrugz/geodata-br/master/geojson/geojs-${codigoIBGE}-mun.json`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Erro ao carregar: ${res.status}`);
        const data = await res.json();
        if (!data.features?.length) throw new Error('Sem municípios');

        geoCache.set(cacheKey, data);
        setGeoData(data);
      } catch (err: any) {
        console.error('Erro municípios:', err);
        setError(err.message);
      } finally { setLoading(false); }
    };
    fetchMunicipios();
  }, [uf]);

  // Prevent page scroll when wheeling inside SVG
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => { e.preventDefault(); };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  const getMunFill = useCallback((d: any): string => {
    const nome = getMunNome(d).toUpperCase();
    const qtd = clientesRef.current[nome] || 0;
    const munVazio = isDark ? '#0d1117' : '#f8fafc';
    if (qtd >= 5) return '#22c55e';
    if (qtd >= 3) return '#16a34a';
    if (qtd >= 1) return '#14532d';
    return munVazio;
  }, [isDark]);

  // Render municipality map (base layer only)
  useEffect(() => {
    if (!geoData || !svgRef.current || !containerRef.current) return;

    const bordaMun = isDark ? '#1e3a2a' : '#bbf7d0';
    const labelColor = isDark ? '#e6edf3' : '#1e293b';
    const labelMunColor = isDark ? '#8b949e' : '#64748b';
    const tooltipBg = isDark ? '#161b22' : '#ffffff';
    const tooltipBorder = isDark ? '#30363d' : '#e2e8f0';
    const mutedColor = isDark ? '#8b949e' : '#64748b';

    const svg = d3.select(svgRef.current);
    const width = containerRef.current.clientWidth;
    const height = 500;
    svg.attr('viewBox', `0 0 ${width} ${height}`);
    svg.selectAll('*').remove();

    const projection = d3.geoMercator()
      .fitExtent([[20, 20], [width - 20, height - 20]], geoData);
    projectionRef.current = projection;
    const pathGen = d3.geoPath().projection(projection);
    pathGenRef.current = pathGen;

    // Glow filter
    const defs = svg.append('defs');
    const glow = defs.append('filter').attr('id', 'mun-glow')
      .attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
    glow.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'blur');
    const merge = glow.append('feMerge');
    merge.append('feMergeNode').attr('in', 'blur');
    merge.append('feMergeNode').attr('in', 'SourceGraphic');

    const g = svg.append('g');

    // Zoom
    const zoom = d3.zoom()
      .scaleExtent([0.5, 20])
      .filter((event: any) => {
        if (event.type === 'mousedown' && event.button === 2) return false;
        return true;
      })
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        const k = event.transform.k;
        setZoomLevel(k);

        g.selectAll('.pin').attr('r', 5 / k).attr('stroke-width', 1.5 / k);
        g.selectAll('.pins-layer text').attr('font-size', (7 / k) + 'px');
        g.selectAll('path.municipio').attr('stroke-width', 0.4 / k);
        // Municipality labels: visible at high zoom
        g.selectAll('text.mun-label')
          .attr('font-size', `${7 / k}px`)
          .attr('opacity', k >= 3 ? Math.min(1, (k - 3) / 1.5) : 0);
      });

    svg.call(zoom as any);
    zoomRef.current = zoom;

    // Municipalities
    g.selectAll('path.municipio')
      .data(geoData.features)
      .enter()
      .append('path')
      .attr('class', 'municipio')
      .attr('d', pathGen as any)
      .attr('fill', (d: any) => getMunFill(d))
      .attr('stroke', bordaMun)
      .attr('stroke-width', 0.4)
      .attr('cursor', 'pointer')
      .on('mouseover', function (event: any, d: any) {
        d3.select(this)
          .attr('fill', GREEN_BRIGHT)
          .attr('stroke', '#4ade80')
          .attr('stroke-width', 1)
          .attr('filter', 'url(#mun-glow)');

        const nome = getMunNome(d);
        const qtd = clientesRef.current[nome.toUpperCase()] || 0;

        if (tooltipRef.current && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          tooltipRef.current.style.display = 'block';
          tooltipRef.current.style.left = (event.clientX - rect.left + 16) + 'px';
          tooltipRef.current.style.top = (event.clientY - rect.top - 10) + 'px';
          tooltipRef.current.style.background = tooltipBg;
          tooltipRef.current.style.borderColor = tooltipBorder;
          tooltipRef.current.innerHTML = `
            <div style="font-size:14px;font-weight:800;color:${GREEN_BRIGHT};margin-bottom:4px;">${nome}</div>
            <div style="font-size:11px;color:${mutedColor};">
              ${qtd > 0
                ? `<div style="display:flex;justify-content:space-between;gap:20px;"><span>Clientes</span><span style="color:${GREEN_BRIGHT};font-weight:700;">${qtd}</span></div>`
                : `<div style="color:${isDark ? '#484f58' : '#94a3b8'};">Sem clientes cadastrados</div>`
              }
            </div>`;
        }
      })
      .on('mousemove', function (event: any) {
        if (tooltipRef.current && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          tooltipRef.current.style.left = (event.clientX - rect.left + 16) + 'px';
          tooltipRef.current.style.top = (event.clientY - rect.top - 10) + 'px';
        }
      })
      .on('mouseout', function (_event: any, d: any) {
        d3.select(this)
          .attr('fill', getMunFill(d))
          .attr('stroke', bordaMun)
          .attr('stroke-width', 0.4)
          .attr('filter', 'none');
        if (tooltipRef.current) tooltipRef.current.style.display = 'none';
      })
      .on('click', function (event: any, d: any) {
        event.stopPropagation();
        const nome = getMunNome(d);

        // Highlight selected municipality
        const currentK = d3.zoomTransform(svgRef.current!).k;
        g.selectAll('path.municipio')
          .attr('fill', (dd: any) => {
            return getMunNome(dd) === nome ? GREEN_BRIGHT : getMunFill(dd);
          })
          .attr('stroke-width', (dd: any) => {
            return getMunNome(dd) === nome ? 2 / currentK : 0.4 / currentK;
          });

        if (onMunicipioClick) onMunicipioClick(nome);
      });

    // Click on background clears selection
    svg.on('click', () => {
      const currentK = d3.zoomTransform(svgRef.current!).k;
      g.selectAll('path.municipio')
        .transition().duration(200)
        .attr('fill', (d: any) => getMunFill(d))
        .attr('stroke-width', 0.4 / currentK);
    });

    // All municipality labels (hidden by default, visible on zoom >= 3)
    g.selectAll('text.mun-label')
      .data(geoData.features)
      .enter()
      .append('text')
      .attr('class', 'mun-label')
      .attr('x', (d: any) => pathGen.centroid(d)[0])
      .attr('y', (d: any) => pathGen.centroid(d)[1])
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', '5px')
      .attr('font-weight', (d: any) => (clientesRef.current[getMunNome(d).toUpperCase()] || 0) > 0 ? '700' : '500')
      .attr('fill', (d: any) => (clientesRef.current[getMunNome(d).toUpperCase()] || 0) > 0 ? labelColor : labelMunColor)
      .attr('pointer-events', 'none')
      .attr('opacity', 0)
      .text((d: any) => getMunNome(d));

  }, [geoData, clientesPorMunicipio, getMunFill, onMunicipioClick, isDark]);

  // Render pins layer (SEPARATE from base map — toggling pins won't reset zoom)
  useEffect(() => {
    if (!geoData || !svgRef.current || !pathGenRef.current) return;
    const svg = d3.select(svgRef.current);
    const g = svg.select('g');
    if (g.empty()) return;

    g.selectAll('.pins-layer').remove();
    if (!contatos || contatos.length === 0) return;

    const pinsGroup = g.append('g').attr('class', 'pins-layer');
    const pathGen = pathGenRef.current;

    const tooltipBg = isDark ? '#161b22' : '#ffffff';
    const tooltipBorder = isDark ? '#30363d' : '#e2e8f0';
    const pinBg = isDark ? '#0b0e14' : '#ffffff';

    // Get current zoom scale to size pins correctly
    const currentK = svgRef.current ? d3.zoomTransform(svgRef.current).k : 1;

    contatos.forEach(contato => {
      // Apply advanced filters
      if (legendaConfig) {
        const cfg = legendaConfig[contato.tipo];
        if (cfg && !cfg.visivel) return;
        if (cfg && cfg.ratingMin > 0 && (contato.rating || 0) < cfg.ratingMin) return;
        if (cfg && cfg.apenasComContato && !contato.contato_interno) return;
      }

      let centroid: [number, number] | null = null;

      if (contato.municipio) {
        const feature = geoData.features.find((f: any) => {
          const nome = (f.properties?.name || '').toUpperCase();
          return nome === contato.municipio!.toUpperCase();
        });
        if (feature) centroid = pathGen.centroid(feature) as [number, number];
      } else {
        centroid = pathGen.centroid(geoData) as [number, number];
      }

      if (!centroid || isNaN(centroid[0]) || isNaN(centroid[1])) return;

      const color = (contato as any).pin_cor || PIN_COLORS[contato.tipo] || '#6b7280';

      pinsGroup.append('circle')
        .attr('cx', centroid[0])
        .attr('cy', centroid[1])
        .attr('r', 5 / currentK)
        .attr('fill', color)
        .attr('stroke', pinBg)
        .attr('stroke-width', 1.5 / currentK)
        .attr('cursor', 'pointer')
        .attr('class', `pin pin-${contato.tipo}`)
        .on('mouseover', function (event: any) {
          const k = d3.zoomTransform(svgRef.current!).k;
          d3.select(this).attr('r', 7 / k).attr('filter', 'url(#mun-glow)');
          const stars = '⭐'.repeat(contato.rating || 0) + '☆'.repeat(5 - (contato.rating || 0));
          if (tooltipRef.current && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            tooltipRef.current.style.display = 'block';
            tooltipRef.current.style.left = (event.clientX - rect.left + 16) + 'px';
            tooltipRef.current.style.top = (event.clientY - rect.top - 10) + 'px';
            tooltipRef.current.style.background = tooltipBg;
            tooltipRef.current.style.borderColor = tooltipBorder;
            tooltipRef.current.innerHTML = `
              <div style="font-size:13px;font-weight:800;color:${color};margin-bottom:4px;">
                ${PIN_EMOJIS[contato.tipo] || '📌'} ${contato.nome}
              </div>
              <div style="font-size:11px;color:${isDark ? '#8b949e' : '#64748b'};line-height:1.6;">
                ${contato.municipio ? `<div>📍 ${contato.municipio}</div>` : '<div>📍 Sede estadual</div>'}
                ${contato.telefone ? `<div>📞 ${contato.telefone}</div>` : ''}
                ${contato.email ? `<div>✉️ ${contato.email}</div>` : ''}
                ${contato.contato_interno ? `<div>👤 ${contato.contato_interno}</div>` : ''}
                <div style="margin-top:4px;">${stars}</div>
                ${contato.observacoes ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid ${isDark ? '#30363d' : '#e2e8f0'};color:${isDark ? '#6b7280' : '#94a3b8'};font-size:10px;">💬 ${contato.observacoes}</div>` : ''}
              </div>`;
          }
        })
        .on('mousemove', function (event: any) {
          if (tooltipRef.current && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            tooltipRef.current.style.left = (event.clientX - rect.left + 16) + 'px';
            tooltipRef.current.style.top = (event.clientY - rect.top - 10) + 'px';
          }
        })
        .on('mouseout', function () {
          const k = d3.zoomTransform(svgRef.current!).k;
          d3.select(this).attr('r', 5 / k).attr('filter', 'none');
          if (tooltipRef.current) tooltipRef.current.style.display = 'none';
        });

      // Label for junta_comercial pins
      if (contato.tipo === 'junta_comercial') {
        pinsGroup.append('text')
          .attr('class', 'pin-label')
          .attr('x', centroid[0])
          .attr('y', centroid[1] - 10 / currentK)
          .attr('text-anchor', 'middle')
          .attr('font-size', `${7 / currentK}px`)
          .attr('font-weight', '700')
          .attr('fill', color)
          .attr('pointer-events', 'none')
          .text(contato.nome.split(' ')[0]);
      }
    });
  }, [geoData, contatos, legendaConfig, isDark]);

  // Highlight municipalities based on search
  const highlightMunicipio = useCallback((query: string) => {
    if (!svgRef.current || !geoData) return;
    const g = d3.select(svgRef.current).select('g');
    const q = query.toLowerCase().trim();

    g.selectAll('path.municipio')
      .transition()
      .duration(200)
      .attr('fill', (d: any) => {
        if (!q) return getMunFill(d);
        const nome = (getMunNome(d) || '').toLowerCase();
        if (nome.includes(q)) return '#22c55e';
        return isDark ? '#060809' : '#e2e8f0';
      })
      .attr('opacity', (d: any) => {
        if (!q) return 1;
        const nome = (getMunNome(d) || '').toLowerCase();
        return nome.includes(q) ? 1 : 0.3;
      });

    if (q.length >= 3 && zoomRef.current) {
      const matchFeature = geoData.features.find((f: any) =>
        (getMunNome(f) || '').toLowerCase().includes(q)
      );
      if (matchFeature && projectionRef.current) {
        const svg = d3.select(svgRef.current);
        const pathGen = d3.geoPath().projection(projectionRef.current);
        const [[x0, y0], [x1, y1]] = pathGen.bounds(matchFeature);
        const cx = (x0 + x1) / 2;
        const cy = (y0 + y1) / 2;
        const w = svgRef.current.clientWidth || 800;
        svg.transition().duration(500).call(
          zoomRef.current.transform,
          d3.zoomIdentity.translate(w / 2 - cx * 3, 250 - cy * 3).scale(3)
        );
      }
    } else if (!q && zoomRef.current) {
      d3.select(svgRef.current).transition().duration(500).call(
        zoomRef.current.transform,
        d3.zoomIdentity
      );
    }
  }, [geoData, getMunFill, isDark]);

  const handleZoomIn = () => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 1.5);
  };
  const handleZoomOut = () => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 0.67);
  };
  const handleZoomReset = () => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(500).call(zoomRef.current.transform, d3.zoomIdentity);
  };

  const mapBg = isDark ? '#0b0e14' : '#f1f5f9';
  const inputBg = isDark ? '#161b22' : '#fff';
  const inputBorder = isDark ? '#30363d' : '#e2e8f0';
  const inputColor = isDark ? '#e6edf3' : '#1e293b';
  const legendMuted = isDark ? '#8b949e' : '#64748b';
  const legendDim = isDark ? '#484f58' : '#94a3b8';
  const btnBg = isDark ? '#161b22' : '#fff';
  const btnBorder = isDark ? '#30363d' : '#e2e8f0';

  if (loading) return (
    <div className="flex items-center justify-center h-[500px] rounded-xl" style={{ background: mapBg }}>
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm" style={{ color: legendMuted }}>Carregando municípios...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center h-[500px] rounded-xl" style={{ background: mapBg }}>
      <p className="text-sm" style={{ color: '#ef4444' }}>Erro ao carregar mapa: {error}</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: legendDim }} />
        <input
          type="text"
          value={buscaMunicipio}
          onChange={(e) => {
            setBuscaMunicipio(e.target.value);
            highlightMunicipio(e.target.value);
          }}
          placeholder={`Buscar município em ${UF_NOMES[uf] || uf}...`}
          className="w-full pl-9 pr-4 py-2 rounded-lg text-sm"
          style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: inputColor, outline: 'none' }}
          onFocus={(e) => e.target.style.borderColor = '#22c55e'}
          onBlur={(e) => e.target.style.borderColor = inputBorder}
        />
      </div>

      {/* Map container */}
      <div
        ref={containerRef}
        className="relative rounded-xl overflow-hidden"
        style={{ background: mapBg }}
        onMouseLeave={() => { if (tooltipRef.current) tooltipRef.current.style.display = 'none'; }}
      >
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: `radial-gradient(${isDark ? '#30363d' : '#cbd5e1'} 1px, transparent 1px)`, backgroundSize: '20px 20px', pointerEvents: 'none' }} />
        <svg ref={svgRef} width="100%" height="500" style={{ display: 'block' }} />
        <div ref={tooltipRef} style={{ display: 'none', position: 'absolute', zIndex: 50, background: isDark ? '#161b22' : '#fff', border: `1px solid ${isDark ? '#30363d' : '#e2e8f0'}`, borderRadius: '12px', padding: '14px 18px', boxShadow: '0 8px 32px rgba(34,197,94,0.15)', minWidth: '180px', pointerEvents: 'none' }} />

        {/* Zoom buttons */}
        <div className="absolute top-4 right-4 flex flex-col gap-1 z-10">
          <button onClick={handleZoomIn}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-colors hover:border-green-500"
            style={{ background: btnBg, border: `1px solid ${btnBorder}`, color: legendMuted }}>+</button>
          <button onClick={handleZoomOut}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-colors hover:border-green-500"
            style={{ background: btnBg, border: `1px solid ${btnBorder}`, color: legendMuted }}>−</button>
          <button onClick={handleZoomReset}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-colors hover:border-green-500"
            style={{ background: btnBg, border: `1px solid ${btnBorder}`, color: legendMuted }}
            title="Resetar zoom">↺</button>
          <span className="text-[10px] mt-1 text-center block" style={{ color: legendDim }}>
            {Math.round(zoomLevel * 100)}%
          </span>
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 flex items-center gap-3" style={{ color: legendMuted, fontSize: '10px' }}>
          <span className="uppercase tracking-wider font-bold" style={{ color: legendDim }}>Legenda:</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: '#22c55e' }} />5+ cli</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: '#16a34a' }} />3-4 cli</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: '#14532d' }} />1-2 cli</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: isDark ? '#0d1117' : '#f8fafc', border: `1px solid ${isDark ? '#1e3a2a' : '#bbf7d0'}` }} />0</span>
        </div>

        {/* Count */}
        <div className="absolute top-4 left-4 text-xs" style={{ color: legendDim }}>
          {geoData?.features?.length || 0} municípios
        </div>
      </div>
    </div>
  );
}
