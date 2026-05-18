// ===========================================================================
// Modal de cadastro/edição de cartão.
// ===========================================================================

import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useCreateCartao, useUpdateCartao, type Cartao } from '@/hooks/useCartoes';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cartao: Cartao | null;
}

const BANDEIRAS = ['Visa', 'Mastercard', 'Elo', 'American Express', 'Hipercard', 'Outra'];

const EMPTY = {
  nome: '',
  bandeira: '',
  ultimos_4: '',
  dia_fechamento: 25,
  dia_vencimento: 1,
  limite: '' as string | number,
  observacoes: '',
  ativo: true,
};

export function CartaoFormModal({ open, onOpenChange, cartao }: Props) {
  const create = useCreateCartao();
  const update = useUpdateCartao();
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (open) {
      if (cartao) {
        setForm({
          nome: cartao.nome,
          bandeira: cartao.bandeira ?? '',
          ultimos_4: cartao.ultimos_4 ?? '',
          dia_fechamento: cartao.dia_fechamento,
          dia_vencimento: cartao.dia_vencimento,
          limite: cartao.limite ?? '',
          observacoes: cartao.observacoes ?? '',
          ativo: cartao.ativo,
        });
      } else {
        setForm(EMPTY);
      }
    }
  }, [open, cartao]);

  const handleSubmit = async () => {
    if (!form.nome.trim()) {
      toast.error('Nome do cartão é obrigatório.');
      return;
    }
    if (form.dia_fechamento < 1 || form.dia_fechamento > 31) {
      toast.error('Dia de fechamento deve estar entre 1 e 31.');
      return;
    }
    if (form.dia_vencimento < 1 || form.dia_vencimento > 31) {
      toast.error('Dia de vencimento deve estar entre 1 e 31.');
      return;
    }
    if (form.ultimos_4 && !/^\d{4}$/.test(form.ultimos_4)) {
      toast.error('"Últimos 4" deve ter exatamente 4 dígitos.');
      return;
    }
    // CART-001 (18/05): defesa contra limite negativo (HTML min=0 não bloqueia
    // se contornar via DevTools/API).
    if (form.limite !== '' && Number(form.limite) < 0) {
      toast.error('Limite deve ser zero ou positivo.');
      return;
    }

    const payload = {
      nome: form.nome.trim(),
      bandeira: form.bandeira || null,
      ultimos_4: form.ultimos_4 || null,
      dia_fechamento: form.dia_fechamento,
      dia_vencimento: form.dia_vencimento,
      limite: form.limite === '' ? null : Number(form.limite),
      observacoes: form.observacoes.trim() || null,
      ativo: form.ativo,
    };

    try {
      if (cartao) {
        await update.mutateAsync({ id: cartao.id, ...payload });
      } else {
        await create.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch {
      // toast já tratado no hook
    }
  };

  const isEdit = !!cartao;
  const saving = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar cartão' : 'Novo cartão'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              placeholder="Ex.: Cartão Trevo"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="bandeira">Bandeira</Label>
              <Select
                value={form.bandeira || undefined}
                onValueChange={(v) => setForm({ ...form, bandeira: v })}
              >
                <SelectTrigger id="bandeira">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {BANDEIRAS.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ultimos_4">Últimos 4 dígitos</Label>
              <Input
                id="ultimos_4"
                inputMode="numeric"
                maxLength={4}
                placeholder="1234"
                value={form.ultimos_4}
                onChange={(e) =>
                  setForm({ ...form, ultimos_4: e.target.value.replace(/\D/g, '').slice(0, 4) })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="fechamento">Dia de fechamento *</Label>
              <Input
                id="fechamento"
                type="number"
                min={1}
                max={31}
                value={form.dia_fechamento}
                onChange={(e) =>
                  setForm({ ...form, dia_fechamento: Math.max(1, Math.min(31, Number(e.target.value) || 1)) })
                }
              />
              <p className="text-[11px] text-muted-foreground">
                Compras feitas até esse dia entram na fatura do mês seguinte.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vencimento">Dia de vencimento *</Label>
              <Input
                id="vencimento"
                type="number"
                min={1}
                max={31}
                value={form.dia_vencimento}
                onChange={(e) =>
                  setForm({ ...form, dia_vencimento: Math.max(1, Math.min(31, Number(e.target.value) || 1)) })
                }
              />
              <p className="text-[11px] text-muted-foreground">
                Dia que a fatura precisa ser paga.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="limite">Limite (R$)</Label>
            <Input
              id="limite"
              type="number"
              step="0.01"
              min={0}
              placeholder="Opcional"
              value={form.limite}
              onChange={(e) =>
                setForm({ ...form, limite: e.target.value === '' ? '' : Number(e.target.value) })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="obs">Observações</Label>
            <Textarea
              id="obs"
              rows={2}
              placeholder="Opcional"
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
            />
          </div>

          {isEdit && (
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Cartão ativo</p>
                <p className="text-xs text-muted-foreground">
                  Desligue pra arquivar sem apagar histórico.
                </p>
              </div>
              <Switch
                checked={form.ativo}
                onCheckedChange={(v) => setForm({ ...form, ativo: v })}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Salvando…' : isEdit ? 'Salvar' : 'Cadastrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
