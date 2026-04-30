import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Tags } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ETIQUETAS_PROCESSO, type EtiquetaProcesso } from '@/constants/etiquetas';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

function getEtiquetaConfig(value: string) {
  return ETIQUETAS_PROCESSO.find(e => e.value === value);
}

/** Display-only badges */
export function EtiquetasDisplay({
  etiquetas,
  size = 'normal',
}: {
  etiquetas: string[];
  size?: 'compact' | 'normal';
}) {
  if (!etiquetas || etiquetas.length === 0) return null;

  const sizeClasses = size === 'compact'
    ? 'text-[10px] px-1.5 py-0'
    : 'text-xs px-2 py-0.5';

  return (
    <div className="flex gap-1 flex-wrap">
      {etiquetas.map(tag => {
        const config = getEtiquetaConfig(tag);
        if (!config) return null;
        return (
          <Badge
            key={tag}
            variant="outline"
            className={cn(sizeClasses, config.color)}
          >
            {config.label}
          </Badge>
        );
      })}
    </div>
  );
}

/** Editable popover with toggle checkboxes */
export function EtiquetasEdit({
  etiquetas,
  processoId,
  size = 'normal',
  triggerVariant = 'icon',
}: {
  etiquetas: string[];
  processoId: string;
  size?: 'compact' | 'normal';
  triggerVariant?: 'icon' | 'badges';
}) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (novas: string[]) => {
      const { error } = await supabase
        .from('processos')
        .update({ etiquetas: novas } as any)
        .eq('id', processoId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['processos_db'] });
      qc.invalidateQueries({ queryKey: ['financeiro_clientes'] });
      qc.invalidateQueries({ queryKey: ['processos'] });
    },
    onError: (e: Error) => toast.error('Erro ao salvar etiquetas: ' + e.message),
  });

  const toggle = (value: EtiquetaProcesso) => {
    const current = etiquetas || [];
    const novas = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    mutation.mutate(novas);
  };

  const sizeClasses = size === 'compact'
    ? 'text-[10px] px-1.5 py-0'
    : 'text-xs px-2 py-0.5';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {triggerVariant === 'badges' && etiquetas.length > 0 ? (
          <button className="flex gap-1 flex-wrap items-center cursor-pointer">
            {etiquetas.map(tag => {
              const config = getEtiquetaConfig(tag);
              if (!config) return null;
              return (
                <Badge
                  key={tag}
                  variant="outline"
                  className={cn(sizeClasses, config.color, 'cursor-pointer hover:opacity-80')}
                >
                  {config.label}
                </Badge>
              );
            })}
          </button>
        ) : (
          <button
            className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            title="Editar etiquetas"
          >
            <Tags className="h-3.5 w-3.5" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start">
        <p className="text-xs font-semibold text-muted-foreground mb-2">Etiquetas</p>
        <div className="space-y-2">
          {ETIQUETAS_PROCESSO.map(etiq => {
            const checked = (etiquetas || []).includes(etiq.value);
            return (
              <label
                key={etiq.value}
                className="flex items-center gap-2 cursor-pointer rounded-md p-1.5 hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggle(etiq.value as EtiquetaProcesso)}
                />
                <Badge variant="outline" className={cn('text-xs px-2 py-0.5', etiq.color)}>
                  {etiq.label}
                </Badge>
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Inline checkboxes for forms (e.g. Cadastro Rápido) */
export function EtiquetasCheckboxes({
  etiquetas,
  onChange,
}: {
  etiquetas: string[];
  onChange: (novas: string[]) => void;
}) {
  const toggle = (value: string) => {
    const novas = etiquetas.includes(value)
      ? etiquetas.filter(v => v !== value)
      : [...etiquetas, value];
    onChange(novas);
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Etiquetas</p>
      <div className="flex flex-wrap gap-2">
        {ETIQUETAS_PROCESSO.map(etiq => {
          const checked = etiquetas.includes(etiq.value);
          return (
            <label
              key={etiq.value}
              className="flex items-center gap-1.5 cursor-pointer"
            >
              <Checkbox
                checked={checked}
                onCheckedChange={() => toggle(etiq.value)}
              />
              <Badge variant="outline" className={cn('text-xs px-2 py-0.5', etiq.color)}>
                {etiq.label}
              </Badge>
            </label>
          );
        })}
      </div>
    </div>
  );
}
