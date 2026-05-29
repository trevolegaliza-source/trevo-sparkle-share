import { maskCNPJ } from '@/lib/cnpj';
import type { ClienteDB } from '@/types/financial';
import type { ServiceNegotiation } from '@/hooks/useServiceNegotiations';
import type { InlineNegotiationRow } from '@/components/clientes/HonorariosInlineRepeater';

/**
 * Monta o form inicial do dialog "Editar Cadastro" a partir do cliente
 * carregado do banco. Separa o boilerplate de copiar 30+ campos da
 * página, com o detalhe das defaults (forma_cobranca derivada do
 * dia_vencimento_mensal, valores numéricos viram string, etc).
 */
export function buildEditCadastroForm(cliente: ClienteDB): Record<string, any> {
  return {
    nome: cliente.nome || '',
    apelido: cliente.apelido || '',
    nome_contador: cliente.nome_contador || '',
    cnpj: maskCNPJ((cliente as any).cnpj || ''),
    codigo_identificador: cliente.codigo_identificador || '',
    email: cliente.email || '',
    telefone: cliente.telefone || '',
    nome_contato_financeiro: (cliente as any).nome_contato_financeiro || '',
    telefone_financeiro: (cliente as any).telefone_financeiro || '',
    tipo: cliente.tipo,
    estado: (cliente as any).estado || '',
    cidade: (cliente as any).cidade || '',
    cep: (cliente as any).cep || '',
    logradouro: (cliente as any).logradouro || '',
    numero: (cliente as any).numero || '',
    complemento: (cliente as any).complemento || '',
    bairro: (cliente as any).bairro || '',
    momento_faturamento: (cliente as any).momento_faturamento || 'na_solicitacao',
    forma_cobranca: Number((cliente as any).dia_vencimento_mensal) > 0 && !(cliente as any).dia_cobranca ? 'fatura_mensal' : 'por_processo',
    dia_cobranca: String((cliente as any).dia_cobranca ?? '4'),
    dia_vencimento_mensal: String((cliente as any).dia_vencimento_mensal ?? '15'),
    valor_base: String((cliente as any).valor_base ?? ''),
    desconto_progressivo: String((cliente as any).desconto_progressivo ?? ''),
    valor_limite_desconto: String((cliente as any).valor_limite_desconto ?? ''),
    mensalidade: String((cliente as any).mensalidade ?? ''),
    franquia_processos: String((cliente as any).franquia_processos ?? ''),
    saldo_prepago: String((cliente as any).saldo_prepago ?? ''),
    observacoes: (cliente as any).observacoes || '',
  };
}

/**
 * Converte rows do HonorariosInlineRepeater pro formato que o
 * useUpsertServiceNegotiations espera.
 */
export function buildHonorariosRowsFromNegotiations(negotiations: ServiceNegotiation[] | undefined): InlineNegotiationRow[] {
  return (negotiations || []).map(n => ({
    key: n.id,
    service_name: n.service_name,
    fixed_price: String(n.fixed_price),
    billing_trigger: n.billing_trigger as 'request' | 'approval',
    trigger_days: String(n.trigger_days),
  }));
}

/**
 * Monta o payload de UPDATE da tabela clientes a partir do form do
 * dialog. Filtra campos por modalidade (AVULSO_4D vs MENSALISTA vs
 * PRE_PAGO) e converte string→number conforme campo.
 */
export function buildCadastroPayload(
  cliente: ClienteDB,
  form: Record<string, any>,
  cnpjDigits: string,
): Record<string, any> {
  const isAvulso = form.tipo === 'AVULSO_4D';
  const isMensalistaEdit = form.tipo === 'MENSALISTA';
  const isPrePagoEdit = form.tipo === 'PRE_PAGO';
  const isFormaProcesso = form.forma_cobranca === 'por_processo';

  return {
    id: cliente.id,
    nome: form.nome,
    apelido: form.apelido,
    nome_contador: form.nome_contador,
    cnpj: cnpjDigits || null,
    codigo_identificador: form.codigo_identificador?.replace(/\D/g, '') || cliente.codigo_identificador,
    email: form.email || null,
    telefone: form.telefone || null,
    nome_contato_financeiro: form.nome_contato_financeiro || null,
    telefone_financeiro: form.telefone_financeiro || null,
    tipo: form.tipo,
    estado: form.estado || null,
    cidade: form.cidade || null,
    cep: (form.cep || '').replace(/\D/g, '') || null,
    logradouro: form.logradouro || null,
    numero: form.numero || null,
    complemento: form.complemento || null,
    bairro: form.bairro || null,
    momento_faturamento: isAvulso ? form.momento_faturamento : isMensalistaEdit ? 'na_solicitacao' : null,
    dia_vencimento_mensal: isAvulso ? (isFormaProcesso ? null : (Number(form.dia_vencimento_mensal) || 15)) : isMensalistaEdit ? (Number(form.dia_vencimento_mensal) || 10) : null,
    dia_cobranca: isAvulso && isFormaProcesso ? (Number(form.dia_cobranca) || 4) : null,
    valor_base: (isAvulso || isMensalistaEdit || isPrePagoEdit) && form.valor_base ? Number(form.valor_base) : null,
    desconto_progressivo: (isAvulso || isMensalistaEdit) && form.desconto_progressivo ? Number(form.desconto_progressivo) : null,
    valor_limite_desconto: (isAvulso || isMensalistaEdit) && form.valor_limite_desconto ? Number(form.valor_limite_desconto) : null,
    mensalidade: isMensalistaEdit && form.mensalidade ? Number(form.mensalidade) : null,
    franquia_processos: isMensalistaEdit && form.franquia_processos ? Number(form.franquia_processos) : 0,
    saldo_prepago: isPrePagoEdit && form.saldo_prepago ? Number(form.saldo_prepago) : undefined,
    observacoes: form.observacoes || null,
  };
}

export const DEFAULT_PROCESSO_FORM = {
  razao_social: '',
  tipo: 'abertura' as string,
  prioridade: 'normal',
  responsavel: '',
  valor_manual: '',
  definir_manual: false,
  negotiated_service_id: '' as string,
  mudanca_uf: false,
  boas_vindas: false,
  boas_vindas_pct: '50',
  ja_pago: false,
  observacoes: '',
  motivo_manual: '',
  data_entrada: new Date().toISOString().split('T')[0],
  dentro_do_plano: true,
  valor_avulso: 0,
  justificativa_avulso: '',
};
