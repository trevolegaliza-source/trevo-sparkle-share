/**
 * Format a raw CPF string to 000.000.000-00
 */
export function formatCPF(raw: string | null | undefined): { formatted: string; valid: boolean } {
  if (!raw) return { formatted: '—', valid: true };
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 11) return { formatted: 'CPF INVÁLIDO', valid: false };
  return {
    formatted: `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9,11)}`,
    valid: true,
  };
}

/**
 * Apply CPF mask to input value (progressive typing)
 */
export function maskCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0,3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6)}`;
  return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
}

/**
 * Validate CPF via dígitos verificadores (mod-11). Rejeita sequências repetidas.
 */
export function isValidCPF(value: string | null | undefined): boolean {
  if (!value) return false;
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const calcDigit = (base: string, factorStart: number): number => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += Number(base[i]) * (factorStart - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };

  const d1 = calcDigit(digits.slice(0, 9), 10);
  if (d1 !== Number(digits[9])) return false;

  const d2 = calcDigit(digits.slice(0, 10), 11);
  if (d2 !== Number(digits[10])) return false;

  return true;
}

export function hasCPFLength(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.replace(/\D/g, '').length === 11;
}
