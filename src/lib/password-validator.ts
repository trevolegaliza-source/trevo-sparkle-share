// SEC-027 (12/05/2026): validação de força de senha compartilhada entre
// todos os pontos onde senha é criada/trocada. Mesma lógica replicada em
// edge-functions-deploy/supabase/functions/_shared/password-validator.ts
// (não dá pra importar TS do cliente em Deno — mantém os dois iguais à mão).
//
// Regras:
//   - Mínimo 10 caracteres
//   - Pelo menos 1 letra e 1 número
//   - Não pode estar na lista de senhas comuns
//
// Antes desta validação, o sistema só checava `length >= 8`, aceitando
// "12345678", "password", "aaaaaaaa", etc.

const COMMON_PASSWORDS = new Set<string>([
  // Numéricas sequenciais
  '12345678', '123456789', '1234567890', '01234567', '00000000', '11111111',
  '12341234', '12121212', '99999999', '88888888',
  // Variações de "password"
  'password', 'password1', 'password12', 'password123', 'passw0rd', 'p@ssw0rd',
  // QWERTY
  'qwerty', 'qwerty123', 'qwertyuiop', 'qwerty1234', 'asdfghjk', 'asdfghjkl',
  'zxcvbnm', '1qaz2wsx', 'qazwsxedc',
  // Admin
  'admin', 'admin123', 'administrator', 'administra',
  // Genéricas comuns
  'letmein', 'letmein123', 'welcome', 'welcome1', 'welcome123',
  'iloveyou', 'abc12345', 'abc123456', 'abcd1234', 'monkey123', 'dragon123',
  'master', 'master123', 'football', 'football1', 'baseball', 'baseball1',
  'sunshine', 'princess', 'shadow123',
  // PT-BR
  'senha', 'senha1234', 'senha123', 'senha12345', 'minhasenha', 'minhasenha123',
  'trevolegaliza', 'trevo1234', 'trevo12345', 'trevo2026',
  'brasil123', 'brasil1234', 'saopaulo', 'riodejaneiro', 'sambafoot',
  'naosei123', 'naoseimais', 'naotenho123',
]);

export type PasswordStrength = 'fraca' | 'media' | 'forte';

export interface PasswordValidation {
  ok: boolean;
  reason?: string;
  strength: PasswordStrength;
}

export function validatePassword(senha: string): PasswordValidation {
  if (!senha || senha.length < 10) {
    return { ok: false, reason: 'Senha deve ter no mínimo 10 caracteres.', strength: 'fraca' };
  }
  const hasLetter = /[a-zA-Z]/.test(senha);
  const hasNumber = /[0-9]/.test(senha);
  if (!hasLetter || !hasNumber) {
    return { ok: false, reason: 'Senha precisa conter pelo menos 1 letra e 1 número.', strength: 'fraca' };
  }
  if (COMMON_PASSWORDS.has(senha.toLowerCase())) {
    return { ok: false, reason: 'Essa senha é muito comum. Escolha uma única e difícil.', strength: 'fraca' };
  }

  const hasSymbol = /[^a-zA-Z0-9]/.test(senha);
  const hasUpper = /[A-Z]/.test(senha);
  const hasLower = /[a-z]/.test(senha);

  let score = 0;
  if (senha.length >= 12) score++;
  if (senha.length >= 14) score++;
  if (hasSymbol) score++;
  if (hasUpper && hasLower) score++;

  const strength: PasswordStrength = score >= 3 ? 'forte' : score >= 1 ? 'media' : 'fraca';
  return { ok: true, strength };
}
