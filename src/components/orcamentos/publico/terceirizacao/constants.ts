/**
 * Constantes compartilhadas entre TerceirizacaoPublicaView e sub-componentes.
 * Extraído do arquivo monolítico em 29/05 — refactor estrutural.
 */
import { SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/client';

/** Headers anônimos pra chamar RPCs públicos (token-based, sem JWT user). */
export const anonHeaders = {
  apikey: SUPABASE_PUBLISHABLE_KEY,
  Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
  'Content-Type': 'application/json',
};

/**
 * Centros geográficos aproximados dos 27 estados (viewBox 0 0 613 639).
 * Paths reais vêm de @/assets/brasil-states-paths (CC-BY 4.0 — VictorCazanave/svg-maps).
 * Paths são RELATIVOS, então media de numeros nao da o centro real — daí esses
 * valores hardcoded.
 */
export const BRASIL_CENTROS: Record<string, [number, number]> = {
  AC: [90, 280],  AL: [560, 260], AP: [340, 80],   AM: [200, 200],
  BA: [430, 320], CE: [490, 200], DF: [370, 330],  ES: [490, 405],
  GO: [350, 350], MA: [400, 200], MT: [270, 290],  MS: [290, 380],
  MG: [430, 380], PA: [300, 180], PB: [550, 230],  PR: [320, 470],
  PE: [520, 240], PI: [440, 230], RJ: [450, 430],  RN: [550, 210],
  RS: [290, 560], RO: [170, 280], RR: [200, 90],   SC: [320, 520],
  SP: [370, 430], SE: [520, 280], TO: [350, 260],
};

/** Cores do confete (compartilhadas entre tela de sucesso e modo "voltou após aceite"). */
export const CONFETTI_CORES = ['#10b981', '#059669', '#34d399', '#fbbf24', '#f59e0b', '#3b82f6', '#a78bfa'];
