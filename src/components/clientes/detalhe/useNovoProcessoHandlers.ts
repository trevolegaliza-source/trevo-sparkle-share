import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ClienteDB, TipoProcesso } from '@/types/financial';
import type { UseMutationResult } from '@tanstack/react-query';
import type { ServiceNegotiation } from '@/hooks/useServiceNegotiations';
import { DEFAULT_PROCESSO_FORM } from './cadastroHelpers';
import type { ProcessoFormState } from './types';
import { toast } from 'sonner';

interface UseNovoProcessoHandlersArgs {
  cliente: ClienteDB | null;
  isMensalista: boolean;
  negotiations: ServiceNegotiation[] | undefined;
  createProcesso: UseMutationResult<any, any, any, any>;
  reload: () => void;
}

/**
 * State + handlers do dialog "Novo Processo". Encapsula: openNovoProcesso
 * (faz query pra detectar 1º processo + reset form), handleCreateProcesso
 * (monta payload com mudança UF/boas-vindas/avulso, dispara mutation).
 */
export function useNovoProcessoHandlers({
  cliente,
  isMensalista,
  negotiations,
  createProcesso,
  reload,
}: UseNovoProcessoHandlersArgs) {
  const [showNovoProcesso, setShowNovoProcesso] = useState(false);
  const [processoForm, setProcessoForm] = useState<ProcessoFormState>({ ...DEFAULT_PROCESSO_FORM });
  const [isFirstProcessNovo, setIsFirstProcessNovo] = useState(false);
  const [boasVindasPct, setBoasVindasPct] = useState('50');
  const [aplicarBoasVindas, setAplicarBoasVindas] = useState(false);

  const isManualPrice = processoForm.definir_manual;
  const isNegotiatedService = !!processoForm.negotiated_service_id;

  const handleNovoProcesso = async () => {
    if (!cliente) return;

    const { count, error } = await supabase
      .from('processos')
      .select('*', { count: 'exact', head: true })
      .eq('cliente_id', cliente.id);

    if (error) {
      toast.error('Erro ao checar primeiro processo');
      return;
    }

    const jaAplicou = (cliente as any).desconto_boas_vindas_aplicado === true;
    const ehPrimeiro = (count ?? 0) === 0;

    if (ehPrimeiro && jaAplicou) {
      console.warn('Cliente com 0 processos e flag de boas-vindas já aplicada; habilitando switch para correção de legado.');
    }

    setAplicarBoasVindas(false);
    setBoasVindasPct('50');
    setIsFirstProcessNovo(ehPrimeiro);
    setProcessoForm({ ...DEFAULT_PROCESSO_FORM });
    setShowNovoProcesso(true);
  };

  const handleCreateProcesso = async () => {
    if (!cliente || !processoForm.razao_social.trim()) {
      toast.error('Preencha a Razão Social');
      return;
    }
    const negotiatedService = negotiations?.find(n => n.id === processoForm.negotiated_service_id);
    const valorManualFinal = negotiatedService
      ? negotiatedService.fixed_price
      : (isManualPrice && processoForm.valor_manual ? Number(processoForm.valor_manual) : undefined);

    let notas = processoForm.observacoes.trim();
    if (processoForm.mudanca_uf) {
      notas = notas ? `Mudança de UF (2 Processos)\n${notas}` : 'Mudança de UF (2 Processos)';
    }
    if (isManualPrice && processoForm.motivo_manual.trim()) {
      notas = notas ? `${notas}\nMotivo valor manual: ${processoForm.motivo_manual.trim()}` : `Motivo valor manual: ${processoForm.motivo_manual.trim()}`;
    }

    const boasVindasPctToSend = (aplicarBoasVindas || processoForm.boas_vindas)
      ? Number(boasVindasPct || processoForm.boas_vindas_pct) || 50
      : undefined;

    createProcesso.mutate(
      {
        cliente_id: cliente.id,
        razao_social: processoForm.razao_social.trim(),
        tipo: (isNegotiatedService ? 'avulso' : processoForm.tipo) as TipoProcesso,
        prioridade: processoForm.prioridade,
        responsavel: processoForm.responsavel || undefined,
        valor_manual: valorManualFinal,
        notas: notas || undefined,
        mudanca_uf: processoForm.mudanca_uf,
        desconto_boas_vindas: boasVindasPctToSend,
        ja_pago: processoForm.ja_pago,
        data_entrada: processoForm.data_entrada,
        dentro_do_plano: isMensalista ? processoForm.dentro_do_plano : undefined,
        valor_avulso: !processoForm.dentro_do_plano ? processoForm.valor_avulso : 0,
        justificativa_avulso: !processoForm.dentro_do_plano ? processoForm.justificativa_avulso : undefined,
      },
      {
        onSuccess: async () => {
          // Marcação de boas-vindas agora é atômica dentro do hook
          // useCreateProcesso (via RPC tentar_aplicar_boas_vindas +
          // SELECT FOR UPDATE). Não precisa mais fazer UPDATE aqui.
          setShowNovoProcesso(false);
          setIsFirstProcessNovo(false);
          setProcessoForm({ ...DEFAULT_PROCESSO_FORM });
          setAplicarBoasVindas(false);
          reload();
        },
      }
    );
  };

  const handleCloseNovoProcesso = (open: boolean) => {
    setShowNovoProcesso(open);
    if (!open) {
      setAplicarBoasVindas(false);
      setIsFirstProcessNovo(false);
    }
  };

  return {
    showNovoProcesso,
    setShowNovoProcesso,
    processoForm,
    setProcessoForm,
    isFirstProcessNovo,
    boasVindasPct,
    setBoasVindasPct,
    aplicarBoasVindas,
    setAplicarBoasVindas,
    isManualPrice,
    isNegotiatedService,
    handleNovoProcesso,
    handleCreateProcesso,
    handleCloseNovoProcesso,
  };
}
