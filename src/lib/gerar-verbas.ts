import { supabase } from '@/integrations/supabase/client';
import type { Colaborador } from '@/hooks/useColaboradores';
import { getBusinessDaysInMonth, getLastBusinessDay, calcularAdiantamento } from '@/lib/business-days';
import { fetchFeriadosNacionais, proximoDiaUtil } from '@/lib/brasil-api';
import type { FeriadoNacional } from '@/lib/brasil-api';
import { toast } from 'sonner';

const fmtDate = (d: Date) => d.toISOString().split('T')[0];

/** Clamp day to the last day of the month to avoid rollover */
function safeDate(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay));
}

/**
 * safeDate + proximoDiaUtil: clamp day then advance to next business day.
 * feriados can span multiple years if dates cross year boundaries.
 */
function safeDateUtil(year: number, month: number, day: number, feriados: FeriadoNacional[]): Date {
  const base = safeDate(year, month, day);
  return proximoDiaUtil(base, feriados);
}

interface VerbaEntry {
  descricao: string;
  valor: number;
  data_vencimento: string;
  categoria: string;
  subcategoria: string;
}

function buildVerbas(colab: Colaborador, year: number, month: number, diasUteisOverride?: number, feriados?: FeriadoNacional[]): VerbaEntry[] {
  const diasUteis = diasUteisOverride ?? getBusinessDaysInMonth(year, month);
  const sal = Number(colab.salario_base);
  const vt = Number(colab.vt_diario);
  const vr = Number(colab.vr_diario);
  const das = Number(colab.valor_das) || 0;
  const diaSalario = colab.dia_salario || colab.dia_pagamento_integral || 5;
  const diaAdiantamento = colab.dia_adiantamento || 20;
  const diaVtVr = colab.dia_vt_vr || 0;
  const diaDas = colab.dia_das || 20;
  const ultimoDia = new Date(year, month + 1, 0);
  const lastBizDay = getLastBusinessDay(year, month);

  // Feriados for applying proximoDiaUtil — empty array if not provided
  const fer = feriados || [];

  // VT/VR: if custom day set, use it; otherwise 1st of NEXT month — both go through proximoDiaUtil
  const vencVtVrBase = diaVtVr > 0 ? safeDate(year, month, diaVtVr) : new Date(year, month + 1, 1);
  const vencVtVr = fmtDate(proximoDiaUtil(vencVtVrBase, fer));

  const entries: VerbaEntry[] = [];

  // 1. ADIANTAMENTO
  if (colab.possui_adiantamento && sal > 0) {
    const valorAdiant = calcularAdiantamento(sal, colab.adiantamento_tipo, Number(colab.adiantamento_valor) || 0);
    if (valorAdiant > 0) {
      entries.push({
        descricao: `Adiantamento - ${colab.nome}`,
        valor: valorAdiant,
        data_vencimento: fmtDate(safeDateUtil(year, month, diaAdiantamento, fer)),
        categoria: 'folha',
        subcategoria: 'Adiantamento',
      });
    }
  }

  // 2. SALÁRIO
  if (sal > 0) {
    let valorSalario = sal;
    let label = `Salário - ${colab.nome}`;
    if (colab.possui_adiantamento) {
      const adiant = calcularAdiantamento(sal, colab.adiantamento_tipo, Number(colab.adiantamento_valor) || 0);
      valorSalario = sal - adiant;
      label = `Salário (Restante) - ${colab.nome}`;
    }
    if (valorSalario > 0) {
      entries.push({
        descricao: label,
        valor: valorSalario,
        data_vencimento: fmtDate(safeDateUtil(year, month, diaSalario, fer)),
        categoria: 'folha',
        subcategoria: 'Salário',
      });
    }
  }

  // 3. VT or Auxílio Combustível
  const tipoTransporte = (colab as any).tipo_transporte || 'vt';
  const auxilioCombustivelValor = Number((colab as any).auxilio_combustivel_valor) || 0;

  if (tipoTransporte === 'auxilio_combustivel' && auxilioCombustivelValor > 0) {
    entries.push({
      descricao: `Auxílio Combustível - ${colab.nome}`,
      valor: auxilioCombustivelValor,
      data_vencimento: vencVtVr,
      categoria: 'folha',
      subcategoria: 'Vale Transporte (VT)',
    });
  } else if (vt > 0) {
    entries.push({
      descricao: `VT (${diasUteis}d) - ${colab.nome}`,
      valor: vt * diasUteis,
      data_vencimento: vencVtVr,
      categoria: 'folha',
      subcategoria: 'Vale Transporte (VT)',
    });
  }

  // 4. VR
  if (vr > 0) {
    entries.push({
      descricao: `VR (${diasUteis}d) - ${colab.nome}`,
      valor: vr * diasUteis,
      data_vencimento: vencVtVr,
      categoria: 'folha',
      subcategoria: 'Vale Refeição (VR)',
    });
  }

  // 5. DAS
  if (das > 0 && colab.regime !== 'INDEFINIDO') {
    entries.push({
      descricao: `DAS - ${colab.nome}`,
      valor: das,
      data_vencimento: fmtDate(safeDateUtil(year, month, diaDas, fer)),
      categoria: 'folha',
      subcategoria: 'DAS Colaborador',
    });
  }

  // --- CLT only ---
  if (colab.regime === 'CLT') {
    const fgtsPct = Number(colab.fgts_percentual) || 8;
    const inssPct = Number(colab.inss_patronal_percentual) || 20;

    // 6. FGTS — due 7th of NEXT month
    if (sal > 0) {
      const nextMonth = month + 1;
      const fgtsYear = nextMonth > 11 ? year + 1 : year;
      const fgtsMonth = nextMonth > 11 ? 0 : nextMonth;
      entries.push({
        descricao: `FGTS - ${colab.nome}`,
        valor: sal * (fgtsPct / 100),
        data_vencimento: fmtDate(safeDateUtil(fgtsYear, fgtsMonth, 7, fer)),
        categoria: 'folha',
        subcategoria: 'FGTS',
      });
    }

    // 7. INSS Patronal — due 20th of NEXT month
    if (sal > 0) {
      const nextMonth = month + 1;
      const inssYear = nextMonth > 11 ? year + 1 : year;
      const inssMonth = nextMonth > 11 ? 0 : nextMonth;
      entries.push({
        descricao: `INSS Patronal - ${colab.nome}`,
        valor: sal * (inssPct / 100),
        data_vencimento: fmtDate(safeDateUtil(inssYear, inssMonth, 20, fer)),
        categoria: 'impostos',
        subcategoria: 'INSS',
      });
    }

    // 8. Provisão 13º — last business day of the month
    if (colab.provisionar_13 && sal > 0) {
      entries.push({
        descricao: `Provisão 13º - ${colab.nome}`,
        valor: sal / 12,
        data_vencimento: fmtDate(lastBizDay),
        categoria: 'folha',
        subcategoria: '13º Salário (Provisão)',
      });
    }

    // 9. Provisão Férias — last business day of the month
    if (colab.provisionar_ferias && sal > 0) {
      entries.push({
        descricao: `Provisão Férias - ${colab.nome}`,
        valor: (sal + sal / 3) / 12,
        data_vencimento: fmtDate(lastBizDay),
        categoria: 'folha',
        subcategoria: 'Férias (Provisão)',
      });
    }
  }

  return entries;
}

