/**
 * Mapa do Brasil animado (hero direito).
 * Paths reais dos 27 estados (CC-BY 4.0 — VictorCazanave/svg-maps).
 *
 * Animação: "scan" sequencial por todos os estados (cada um acende ao chegar a vez).
 * DSG-04 (27/05 noite): checks estáticos em cada estado, exceto o "ativo" do scan
 * que pulsa. Antes: 27 pulse-dots infinite competindo. Agora: pulso só no scanIdx.
 *
 * Extraído do arquivo monolítico em 29/05 — só movimentação.
 * Animações dependem dos keyframes globais (`pulse-dot`, `ring-expand`) que
 * continuam definidas inline na TerceirizacaoPublicaView.
 */
import { useEffect, useMemo, useState } from 'react';
import { BRASIL_ESTADOS_PATHS } from '@/assets/brasil-states-paths';
import { BRASIL_CENTROS } from './constants';

export function MapaBrasilAnimado() {
  const estadosComCentro = useMemo(() =>
    BRASIL_ESTADOS_PATHS.map((st) => ({
      id: st.id,
      d: st.d,
      cx: BRASIL_CENTROS[st.id]?.[0] ?? 300,
      cy: BRASIL_CENTROS[st.id]?.[1] ?? 300,
    })),
  []);

  // Animação: "scan" sequencial por todos os estados (cada um acende ao chegar a vez)
  const [scanIdx, setScanIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => {
      setScanIdx((i) => (i + 1) % estadosComCentro.length);
    }, 700);
    return () => clearInterval(t);
  }, [estadosComCentro.length]);

  return (
    <div className="relative w-full max-w-[380px]">
      {/* Badge topo */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <span className="relative flex h-2 w-2">
          <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-75 pulse-dot" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-300" />
        </span>
        <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-200 font-bold">
          Atuação Nacional
        </p>
      </div>

      {/* SVG do Brasil com glow */}
      <div className="relative aspect-[613/639]">
        {/* halo de fundo */}
        <div className="absolute inset-0 bg-emerald-500/15 blur-2xl rounded-full" />

        <svg
          viewBox="0 0 613 639"
          className="relative w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="Mapa do Brasil destacando atuação em todos os 26 estados e Distrito Federal"
        >
          <defs>
            <linearGradient id="brasilFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.85" />
              <stop offset="55%" stopColor="#059669" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#047857" stopOpacity="0.65" />
            </linearGradient>
            <linearGradient id="brasilHi" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity="1" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="1" />
            </linearGradient>
            <filter id="brasilGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="checkGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Estados preenchidos com hover acende */}
          <g filter="url(#brasilGlow)">
            {estadosComCentro.map((st, idx) => {
              const ativo = idx === scanIdx;
              return (
                <path
                  key={`p-${st.id}`}
                  d={st.d}
                  fill={ativo ? 'url(#brasilHi)' : 'url(#brasilFill)'}
                  stroke="#a7f3d0"
                  strokeWidth={ativo ? '2.5' : '1.2'}
                  strokeLinejoin="round"
                  style={{ transition: 'fill 0.35s ease, stroke-width 0.35s ease' }}
                />
              );
            })}
          </g>

          {/* DSG-04 (27/05 noite): checks estáticos em cada estado, exceto o "ativo" do scan
              que pulsa. Antes: 27 pulse-dots infinite competindo. Agora: pulso só no scanIdx. */}
          {estadosComCentro.map((st, idx) => (
            <g key={`chk-${st.id}`}>
              {idx === scanIdx && (
                <circle
                  cx={st.cx}
                  cy={st.cy}
                  r="9"
                  fill="#10b981"
                  opacity="0.35"
                  style={{
                    animation: 'pulse-dot 2.4s ease-in-out infinite',
                    transformOrigin: `${st.cx}px ${st.cy}px`,
                    transformBox: 'view-box',
                  }}
                />
              )}
              <circle cx={st.cx} cy={st.cy} r="6" fill="white" filter="url(#checkGlow)" />
              <path
                d={`M ${st.cx - 3.2} ${st.cy} l 2.2 2.4 l 4.4 -4.6`}
                stroke="#059669"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </g>
          ))}

          {/* Anel expansivo no estado "ativo" do scan */}
          {estadosComCentro[scanIdx] && (
            <circle
              key={`ring-${scanIdx}`}
              cx={estadosComCentro[scanIdx].cx}
              cy={estadosComCentro[scanIdx].cy}
              r="6"
              fill="none"
              stroke="#34d399"
              strokeWidth="2"
              opacity="0.9"
              style={{
                animation: 'ring-expand 1s ease-out forwards',
                transformOrigin: `${estadosComCentro[scanIdx].cx}px ${estadosComCentro[scanIdx].cy}px`,
                transformBox: 'view-box',
              }}
            />
          )}
        </svg>

        {/* Indicador do estado ativo (canto direito) */}
        <div className="absolute top-2 right-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-950/70 backdrop-blur border border-emerald-500/40">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-75 pulse-dot" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-300" />
          </span>
          <span className="text-[10px] font-mono font-bold text-emerald-200 tabular-nums">
            {estadosComCentro[scanIdx]?.id || '--'}
          </span>
        </div>
      </div>

      {/* Badge inferior */}
      <div className="mt-4 flex items-center justify-center gap-4">
        <div className="text-center">
          <p className="text-3xl font-bold text-emerald-300 tabular-nums leading-none">26<span className="text-emerald-400 text-xl">+1</span></p>
          <p className="text-[9px] uppercase tracking-wider text-emerald-200/70 font-bold mt-1">estados + DF</p>
        </div>
        <div className="h-10 w-px bg-emerald-500/30" />
        <div className="text-center">
          <p className="text-3xl font-bold text-emerald-300 tabular-nums leading-none">100<span className="text-xl">%</span></p>
          <p className="text-[9px] uppercase tracking-wider text-emerald-200/70 font-bold mt-1">cobertura</p>
        </div>
      </div>
    </div>
  );
}
