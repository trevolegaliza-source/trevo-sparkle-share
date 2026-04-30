const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
  'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

function grupoExtenso(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cem';
  const c = Math.floor(n / 100);
  const r = n % 100;
  const d = Math.floor(r / 10);
  const u = r % 10;
  const parts: string[] = [];
  if (c > 0) parts.push(CENTENAS[c]);
  if (r < 20 && r > 0) {
    parts.push(UNIDADES[r]);
  } else {
    if (d > 0) parts.push(DEZENAS[d]);
    if (u > 0) parts.push(UNIDADES[u]);
  }
  return parts.join(' e ');
}

export function valorPorExtenso(valor: number): string {
  if (valor === 0) return 'zero reais';
  const inteiro = Math.floor(Math.abs(valor));
  const centavos = Math.round((Math.abs(valor) - inteiro) * 100);

  const grupos: { valor: number; singular: string; plural: string }[] = [
    { valor: Math.floor(inteiro / 1000000) % 1000, singular: 'milhão', plural: 'milhões' },
    { valor: Math.floor(inteiro / 1000) % 1000, singular: 'mil', plural: 'mil' },
    { valor: inteiro % 1000, singular: '', plural: '' },
  ];

  const partes: string[] = [];
  for (const g of grupos) {
    if (g.valor === 0) continue;
    const ext = grupoExtenso(g.valor);
    if (g.singular) {
      partes.push(`${ext} ${g.valor === 1 ? g.singular : g.plural}`);
    } else {
      partes.push(ext);
    }
  }

  let resultado = partes.join(', ');
  if (inteiro === 1) resultado += ' real';
  else if (inteiro > 0) resultado += ' reais';

  if (centavos > 0) {
    const centExt = grupoExtenso(centavos);
    if (inteiro > 0) resultado += ' e ';
    resultado += centavos === 1 ? `${centExt} centavo` : `${centExt} centavos`;
  }

  return resultado;
}
