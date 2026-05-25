/**
 * Layout público da Proposta de Terceirização — refactor 25/05/2026.
 *
 * Decisão: refatoração visual COMPLETA é pra depois (Thales focou na tela
 * de preenchimento agora). Esta versão apenas mantém build estável + renderiza
 * o novo formato (ItemEditavel[]) sem regressão. Visual fiel à proposta PDF
 * fica pra próxima sessão.
 */
import { useMemo, useState } from 'react';
import { Loader2, Check, ShieldCheck } from 'lucide-react';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/client';
import {
  type ItemEditavel, type Modalidade,
  PLANOS, fmtBRL,
} from '@/lib/terceirizacao-engine';

const anonHeaders = {
  apikey: SUPABASE_PUBLISHABLE_KEY,
  Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
  'Content-Type': 'application/json',
};

interface OrcTerc {
  id: string;
  numero: number;
  status: string;
  prospect_nome: string;
  prospect_cnpj: string | null;
  prospect_contato: string | null;
  terc_modalidade: Modalidade;
  terc_servicos: ItemEditavel[];
  terc_naturezas: ItemEditavel[];
  terc_inclusos: ItemEditavel[];
  terc_valor_base: number;
  terc_valor_pro: number;
  terc_valor_enterprise: number;
  terc_valor_final_override?: number | null;
  terc_observacoes_publicas?: string | null;
  validade_dias: number;
  created_at: string;
}

interface Props {
  orc: OrcTerc;
  token: string;
}

