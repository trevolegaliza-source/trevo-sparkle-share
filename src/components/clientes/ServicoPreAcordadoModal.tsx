import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ServicoRow } from './ServicosPreAcordados';

const TIPOS_SERVICO = ['Abertura', 'Alteração', 'Transformação', 'Baixa', 'Avulso', 'Orçamento'];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: ServicoRow | null;
  isPrePago: boolean;
  onSave: (row: ServicoRow) => void;
}

export default function ServicoPreAcordadoModal({ open, onOpenChange, row, isPrePago, onSave }: Props) {
  const [serviceName, setServiceName] = useState('');
  const [customName, setCustomName] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [fixedPrice, setFixedPrice] = useState('');
  const [valorPrepago, setValorPrepago] = useState('');
  const [trigger, setTrigger] = useState<'request' | 'approval'>('request');
  const [triggerDays, setTriggerDays] = useState('5');
  const [obs, setObs] = useState('');

  useEffect(() => {
    if (row) {
      const isStandard = TIPOS_SERVICO.includes(row.service_name);
      setServiceName(isStandard ? row.service_name : '__custom__');
      setCustomName(isStandard ? '' : row.service_name);
      setIsCustom(!isStandard);
      setFixedPrice(String(row.fixed_price));
      setValorPrepago(row.valor_prepago > 0 ? String(row.valor_prepago) : '');
      setTrigger(row.billing_trigger);
      setTriggerDays(String(row.trigger_days));
      setObs(row.observacoes);
    } else {
      setServiceName('');
      setCustomName('');
      setIsCustom(false);
      setFixedPrice('');
      setValorPrepago('');
      setTrigger('request');
      setTriggerDays('5');
      setObs('');
    }
  }, [row, open]);

  const handleServiceChange = (v: string) => {
    setServiceName(v);
    setIsCustom(v === '__custom__');
  };

  const handleSave = () => {
    const name = isCustom ? customName.trim() : serviceName;
    if (!name || !fixedPrice) return;
    onSave({
      key: row?.key || crypto.randomUUID(),
      service_name: name,
      fixed_price: Number(fixedPrice),
      valor_prepago: Number(valorPrepago) || 0,
      billing_trigger: trigger,
      trigger_days: Number(triggerDays) || 0,
      observacoes: obs,
      is_custom: isCustom,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{row ? 'Editar' : 'Novo'} Serviço Pré-Acordado</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do Serviço *</Label>
            <Select value={serviceName} onValueChange={handleServiceChange}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {TIPOS_SERVICO.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
                <SelectItem value="__custom__">Customizado...</SelectItem>
              </SelectContent>
            </Select>
            {isCustom && (
              <Input placeholder="Nome do serviço customizado" value={customName} onChange={e => setCustomName(e.target.value)} />
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor Normal *</Label>
              <Input type="number" step="0.01" min="0" placeholder="0,00" value={fixedPrice} onChange={e => setFixedPrice(e.target.value)} />
            </div>
            {isPrePago && (
              <div className="space-y-2">
                <Label>Valor Pré-Pago</Label>
                <Input type="number" step="0.01" min="0" placeholder="Deixe vazio se não aplica" value={valorPrepago} onChange={e => setValorPrepago(e.target.value)} />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Gatilho de Cobrança</Label>
            <RadioGroup value={trigger} onValueChange={v => setTrigger(v as any)} className="flex gap-6">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="request" id="trig-req" />
                <Label htmlFor="trig-req" className="font-normal cursor-pointer">Na solicitação</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="approval" id="trig-app" />
                <Label htmlFor="trig-app" className="font-normal cursor-pointer">No deferimento</Label>
              </div>
            </RadioGroup>
          </div>
          {trigger === 'request' && (
            <div className="space-y-2">
              <Label>Dias após solicitação</Label>
              <Input type="number" min={0} max={60} value={triggerDays} onChange={e => setTriggerDays(e.target.value)} className="w-24" />
            </div>
          )}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea placeholder="Opcional..." value={obs} onChange={e => setObs(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!(isCustom ? customName.trim() : serviceName) || !fixedPrice}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
