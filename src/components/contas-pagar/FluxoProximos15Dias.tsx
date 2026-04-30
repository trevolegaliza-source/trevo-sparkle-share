import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useColaboradores } from '@/hooks/useColaboradores';
import { AlertTriangle } from 'lucide-react';
import FluxoAgendaModal from './FluxoAgendaModal';
import FluxoItemDetalheModal from './FluxoItemDetalheModal';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

type Urgencia = 'atrasado' | 'urgente' | 'normal';

export interface LancItem {
  id: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  status: string;
  categoria: string | null;
  subcategoria: string | null;
  colaborador_id: string | null;
  fornecedor: string | null;
  urgencia: Urgencia;
}

export function getUrgencia(dataVenc: string): Urgencia {
  const hoje = new Date().toISOString().split('T')[0];
  const em7 = new Date(); em7.setDate(em7.getDate() + 7);
  const em7Str = em7.toISOString().split('T')[0];
  if (dataVenc <= hoje) return 'atrasado';
  if (dataVenc <= em7Str) return 'urgente';
  return 'normal';
}

const RANGE_OPTIONS = [
  { value: 15, label: '15d' },
  { value: 30, label: '30d' },
  { value: 60, label: '60d' },
  { value: 90, label: '90d' },
] as const;

const STORAGE_KEY = 'trevo_fluxo_range_dias';

function readRangeStored(): number {
  if (typeof window === 'undefined') return 15;
  const v = parseInt(window.localStorage.getItem(STORAGE_KEY) || '15', 10);
  return RANGE_OPTIONS.some(o => o.value === v) ? v : 15;
}

export default function FluxoProximos15Dias() {
  const [rangeDias, setRangeDias] = useState<number>(readRangeStored);
  const [agendaOpen, setAgendaOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<LancItem | null>(null);
  const queryClient = useQueryClient();
  const { data: colaboradores = [] } = useColaboradores();

  const { data: items = [] } = useQuery<LancItem[]>({
    queryKey: ['fluxo_agenda', rangeDias],
    queryFn: async () => {
      const hoje = new Date();
      const fim = new Date(hoje); fim.setDate(fim.getDate() + rangeDias);
      const hojeStr = hoje.toISOString().split('T')[0];
      const fimStr = fim.toISOString().split('T')[0];

      const { data: rows } = await supabase
        .from('lancamentos')
        .select('id, descricao, valor, data_vencimento, status, categoria, subcategoria, colaborador_id, fornecedor')
        .eq('tipo', 'pagar')
        .in('status', ['pendente', 'atrasado'])
        .gte('data_vencimento', hojeStr)
        .lte('data_vencimento', fimStr)
        .order('data_vencimento', { ascending: true });

      return (rows || []).map(r => ({
        ...r,
        valor: Number(r.valor),
        urgencia: getUrgencia(r.data_vencimento),
      }));
    },
    refetchInterval: 30000,
  });

  const handleRangeChange = (v: number) => {
    setRangeDias(v);
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, String(v));
  };

  const handleMarcarPago = async (id: string) => {
    const dataPagamento = new Date().toISOString().split('T')[0];
    await supabase.from('lancamentos').update({
      status: 'pago' as any,
      data_pagamento: dataPagamento,
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['fluxo_agenda'] });
    queryClient.invalidateQueries({ queryKey: ['lancamentos_pagar'] });
    queryClient.invalidateQueries({ queryKey: ['lancamentos_pagar_date'] });
    queryClient.invalidateQueries({ queryKey: ['lancamentos_pagos_historico'] });
    setSelectedItem(null);
  };

  const totalGeral = items.reduce((s, i) => s + i.valor, 0);
  const hoje = new Date();
  const em7 = new Date(hoje); em7.setDate(em7.getDate() + 7);
  const em7Str = em7.toISOString().split('T')[0];
  const criticos7 = items.filter(i => i.data_vencimento <= em7Str);
  const valorCritico = criticos7.reduce((s, i) => s + i.valor, 0);
  const hojeStr = hoje.toLocaleDateString('pt-BR');

  return (
    <>
      {/* Compact card — agora com seletor de range */}
      <div className="bg-card rounded-lg border border-border border-l-4 border-l-primary p-4 transition-colors">
        <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
          <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Fluxo · Próximos {rangeDias} dias
          </span>
          <div className="flex items-center gap-1.5">
            {/* Botões de range — clique não abre o modal */}
            <div className="flex items-center rounded-md border border-border overflow-hidden">
              {RANGE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={(e) => { e.stopPropagation(); handleRangeChange(opt.value); }}
                  className={
                    'px-2 py-0.5 text-[10px] font-semibold transition-colors ' +
                    (rangeDias === opt.value
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted')
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">hoje: {hojeStr}</span>
          </div>
        </div>

        <div
          className="cursor-pointer hover:opacity-80"
          onClick={() => setAgendaOpen(true)}
        >
          {items.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
              <span>Sem despesas pendentes nos próximos {rangeDias} dias 🎉</span>
            </div>
          ) : (
            <>
              <div className="flex items-baseline gap-4">
                <span className="text-2xl font-bold text-foreground">{fmt(totalGeral)}</span>
                <span className="text-sm text-muted-foreground">
                  {items.length} despesa{items.length !== 1 ? 's' : ''}
                </span>
              </div>

              {criticos7.length > 0 && (
                <div className="flex items-center gap-1.5 mt-2 text-sm" style={{ color: '#F59E0B' }}>
                  <AlertTriangle className="h-4 w-4" />
                  <span>
                    {criticos7.length} vence{criticos7.length !== 1 ? 'm' : ''} em até 7 dias · {fmt(valorCritico)}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Agenda modal */}
      <FluxoAgendaModal
        open={agendaOpen}
        onClose={() => setAgendaOpen(false)}
        items={items}
        colaboradores={colaboradores}
        onSelectItem={setSelectedItem}
      />

      {/* Item detail modal */}
      <FluxoItemDetalheModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onMarcarPago={handleMarcarPago}
      />
    </>
  );
}
