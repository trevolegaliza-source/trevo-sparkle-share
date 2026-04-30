export const ROLES = [
  {
    value: 'master',
    label: 'Master',
    descricao: 'Acesso total. Configura usuários e permissões.',
    cor: 'bg-red-500/15 text-red-500 border-red-500/30',
    corDot: 'bg-red-500',
  },
  {
    value: 'gerente',
    label: 'Gerente',
    descricao: 'Opera com autonomia. Não configura usuários.',
    cor: 'bg-purple-500/15 text-purple-500 border-purple-500/30',
    corDot: 'bg-purple-500',
  },
  {
    value: 'financeiro',
    label: 'Financeiro',
    descricao: 'Cobranças, extratos, contas a pagar.',
    cor: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
    corDot: 'bg-blue-500',
  },
  {
    value: 'operacional',
    label: 'Operacional',
    descricao: 'Processos, clientes, cadastro rápido.',
    cor: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
    corDot: 'bg-emerald-500',
  },
  {
    value: 'visualizador',
    label: 'Visualizador',
    descricao: 'Somente leitura.',
    cor: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
    corDot: 'bg-gray-500',
  },
] as const;

export type RoleValue = typeof ROLES[number]['value'];

export const MODULOS_DISPONIVEIS = [
  { value: 'dashboard', label: 'Dashboard', grupo: 'Operação' },
  { value: 'cadastro_rapido', label: 'Cadastro Rápido', grupo: 'Operação' },
  { value: 'processos', label: 'Processos', grupo: 'Operação' },
  { value: 'clientes', label: 'Clientes', grupo: 'Operação' },
  { value: 'orcamentos', label: 'Orçamentos', grupo: 'Comercial' },
  { value: 'catalogo', label: 'Portfólio & Preços', grupo: 'Comercial' },
  { value: 'financeiro', label: 'Financeiro (Cobranças)', grupo: 'Financeiro' },
  { value: 'contas_pagar', label: 'Contas a Pagar', grupo: 'Financeiro' },
  { value: 'relatorios_dre', label: 'Relatórios DRE', grupo: 'Financeiro' },
  { value: 'fluxo_caixa', label: 'Fluxo de Caixa', grupo: 'Financeiro' },
  { value: 'colaboradores', label: 'Colaboradores', grupo: 'Gestão' },
  { value: 'intel_geografica', label: 'Intel. Geográfica', grupo: 'Gestão' },
  { value: 'documentos', label: 'Documentos', grupo: 'Gestão' },
  { value: 'configuracoes', label: 'Configurações', grupo: 'Sistema' },
] as const;

export const GRUPOS_MODULOS = ['Operação', 'Comercial', 'Financeiro', 'Gestão', 'Sistema'] as const;

export function getRoleInfo(role: string) {
  return ROLES.find(r => r.value === role) || ROLES[ROLES.length - 1];
}
