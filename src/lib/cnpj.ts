/**
 * Format a raw CNPJ string to 00.000.000/0000-00
 * Returns 'CNPJ INVÁLIDO' if not exactly 14 digits after stripping.
 */
export function formatCNPJ(raw: string | null | undefined): { formatted: string; valid: boolean } {
  if (!raw) return { formatted: '—', valid: true };
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 14) return { formatted: 'CNPJ INVÁLIDO', valid: false };
  return {
    formatted: `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5,8)}/${digits.slice(8,12)}-${digits.slice(12,14)}`,
    valid: true,
  };
}

/**
 * Format codigo_identificador to 000.000 pattern
 */
export function formatCodigo(raw: string | null | undefined): string {
  if (!raw) return '—';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 6) return `${digits.slice(0,3)}.${digits.slice(3,6)}`;
  // If it looks like a CNPJ, format as CNPJ
  if (digits.length === 14) {
    return formatCNPJ(raw).formatted;
  }
  return raw; // return as-is if doesn't match patterns
}

/**
 * Apply CNPJ mask to input value (progressive typing)
 */
export function maskCNPJ(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0,2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5,8)}/${digits.slice(8)}`;
  return `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5,8)}/${digits.slice(8,12)}-${digits.slice(12)}`;
}

/**
 * Validate CNPJ: 14 dígitos + algoritmo mod-11 dos dígitos verificadores.
 * Rejeita também sequências repetidas (00000000000000, 11111111111111, ...).
 */
export function isValidCNPJ(value: string | null | undefined): boolean {
  if (!value) return false;
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 14) return false;
  // Sequências repetidas são inválidas (passariam no mod-11)
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const calcDigit = (base: string, weights: number[]): number => {
    const sum = weights.reduce((acc, w, i) => acc + Number(base[i]) * w, 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const d1 = calcDigit(digits.slice(0, 12), weights1);
  if (d1 !== Number(digits[12])) return false;

  const d2 = calcDigit(digits.slice(0, 13), weights2);
  if (d2 !== Number(digits[13])) return false;

  return true;
}

/**
 * Validação só de comprimento — útil para máscara em digitação progressiva,
 * onde ainda não dá pra exigir DV. Use isValidCNPJ no submit.
 */
export function hasCNPJLength(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.replace(/\D/g, '').length === 14;
}

/**
 * Apply codigo mask (000.000) progressively
 */
export function maskCodigo(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 6);
  if (digits.length <= 3) return digits;
  return `${digits.slice(0,3)}.${digits.slice(3)}`;
}
