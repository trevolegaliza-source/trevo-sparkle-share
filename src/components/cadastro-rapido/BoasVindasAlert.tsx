import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { ArrowRight, PartyPopper } from 'lucide-react';

interface Props {
  clienteNome: string;
  aplicar: boolean;
  percentual: string;
  onAplicarChange: (aplicar: boolean) => void;
  onPercentualChange: (pct: string) => void;
  onContinue: () => void;
}

export default function BoasVindasAlert({ clienteNome, aplicar, percentual, onAplicarChange, onPercentualChange, onContinue }: Props) {
  return (
    <Card className="border-success/40 bg-success/5">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <PartyPopper className="h-5 w-5 text-success" />
          <h3 className="font-semibold text-success">Primeiro processo deste cliente!</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Este é o primeiro processo de <span className="font-medium text-foreground">{clienteNome}</span>. Deseja aplicar desconto de boas-vindas?
        </p>
        <RadioGroup value={aplicar ? 'sim' : 'nao'} onValueChange={v => onAplicarChange(v === 'sim')} className="space-y-2">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="sim" id="bv-sim" />
            <Label htmlFor="bv-sim" className="font-normal cursor-pointer">Sim, aplicar desconto</Label>
          </div>
          {aplicar && (
            <div className="ml-6 flex items-center gap-2">
              <Label className="text-xs">Percentual:</Label>
              <Input type="number" min={1} max={100} className="w-20 h-8" value={percentual} onChange={e => onPercentualChange(e.target.value)} />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <RadioGroupItem value="nao" id="bv-nao" />
            <Label htmlFor="bv-nao" className="font-normal cursor-pointer">Não, cobrar valor normal</Label>
          </div>
        </RadioGroup>
        <div className="flex justify-end">
          <Button onClick={onContinue} className="gap-2">Continuar <ArrowRight className="h-4 w-4" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}
