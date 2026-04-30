/**
 * Relatório de Saldo Pré-Pago — PDF via html2canvas + jsPDF
 * Reuses Trevo brand visual identity from extrato-pdf.ts
 */
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { PrepagoMovimentacao } from '@/types/supabase';

const BRAND = {
  nome: 'TREVO LEGALIZA LTDA',
  fantasia: 'Trevo Legaliza 🍀',
  cnpj: '39.969.412/0001-70',
  endereco: 'Rua Brasil, nº 1170, Rudge Ramos, SBC/SP',
  email: 'administrativo@trevolegaliza.com.br',
  telefone: '(11) 93492-7001',
  pix: '39.969.412/0001-70',
  banco: 'C6 Bank',
};

const LOGO_URL = 'https://aahhauquuicvtwtrxyan.supabase.co/storage/v1/object/public/documentos/logo/trevo-legaliza-hd.png';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

export interface RelatorioPrepagoDados {
  cliente: {
    nome: string;
    cnpj: string | null;
    apelido: string | null;
  };
  saldoAtual: number;
  ultimaRecarga: number;
  dataUltimaRecarga: string | null;
  movimentacoes: PrepagoMovimentacao[];
  // If generated due to insufficient balance
  saldoInsuficiente?: {
    tipoProcesso: string;
    razaoSocial: string;
    valorServico: number;
    diferenca: number;
  };
}

