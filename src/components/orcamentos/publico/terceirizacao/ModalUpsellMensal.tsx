/**
 * Modal Upsell Pacote Mensal (só modalidade=avulso).
 *
 * 27/05 noite: ofertado ANTES do aceite. Calcula economia de Pro_5 (5 procs/mês
 * com 15% desconto por processo). Cliente pode aceitar mensal (interesse só —
 * Letícia conduz conversão depois) ou continuar avulso.
 *
 * Extraído do arquivo monolítico em 29/05 — só movimentação.
 */
import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { SUPABASE_URL } from '@/integrations/supabase/client';
import { fmtBRL } from '@/lib/terceirizacao-engine';
import { anonHeaders } from './constants';

export function ModalUpsellMensal({
  token,
  numero,
  valorAvulso,
  valorPro,
  onClose,
  onContinuar,
}: {
  token: string;
  numero: number;
  valorAvulso: number;
  valorPro: number | null | undefined;
  onClose: () => void;
  onContinuar: (quisMensal: boolean) => void;
}) {
  const [enviando, setEnviando] = useState(false);

  // Cálculo do desconto: se valorPro não tá setado, usa 15% off do avulso
  const valorProEfetivo = valorPro && valorPro > 0
    ? valorPro
    : Math.round(valorAvulso * 0.85);
  const economiaPorProcesso = valorAvulso - valorProEfetivo;
  const valorMensal5 = valorProEfetivo * 5;
  const economiaMensal = economiaPorProcesso * 5;

  const handleQueroMensal = async () => {
    setEnviando(true);
    try {
      // Registra interesse — fire & forget OK porque o backend é idempotente
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/registrar_interesse_mensal_proposta`, {
        method: 'POST',
        headers: anonHeaders,
        body: JSON.stringify({ p_token: token }),
      });
      if (!res.ok) console.warn('[upsell] registrar_interesse falhou:', res.status);
    } catch (e) {
      console.warn('[upsell] erro:', e);
    } finally {
      setEnviando(false);
      onContinuar(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full p-7 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-amber-100 to-emerald-100 inline-flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">Oferta antes do aceite</p>
            <h3 className="text-lg font-bold text-slate-900">Pacote mensal · 15% de desconto</h3>
            <p className="text-[11px] text-slate-500">PROP-{String(numero).padStart(4, '0')}</p>
          </div>
        </div>

        <p className="text-sm text-slate-600 leading-relaxed mb-4">
          Você está aceitando como <strong>avulso</strong> (paga por processo executado).
          Se sua operação roda <strong>5+ processos por mês</strong>, vale considerar o pacote mensal:
        </p>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="rounded-xl border-2 border-slate-200 p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Avulso (atual)</p>
            <p className="text-2xl font-bold tabular-nums text-slate-700 mt-1">{fmtBRL(valorAvulso)}</p>
            <p className="text-[11px] text-slate-500 mt-1">por processo</p>
          </div>
          <div className="rounded-xl border-2 border-emerald-400 bg-gradient-to-br from-emerald-50 to-emerald-50/40 p-4 relative">
            <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-bold uppercase tracking-wider shadow">−15%</span>
            <p className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">Pacote mensal</p>
            <p className="text-2xl font-bold tabular-nums text-emerald-700 mt-1">{fmtBRL(valorProEfetivo)}</p>
            <p className="text-[11px] text-emerald-700/80 mt-1">por processo · 5 inclusos/mês</p>
          </div>
        </div>

        <div className="rounded-lg bg-emerald-50/60 border border-emerald-100 p-3 mb-5">
          <p className="text-xs text-slate-700">
            <strong className="text-emerald-700">Economia ~ {fmtBRL(economiaMensal)}/mês</strong> {' '}
            (≈ {fmtBRL(economiaMensal * 12)}/ano) com 5 processos/mês. Mensalidade: {fmtBRL(valorMensal5)}.
          </p>
        </div>

        <p className="text-[11px] text-slate-500 leading-relaxed mb-5">
          Ao marcar interesse, a Trevo entra em contato pra <strong>confirmar o pacote</strong> antes do contrato ir pra
          ClickSign. Você ainda decide. Se preferir, segue avulso e converte depois.
        </p>

        <div className="flex flex-col-reverse sm:flex-row gap-2">
          <button
            onClick={() => onContinuar(false)}
            disabled={enviando}
            className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 min-h-[44px]"
          >
            Manter avulso
          </button>
          <button
            onClick={handleQueroMensal}
            disabled={enviando}
            className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50 min-h-[44px]"
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Quero o pacote mensal
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-3 text-[11px] text-slate-400 hover:text-slate-600 underline-offset-2 hover:underline"
        >
          Voltar pra proposta
        </button>
      </div>
    </div>
  );
}
