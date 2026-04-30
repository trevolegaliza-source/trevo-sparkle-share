import React from 'react';

interface BrazilSVGProps {
  colors: Record<string, string>;
  onStateMouseEnter: (uf: string, e: React.MouseEvent) => void;
  onStateMouseLeave: () => void;
  onStateClick: (uf: string) => void;
}

// Simplified Brazil map SVG paths for each state
const STATES: { id: string; d: string }[] = [
  { id: 'AC', d: 'M95,280 L95,310 L120,315 L130,305 L125,285 L110,275 Z' },
  { id: 'AM', d: 'M110,180 L90,200 L85,240 L95,270 L110,275 L130,280 L160,275 L200,260 L220,240 L230,210 L210,190 L180,180 L150,175 Z' },
  { id: 'RR', d: 'M170,120 L155,140 L150,170 L170,175 L190,170 L200,150 L195,130 Z' },
  { id: 'AP', d: 'M260,140 L245,155 L240,175 L255,190 L275,185 L280,165 L270,145 Z' },
  { id: 'PA', d: 'M200,175 L220,195 L230,215 L250,220 L280,210 L300,200 L310,180 L290,170 L270,175 L255,185 L240,175 L230,185 L215,180 Z' },
  { id: 'MA', d: 'M305,195 L310,180 L330,175 L345,185 L350,200 L340,215 L320,220 L310,210 Z' },
  { id: 'TO', d: 'M290,225 L285,250 L280,280 L295,300 L310,295 L315,270 L310,245 L300,230 Z' },
  { id: 'PI', d: 'M340,210 L345,185 L360,190 L370,210 L365,235 L350,245 L340,235 Z' },
  { id: 'CE', d: 'M370,195 L385,185 L400,190 L405,210 L390,220 L375,215 Z' },
  { id: 'RN', d: 'M400,205 L415,200 L425,210 L415,220 L400,215 Z' },
  { id: 'PB', d: 'M395,220 L415,220 L425,230 L410,235 L395,230 Z' },
  { id: 'PE', d: 'M365,235 L390,230 L410,235 L420,245 L400,250 L375,250 L360,245 Z' },
  { id: 'AL', d: 'M400,250 L415,250 L420,260 L410,265 L400,260 Z' },
  { id: 'SE', d: 'M395,265 L405,268 L410,278 L400,275 Z' },
  { id: 'BA', d: 'M310,280 L330,260 L350,250 L370,255 L395,265 L400,280 L395,310 L380,330 L360,340 L340,330 L320,310 Z' },
  { id: 'MT', d: 'M200,270 L220,260 L250,265 L275,280 L280,310 L260,330 L230,335 L210,320 L195,300 Z' },
  { id: 'GO', d: 'M280,310 L300,305 L320,310 L325,335 L315,355 L295,360 L280,350 L275,330 Z' },
  { id: 'DF', d: 'M310,340 L318,338 L320,345 L312,347 Z' },
  { id: 'MS', d: 'M220,340 L245,335 L265,340 L275,360 L265,385 L245,390 L225,380 L215,360 Z' },
  { id: 'MG', d: 'M310,340 L330,335 L355,345 L375,340 L385,355 L380,380 L360,395 L335,395 L315,385 L300,370 L295,355 Z' },
  { id: 'ES', d: 'M385,355 L400,350 L405,370 L395,385 L385,375 Z' },
  { id: 'RJ', d: 'M360,395 L380,390 L395,395 L390,410 L370,415 L355,405 Z' },
  { id: 'SP', d: 'M275,370 L300,375 L325,390 L345,400 L355,405 L345,420 L320,425 L295,415 L275,400 L265,390 Z' },
  { id: 'PR', d: 'M260,400 L280,405 L305,420 L315,430 L300,445 L275,445 L255,435 L250,420 Z' },
  { id: 'SC', d: 'M270,445 L295,448 L305,460 L290,470 L270,465 Z' },
  { id: 'RS', d: 'M255,465 L275,468 L290,475 L295,495 L280,510 L260,510 L245,500 L240,480 Z' },
  { id: 'RO', d: 'M145,280 L170,275 L195,285 L200,310 L185,325 L160,320 L145,305 Z' },
];

export default function BrazilSVG({ colors, onStateMouseEnter, onStateMouseLeave, onStateClick }: BrazilSVGProps) {
  return (
    <svg
      viewBox="60 100 380 430"
      className="w-full h-auto max-h-[450px]"
      xmlns="http://www.w3.org/2000/svg"
    >
      {STATES.map(state => (
        <path
          key={state.id}
          id={state.id}
          d={state.d}
          fill={colors[state.id] || 'hsl(var(--muted))'}
          stroke="hsl(var(--border))"
          strokeWidth="1"
          className="cursor-pointer transition-opacity hover:opacity-80"
          onMouseEnter={(e) => onStateMouseEnter(state.id, e)}
          onMouseLeave={onStateMouseLeave}
          onClick={() => onStateClick(state.id)}
        />
      ))}
      {/* State labels */}
      {STATES.map(state => {
        const match = state.d.match(/M([\d.]+),([\d.]+)/);
        if (!match) return null;
        // Calculate rough center from path
        const coords = state.d.match(/[\d.]+/g)?.map(Number) || [];
        const xs = coords.filter((_, i) => i % 2 === 0);
        const ys = coords.filter((_, i) => i % 2 === 1);
        const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
        const cy = ys.reduce((a, b) => a + b, 0) / ys.length;
        return (
          <text
            key={`label-${state.id}`}
            x={cx}
            y={cy}
            textAnchor="middle"
            dominantBaseline="central"
            className="pointer-events-none fill-foreground text-[7px] font-bold"
            style={{ fontSize: '7px' }}
          >
            {state.id}
          </text>
        );
      })}
    </svg>
  );
}
