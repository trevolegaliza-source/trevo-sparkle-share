import { useState } from 'react';
import { maskCNPJ } from '@/lib/cnpj';
import { buscarCoordenadas } from '@/lib/cep';
import type { ClienteDB } from '@/types/financial';
import type { InlineNegotiationRow } from '@/components/clientes/HonorariosInlineRepeater';
import type { UseMutationResult } from '@tanstack/react-query';
import { buildEditCadastroForm, buildHonorariosRowsFromNegotiations, buildCadastroPayload } from './cadastroHelpers';
import type { ServiceNegotiation } from '@/hooks/useServiceNegotiations';
import { toast } from 'sonner';

interface UseCadastroHandlersArgs {
  cliente: ClienteDB | null;
  negotiations: ServiceNegotiation[] | undefined;
  updateCliente: UseMutationResult<any, any, any, any>;
  upsertNegotiations: UseMutationResult<any, any, any, any>;
  reload: () => void;
}

/**
 * Handlers do dialog "Editar Cadastro": abertura (preenche form),
 * mudança de CNPJ (auto-preenche código), e save (valida CNPJ, monta
 * payload, faz upsert do cliente + negotiations + busca coords).
 */
export function useCadastroHandlers({
  cliente,
  negotiations,
  updateCliente,
  upsertNegotiations,
  reload,
}: UseCadastroHandlersArgs) {
  const [showEditCadastro, setShowEditCadastro] = useState(false);
  const [editCadastroForm, setEditCadastroForm] = useState<Record<string, any>>({});
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [editHonorariosRows, setEditHonorariosRows] = useState<InlineNegotiationRow[]>([]);
  const [savingCadastro, setSavingCadastro] = useState(false);

  const openEditCadastro = () => {
    if (!cliente) return;
    setEditCadastroForm(buildEditCadastroForm(cliente));
    setEditHonorariosRows(buildHonorariosRowsFromNegotiations(negotiations));
    setShowEditCadastro(true);
  };

  const handleCnpjEditChange = (value: string) => {
    const masked = maskCNPJ(value);
    const digits = value.replace(/\D/g, '');
    const codigo = digits.slice(0, 6);
    setEditCadastroForm(f => ({
      ...f,
      cnpj: masked,
      codigo_identificador: codigo || f.codigo_identificador,
    }));
  };

  const handleSaveCadastro = async () => {
    if (!cliente) return;
    const cnpjDigits = (editCadastroForm.cnpj || '').replace(/\D/g, '');
    if (cnpjDigits.length > 0 && cnpjDigits.length !== 14) {
      toast.error('Erro ao validar CNPJ: deve conter 14 dígitos.');
      return;
    }
    setSavingCadastro(true);
    try {
      const payload = buildCadastroPayload(cliente, editCadastroForm, cnpjDigits);
      // Fetch coordinates in background
      if (editCadastroForm.cidade && editCadastroForm.estado) {
        const coords = await buscarCoordenadas(editCadastroForm.logradouro || '', editCadastroForm.cidade, editCadastroForm.estado);
        if (coords) {
          payload.latitude = coords.lat;
          payload.longitude = coords.lng;
        }
      }
      await new Promise<void>((resolve, reject) => {
        updateCliente.mutate(payload as any, {
          onSuccess: () => resolve(),
          onError: (err: any) => reject(err),
        });
      });
      // Upsert honorários
      const validRows = editHonorariosRows.filter(r => r.service_name.trim() && r.fixed_price);
      await upsertNegotiations.mutateAsync({
        clienteId: cliente.id,
        negotiations: validRows.map(r => ({
          service_name: r.service_name.trim(),
          fixed_price: Number(r.fixed_price),
          billing_trigger: r.billing_trigger,
          trigger_days: Number(r.trigger_days) || 0,
          is_custom: true as const,
        })),
      });
      toast.success('Dados cadastrais e honorários atualizados!');
      setShowEditCadastro(false);
      reload();
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message || 'Desconhecido'));
    } finally {
      setSavingCadastro(false);
    }
  };

  return {
    showEditCadastro,
    setShowEditCadastro,
    editCadastroForm,
    setEditCadastroForm,
    buscandoCep,
    setBuscandoCep,
    editHonorariosRows,
    setEditHonorariosRows,
    savingCadastro,
    openEditCadastro,
    handleCnpjEditChange,
    handleSaveCadastro,
  };
}