function buildHTML(dados: RelatorioPrepagoDados): string {
  const { cliente, saldoAtual, ultimaRecarga, dataUltimaRecarga, movimentacoes, saldoInsuficiente } = dados;
  const hoje = new Date().toLocaleDateString('pt-BR');

  const movRows = movimentacoes.map(m => `
    <tr>
      <td class="td-date">${fmtDate(m.created_at)}</td>
      <td class="td-desc">${m.descricao}</td>
      <td class="td-val" style="color:#ef4444;">${m.tipo === 'consumo' ? fmt(m.valor) : '—'}</td>
      <td class="td-val" style="color:#22c55e;">${m.tipo === 'recarga' ? fmt(m.valor) : '—'}</td>
      <td class="td-val">${fmt(m.saldo_posterior)}</td>
    </tr>
  `).join('');

  const insufBlock = saldoInsuficiente ? `
    <div style="margin-top:20px; background:#fef2f2; border:2px solid #ef4444; border-radius:8px; padding:20px;">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
        <span style="font-size:18px;">⚠️</span>
        <span style="font-size:14px; font-weight:800; color:#dc2626; text-transform:uppercase;">Saldo Insuficiente para Novo Processo</span>
      </div>
      <table style="width:100%; font-size:11px; color:#1a1a2e;">
        <tr><td style="padding:4px 0; color:#64748b;">Processo solicitado:</td><td style="font-weight:600;">${saldoInsuficiente.tipoProcesso} — ${saldoInsuficiente.razaoSocial}</td></tr>
        <tr><td style="padding:4px 0; color:#64748b;">Valor do serviço:</td><td style="font-weight:700;">${fmt(saldoInsuficiente.valorServico)}</td></tr>
        <tr><td style="padding:4px 0; color:#64748b;">Saldo disponível:</td><td style="font-weight:700;">${fmt(saldoAtual)}</td></tr>
        <tr><td style="padding:4px 0; color:#64748b;">Diferença:</td><td style="font-weight:800; color:#dc2626;">${fmt(saldoInsuficiente.diferenca)}</td></tr>
      </table>
      <div style="margin-top:14px; padding:12px; background:#ffffff; border-radius:6px; border:1px solid #e2e8f0;">
        <p style="font-size:10px; font-weight:700; color:#1a1a2e; margin-bottom:6px;">Para prosseguir, realize uma recarga no valor mínimo de ${fmt(saldoInsuficiente.diferenca)}.</p>
        <p style="font-size:10px; color:#64748b;">Chave PIX (CNPJ): <strong>${BRAND.pix}</strong></p>
        <p style="font-size:10px; color:#64748b;">Banco: <strong>${BRAND.banco}</strong></p>
      </div>
    </div>
  ` : '';

  return `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      body, div, span, p, td, th { font-family: 'DM Sans', sans-serif; }
      .page { width: 794px; min-height: 1123px; background: #ffffff; position: relative; overflow: hidden; }
      .stripe-top { width: 100%; height: 5px; background: #1a3a1a; }
      .header { display: flex; justify-content: space-between; align-items: center; padding: 10px 30px; border-bottom: 1px solid #e2e8f0; }
      .header-logo img { width: 208px; height: auto; }
      .header-right { text-align: right; font-size: 9px; color: #64748b; }
      .gradient-bar { width: 100%; height: 3px; background: linear-gradient(90deg, #4C9F38 0%, #a3e635 100%); }
      .client-block { background: #0f1f0f; padding: 20px 30px; }
      .client-tag { font-size: 9px; font-weight: 700; color: #4ade80; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 6px; }
      .client-name { font-size: 26px; font-weight: 800; color: #ffffff; }
      .client-cnpj { font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 4px; }
      .content { padding: 22px 30px; }
      .saldo-card { background: linear-gradient(135deg, #0f1f0f, #1a3a1a); border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 20px; }
      .saldo-label { font-size: 9px; font-weight: 700; color: #4ade80; text-transform: uppercase; letter-spacing: 1px; }
      .saldo-value { font-size: 36px; font-weight: 800; color: #ffffff; margin-top: 4px; }
      .saldo-sub { font-size: 10px; color: #94a3b8; margin-top: 4px; }
      .section-title { font-size: 10px; font-weight: 700; color: #4C9F38; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; border-bottom: 2px solid #4C9F38; padding-bottom: 4px; }
      table.mov { width: 100%; border-collapse: collapse; }
      table.mov th { background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 8px; font-weight: 700; color: #64748b; text-transform: uppercase; padding: 6px 8px; text-align: left; }
      table.mov th:nth-child(n+3) { text-align: right; }
      table.mov td { font-size: 9px; padding: 5px 8px; border-bottom: 1px solid #f1f5f9; }
      table.mov tr:nth-child(even) td { background: #f8fafc; }
      .td-date { color: #64748b; }
      .td-desc { color: #334155; font-weight: 500; }
      .td-val { text-align: right; font-weight: 700; color: #1a1a2e; }
      .footer { position: absolute; bottom: 4px; left: 30px; right: 30px; display: flex; justify-content: space-between; font-size: 8px; color: #94a3b8; }
      .gradient-bottom { position: absolute; bottom: 20px; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #4C9F38 0%, #a3e635 100%); }
    </style>
    <div class="page">
      <div class="stripe-top"></div>
      <div class="header">
        <div class="header-logo"><img src="${LOGO_URL}" crossorigin="anonymous" /></div>
        <div class="header-right">
          <div style="font-weight:700;">${BRAND.nome}</div>
          <div>${BRAND.endereco}</div>
        </div>
      </div>
      <div class="gradient-bar"></div>
      <div class="client-block">
        <div class="client-tag">Extrato de Saldo Pré-Pago</div>
        <div class="client-name">${cliente.apelido || cliente.nome}</div>
        ${cliente.cnpj ? `<div class="client-cnpj">CNPJ: ${cliente.cnpj}</div>` : ''}
        <div style="font-size:10px; color:#94a3b8; margin-top:4px;">Data de emissão: ${hoje}</div>
      </div>
      <div class="content">
        <div class="saldo-card">
          <div class="saldo-label">Saldo Atual</div>
          <div class="saldo-value">${fmt(saldoAtual)}</div>
          ${dataUltimaRecarga ? `<div class="saldo-sub">Última recarga: ${fmt(ultimaRecarga)} em ${fmtDate(dataUltimaRecarga)}</div>` : ''}
        </div>

        <div class="section-title">Movimentações</div>
        ${movimentacoes.length > 0 ? `
          <table class="mov">
            <thead>
              <tr>
                <th>Data</th>
                <th>Descrição</th>
                <th>Débito</th>
                <th>Crédito</th>
                <th>Saldo</th>
              </tr>
            </thead>
            <tbody>${movRows}</tbody>
          </table>
        ` : '<p style="font-size:10px; color:#94a3b8; text-align:center; padding:20px;">Nenhuma movimentação registrada.</p>'}

        ${insufBlock}
      </div>
      <div class="gradient-bottom"></div>
      <div class="footer">
        <span>${BRAND.email} | ${BRAND.telefone}</span>
        <span>Documento gerado automaticamente</span>
      </div>
    </div>
  `;
}

export async function gerarRelatorioPrepagoPDF(dados: RelatorioPrepagoDados): Promise<void> {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.innerHTML = buildHTML(dados);
  document.body.appendChild(container);

  // Wait for fonts/images
  await new Promise(r => setTimeout(r, 800));

  const page = container.querySelector('.page') as HTMLElement;
  const canvas = await html2canvas(page, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    logging: false,
  });

  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = (canvas.height * pdfW) / canvas.width;
  pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH);

  const nomeCliente = (dados.cliente.apelido || dados.cliente.nome).replace(/[^a-zA-Z0-9]/g, '_');
  pdf.save(`Extrato_PrePago_${nomeCliente}.pdf`);

  document.body.removeChild(container);
}
