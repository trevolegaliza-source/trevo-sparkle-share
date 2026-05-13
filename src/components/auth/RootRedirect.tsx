import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import Dashboard from '@/pages/Dashboard';

// UX-130 (12/05/2026): root redirect role-aware.
//
// Antes: rota `/` era envolvida em <RequirePermission modulo="dashboard">.
// Gerente/operacional não tinham `dashboard` → caíam direto em "Acesso
// Restrito" no primeiro login, sem chance de redirecionar pro módulo
// que ela podia ver. O fallback do Dashboard.tsx que tentava redirect
// nunca executava porque o Dashboard não chegava a renderizar.
//
// Agora: rota `/` renderiza este componente que escolhe destino baseado
// nas permissões do usuário.
// DECISION-001 Fase 2 (13/05/2026): `/processos` (kanban operacional)
// removido da lista de prioridade. Visualizador/financeiro caem em
// `/clientes`. Rota `/processos` continua viva por URL direta mas não
// é mais destino default. Thales: "tira essa merda".
const MODULES_PRIORITY = [
  { mod: 'cadastro_rapido', path: '/cadastro-rapido' },
  { mod: 'clientes',        path: '/clientes' },
  { mod: 'orcamentos',      path: '/orcamentos' },
  { mod: 'financeiro',      path: '/financeiro' },
  { mod: 'contas_pagar',    path: '/contas-pagar' },
  { mod: 'colaboradores',   path: '/colaboradores' },
  { mod: 'configuracoes',   path: '/configuracoes' },
];

export function RootRedirect() {
  const { loading, podeVer, isMaster } = usePermissions();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isMaster() || podeVer('dashboard')) {
    return <Dashboard />;
  }

  const first = MODULES_PRIORITY.find(m => podeVer(m.mod));
  if (first) {
    return <Navigate to={first.path} replace />;
  }

  // Caso patológico: usuário ativo sem nenhum módulo permitido.
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center px-6">
      <h2 className="text-xl font-bold mb-2">Sem módulos disponíveis</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        Sua conta foi aprovada, mas nenhum módulo está liberado ainda. Peça ao master pra ajustar suas permissões em Configurações → Usuários.
      </p>
    </div>
  );
}
