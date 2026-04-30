import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Kanban, Users, DollarSign, Settings,
  PlusCircle, ArrowUpCircle, LogOut, UsersRound, Receipt, MapPin, BookOpen, BarChart3, X, GitCompare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebarCounts } from '@/hooks/useSidebarCounts';
import { usePermissions } from '@/hooks/usePermissions';
import logoTrevo from '@/assets/logo-trevo.png';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, badgeKey: null, modulo: 'dashboard' },
  { path: '/cadastro-rapido', label: 'Cadastro Rápido', icon: PlusCircle, badgeKey: null, modulo: 'processos' },
  { path: '/processos', label: 'Processos', icon: Kanban, badgeKey: 'processosAtivos' as const, modulo: 'processos' },
  { path: '/clientes', label: 'Clientes', icon: Users, badgeKey: null, modulo: 'clientes' },
  { path: '/orcamentos', label: 'Orçamentos', icon: Receipt, badgeKey: 'orcamentosPendentes' as const, modulo: 'orcamentos' },
  { path: '/financeiro', label: 'Financeiro', icon: DollarSign, badgeKey: 'pendentesFinanceiro' as const, modulo: 'financeiro' },
  { path: '/contas-pagar', label: 'Contas a Pagar', icon: ArrowUpCircle, badgeKey: null, modulo: 'contas_pagar' },
  { path: '/colaboradores', label: 'Colaboradores', icon: UsersRound, badgeKey: null, modulo: 'colaboradores' },
  { path: '/relatorios/dre', label: 'Relatórios (DRE)', icon: BarChart3, badgeKey: null, modulo: 'relatorios_dre' },
  { path: '/relatorios/fluxo-caixa', label: 'Fluxo de Caixa', icon: ArrowUpCircle, badgeKey: null, modulo: 'fluxo_caixa' },
  { path: '/inteligencia-geografica', label: 'Intel. Geográfica', icon: MapPin, badgeKey: null, modulo: 'intel_geografica' },
  { path: '/catalogo', label: 'Portfólio & Preços', icon: BookOpen, badgeKey: null, modulo: 'catalogo' },
  { path: '/reconciliacao-trello', label: 'Trello ↔ ERP', icon: GitCompare, badgeKey: null, modulo: 'configuracoes', masterOnly: true },
  { path: '/configuracoes', label: 'Configurações', icon: Settings, badgeKey: null, modulo: 'configuracoes' },
];

type BadgeVariant = 'default' | 'warning' | 'info';

const badgeVariants: Record<string, BadgeVariant> = {
  processosAtivos: 'default',
  orcamentosPendentes: 'info',
  pendentesFinanceiro: 'warning',
  docsPendentes: 'info',
};

const badgeColors: Record<BadgeVariant, string> = {
  default: 'bg-muted text-muted-foreground',
  warning: 'bg-amber-500/20 text-amber-500',
  info: 'bg-blue-500/20 text-blue-500',
};

interface AppSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function AppSidebar({ open, onClose }: AppSidebarProps) {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { data: counts } = useSidebarCounts();
  const { podeVer, loading: permsLoading, isMaster } = usePermissions();

  const visibleItems = navItems.filter(item => {
    if ((item as any).masterOnly && !isMaster()) return false;
    return podeVer(item.modulo);
  });

  return (
    <aside
      className={cn(
        'fixed top-0 z-50 flex h-screen w-60 flex-col border-r border-sidebar-border bg-sidebar/95 backdrop-blur-md text-sidebar-foreground transition-transform duration-300',
        'lg:translate-x-0 lg:z-40',
        open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}
    >
      {/* Logo + Close (mobile) */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-3">
        <div className="flex items-center gap-2.5">
          <img src={logoTrevo} alt="Trevo Legaliza" className="h-10 w-auto shrink-0 logo-pulse" />
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold tracking-tight truncate">Trevo Legaliza</span>
            <span className="text-[10px] text-sidebar-foreground/60">Controladoria & Gestão</span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden h-8 w-8 text-sidebar-foreground/60"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-2 py-4 overflow-y-auto scrollbar-thin">
        {permsLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
              <div className="h-4.5 w-4.5 shrink-0 rounded bg-sidebar-foreground/10 animate-pulse" />
              <div
                className="h-3.5 rounded bg-sidebar-foreground/10 animate-pulse"
                style={{ width: `${[70, 50, 80, 40, 65, 55][i]}%` }}
              />
            </div>
          ))
        ) : (
          visibleItems.map((item) => {
            const isActive = location.pathname === item.path;
            const badgeCount = item.badgeKey && counts ? counts[item.badgeKey] : 0;
            const variant = item.badgeKey ? badgeVariants[item.badgeKey] : 'default';

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'sidebar-item-active'
                    : 'sidebar-item-hover text-sidebar-foreground/70 hover:text-sidebar-accent-foreground'
                )}
              >
                <item.icon className={cn('h-4.5 w-4.5 shrink-0 transition-all', isActive && 'icon-glow text-primary')} />
                <span className="flex-1 truncate">{item.label}</span>
                {badgeCount > 0 && (
                  <span className={cn(
                    'ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                    badgeColors[variant]
                  )}>
                    {badgeCount}
                  </span>
                )}
              </Link>
            );
          })
        )}
      </nav>

      {/* User & Actions */}
      <div className="border-t border-sidebar-border p-2 space-y-1">
        {user && (
          <p className="text-[10px] text-sidebar-foreground/50 px-3 truncate">{user.email}</p>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="w-full justify-start gap-2 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span className="text-xs">Sair</span>
        </Button>
      </div>
    </aside>
  );
}
