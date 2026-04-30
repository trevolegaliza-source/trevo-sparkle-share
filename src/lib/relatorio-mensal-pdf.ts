import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';

const BRAND = {
  nome: 'TREVO LEGALIZA LTDA',
  fantasia: 'Trevo Legaliza',
  cnpj: '39.969.412/0001-70',
  endereco: 'Rua Brasil, nº 1170, Rudge Ramos, SBC/SP',
  email: 'administrativo@trevolegaliza.com.br',
  telefone: '(11) 93492-7001',
  site: 'trevolegaliza.com.br',
  tagline: 'Assessoria societária com atuação em todo o território nacional',
};

const LOGO_URL = 'https://aahhauquuicvtwtrxyan.supabase.co/storage/v1/object/public/documentos/logo/trevo-legaliza-hd.png';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
const pct = (v: number) => `${v.toFixed(1)}%`;

async function loadLogo(): Promise<HTMLImageElement | null> {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = LOGO_URL;
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
    return img;
  } catch { return null; }
}

function addFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const h = doc.internal.pageSize.getHeight();
  const w = doc.internal.pageSize.getWidth();
  doc.setDrawColor(34, 197, 94);
  doc.setLineWidth(0.5);
  doc.line(15, h - 18, w - 15, h - 18);
  doc.setFontSize(7);
  doc.setTextColor(120);
  doc.text(`${BRAND.fantasia} · ${BRAND.cnpj} · ${BRAND.endereco}`, 15, h - 13);
  doc.text(`${BRAND.email} · ${BRAND.site}`, 15, h - 9);
  doc.text(`Página ${pageNum}/${totalPages}`, w - 15, h - 9, { align: 'right' });
}

function addSectionTitle(doc: jsPDF, y: number, title: string): number {
  doc.setFontSize(13);
  doc.setTextColor(34, 197, 94);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 15, y);
  doc.setDrawColor(34, 197, 94);
  doc.setLineWidth(0.3);
  doc.line(15, y + 2, 195, y + 2);
  return y + 10;
}

function addKpiBox(doc: jsPDF, x: number, y: number, w: number, label: string, value: string, color: [number, number, number] = [255, 255, 255]) {
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(x, y, w, 22, 3, 3, 'F');
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.setFont('helvetica', 'normal');
  doc.text(label, x + w / 2, y + 8, { align: 'center' });
  doc.setFontSize(13);
  doc.setTextColor(...color);
  doc.setFont('helvetica', 'bold');
  doc.text(value, x + w / 2, y + 17, { align: 'center' });
}

