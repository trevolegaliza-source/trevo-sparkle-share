import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, UserPlus, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ClienteDB } from '@/types/financial';
import NovoClienteInline from './NovoClienteInline';

interface StepClienteProps {
  clientes: ClienteDB[];
  clienteId: string | null;
  onSelectCliente: (id: string) => void;
  onNext: () => void;
  onClienteCreated: (id: string) => void;
}

export default function StepCliente({ clientes, clienteId, onSelectCliente, onNext, onClienteCreated }: StepClienteProps) {
  const [open, setOpen] = useState(false);
  const [showNovoCliente, setShowNovoCliente] = useState(false);
  const selected = clientes.find(c => c.id === clienteId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Selecionar Cliente</h2>
        <p className="text-sm text-muted-foreground">Escolha o cliente para o novo processo</p>
      </div>

      <div className="space-y-2">
        <Label>Cliente *</Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-11">
              {selected
                ? `${selected.apelido || selected.nome} ${selected.cnpj ? `· ${selected.cnpj}` : ''}`
                : 'Buscar por nome, CNPJ ou apelido...'}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full min-w-[400px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar cliente..." />
              <CommandList>
                <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                <CommandGroup>
                  {clientes.filter(c => !c.is_archived).map(c => (
                    <CommandItem
                      key={c.id}
                      value={`${c.nome} ${c.apelido || ''} ${c.codigo_identificador} ${c.cnpj || ''}`}
                      onSelect={() => {
                        onSelectCliente(c.id);
                        setOpen(false);
                      }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", clienteId === c.id ? "opacity-100" : "opacity-0")} />
                      <div>
                        <p className="text-sm font-medium">{c.apelido || c.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.codigo_identificador} · {c.tipo === 'MENSALISTA' ? 'Mensalista' : 'Avulso'}
                          {c.cnpj ? ` · ${c.cnpj}` : ''}
                        </p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">ou</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <Button
        variant="outline"
        className="w-full gap-2"
        onClick={() => setShowNovoCliente(true)}
      >
        <UserPlus className="h-4 w-4" />
        Cadastrar Novo Cliente
      </Button>

      {showNovoCliente && (
        <NovoClienteInline
          onClose={() => setShowNovoCliente(false)}
          onCreated={(id) => {
            onClienteCreated(id);
            setShowNovoCliente(false);
          }}
        />
      )}

      <div className="flex justify-end pt-4">
        <Button onClick={onNext} disabled={!clienteId} className="gap-2">
          Próximo <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
