export const ETIQUETAS_PROCESSO = [
  { value: 'metodo_trevo', label: '🍀 Método Trevo', color: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' },
  { value: 'prioridade', label: '🔴 Prioridade', color: 'bg-red-500/15 text-red-500 border-red-500/30' },
  { value: 'cortesia', label: '🎁 Cortesia', color: 'bg-purple-500/15 text-purple-500 border-purple-500/30' },
  { value: 'boas_vindas', label: '👋 Boas-vindas', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-400/30' },
] as const;

export type EtiquetaProcesso = typeof ETIQUETAS_PROCESSO[number]['value'];
