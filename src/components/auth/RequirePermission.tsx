import { usePermissions } from '@/hooks/usePermissions';
import { Navigate } from 'react-router-dom';
import { ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  modulo: string;
  acao?: 'ver' | 'criar' | 'editar' | 'excluir' | 'aprovar';
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

function AcessoNegado() {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center">
      <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <ShieldX className="h-8 w-8 text-destructive" />
      </div>
      <h2 className="text-xl font-bold mb-2">Acesso Restrito</h2>
      <p className="text-muted-foreground mb-4">Você não tem permissão para acessar esta página.</p>
      <Button onClick={() => window.history.back()}>Voltar</Button>
    </div>
  );
}

export function RequirePermission({ modulo, acao = 'ver', children, fallback }: Props) {
  const { podeVer, podeCriar, podeEditar, podeExcluir, podeAprovar, loading } = usePermissions();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const temPermissao =
    acao === 'ver' ? podeVer(modulo) :
    acao === 'criar' ? podeCriar(modulo) :
    acao === 'editar' ? podeEditar(modulo) :
    acao === 'excluir' ? podeExcluir(modulo) :
    podeAprovar(modulo);

  if (!temPermissao) {
    if (fallback) return <>{fallback}</>;
    return <AcessoNegado />;
  }

  return <>{children}</>;
}
