// ===========================================================================
// Helpers de cálculo de fatura de cartão
// ===========================================================================
//
// Regra: uma compra feita em data D, em um cartão com fechamento dia F e
// vencimento dia V, cai na fatura de vencimento:
//   - Se D <= último fechamento (mês de D, dia F)  → vence no PRÓXIMO V (mês D+1 ou D+2)
//   - Se D > último fechamento                      → pula uma fatura
//
// Exemplo: cartão fecha dia 25, vence dia 1.
//   Compra em 10/05  (≤ 25/05)  → fecha 25/05 → vence 01/06
//   Compra em 28/05  (> 25/05)  → fecha 25/06 → vence 01/07
//   Compra em 25/05  (=  25/05) → fecha 25/05 → vence 01/06 (limite incluso)
//
// Para parcelas: cada parcela cai num mês consecutivo a partir do vencimento
// calculado da primeira parcela.
// ===========================================================================

/**
 * Retorna a data de vencimento (YYYY-MM-DD) da fatura em que uma compra cai.
 *
 * @param dataCompra ISO date string ou Date — data da compra
 * @param diaFechamento dia do mês em que a fatura fecha (1–31)
 * @param diaVencimento dia do mês em que a fatura vence (1–31)
 * @returns ISO date string YYYY-MM-DD do vencimento da fatura
 */
export function calcularVencimentoFatura(
  dataCompra: string | Date,
  diaFechamento: number,
  diaVencimento: number
): string {
  const compra = typeof dataCompra === 'string' ? new Date(dataCompra + 'T12:00:00') : dataCompra;
  const ano = compra.getFullYear();
  const mes = compra.getMonth(); // 0-indexed
  const dia = compra.getDate();

  // Determina mês/ano do FECHAMENTO que captura essa compra.
  // Se compra <= dia de fechamento do mês corrente, fecha no mês corrente;
  // senão, fecha no mês seguinte.
  let mesFechamento = mes;
  let anoFechamento = ano;
  if (dia > diaFechamento) {
    mesFechamento += 1;
    if (mesFechamento > 11) {
      mesFechamento = 0;
      anoFechamento += 1;
    }
  }

  // Vencimento = mês seguinte ao fechamento, no dia de vencimento.
  // (Cartão típico: fecha em maio → vence em junho.)
  let mesVenc = mesFechamento + 1;
  let anoVenc = anoFechamento;
  if (mesVenc > 11) {
    mesVenc = 0;
    anoVenc += 1;
  }

  // Trata mês curto (ex.: vencimento dia 31, fevereiro tem 28/29).
  const ultimoDiaMes = new Date(anoVenc, mesVenc + 1, 0).getDate();
  const diaFinal = Math.min(diaVencimento, ultimoDiaMes);

  return formatISODate(anoVenc, mesVenc, diaFinal);
}

/**
 * Soma N meses a uma data de vencimento (preserva dia, ajusta mês curto).
 * Usado para parcelas: parcela 2 = vencimento da parcela 1 + 1 mês.
 */
export function somarMesesAoVencimento(vencimentoISO: string, meses: number): string {
  const d = new Date(vencimentoISO + 'T12:00:00');
  const dia = d.getDate();
  const mesAlvo = d.getMonth() + meses;
  const novoAno = d.getFullYear() + Math.floor(mesAlvo / 12);
  const novoMes = ((mesAlvo % 12) + 12) % 12;
  const ultimoDia = new Date(novoAno, novoMes + 1, 0).getDate();
  const diaFinal = Math.min(dia, ultimoDia);
  return formatISODate(novoAno, novoMes, diaFinal);
}

/**
 * Calcula data de fechamento da fatura a partir do vencimento.
 * Fechamento = mês anterior ao vencimento, no dia de fechamento.
 */
export function calcularDataFechamento(
  vencimentoISO: string,
  diaFechamento: number
): string {
  const d = new Date(vencimentoISO + 'T12:00:00');
  let mesFech = d.getMonth() - 1;
  let anoFech = d.getFullYear();
  if (mesFech < 0) {
    mesFech = 11;
    anoFech -= 1;
  }
  const ultimoDiaMes = new Date(anoFech, mesFech + 1, 0).getDate();
  const diaFinal = Math.min(diaFechamento, ultimoDiaMes);
  return formatISODate(anoFech, mesFech, diaFinal);
}

/**
 * Divide um valor total em N parcelas de igual valor, ajustando a última
 * pra cobrir o resto (evita perder centavos).
 */
export function calcularValoresParcelas(valorTotal: number, parcelas: number): number[] {
  if (parcelas <= 1) return [valorTotal];
  const cents = Math.round(valorTotal * 100);
  const base = Math.floor(cents / parcelas);
  const resto = cents - base * parcelas;
  const valores = Array(parcelas).fill(base / 100);
  // Última parcela absorve o resto (em centavos)
  valores[parcelas - 1] = (base + resto) / 100;
  return valores;
}

function formatISODate(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}
