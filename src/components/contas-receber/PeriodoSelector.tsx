import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subDays, startOfYear, endOfYear, startOfQuarter, endOfQuarter } from 'date-fns';
import { cn } from '@/lib/utils';

export type PeriodoPreset = 'este_mes' | 'semana_atual' | 'ultimos_30' | 'este_trimestre' | 'este_ano' | 'personalizado';

interface Props {
  dataInicio: string;
  dataFim: string;
  onChange: (inicio: string, fim: string, preset: PeriodoPreset) => void;
}

function toISO(d: Date) {
  return d.toISOString().split('T')[0];
}

export default function PeriodoSelector({ dataInicio, dataFim, onChange }: Props) {
  const [preset, setPreset] = useState<PeriodoPreset>('este_mes');
  const [customDe, setCustomDe] = useState<Date | undefined>();
  const [customAte, setCustomAte] = useState<Date | undefined>();

  function handlePreset(value: PeriodoPreset) {
    setPreset(value);
    const now = new Date();
    let inicio: Date, fim: Date;
    switch (value) {
      case 'este_mes':
        inicio = startOfMonth(now); fim = endOfMonth(now); break;
      case 'semana_atual':
        inicio = startOfWeek(now, { weekStartsOn: 1 }); fim = endOfWeek(now, { weekStartsOn: 1 }); break;
      case 'ultimos_30':
        inicio = subDays(now, 30); fim = now; break;
      case 'este_trimestre':
        inicio = startOfQuarter(now); fim = endOfQuarter(now); break;
      case 'este_ano':
        inicio = startOfYear(now); fim = endOfYear(now); break;
      case 'personalizado':
        return;
      default:
        inicio = startOfMonth(now); fim = endOfMonth(now);
    }
    onChange(toISO(inicio), toISO(fim), value);
  }

  function applyCustom() {
    if (customDe && customAte) {
      onChange(toISO(customDe), toISO(customAte), 'personalizado');
    }
  }

  const presetLabels: Record<PeriodoPreset, string> = {
    este_mes: 'Este Mês',
    semana_atual: 'Semana Atual',
    ultimos_30: 'Últimos 30 dias',
    este_trimestre: 'Este Trimestre',
    este_ano: 'Este Ano',
    personalizado: 'Personalizado',
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={preset} onValueChange={(v) => handlePreset(v as PeriodoPreset)}>
        <SelectTrigger className="w-44 h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(presetLabels).map(([k, v]) => (
            <SelectItem key={k} value={k}>{v}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {preset === 'personalizado' && (
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("h-9 text-xs", !customDe && "text-muted-foreground")}>
                <CalendarIcon className="h-3.5 w-3.5 mr-1" />
                {customDe ? format(customDe, 'dd/MM/yyyy') : 'De'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={customDe} onSelect={setCustomDe} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("h-9 text-xs", !customAte && "text-muted-foreground")}>
                <CalendarIcon className="h-3.5 w-3.5 mr-1" />
                {customAte ? format(customAte, 'dd/MM/yyyy') : 'Até'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={customAte} onSelect={setCustomAte} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <Button size="sm" className="h-9" onClick={applyCustom} disabled={!customDe || !customAte}>Aplicar</Button>
        </div>
      )}

      {preset !== 'personalizado' && (
        <span className="text-xs text-muted-foreground">
          {new Date(dataInicio + 'T00:00:00').toLocaleDateString('pt-BR')} — {new Date(dataFim + 'T00:00:00').toLocaleDateString('pt-BR')}
        </span>
      )}
    </div>
  );
}
