import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface ProcessoStatus {
  razao_social: string;
  tipo: string;
  etapa: string;
  created_at: string;
  progresso: number;
  etapas_concluidas: string[];
  etapas_pendentes: string[];
}

interface RelatorioData {
  cliente_nome: string;
  cliente_cnpj: string;
  processos: ProcessoStatus[];
  data_emissao: string;
}

const ETAPAS_ORDENADAS = [
  'recebidos', 'analise_documental', 'contrato', 'viabilidade',
  'dbe', 'vre', 'aguardando_pagamento', 'taxa_paga',
  'assinaturas', 'assinado', 'em_analise', 'registro',
  'mat', 'inscricao_me', 'alvaras', 'conselho', 'finalizados',
];

const ETAPA_LABELS: Record<string, string> = {
  recebidos: 'Recebido',
  analise_documental: 'Análise Documental',
  contrato: 'Contrato',
  viabilidade: 'Viabilidade',
  dbe: 'DBE',
  vre: 'VRE',
  aguardando_pagamento: 'Ag. Pagamento',
  taxa_paga: 'Taxa Paga',
  assinaturas: 'Assinaturas',
  assinado: 'Assinado',
  em_analise: 'Em Análise',
  registro: 'Registro',
  mat: 'MAT',
  inscricao_me: 'Inscrição M/E',
  alvaras: 'Alvarás',
  conselho: 'Conselho',
  finalizados: 'Finalizado',
};

export function calcularProgresso(etapa: string): number {
  const idx = ETAPAS_ORDENADAS.indexOf(etapa);
  return idx >= 0 ? Math.round((idx / (ETAPAS_ORDENADAS.length - 1)) * 100) : 0;
}

export function getEtapasConcluidas(etapaAtual: string): { concluidas: string[]; pendentes: string[] } {
  const idx = ETAPAS_ORDENADAS.indexOf(etapaAtual);
  return {
    concluidas: ETAPAS_ORDENADAS.slice(0, idx + 1),
    pendentes: ETAPAS_ORDENADAS.slice(idx + 1),
  };
}

function formatEtapa(etapa: string): string {
  return ETAPA_LABELS[etapa] || etapa;
}

function buildRelatorioHTML(data: RelatorioData): string {
  const processosHtml = data.processos.map(p => {
    const barColor = p.progresso >= 80 ? '#22c55e' : p.progresso >= 50 ? '#f59e0b' : '#3b82f6';

    return `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div>
            <div style="font-size: 14px; font-weight: 700; color: #1a1a2e;">${p.razao_social}</div>
            <div style="font-size: 11px; color: #64748b;">${p.tipo.charAt(0).toUpperCase() + p.tipo.slice(1)} · Iniciado em ${new Date(p.created_at).toLocaleDateString('pt-BR')}</div>
          </div>
          <div style="font-size: 18px; font-weight: 800; color: ${barColor};">${p.progresso}%</div>
        </div>
        <div style="background: #e2e8f0; border-radius: 8px; height: 10px; overflow: hidden;">
          <div style="background: ${barColor}; height: 100%; width: ${p.progresso}%; border-radius: 8px;"></div>
        </div>
        <div style="font-size: 10px; color: #64748b; margin-top: 6px;">
          Etapa atual: <strong style="color: #1a1a2e;">${formatEtapa(p.etapa)}</strong>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div style="font-family: Arial, sans-serif; width: 794px; background: white; padding: 0;">
      <div style="background: #0f1f0f; padding: 24px 32px;">
        <div style="font-size: 10px; font-weight: 700; color: #4ade80; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">Relatório de Andamento</div>
        <div style="font-size: 22px; font-weight: 800; color: #fff;">${data.cliente_nome}</div>
        <div style="font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 4px;">${data.cliente_cnpj || ''} · Emitido em ${data.data_emissao}</div>
      </div>
      <div style="height: 3px; background: linear-gradient(90deg, #22c55e, #86efac);"></div>
      <div style="padding: 24px 32px;">
        <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px;">${data.processos.length} processo(s) em andamento</div>
        ${processosHtml}
      </div>
      <div style="padding: 16px 32px; border-top: 1px solid #e2e8f0;">
        <div style="font-size: 10px; color: #94a3b8; text-align: center;">
          Trevo Legaliza 🍀 · administrativo@trevolegaliza.com.br · (11) 93492-7001
        </div>
      </div>
    </div>
  `;
}

export async function gerarRelatorioStatusPDF(data: RelatorioData): Promise<jsPDF> {
  const html = buildRelatorioHTML(data);

  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.width = '794px';
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, { scale: 2, useCORS: true });
    const doc = new jsPDF('p', 'mm', 'a4');
    const imgData = canvas.toDataURL('image/png');
    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= 297;

    while (heightLeft > 0) {
      position -= 297;
      doc.addPage();
      doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= 297;
    }

    return doc;
  } finally {
    document.body.removeChild(container);
  }
}