/**
 * Check and apply scheduled salary increases before generating verbas.
 */
async function aplicarAumentos(colaboradores: Colaborador[], year: number, month: number) {
  const mesAno = `${year}-${String(month + 1).padStart(2, '0')}`;
  for (const colab of colaboradores) {
    if (colab.aumento_previsto_data && colab.aumento_previsto_valor && Number(colab.aumento_previsto_valor) > 0) {
      if (colab.aumento_previsto_data === mesAno) {
        const novoSalario = Number(colab.aumento_previsto_valor);
        await (supabase as any).from('colaboradores').update({
          salario_base: novoSalario,
          aumento_previsto_valor: 0,
          aumento_previsto_data: null,
          updated_at: new Date().toISOString(),
        }).eq('id', colab.id);
        colab.salario_base = novoSalario;
        toast.info(`Aumento aplicado para ${colab.nome}: R$ ${novoSalario.toFixed(2)}`);
      }
    }
  }
}

/**
 * Estimate total monthly cost for a single collaborator (used in previews).
 */
export function estimarCustoTotal(colab: Colaborador, diasUteis?: number): number {
  const du = diasUteis ?? 22;
  const sal = Number(colab.salario_base);
  const tipoTransporte = (colab as any).tipo_transporte || 'vt';
  const vt = tipoTransporte === 'auxilio_combustivel' 
    ? (Number((colab as any).auxilio_combustivel_valor) || 0) 
    : Number(colab.vt_diario) * du;
  const vr = Number(colab.vr_diario) * du;
  const das = colab.regime !== 'INDEFINIDO' ? (Number(colab.valor_das) || 0) : 0;
  let total = sal + vt + vr + das;
  if (colab.regime === 'CLT') {
    total += sal * ((Number(colab.fgts_percentual) || 8) / 100);
    total += sal * ((Number(colab.inss_patronal_percentual) || 20) / 100);
    if (colab.provisionar_13) total += sal / 12;
    if (colab.provisionar_ferias) total += (sal + sal / 3) / 12;
  }
  return total;
}

/**
 * Generate all financial entries for a collaborator for a given month/year.
 * Uses upsert logic: update existing pending, skip paid, insert new.
 * Returns count of created/updated entries.
 */
