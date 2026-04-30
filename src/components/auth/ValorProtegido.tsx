import { usePermissions } from '@/hooks/usePermissions';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  valor: number;
  className?: string;
}

export function ValorProtegido({ valor, className }: Props) {
  const { podeVerValores } = usePermissions();
  if (!podeVerValores()) return <span className={`text-muted-foreground ${className || ''}`}>•••••</span>;
  return <span className={className}>{fmt(valor)}</span>;
}
