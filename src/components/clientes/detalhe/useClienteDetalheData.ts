import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { STORAGE_BUCKETS } from '@/constants/storage';
import { getEmpresaId } from '@/lib/storage-path';
import type { ClienteDB, ProcessoDB, Lancamento } from '@/types/financial';

/**
 * Carrega cliente + processos + lançamentos + contratos. UX-010 (11/05/2026):
 * param `silent` pra refresh não disparar Skeleton. Carregamento inicial
 * (vindo do useEffect) chama sem silent → loading=true → mostra skeleton.
 * Refresh pós-mutação chama silent=true → não mostra skeleton → árvore não
 * remonta → aba/scroll/seleção preservados.
 */
export function useClienteDetalheData(id: string | undefined) {
  const [cliente, setCliente] = useState<ClienteDB | null>(null);
  const [processos, setProcessos] = useState<ProcessoDB[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [contracts, setContracts] = useState<{ name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editForm, setEditForm] = useState<Partial<ClienteDB>>({});

  const loadContracts = async (clienteId: string) => {
    const empresaId = await getEmpresaId();
    const { data } = await supabase.storage.from(STORAGE_BUCKETS.CONTRACTS).list(`${empresaId}/${clienteId}`);
    setContracts((data || []).map(f => ({ name: f.name })));
  };

  const loadAll = async (clienteId: string, { silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true);
    const [cRes, pRes, lRes] = await Promise.all([
      supabase.from('clientes').select('*').eq('id', clienteId).maybeSingle(),
      supabase.from('processos').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }),
      supabase.from('lancamentos').select('*').eq('cliente_id', clienteId).order('data_vencimento', { ascending: false }),
    ]);
    if (cRes.data) { setCliente(cRes.data as ClienteDB); setEditForm(cRes.data as ClienteDB); }
    setProcessos((pRes.data || []) as ProcessoDB[]);
    setLancamentos((lRes.data || []) as Lancamento[]);
    loadContracts(clienteId);
    setLoading(false);
  };

  useEffect(() => {
    if (!id) return;
    loadAll(id);
  }, [id]);

  // Helper: check if a processo has been fully paid (must be before early returns)
  const paidProcessIds = useMemo(() => {
    const set = new Set<string>();
    lancamentos.forEach(l => {
      if (l.tipo === 'receber' && l.status === 'pago' && l.confirmado_recebimento && l.processo_id) {
        set.add(l.processo_id);
      }
    });
    return set;
  }, [lancamentos]);

  const isProcessoPago = (processoId: string) => paidProcessIds.has(processoId);

  // Sort: pending first, paid last
  const processosOrdenados = useMemo(() => {
    return [...processos].sort((a, b) => {
      const aPago = paidProcessIds.has(a.id);
      const bPago = paidProcessIds.has(b.id);
      if (aPago && !bPago) return 1;
      if (!aPago && bPago) return -1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [processos, paidProcessIds]);

  const processosPagosCount = processos.filter(p => paidProcessIds.has(p.id)).length;
  const processosPendentesCount = processos.length - processosPagosCount;

  return {
    cliente,
    setCliente,
    processos,
    setProcessos,
    lancamentos,
    setLancamentos,
    contracts,
    setContracts,
    loading,
    editForm,
    setEditForm,
    loadAll,
    loadContracts,
    paidProcessIds,
    isProcessoPago,
    processosOrdenados,
    processosPagosCount,
    processosPendentesCount,
  };
}
