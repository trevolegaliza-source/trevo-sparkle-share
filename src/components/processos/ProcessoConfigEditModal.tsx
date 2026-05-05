import { useState, useEffect, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Save } from 'lucide-react';
import { PROCESS_TYPE_LABELS, type ProcessType } from '@/types/process';
import type { ProcessoDB } from '@/hooks/useProcessos';
import { invalidateFinanceiro } from '@/hooks/useFinanceiroClientes';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processo: ProcessoDB | null;
}

/**
 * Modal de edição das configurações do PROCESSO (não do lançamento).
 * Permite editar campos básicos após cadastro: razão social, tipo,
 * data de entrada (created_at), prioridade, responsável, notas.
 *
 * IMPORTANTE: alterar a data de entrada NÃO recalcula o vencimento do
 * lançamento financeiro associado — usuário ajusta vencimento na mão
 * via modal financeiro se quiser. Confirma com AlertDialog antes de salvar.
 */
export default function ProcessoConfigEditModal({ open, onOpenChange, processo }: Props) {
  const qc = useQueryClient();
  const [razaoSocial, setRazaoSocial] = useState('');
  const [tipo, setTipo] = useState<ProcessType>('abertura');
  const [dataEntrada, setDataEntrada] = useState(''); // YYYY-MM-DD
  const [prioridade, setPrioridade] = useState<'normal' | 'urgente'>('normal');
  const [responsavel, setResponsavel] = useState('');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDataChange, setConfirmDataChange] = useState(false);

  // Sync form quando troca processo
  useEffect(() => {
    if (!processo) return;
    setRazaoSocial(processo.razao_social || '');
    setTipo((processo.tipo as ProcessType) || 'abertura');
    setDataEntrada(processo.created_at?.split('T')[0] || '');
    setPrioridade((processo.prioridade as 'normal' | 'urgente') || 'normal');
    setResponsavel(processo.responsavel || '');
    setNotas(processo.notas || '');
  }, [processo?.id]);

  const dataEntradaOriginal = useMemo(
    () => processo?.created_at?.split('T')[0] || '',
    [processo?.created_at]
  );

  const dataMudou = dataEntrada !== dataEntradaOriginal;

  if (!processo) return null;

  async function handleSalvar() {
    if (dataMudou && !confirmDataChange) {
      setConfirmDataChange(true);
      return;
    }
    setSaving(true);
    try {
      // created_at é timestamp; preserva hora original mas troca a data
      const horaOriginal = processo.created_at?.split('T')[1] || '00:00:00';
      const novoCreatedAt = new Date(`${dataEntrada}T${horaOriginal.split('+')[0].split('Z')[0]}Z`).toISOString();

      const updates: Record<string, any> = {
        razao_social: razaoSocial.trim(),
        tipo,
        prioridade,
        responsavel: responsavel.trim() || null,
        notas: notas.trim() || null,
        updated_at: new Date().toISOString(),
      };
      if (dataMudou) updates.created_at = novoCreatedAt;

      const { error } = await supabase
        .from('processos')
        .update(updates as any)
        .eq('id', processo.id);
      if (error) throw error;

      qc.invalidateQueries({ queryKey: ['processos_db'] });
      qc.invalidateQueries({ queryKey: ['processos_financeiro'] });
      invalidateFinanceiro(qc);
      toast.success('Processo atualizado!');
      onOpenChange(false);
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
      setConfirmDataChange(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar Configurações do Processo</DialogTitle>
            <DialogDescription>
              Edite os dados básicos do processo. Para alterar valor ou observações financeiras, use o item "Editar" do menu.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div>
              <Label htmlFor="razao_social">Razão Social</Label>
              <Input
                id="razao_social"
                value={razaoSocial}
                onChange={(e) => setRazaoSocial(e.target.value)}
                placeholder="Ex: ACME LTDA"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="tipo">Tipo</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as ProcessType)}>
                  <SelectTrigger id="tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(PROCESS_TYPE_LABELS) as [ProcessType, string][]).map(([k, label]) => (
                      <SelectItem key={k} value={k}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="prioridade">Prioridade</Label>
                <Select value={prioridade} onValueChange={(v) => setPrioridade(v as 'normal' | 'urgente')}>
                  <SelectTrigger id="prioridade">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="data_entrada">Data de Entrada</Label>
                <Input
                  id="data_entrada"
                  type="date"
                  value={dataEntrada}
                  onChange={(e) => setDataEntrada(e.target.value)}
                />
                {dataMudou && (
                  <p className="text-[11px] text-amber-500 mt-1">
                    ⚠️ Vencimento do lançamento NÃO será recalculado automaticamente.
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="responsavel">Responsável</Label>
                <Input
                  id="responsavel"
                  value={responsavel}
                  onChange={(e) => setResponsavel(e.target.value)}
                  placeholder="Nome do responsável"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="notas">Notas</Label>
              <Textarea
                id="notas"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={3}
                placeholder="Observações internas sobre o processo"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSalvar} disabled={saving || !razaoSocial.trim()}>
              {saving ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</>
              ) : (
                <><Save className="h-4 w-4 mr-2" /> Salvar</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDataChange} onOpenChange={setConfirmDataChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterar data de entrada?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está mudando a data de entrada de <strong>{dataEntradaOriginal}</strong> para <strong>{dataEntrada}</strong>.
              <br /><br />
              O vencimento do lançamento financeiro associado <strong>NÃO</strong> será recalculado automaticamente.
              Se precisar ajustar, edite manualmente pelo menu financeiro depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSalvar}>Confirmar e salvar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
