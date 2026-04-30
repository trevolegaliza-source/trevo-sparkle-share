import { supabase } from '@/integrations/supabase/client';

interface TaxaItem {
  descricao: string;
  valor: number;
}

interface ProcessoCobranca {
  tipo: string;
  razao_social: string;
  valor: number;
  honorarios?: number;
  taxasExtras?: number;
  taxasDetalhadas?: TaxaItem[];
}

/**
 * Dados da empresa emissora da cobrança. Vêm da tabela empresas_config
 * via RPC resolve_empresa_config. Fallback pros valores da Trevo
 * garante que a mensagem sempre fica completa mesmo sem config
 * populada (compatibilidade pra empresa legacy).
 */
export interface EmpresaConfigCobranca {
  nome: string;      // razão social
  pix_chave: string;
  pix_banco: string;
  whatsapp: string;  // formato internacional, ex: 5511934927001
  site: string;
  /** Nome display (ex: "Trevo Legaliza"). Se vazio, usa pedaço do nome. */
  nome_fantasia?: string;
}

/** Fallback usado quando a config não tá populada (empresa antiga). */
const CONFIG_FALLBACK: EmpresaConfigCobranca = {
  nome: 'TREVO LEGALIZA LTDA',
  nome_fantasia: 'Trevo Legaliza',
  pix_chave: '39.969.412/0001-70',
  pix_banco: 'C6 Bank',
  whatsapp: '5511934927001',
  site: 'trevolegaliza.com.br',
};

function nomeCurto(cfg: EmpresaConfigCobranca): string {
  return cfg.nome_fantasia && cfg.nome_fantasia.trim().length > 0
    ? cfg.nome_fantasia.trim()
    : cfg.nome.replace(/\b(LTDA|S\.?A\.?|ME|EPP)\.?\b/gi, '').trim();
}

function formatarTelefoneBR(v: string): string {
  // 5511934927001 → (11) 93492-7001
  const digits = (v || '').replace(/\D/g, '');
  const local = digits.startsWith('55') ? digits.slice(2) : digits;
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return v; // não sei formatar, devolve como veio
}

/**
 * Busca config da empresa (via RPC que já tem fallback embutido).
 * Útil pra quem tem empresa_id em mãos e quer construir a mensagem.
 */
export async function fetchEmpresaConfigCobranca(
  empresaId: string,
): Promise<EmpresaConfigCobranca> {
  try {
    const { data, error } = await supabase.rpc(
      'resolve_empresa_config' as any,
      { p_empresa_id: empresaId },
    );
    if (error || !data) return CONFIG_FALLBACK;
    const cfg = data as Partial<EmpresaConfigCobranca>;
    return {
      nome: cfg.nome || CONFIG_FALLBACK.nome,
      nome_fantasia: cfg.nome_fantasia,
      pix_chave: cfg.pix_chave || CONFIG_FALLBACK.pix_chave,
      pix_banco: cfg.pix_banco || CONFIG_FALLBACK.pix_banco,
      whatsapp: cfg.whatsapp || CONFIG_FALLBACK.whatsapp,
      site: cfg.site || CONFIG_FALLBACK.site,
    };
  } catch {
    return CONFIG_FALLBACK;
  }
}

function formatarNegrito(text: string) {
  const limpo = text.trim().replace(/^\*+|\*+$/g, '');
  return `*${limpo}*`;
}

