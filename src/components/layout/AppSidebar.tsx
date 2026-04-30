import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Kanban, Users, DollarSign, Settings,
  PlusCircle, ArrowUpCircle, LogOut, UsersRound, Receipt, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import logoTrevo from '@/assets/logo-trevo.png';

// Demanda Thales 30/04 (item 2.3): menu enxuto. Itens removidos da UI
// (Dashboard, Relatórios DRE, Fluxo de Caixa, Intel. Geográfica,
// Portfólio & Preços, Trello ↔ ERP) ficam acessíveis só por URL direta —
// rotas mantidas em App.tsx. Decisão registrada no doc Auditoria.
const navItems = [
  { path: '/cadastro-rapido', label: 'Cadastro Rápido', icon: PlusCircle, modulo: 'processos' },
  { path: '/processos', label: 'Processos', icon: Kanban, modulo: 'processos' },
  { path: '/clientes', label: 'Clientes', icon: Users, modulo: 'clientes' },
  { path: '/orcamentos', label: 'Orçamentos', icon: Receipt, modulo: 'orcamentos' },
  { path: '/financeiro', label: 'Financeiro', icon: DollarSign, modulo: 'financeiro' },
  { path: '/contas-pagar', label: 'Contas a Pagar', icon: ArrowUpCircle, modulo: 'contas_pagar' },
  { path: '/colaboradores', label: 'Colaboradores', icon: UsersRound, modulo: 'colaboradores' },
  { path: '/configuracoes', label: 'Configurações', icon: Settings, modulo: 'configuracoes' },
];

interface AppSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function AppSidebar({ open, onClose }: AppSidebarProps) {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { podeVer, loading: permsLoading } = usePermissions();
  // Demanda Thales 30/04 (item 2.5): hover expande, mouse out colapsa.
  // Mobile mantém comportamento prévio (hambúrguer abre/fecha por clique).
  const [hover, setHover] = useState(false);

  const visibleItems = navItems.filter(item => podeVer(item.modulo));
  // Mobile: largura cheia quando aberta. Desktop: w-16 default, w-60 no hover.
  const expanded = hover || open;

  return (
    <aside
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={cn(
        'fixed top-0 z-50 flex h-screen flex-col border-r border-sidebar-border bg-sidebar/95 backdrop-blur-md text-sidebar-foreground transition-all duration-300',
        'lg:translate-x-0 lg:z-40',
        // Mobile open vs closed
        open ? 'translate-x-0 w-60' : '-translate-x-full w-60 lg:translate-x-0',
        // Desktop expand on hover
        !open && (hover ? 'lg:w-60' : 'lg:w-16')
      )}
    >
      {/* Logo + Close (mobile) */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <img src={logoTrevo} alt="Trevo Legaliza" className="h-10 w-10 object-contain shrink-0 logo-pulse" />
          {expanded && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold tracking-tight truncate">Trevo Legaliza</span>
              <span className="text-[10px] text-sidebar-foreground/60">Controladoria & Gestão</span>
            </div>
          )}
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
      <nav className="flex-1 space-y-1 px-2 py-4 overflow-y-auto overflow-x-hidden scrollbar-thin">
        {permsLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
              <div className="h-4.5 w-4.5 shrink-0 rounded bg-sidebar-foreground/10 animate-pulse" />
              {expanded && (
                <div
                  className="h-3.5 rounded bg-sidebar-foreground/10 animate-pulse"
                  style={{ width: `${[70, 50, 80, 40, 65, 55][i]}%` }}
                />
              )}
            </div>
          ))
        ) : (
          visibleItems.map((item) => {
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                title={item.label}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'sidebar-item-active'
                    : 'sidebar-item-hover text-sidebar-foreground/70 hover:text-sidebar-accent-foreground'
                )}
              >
                <item.icon className={cn('h-4.5 w-4.5 shrink-0 transition-all', isActive && 'icon-glow text-primary')} />
                {expanded && <span className="flex-1 truncate">{item.label}</span>}
              </Link>
            );
          })
        )}
      </nav>

      {/* User & Actions */}
      <div className="border-t border-sidebar-border p-2 space-y-1">
        {user && expanded && (
          <p className="text-[10px] text-sidebar-foreground/50 px-3 truncate">{user.email}</p>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          title="Sair"
          className="w-full justify-start gap-2 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {expanded && <span className="text-xs">Sair</span>}
        </Button>
      </div>
    </aside>
  );
}
