/**
 * Brazilian national holidays (fixed + movable for common years).
 * Movable holidays (Carnival, Corpus Christi, Good Friday) are approximated.
 * Exportada para servir de fallback quando BrasilAPI falha (timeout/offline).
 */
export function getBrazilianHolidays(year: number): Set<string> {
  const holidays = new Set<string>();
  const add = (m: number, d: number) =>
    holidays.add(`${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);

  // Fixed holidays
  add(1, 1);   // Confraternização Universal
  add(4, 21);  // Tiradentes
  add(5, 1);   // Dia do Trabalho
  add(9, 7);   // Independência
  add(10, 12); // Nossa Senhora Aparecida
  add(11, 2);  // Finados
  add(11, 15); // Proclamação da República
  add(12, 25); // Natal

  // Easter (Meeus algorithm)
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = new Date(year, month - 1, day);

  const addOffset = (offset: number) => {
    const d2 = new Date(easter);
    d2.setDate(d2.getDate() + offset);
    add(d2.getMonth() + 1, d2.getDate());
  };

  addOffset(-47); // Carnaval (terça)
  addOffset(-48); // Carnaval (segunda)
  addOffset(-2);  // Sexta-feira Santa
  addOffset(60);  // Corpus Christi

  return holidays;
}

function isBusinessDay(date: Date, holidays: Set<string>): boolean {
  const dow = date.getDay();
  if (dow === 0 || dow === 6) return false;
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return !holidays.has(key);
}

/**
 * Calculate business days (Mon-Fri, excluding Brazilian holidays) in a given month/year.
 */
export function getBusinessDaysInMonth(year?: number, month?: number): number {
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? now.getMonth(); // 0-indexed
  const holidays = getBrazilianHolidays(y);
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(y, m, d);
    if (isBusinessDay(date, holidays)) count++;
  }
  return count;
}

/**
 * Calculate total monthly cost for a collaborator.
 */
export function calcularCustoMensal(
  salarioBase: number,
  vtDiario: number,
  vrDiario: number,
  diasUteis?: number,
): number {
  const du = diasUteis ?? getBusinessDaysInMonth();
  return salarioBase + (vtDiario + vrDiario) * du;
}

/**
 * Get the Nth business day of a given month/year (1-indexed).
 * Accounts for Brazilian national holidays.
 */
export function getNthBusinessDay(n: number, year?: number, month?: number): Date {
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? now.getMonth();
  const holidays = getBrazilianHolidays(y);
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(y, m, d);
    if (isBusinessDay(date, holidays)) {
      count++;
      if (count === n) return date;
    }
  }
  // Fallback: last business day
  return new Date(y, m, daysInMonth);
}

/**
 * Get the 5th business day of a given month/year.
 */
export function getFifthBusinessDay(year?: number, month?: number): Date {
  return getNthBusinessDay(5, year, month);
}

/**
 * Get the last business day of a given month/year.
 */
export function getLastBusinessDay(year?: number, month?: number): Date {
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? now.getMonth();
  const holidays = getBrazilianHolidays(y);
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  for (let d = daysInMonth; d >= 1; d--) {
    const date = new Date(y, m, d);
    if (isBusinessDay(date, holidays)) return date;
  }
  return new Date(y, m, daysInMonth);
}

/**
 * Calculate advance value based on type and salary.
 */
export function calcularAdiantamento(
  salarioBase: number,
  adiantamentoTipo: 'percentual' | 'fixo',
  adiantamentoValor: number,
): number {
  if (adiantamentoTipo === 'percentual') {
    return salarioBase * (adiantamentoValor / 100);
  }
  return adiantamentoValor;
}
