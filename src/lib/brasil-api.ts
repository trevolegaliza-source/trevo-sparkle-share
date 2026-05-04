export interface FeriadoNacional {
  date: string; // "2026-01-01"
  name: string;
  type: string;
}

/**
 * Fetch national holidays for a given year from BrasilAPI.
 * Returns empty array on failure (timeout 5s).
 */
export async function fetchFeriadosNacionais(ano: number): Promise<FeriadoNacional[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`https://brasilapi.com.br/api/feriados/v1/${ano}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

/**
 * Calculate business days in a month using BrasilAPI holidays.
 */
export function calcularDiasUteis(
  year: number,
  month: number, // 0-indexed
  feriados: FeriadoNacional[],
): number {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let count = 0;
  const feriadoSet = new Set(feriados.map(f => f.date));

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue;
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (feriadoSet.has(iso)) continue;
    count++;
  }
  return count;
}

/**
 * Filter holidays that fall within a specific month.
 */
export function feriadosDoMes(
  feriados: FeriadoNacional[],
  year: number,
  month: number, // 0-indexed
): FeriadoNacional[] {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  return feriados.filter(f => f.date.startsWith(prefix));
}

/**
 * Get the N-th business day of a given month, considering BrasilAPI holidays.
 * Useful for "5º dia útil" CLT salary rule.
 * If N exceeds business days available, returns the last business day.
 */
export function getNthDiaUtil(
  year: number,
  month: number, // 0-indexed
  n: number,
  feriados: FeriadoNacional[],
): Date {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const feriadoSet = new Set(feriados.map(f => f.date));
  let count = 0;
  let lastBiz: Date | null = null;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue;
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (feriadoSet.has(iso)) continue;
    count++;
    lastBiz = date;
    if (count === n) return date;
  }
  return lastBiz ?? new Date(year, month, daysInMonth);
}

/**
 * Advance a date to the next business day if it falls on a weekend or national holiday.
 * Keeps advancing until a valid business day is found.
 */
export function proximoDiaUtil(date: Date, feriados: FeriadoNacional[]): Date {
  const feriadoSet = new Set(feriados.map(f => f.date));
  const result = new Date(date);
  
  const toIso = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  while (true) {
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6 && !feriadoSet.has(toIso(result))) {
      break;
    }
    result.setDate(result.getDate() + 1);
  }
  return result;
}
