export const CATEGORIAS_DESPESAS = {
  folha: {
    label: 'Folha de Pagamento',
    icon: 'Users',
    color: '#4C9F38',
    subcategorias: [
      'Salário',
      'Vale Transporte (VT)',
      'Vale Refeição (VR)',
      'DAS Colaborador',
      'FGTS',
      'INSS',
      '13º Salário (Provisão)',
      'Férias (Provisão)',
      'Adiantamento',
      'Outros Folha'
    ]
  },
  infraestrutura: {
    label: 'Infraestrutura',
    icon: 'Building2',
    color: '#3b82f6',
    subcategorias: [
      'Aluguel',
      'Água',
      'Energia Elétrica',
      'Internet',
      'Telefone',
      'Condomínio',
      'IPTU',
      'Manutenção',
      'Outros Infraestrutura'
    ]
  },
  marketing: {
    label: 'Marketing & Agência',
    icon: 'Megaphone',
    color: '#f59e0b',
    subcategorias: [
      'Agência de Marketing',
      'Tráfego Pago (Google Ads)',
      'Tráfego Pago (Meta Ads)',
      'Design/Criação',
      'Domínio/Hospedagem',
      'Outros Marketing'
    ]
  },
  ferramentas: {
    label: 'Ferramentas & SaaS',
    icon: 'Wrench',
    color: '#8b5cf6',
    subcategorias: [
      'Google Workspace',
      'Plataforma Trevo',
      'Lovable/Hosting',
      'CRM',
      'Outros SaaS'
    ]
  },
  terceiros: {
    label: 'Terceiros & Freelancers',
    icon: 'UserPlus',
    color: '#ec4899',
    subcategorias: [
      'Contador Externo',
      'Advogado',
      'Despachante',
      'Freelancer',
      'Outros Terceiros'
    ]
  },
  impostos: {
    label: 'Impostos & Tributos',
    icon: 'Landmark',
    color: '#ef4444',
    subcategorias: [
      'DAS Empresa',
      'ISS',
      'IRPJ',
      'CSLL',
      'PIS/COFINS',
      'Outros Impostos'
    ]
  },
  outros: {
    label: 'Outros',
    icon: 'MoreHorizontal',
    color: '#64748b',
    subcategorias: [
      'Material de Escritório',
      'Viagem/Deslocamento',
      'Alimentação Corporativa',
      'Seguros',
      'Outros'
    ]
  }
} as const;

export type CategoriaKey = keyof typeof CATEGORIAS_DESPESAS;