export function TerceirizacaoPublicaView({ orc, token }: Props) {
  const [aceitando, setAceitando] = useState(false);
  const [statusLocal, setStatusLocal] = useState(orc.status);

  const modalidadeCfg = PLANOS[orc.terc_modalidade as keyof typeof PLANOS] ?? PLANOS.avulso;
  const expiracao = useMemo(() => {
    const d = new Date(orc.created_at);
    d.setDate(d.getDate() + (orc.validade_dias || 15));
    return d;
  }, [orc.created_at, orc.validade_dias]);

  const servicos = Array.isArray(orc.terc_servicos) ? orc.terc_servicos : [];
  const naturezas = Array.isArray(orc.terc_naturezas) ? orc.terc_naturezas : [];
  const inclusos = Array.isArray(orc.terc_inclusos) ? orc.terc_inclusos : [];

  const valorPrincipal = (() => {
    if (orc.terc_valor_final_override && orc.terc_valor_final_override > 0) return orc.terc_valor_final_override;
    if (orc.terc_modalidade === 'pro_5') return orc.terc_valor_pro * 5;
    if (orc.terc_modalidade === 'enterprise_10') return orc.terc_valor_enterprise * 10;
    return orc.terc_valor_base;
  })();

  const handleAceitar = async () => {
    if (!window.confirm('Confirma o aceite da proposta? Após aceitar, será enviada para assinatura.')) return;
    setAceitando(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/aceitar_proposta_terceirizacao`, {
        method: 'POST', headers: anonHeaders,
        body: JSON.stringify({ p_token: token }),
      });
      if (!res.ok) throw new Error(`erro ${res.status}`);
      setStatusLocal('aceito');
    } catch {
      alert('Não conseguimos registrar seu aceite agora. Tente recarregar a página.');
    } finally {
      setAceitando(false);
    }
  };

  if (statusLocal === 'aceito') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100">
            <Check className="h-8 w-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold">Proposta aceita!</h1>
          <p className="text-muted-foreground">
            A equipe Trevo recebeu seu aceite e entrará em contato pelo WhatsApp
            para os próximos passos.
          </p>
          <p className="text-xs text-muted-foreground pt-4">
            Proposta PROP-{String(orc.numero).padStart(4, '0')} · {orc.prospect_nome}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* CAPA */}
      <section className="bg-emerald-950 text-white">
        <div className="max-w-3xl mx-auto px-6 py-4 border-b border-emerald-800/50 text-xs">
          <p className="font-semibold">TREVO ASSESSORIA SOCIETÁRIA LTDA</p>
          <p className="text-emerald-200/80">CNPJ 39.969.412/0001-70 • Atuação Nacional</p>
        </div>
        <div className="max-w-3xl mx-auto px-6 py-12">
          <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-300 font-semibold mb-3">
            PROPOSTA PREPARADA EXCLUSIVAMENTE PARA
          </p>
          <h1 className="text-3xl md:text-4xl font-bold leading-tight">{orc.prospect_nome}</h1>
          {orc.prospect_cnpj && (
            <p className="text-emerald-200/80 mt-1 text-sm tabular-nums">{orc.prospect_cnpj}</p>
          )}
          <div className="mt-4">
            <span className="inline-block px-3 py-1.5 rounded bg-emerald-700 text-white text-xs font-bold tracking-wide">
              {modalidadeCfg.badge}
            </span>
          </div>
          <div className="mt-10 border-t border-emerald-800/40 pt-8">
            <h2 className="text-2xl font-light">Departamento societário terceirizado.</h2>
            <h2 className="text-2xl font-light text-emerald-300">Sem dor de cabeça pro seu escritório.</h2>
          </div>
        </div>
        <div className="bg-emerald-900/30 border-t border-emerald-800/40">
          <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between text-[11px] text-emerald-200">
            <span>12 anos de mercado • Atuação nacional</span>
            <span className="font-bold">⚠️ EXPIRA EM {expiracao.toLocaleDateString('pt-BR')}</span>
            <span className="font-mono">PROP-{String(orc.numero).padStart(4, '0')}</span>
          </div>
        </div>
      </section>

      {/* ESCOPO + VALOR */}
      <section className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <ChipsSection titulo="Serviços Societários" itens={servicos} corAtivo="bg-slate-900 text-white" />
        <ChipsSection titulo="Natureza Jurídica" itens={naturezas} corAtivo="bg-emerald-600 text-white" />

        <div>
          <p className="text-[11px] uppercase font-semibold text-slate-500 mb-3">O que está incluído no processo</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {inclusos.map((it) => (
              <div
                key={it.id}
                className={
                  it.ativo
                    ? 'border-l-2 border-emerald-500 px-3 py-2 bg-emerald-50/50'
                    : 'border-l-2 border-slate-200 px-3 py-2 bg-slate-50/50 opacity-60'
                }
              >
                <div className="flex items-baseline gap-2">
                  <span className={it.ativo ? 'text-emerald-600 text-xs' : 'text-slate-400 text-xs'}>
                    {it.ativo ? '✓' : '✗'}
                  </span>
                  <span className={it.ativo ? 'text-sm font-medium text-slate-900' : 'text-sm text-slate-400 line-through'}>
                    {it.label}
                  </span>
                </div>
                {it.descricao && (
                  <p className={`text-[11px] mt-0.5 ml-5 ${it.ativo ? 'text-slate-600' : 'text-slate-400'}`}>
                    {it.descricao}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-emerald-900 text-white rounded-lg p-6">
          <p className="text-[11px] uppercase tracking-wider text-emerald-200 font-semibold">Honorários — {modalidadeCfg.label}</p>
          <p className="text-5xl font-bold mt-2 tabular-nums">
            {fmtBRL(valorPrincipal)}
            {(orc.terc_modalidade === 'pro_5' || orc.terc_modalidade === 'enterprise_10') && (
              <span className="text-base font-normal text-emerald-200">/mês</span>
            )}
          </p>
          <p className="text-xs text-emerald-200/80 mt-2">
            {orc.terc_modalidade === 'avulso' || orc.terc_modalidade === 'custom'
              ? 'Valor fixo por processo / operação societária'
              : `${orc.terc_modalidade === 'pro_5' ? '5' : '10'} processos inclusos por mês`}
          </p>
        </div>

        {orc.terc_observacoes_publicas && (
          <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
            <p className="text-[10px] uppercase tracking-wider font-bold text-amber-700 mb-2">Observações</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{orc.terc_observacoes_publicas}</p>
          </div>
        )}

        <div className="bg-emerald-900 text-white rounded-lg p-5">
          <p className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold mb-2">VINCULAÇÃO CONTRATUAL</p>
          <p className="text-sm text-emerald-100 leading-relaxed">
            Esta Proposta é parte integrante do Contrato Mestre de Prestação de Serviços (MSA) entre as partes.
            O aceite implica concordância integral com os termos.
          </p>
          <p className="text-xs text-emerald-300 mt-3 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> DOCUMENTO VINCULANTE
          </p>
        </div>

        <div className="sticky bottom-4 z-10 mt-12">
          <div className="bg-white border-2 border-emerald-200 rounded-xl shadow-xl p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Pronto para começar?</p>
              <p className="text-xs text-muted-foreground">Após aceitar, a Trevo entrará em contato pelos próximos passos.</p>
            </div>
            <button
              onClick={handleAceitar}
              disabled={aceitando}
              className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50"
            >
              {aceitando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Aceitar proposta
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function ChipsSection({ titulo, itens, corAtivo }: { titulo: string; itens: ItemEditavel[]; corAtivo: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase font-semibold text-slate-500 mb-2">{titulo}</p>
      <div className="flex flex-wrap gap-1.5">
        {itens.map((it) => (
          <span
            key={it.id}
            className={
              it.ativo
                ? `px-2.5 py-1 rounded text-xs font-semibold ${corAtivo}`
                : 'px-2.5 py-1 rounded bg-slate-100 text-slate-400 line-through text-xs'
            }
          >
            {it.label}
          </span>
        ))}
      </div>
    </div>
  );
}