function formatarValor(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(dataISO: string) {
  return new Date(dataISO + 'T00:00:00').toLocaleDateString('pt-BR');
}

function tipoUpper(tipo: string) {
  return (tipo || 'PROCESSO').toUpperCase();
}

function renderProcessoBlock(p: ProcessoCobranca): string {
  const linhas: string[] = [];
  linhas.push(`${formatarNegrito(tipoUpper(p.tipo))} — ${formatarNegrito(p.razao_social)}`);
  const honorarios = p.honorarios != null ? p.honorarios : p.valor;
  linhas.push(`Honorários: ${formatarValor(honorarios)}`);
  const taxas = (p.taxasDetalhadas || []).filter(t => t.valor > 0);
  for (const t of taxas) {
    linhas.push(`${t.descricao}: ${formatarValor(t.valor)}`);
  }
  return linhas.join('\n');
}

function temAlgumaTaxa(processos: ProcessoCobranca[]): boolean {
  return processos.some(p =>
    (p.taxasDetalhadas || []).some(t => t.valor > 0) || (p.taxasExtras || 0) > 0,
  );
}

/**
 * Gera mensagem de PRIMEIRO ENVIO — tom amigável, faturamento disponível.
 * Usar quando o extrato acabou de ser gerado (etapa: cobranca_gerada).
 *
 * Se `empresaConfig` não for passado, usa o fallback (Trevo). Recomendado
 * sempre passar via `fetchEmpresaConfigCobranca(empresa_id)` pra suportar
 * multi-empresa.
 */
export function gerarMensagemCobranca(params: {
  tipo: string;
  razao_social: string;
  valor: number;
  data_vencimento: string;
  diasAtraso: number;
  processosAdicionais?: ProcessoCobranca[];
  /** @deprecated mantido por compatibilidade; não é mais exibido */
  nomeRemetente?: string;
  honorarios?: number;
  taxasExtras?: number;
  taxasDetalhadas?: TaxaItem[];
  observacao?: string;
  empresaConfig?: EmpresaConfigCobranca;
}) {
  const cfg = params.empresaConfig ?? CONFIG_FALLBACK;
  const allProcessos: ProcessoCobranca[] = [
    {
      tipo: params.tipo,
      razao_social: params.razao_social,
      valor: params.valor,
      honorarios: params.honorarios,
      taxasExtras: params.taxasExtras,
      taxasDetalhadas: params.taxasDetalhadas,
    },
    ...(params.processosAdicionais || []),
  ];

  const valorTotal = allProcessos.reduce((sum, p) => sum + p.valor, 0);
  const dataFmt = formatarData(params.data_vencimento);

  if (params.diasAtraso > 0) {
    return gerarMensagemRecobranca(allProcessos, valorTotal, dataFmt, params.diasAtraso, cfg);
  }

  const blocos = allProcessos.map(renderProcessoBlock).join('\n\n');
  const obsBlock = params.observacao ? `\n📝 _${params.observacao}_\n` : '';
  const comprovantesBlock = temAlgumaTaxa(allProcessos)
    ? `\nOs comprovantes de pagamento das taxas reembolsáveis estão registrados no processo dentro da nossa plataforma.\n`
    : '';

  const nome = nomeCurto(cfg);
  const tel = formatarTelefoneBR(cfg.whatsapp);

  return `Olá! Aqui é do departamento financeiro da ${formatarNegrito(nome)} 🍀

Segue o faturamento referente ao(s) processo(s) do mês:

${blocos}

${formatarNegrito('Total: ' + formatarValor(valorTotal))}
${formatarNegrito('Vencimento: ' + dataFmt)}
${obsBlock}${comprovantesBlock}
${formatarNegrito('Chave PIX (CNPJ):')} ${cfg.pix_chave}
${formatarNegrito('Banco:')} ${cfg.pix_banco}

Se preferir pagamento via ${formatarNegrito('boleto bancário')}, é só solicitar por aqui! 📄

Qualquer dúvida, estamos à disposição.

${formatarNegrito(nome)} 🍀
Assessoria societária · Atuação nacional
${tel} · ${cfg.site}`;
}

/**
 * Mensagem de RECOBRANÇA — tom educado mas direto, para vencidos.
 */
function gerarMensagemRecobranca(
  processos: ProcessoCobranca[],
  valorTotal: number,
  dataVencimento: string,
  _diasAtraso: number,
  cfg: EmpresaConfigCobranca,
) {
  const blocos = processos.map(renderProcessoBlock).join('\n\n');
  const comprovantesBlock = temAlgumaTaxa(processos)
    ? `\nOs comprovantes de pagamento das taxas reembolsáveis estão registrados no processo dentro da nossa plataforma.\n`
    : '';

  const nome = nomeCurto(cfg);
  const tel = formatarTelefoneBR(cfg.whatsapp);

  return `Olá! Aqui é do departamento financeiro da ${formatarNegrito(nome)} 🍀

Gostaríamos de verificar o pagamento referente ao(s) processo(s) abaixo, com vencimento em ${formatarNegrito(dataVencimento)}:

${blocos}

${formatarNegrito('Total: ' + formatarValor(valorTotal))}
${comprovantesBlock}
${formatarNegrito('Chave PIX (CNPJ):')} ${cfg.pix_chave}
${formatarNegrito('Banco:')} ${cfg.pix_banco}

Se preferir ${formatarNegrito('boleto bancário')}, é só solicitar! 📄

Caso já tenha efetuado o pagamento, por favor desconsidere esta mensagem e nos envie o comprovante.

${formatarNegrito(nome)} 🍀
Assessoria societária · Atuação nacional
${tel} · ${cfg.site}`;
}