export async function gerarRelatorioMensal(mes?: number, ano?: number) {
  const now = new Date();
  const targetMes = mes ?? now.getMonth();
  const targetAno = ano ?? now.getFullYear();
  const mesLabel = new Date(targetAno, targetMes, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const mesLabelCap = mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1);

  const inicioMes = new Date(targetAno, targetMes, 1).toISOString().split('T')[0];
  const fimMes = new Date(targetAno, targetMes + 1, 0).toISOString().split('T')[0];
  const inicioMesAnt = new Date(targetAno, targetMes - 1, 1).toISOString().split('T')[0];
  const fimMesAnt = new Date(targetAno, targetMes, 0).toISOString().split('T')[0];
  const seisMesesAtras = new Date(targetAno, targetMes - 5, 1).toISOString().split('T')[0];

  // Fetch all data in parallel
  const [
    { data: lancReceber },
    { data: lancReceberAnt },
    { data: lancPagar },
    { data: lancPagarAnt },
    { data: processos },
    { data: clientes },
    { data: lancHist },
    { data: lancPagarPendentes },
    { data: lancReceberPendentes },
  ] = await Promise.all([
    supabase.from('lancamentos').select('id, valor, status, confirmado_recebimento, data_pagamento, data_vencimento, cliente_id, processo_id, clientes(nome, apelido), processos(tipo)')
      .eq('tipo', 'receber').gte('data_vencimento', inicioMes).lte('data_vencimento', fimMes),
    supabase.from('lancamentos').select('id, valor, status, confirmado_recebimento')
      .eq('tipo', 'receber').gte('data_vencimento', inicioMesAnt).lte('data_vencimento', fimMesAnt),
    supabase.from('lancamentos').select('id, valor, status, data_pagamento, categoria, descricao, data_vencimento, conta_id, plano_contas(nome, codigo)')
      .eq('tipo', 'pagar').gte('data_vencimento', inicioMes).lte('data_vencimento', fimMes),
    supabase.from('lancamentos').select('id, valor, status')
      .eq('tipo', 'pagar').gte('data_vencimento', inicioMesAnt).lte('data_vencimento', fimMesAnt),
    supabase.from('processos').select('id, tipo, etapa, created_at, cliente_id').neq('is_archived', true),
    supabase.from('clientes').select('id, nome, apelido').neq('is_archived', true),
    supabase.from('lancamentos').select('id, valor, status, confirmado_recebimento, data_vencimento, tipo')
      .gte('data_vencimento', seisMesesAtras).lte('data_vencimento', fimMes),
    supabase.from('lancamentos').select('id, valor, data_vencimento, descricao')
      .eq('tipo', 'pagar').in('status', ['pendente', 'atrasado']).gte('data_vencimento', inicioMes).order('data_vencimento').limit(10),
    supabase.from('lancamentos').select('id, valor, data_vencimento, cliente_id, clientes(nome, apelido)')
      .eq('tipo', 'receber').in('status', ['pendente', 'atrasado']).gte('data_vencimento', inicioMes).order('data_vencimento').limit(10),
  ]);

  const receber = lancReceber || [];
  const receberAnt = lancReceberAnt || [];
  const pagar = lancPagar || [];
  const pagarAnt = lancPagarAnt || [];
  const procs = processos || [];
  const hist = lancHist || [];

  // Calculations
  const receitaBruta = receber.reduce((s, l) => s + Number(l.valor), 0);
  const receitaRecebida = receber.filter(l => l.status === 'pago' && l.confirmado_recebimento).reduce((s, l) => s + Number(l.valor), 0);
  const receitaAnt = receberAnt.reduce((s, l) => s + Number(l.valor), 0);
  const despesaTotal = pagar.reduce((s, l) => s + Number(l.valor), 0);
  const despesaPaga = pagar.filter(l => l.status === 'pago').reduce((s, l) => s + Number(l.valor), 0);
  const despesaAnt = pagarAnt.reduce((s, l) => s + Number(l.valor), 0);
  const resultado = receitaBruta - despesaTotal;
  const margemLiquida = receitaBruta > 0 ? (resultado / receitaBruta) * 100 : 0;

  const processosAtivos = procs.filter(p => !['finalizados', 'arquivo'].includes(p.etapa)).length;
  const processosMes = procs.filter(p => {
    const d = new Date(p.created_at || '');
    return d.getMonth() === targetMes && d.getFullYear() === targetAno;
  }).length;
  const clientesAtivos = new Set(receber.map(l => l.cliente_id).filter(Boolean)).size;

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const inadimplentes = receber.filter(l => {
    const v = new Date(l.data_vencimento + 'T00:00:00');
    return v < hoje && l.status !== 'pago';
  });
  const valorInadimplente = inadimplentes.reduce((s, l) => s + Number(l.valor), 0);
  const taxaInadimplencia = receitaBruta > 0 ? (valorInadimplente / receitaBruta) * 100 : 0;

  // Top 5 clients
  const clienteMap: Record<string, { nome: string; total: number }> = {};
  receber.forEach(l => {
    if (!l.cliente_id) return;
    const c = l.clientes as any;
    const nome = c?.apelido || c?.nome || '—';
    if (!clienteMap[l.cliente_id]) clienteMap[l.cliente_id] = { nome, total: 0 };
    clienteMap[l.cliente_id].total += Number(l.valor);
  });
  const topClientes = Object.values(clienteMap).sort((a, b) => b.total - a.total).slice(0, 5);

  // Distribution by process type
  const tipoMap: Record<string, number> = {};
  receber.forEach(l => {
    const tipo = (l.processos as any)?.tipo || 'outros';
    tipoMap[tipo] = (tipoMap[tipo] || 0) + Number(l.valor);
  });
  const tipoDistrib = Object.entries(tipoMap).sort((a, b) => b[1] - a[1]);

  // Expense categories
  const catMap: Record<string, number> = {};
  pagar.forEach(l => {
    const cat = (l.plano_contas as any)?.nome || l.categoria || 'Sem classificação';
    catMap[cat] = (catMap[cat] || 0) + Number(l.valor);
  });
  const topDespesas = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // 6-month evolution
  const evolucao: { mes: string; receita: number; despesa: number; resultado: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const m = new Date(targetAno, targetMes - i, 1);
    const mMes = m.getMonth();
    const mAno = m.getFullYear();
    const label = m.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') + '/' + String(mAno).slice(2);
    const rec = hist.filter(l => {
      const d = new Date(l.data_vencimento || '');
      return d.getMonth() === mMes && d.getFullYear() === mAno && l.tipo === 'receber';
    }).reduce((s, l) => s + Number(l.valor), 0);
    const desp = hist.filter(l => {
      const d = new Date(l.data_vencimento || '');
      return d.getMonth() === mMes && d.getFullYear() === mAno && l.tipo === 'pagar';
    }).reduce((s, l) => s + Number(l.valor), 0);
    evolucao.push({ mes: label, receita: rec, despesa: desp, resultado: rec - desp });
  }

  // EBITDA approximation (resultado + financial expenses already excluded in our model)
  const despFinanceiras = pagar.filter(l => {
    const cod = (l.plano_contas as any)?.codigo || '';
    return cod.startsWith('5');
  }).reduce((s, l) => s + Number(l.valor), 0);
  const ebitda = resultado + despFinanceiras;
  const margemEbitda = receitaBruta > 0 ? (ebitda / receitaBruta) * 100 : 0;
  const ticketMedio = processosMes > 0 ? receitaBruta / processosMes : 0;

  // Variation helpers
  const varReceita = receitaAnt > 0 ? ((receitaBruta - receitaAnt) / receitaAnt) * 100 : 0;
  const varDespesa = despesaAnt > 0 ? ((despesaTotal - despesaAnt) / despesaAnt) * 100 : 0;

  // ========== PDF GENERATION ==========
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const logo = await loadLogo();
  const totalPages = 5;

  // ===== PAGE 1: Executive Summary =====
  let y = 15;
  if (logo) {
    doc.addImage(logo, 'PNG', 15, y, 30, 30);
  }
  doc.setFontSize(20);
  doc.setTextColor(34, 197, 94);
  doc.setFont('helvetica', 'bold');
  doc.text('RELATÓRIO MENSAL', 50, y + 12);
  doc.setFontSize(12);
  doc.setTextColor(80);
  doc.setFont('helvetica', 'normal');
  doc.text(mesLabelCap, 50, y + 20);
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(BRAND.tagline, 50, y + 27);

  y = 55;
  y = addSectionTitle(doc, y, 'RESUMO EXECUTIVO');

  // KPI boxes - row 1
  const kpiW = 42;
  const kpiGap = 3;
  const startX = 15;
  addKpiBox(doc, startX, y, kpiW, 'Receita Bruta', fmt(receitaBruta), [34, 197, 94]);
  addKpiBox(doc, startX + kpiW + kpiGap, y, kpiW, 'Despesas', fmt(despesaTotal), [239, 68, 68]);
  addKpiBox(doc, startX + (kpiW + kpiGap) * 2, y, kpiW, 'Resultado', fmt(resultado), resultado >= 0 ? [34, 197, 94] : [239, 68, 68]);
  addKpiBox(doc, startX + (kpiW + kpiGap) * 3, y, kpiW, 'EBITDA', fmt(ebitda), [59, 130, 246]);
  y += 28;

  // KPI boxes - row 2
  addKpiBox(doc, startX, y, kpiW, 'Processos Ativos', String(processosAtivos), [80, 80, 80]);
  addKpiBox(doc, startX + kpiW + kpiGap, y, kpiW, 'Novos no Mês', String(processosMes), [80, 80, 80]);
  addKpiBox(doc, startX + (kpiW + kpiGap) * 2, y, kpiW, 'Clientes Ativos', String(clientesAtivos), [80, 80, 80]);
  addKpiBox(doc, startX + (kpiW + kpiGap) * 3, y, kpiW, 'Margem Líquida', pct(margemLiquida), margemLiquida >= 0 ? [34, 197, 94] : [239, 68, 68]);
  y += 32;

  // Mini DRE
  y = addSectionTitle(doc, y, 'MINI DRE');
  const dreRows = [
    ['(+) Receita Bruta', fmt(receitaBruta), varReceita >= 0 ? `+${pct(varReceita)}` : pct(varReceita)],
    ['(-) Despesas Totais', fmt(despesaTotal), varDespesa >= 0 ? `+${pct(varDespesa)}` : pct(varDespesa)],
    ['(=) Resultado Operacional', fmt(resultado), ''],
    ['(-) Desp. Financeiras', fmt(despFinanceiras), ''],
    ['(=) Resultado Líquido', fmt(resultado - despFinanceiras), ''],
  ];
  autoTable(doc, {
    startY: y,
    head: [['Linha', 'Valor', 'Var. vs Anterior']],
    body: dreRows,
    margin: { left: 15, right: 15 },
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [34, 197, 94], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Inadimplência alert
  if (valorInadimplente > 0) {
    doc.setFillColor(254, 243, 199);
    doc.roundedRect(15, y, W - 30, 14, 2, 2, 'F');
    doc.setFontSize(9);
    doc.setTextColor(180, 83, 9);
    doc.setFont('helvetica', 'bold');
    doc.text(`⚠ Inadimplência: ${fmt(valorInadimplente)} (${inadimplentes.length} lançamento(s) vencidos — ${pct(taxaInadimplencia)} da receita)`, 20, y + 9);
  }

  addFooter(doc, 1, totalPages);

  // ===== PAGE 2: Receitas =====
  doc.addPage();
  y = 20;
  y = addSectionTitle(doc, y, 'RECEITAS — DETALHAMENTO');

  // Top 5 clients
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.setFont('helvetica', 'bold');
  doc.text('Top 5 Clientes por Faturamento', 15, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [['#', 'Cliente', 'Faturamento', '% do Total']],
    body: topClientes.map((c, i) => [
      String(i + 1),
      c.nome,
      fmt(c.total),
      pct(receitaBruta > 0 ? (c.total / receitaBruta) * 100 : 0),
    ]),
    margin: { left: 15, right: 15 },
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [34, 197, 94], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' } },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // Distribution by type
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.setFont('helvetica', 'bold');
  doc.text('Distribuição por Tipo de Processo', 15, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [['Tipo', 'Valor', '% do Total']],
    body: tipoDistrib.map(([tipo, valor]) => [
      tipo.charAt(0).toUpperCase() + tipo.slice(1),
      fmt(valor),
      pct(receitaBruta > 0 ? (valor / receitaBruta) * 100 : 0),
    ]),
    margin: { left: 15, right: 15 },
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [34, 197, 94], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // Comparison
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.setFont('helvetica', 'bold');
  doc.text('Comparativo vs Mês Anterior', 15, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [['Métrica', 'Mês Atual', 'Mês Anterior', 'Variação']],
    body: [
      ['Receita Bruta', fmt(receitaBruta), fmt(receitaAnt), `${varReceita >= 0 ? '+' : ''}${pct(varReceita)}`],
      ['Recebido', fmt(receitaRecebida), '—', '—'],
    ],
    margin: { left: 15, right: 15 },
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [34, 197, 94], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
  });

  addFooter(doc, 2, totalPages);

  // ===== PAGE 3: Despesas =====
  doc.addPage();
  y = 20;
  y = addSectionTitle(doc, y, 'DESPESAS — DETALHAMENTO');

  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.setFont('helvetica', 'bold');
  doc.text('Top 5 Categorias de Despesa', 15, y);
  y += 4;

  // Horizontal bar simulation via table
  autoTable(doc, {
    startY: y,
    head: [['Categoria', 'Valor', '% do Total', 'Barra']],
    body: topDespesas.map(([cat, val]) => {
      const pctVal = despesaTotal > 0 ? (val / despesaTotal) * 100 : 0;
      const bar = '█'.repeat(Math.max(1, Math.round(pctVal / 5)));
      return [cat, fmt(val), pct(pctVal), bar];
    }),
    margin: { left: 15, right: 15 },
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [239, 68, 68], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { textColor: [239, 68, 68] } },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // 3-month expense evolution
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.setFont('helvetica', 'bold');
  doc.text('Evolução de Despesas (3 meses)', 15, y);
  y += 4;
  const last3 = evolucao.slice(-3);
  autoTable(doc, {
    startY: y,
    head: [['Mês', 'Despesas', 'Receitas', 'Resultado']],
    body: last3.map(e => [e.mes, fmt(e.despesa), fmt(e.receita), fmt(e.resultado)]),
    margin: { left: 15, right: 15 },
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [100, 100, 100], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
  });

  addFooter(doc, 3, totalPages);

  // ===== PAGE 4: Projeção =====
  doc.addPage();
  y = 20;
  y = addSectionTitle(doc, y, 'PROJEÇÃO E FLUXO');

  // Pending receivables
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.setFont('helvetica', 'bold');
  doc.text('Contas a Receber Pendentes', 15, y);
  y += 4;
  const recPendentes = lancReceberPendentes || [];
  if (recPendentes.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Vencimento', 'Cliente', 'Valor']],
      body: recPendentes.map(l => [
        new Date(l.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR'),
        (l.clientes as any)?.apelido || (l.clientes as any)?.nome || '—',
        fmt(Number(l.valor)),
      ]),
      margin: { left: 15, right: 15 },
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [34, 197, 94], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 2: { halign: 'right' } },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.setFont('helvetica', 'italic');
    doc.text('Nenhuma conta a receber pendente no período.', 15, y + 4);
    y += 14;
  }

  // Pending payables
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.setFont('helvetica', 'bold');
  doc.text('Contas a Pagar Próximas', 15, y);
  y += 4;
  const pagPendentes = lancPagarPendentes || [];
  if (pagPendentes.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Vencimento', 'Descrição', 'Valor']],
      body: pagPendentes.map(l => [
        new Date(l.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR'),
        l.descricao,
        fmt(Number(l.valor)),
      ]),
      margin: { left: 15, right: 15 },
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [239, 68, 68], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 2: { halign: 'right' } },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.setFont('helvetica', 'italic');
    doc.text('Nenhuma conta a pagar pendente no período.', 15, y + 4);
    y += 14;
  }

  // Cash flow summary
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo do Fluxo — Próximos 30 dias', 15, y);
  y += 4;
  const totalEntPendente = recPendentes.reduce((s, l) => s + Number(l.valor), 0);
  const totalSaiPendente = pagPendentes.reduce((s, l) => s + Number(l.valor), 0);
  const saldoProj = totalEntPendente - totalSaiPendente;
  addKpiBox(doc, 15, y, 55, 'Entradas Previstas', fmt(totalEntPendente), [34, 197, 94]);
  addKpiBox(doc, 75, y, 55, 'Saídas Previstas', fmt(totalSaiPendente), [239, 68, 68]);
  addKpiBox(doc, 135, y, 55, 'Saldo Projetado', fmt(saldoProj), saldoProj >= 0 ? [34, 197, 94] : [239, 68, 68]);

  addFooter(doc, 4, totalPages);

  // ===== PAGE 5: Indicadores =====
  doc.addPage();
  y = 20;
  y = addSectionTitle(doc, y, 'INDICADORES DE DESEMPENHO');

  // Main indicators
  const indicW = 55;
  addKpiBox(doc, 15, y, indicW, 'EBITDA', fmt(ebitda), [59, 130, 246]);
  addKpiBox(doc, 15 + indicW + 5, y, indicW, 'Margem EBITDA', pct(margemEbitda), [59, 130, 246]);
  addKpiBox(doc, 15 + (indicW + 5) * 2, y, indicW, 'Margem Líquida', pct(margemLiquida), margemLiquida >= 0 ? [34, 197, 94] : [239, 68, 68]);
  y += 28;

  addKpiBox(doc, 15, y, indicW, 'Inadimplência', pct(taxaInadimplencia), taxaInadimplencia > 10 ? [239, 68, 68] : [34, 197, 94]);
  addKpiBox(doc, 15 + indicW + 5, y, indicW, 'Ticket Médio', fmt(ticketMedio), [80, 80, 80]);
  addKpiBox(doc, 15 + (indicW + 5) * 2, y, indicW, 'Processos/Mês', String(processosMes), [80, 80, 80]);
  y += 32;

  // 6-month evolution table
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.setFont('helvetica', 'bold');
  doc.text('Evolução 6 Meses', 15, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [['Mês', 'Receita', 'Despesa', 'Resultado', 'Margem']],
    body: evolucao.map(e => [
      e.mes,
      fmt(e.receita),
      fmt(e.despesa),
      fmt(e.resultado),
      e.receita > 0 ? pct((e.resultado / e.receita) * 100) : '—',
    ]),
    margin: { left: 15, right: 15 },
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
  });

  addFooter(doc, 5, totalPages);

  // Save
  const filename = `relatorio-mensal-${targetAno}-${String(targetMes + 1).padStart(2, '0')}.pdf`;
  doc.save(filename);
  return filename;
}
