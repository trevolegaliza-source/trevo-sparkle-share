export interface HierarchyGroup {
  key: string;
  label: string;
  description: string;
  icon: string;
  gradient: string;
  glowColor: string;
  children?: HierarchyChild[];
  categories?: string[];
}

export interface HierarchyChild {
  key: string;
  label: string;
  description: string;
  categories: string[];
}

export const CATALOG_HIERARCHY: HierarchyGroup[] = [
  {
    key: 'societario',
    label: 'Serviços Societários',
    description: 'Abertura, alteração, transformação e encerramento de empresas em todo o território nacional.',
    icon: '🏢',
    gradient: 'from-emerald-500/10 to-emerald-600/5',
    glowColor: 'rgba(34, 197, 94, 0.15)',
    children: [
      { key: 'abertura', label: 'Abertura de Empresas', description: 'MEI, EI, SLU, LTDA, S/A, Cooperativas, Filiais e mais.', categories: ['abertura'] },
      { key: 'alteracao', label: 'Alteração Contratual', description: 'Razão social, endereço, sócios, capital, CNAEs e cláusulas.', categories: ['alteracao'] },
      { key: 'transformacao', label: 'Transformação Societária', description: 'Fusão, cisão, incorporação e mudanças de natureza jurídica.', categories: ['transformacao'] },
      { key: 'baixa', label: 'Encerramento / Baixa', description: 'Distrato, baixa de CNPJ, IE, IM e filiais.', categories: ['baixa'] },
    ],
  },
  {
    key: 'licenciamento',
    label: 'Licenciamento & Regularização',
    description: 'Alvarás, licenças ambientais, sanitárias, bombeiros e regularizações fiscais.',
    icon: '📋',
    gradient: 'from-amber-500/10 to-amber-600/5',
    glowColor: 'rgba(245, 158, 11, 0.15)',
    children: [
      { key: 'licenca', label: 'Licenças e Alvarás', description: 'Alvará, AVCB, CLCB, ambiental, sanitária, PF, PC, Exército.', categories: ['licenca'] },
      { key: 'regularizacao', label: 'Regularização', description: 'CNPJ pendente, IE cassada, alvará vencido, reativação.', categories: ['regularizacao'] },
    ],
  },
  {
    key: 'registros',
    label: 'Registros & Certidões',
    description: 'Registros em conselhos profissionais, certidões negativas e serviços cartorários.',
    icon: '📑',
    gradient: 'from-blue-500/10 to-blue-600/5',
    glowColor: 'rgba(59, 130, 246, 0.15)',
    children: [
      { key: 'registros_especiais', label: 'Registros Especiais', description: 'CRM, CRO, CREA, CAU, OAB, ANVISA, ANTT e outros.', categories: ['registros_especiais'] },
      { key: 'certidao', label: 'Certidões', description: 'CND federal, FGTS, estadual, municipal, Junta, protestos.', categories: ['certidao'] },
      { key: 'cartorario', label: 'Serviços Cartorários', description: 'Autenticação, firma, apostila, tradução juramentada.', categories: ['cartorario'] },
    ],
  },
  {
    key: 'propriedade',
    label: 'Propriedade Intelectual',
    description: 'Registro de marcas, patentes, software e desenho industrial no INPI.',
    icon: '🏷️',
    gradient: 'from-purple-500/10 to-purple-600/5',
    glowColor: 'rgba(168, 85, 247, 0.15)',
    categories: ['marcas_patentes'],
  },
  {
    key: 'consultoria',
    label: 'Consultoria Societária',
    description: 'Análise de viabilidade, planejamento societário, due diligence e pareceres.',
    icon: '💡',
    gradient: 'from-pink-500/10 to-pink-600/5',
    glowColor: 'rgba(236, 72, 153, 0.15)',
    categories: ['consultoria'],
  },
  {
    key: 'recorrentes',
    label: 'Serviços Recorrentes',
    description: 'Renovações anuais de alvarás, licenças, registros em conselhos e certificados digitais.',
    icon: '🔄',
    gradient: 'from-teal-500/10 to-teal-600/5',
    glowColor: 'rgba(20, 184, 166, 0.15)',
    categories: ['recorrentes'],
  },
];
