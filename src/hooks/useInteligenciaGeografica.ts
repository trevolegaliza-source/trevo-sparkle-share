import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ContatoEstado {
  id: string;
  uf: string;
  tipo: string;
  nome: string;
  municipio: string | null;
  site_url: string | null;
  telefone: string | null;
  email: string | null;
  contato_interno: string | null;
  endereco: string | null;
  observacoes: string | null;
  rating: number | null;
  pin_cor: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface EstadoResumo {
  uf: string;
  qtdClientes: number;
  qtdProcessos: number;
  receita: number;
}

export function useEstadosResumo() {
  return useQuery({
    queryKey: ['estados_resumo'],
    queryFn: async () => {
      const [{ data: clientes }, { data: lancamentos }] = await Promise.all([
        supabase.from('clientes').select('id, estado').eq('is_archived', false).not('estado', 'is', null),
        supabase.from('lancamentos').select('id, cliente_id, valor').eq('tipo', 'receber'),
      ]);

      const { data: processos } = await supabase
        .from('processos')
        .select('id, cliente_id')
        .neq('is_archived', true);

      const clienteEstado: Record<string, string> = {};
      const estadoData: Record<string, EstadoResumo> = {};

      clientes?.forEach((c: any) => {
        if (!c.estado) return;
        clienteEstado[c.id] = c.estado;
        if (!estadoData[c.estado]) {
          estadoData[c.estado] = { uf: c.estado, qtdClientes: 0, qtdProcessos: 0, receita: 0 };
        }
        estadoData[c.estado].qtdClientes++;
      });

      processos?.forEach((p: any) => {
        const uf = clienteEstado[p.cliente_id];
        if (uf && estadoData[uf]) estadoData[uf].qtdProcessos++;
      });

      lancamentos?.forEach((l: any) => {
        const uf = clienteEstado[l.cliente_id];
        if (uf && estadoData[uf]) estadoData[uf].receita += Number(l.valor) || 0;
      });

      return estadoData;
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useEstadoDetalhe(uf: string) {
  return useQuery({
    queryKey: ['estado_detalhe', uf],
    queryFn: async () => {
      const [contatosRes, notasRes, clientesRes] = await Promise.all([
        supabase.from('contatos_estado' as any).select('*').eq('uf', uf).order('tipo').order('nome'),
        supabase.from('notas_estado' as any).select('*').eq('uf', uf).limit(1).single(),
        supabase.from('clientes').select('id, nome, apelido, cnpj, estado').eq('estado', uf).eq('is_archived', false),
      ]);

      const contatos = (contatosRes.data || []) as unknown as ContatoEstado[];
      const notaRow = notasRes.data as any;
      const clientes = clientesRes.data || [];

      const clienteIds = clientes.map((c: any) => c.id);
      let processosCliente: any[] = [];
      let lancamentosCliente: any[] = [];

      if (clienteIds.length > 0) {
        const [{ data: procs }, { data: lancs }] = await Promise.all([
          supabase.from('processos').select('id, cliente_id, tipo, etapa, valor, razao_social').in('cliente_id', clienteIds).neq('is_archived', true),
          supabase.from('lancamentos').select('id, cliente_id, valor, status, confirmado_recebimento').eq('tipo', 'receber').in('cliente_id', clienteIds),
        ]);
        processosCliente = procs || [];
        lancamentosCliente = lancs || [];
      }

      return {
        contatos,
        nota: notaRow?.conteudo || '',
        notaId: notaRow?.id || null,
        clientes: clientes.map((c: any) => {
          const procs = processosCliente.filter(p => p.cliente_id === c.id);
          const lancs = lancamentosCliente.filter(l => l.cliente_id === c.id);
          const receita = lancs.reduce((s: number, l: any) => s + Number(l.valor), 0);
          const pago = lancs.filter((l: any) => l.status === 'pago' && l.confirmado_recebimento).reduce((s: number, l: any) => s + Number(l.valor), 0);
          return { ...c, processos: procs.length, receita, pago };
        }),
      };
    },
    enabled: !!uf,
  });
}

export function useSalvarContato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (contato: Partial<ContatoEstado> & { uf: string; nome: string; tipo: string }) => {
      if (contato.id) {
        const { error } = await (supabase.from('contatos_estado' as any) as any).update({
          ...contato, updated_at: new Date().toISOString(),
        }).eq('id', contato.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from('contatos_estado' as any) as any).insert(contato);
        if (error) throw error;
      }
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['estado_detalhe', v.uf] });
      toast.success('Contato salvo!');
    },
    onError: () => toast.error('Erro ao salvar contato'),
  });
}

export function useRemoverContato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, uf }: { id: string; uf: string }) => {
      const { error } = await (supabase.from('contatos_estado' as any) as any).delete().eq('id', id);
      if (error) throw error;
      return uf;
    },
    onSuccess: (uf) => {
      qc.invalidateQueries({ queryKey: ['estado_detalhe', uf] });
      toast.success('Contato removido');
    },
  });
}

export function useSalvarNotaEstado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ uf, conteudo, notaId }: { uf: string; conteudo: string; notaId: string | null }) => {
      if (notaId) {
        await (supabase.from('notas_estado' as any) as any).update({ conteudo, updated_at: new Date().toISOString() }).eq('id', notaId);
      } else {
        await (supabase.from('notas_estado' as any) as any).insert({ uf, conteudo });
      }
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['estado_detalhe', v.uf] });
    },
  });
}

export function useMunicipiosIBGE(uf: string) {
  return useQuery({
    queryKey: ['municipios_ibge', uf],
    queryFn: async () => {
      const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`);
      const data = await res.json();
      return (data as any[]).map(m => ({ id: m.id as number, nome: m.nome as string }));
    },
    enabled: !!uf,
    staleTime: Infinity,
  });
}