export async function gerarVerbasColaborador(colab: Colaborador, year: number, month: number, diasUteisOverride?: number, feriados?: FeriadoNacional[]): Promise<number> {
  const entries = buildVerbas(colab, year, month, diasUteisOverride, feriados);
  if (entries.length === 0) return 0;

  // Fetch existing entries for this collaborator/month
  const { data: existing } = await (supabase as any)
    .from('lancamentos')
    .select('id, subcategoria, status')
    .eq('tipo', 'pagar')
    .eq('colaborador_id', colab.id)
    .eq('competencia_mes', month + 1)
    .eq('competencia_ano', year);

  const existingMap = new Map<string, { id: string; status: string }>();
  (existing || []).forEach((e: any) => {
    existingMap.set(e.subcategoria || '', e);
  });

  let count = 0;

  for (const e of entries) {
    const found = existingMap.get(e.subcategoria);

    if (found) {
      if (found.status === 'pago') {
        // Already paid — skip
        continue;
      }
      // Update existing pending entry
      await (supabase as any)
        .from('lancamentos')
        .update({
          descricao: e.descricao,
          valor: e.valor,
          data_vencimento: e.data_vencimento,
          categoria: e.categoria,
          fornecedor: colab.nome,
          updated_at: new Date().toISOString(),
        })
        .eq('id', found.id);
      count++;
    } else {
      // Insert new
      const { error } = await (supabase as any).from('lancamentos').insert({
        tipo: 'pagar' as const,
        descricao: e.descricao,
        valor: e.valor,
        categoria: e.categoria,
        subcategoria: e.subcategoria,
        status: 'pendente' as const,
        data_vencimento: e.data_vencimento,
        colaborador_id: colab.id,
        fornecedor: colab.nome,
        competencia_mes: month + 1,
        competencia_ano: year,
        etapa_financeiro: 'solicitacao_criada',
      });
      if (error) {
        toast.error(`Erro ao gerar verbas de ${colab.nome}: ${error.message}`);
        throw error;
      }
      count++;
    }
  }

  return count;
}

/**
 * Generate all verbas for all active collaborators for a given month.
 * Fetches holidays for the competência year AND the next year (for cross-year dates like FGTS/INSS).
 */
export async function gerarVerbasDoMes(colaboradores: Colaborador[], year: number, month: number, diasUteisOverride?: number) {
  const ativos = colaboradores.filter(c => c.status === 'ativo');
  await aplicarAumentos(ativos, year, month);

  // Fetch holidays for current year and next year (some dates land in next year)
  const [feriadosAno, feriadosProx] = await Promise.all([
    fetchFeriadosNacionais(year),
    month >= 10 ? fetchFeriadosNacionais(year + 1) : Promise.resolve([]),
  ]);
  const todosOsFeriados = [...feriadosAno, ...feriadosProx];

  let total = 0;
  for (const colab of ativos) {
    const count = await gerarVerbasColaborador(colab, year, month, diasUteisOverride, todosOsFeriados);
    total += count;
  }
  return total;
}

/**
 * Fix existing records that have data_vencimento on weekends/holidays.
 * Only updates pendente/atrasado records. Never touches pago.
 * Returns count of corrected records.
 */
export async function corrigirDatasExistentes(): Promise<number> {
  // Fetch all pending/overdue pagar records
  const { data: records, error } = await (supabase as any)
    .from('lancamentos')
    .select('id, data_vencimento, status')
    .eq('tipo', 'pagar')
    .in('status', ['pendente', 'atrasado']);

  if (error || !records || records.length === 0) return 0;

  // Group by year to minimize API calls
  const yearsNeeded = new Set<number>();
  for (const r of records) {
    const y = new Date(r.data_vencimento + 'T00:00:00').getFullYear();
    yearsNeeded.add(y);
  }

  // Fetch holidays for all needed years
  const feriadosByYear = new Map<number, FeriadoNacional[]>();
  const fetches = Array.from(yearsNeeded).map(async (y) => {
    const f = await fetchFeriadosNacionais(y);
    feriadosByYear.set(y, f);
  });
  await Promise.all(fetches);

  // Build combined feriados list
  const allFeriados: FeriadoNacional[] = [];
  feriadosByYear.forEach(f => allFeriados.push(...f));

  let corrected = 0;

  for (const r of records) {
    const orig = new Date(r.data_vencimento + 'T00:00:00');
    const dow = orig.getDay();
    
    // Check if it's on a weekend
    const isoStr = r.data_vencimento; // already YYYY-MM-DD
    const feriadoSet = new Set(allFeriados.map(f => f.date));
    const isWeekend = dow === 0 || dow === 6;
    const isHoliday = feriadoSet.has(isoStr);

    if (!isWeekend && !isHoliday) continue;

    const correctedDate = proximoDiaUtil(orig, allFeriados);
    const newDateStr = fmtDate(correctedDate);

    if (newDateStr !== r.data_vencimento) {
      await (supabase as any)
        .from('lancamentos')
        .update({
          data_vencimento: newDateStr,
          updated_at: new Date().toISOString(),
        })
        .eq('id', r.id);
      corrected++;
    }
  }

  return corrected;
}

export { buildVerbas };
