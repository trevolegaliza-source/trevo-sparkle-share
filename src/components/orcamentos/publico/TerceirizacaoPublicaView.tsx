/**
 * Layout público da Proposta de Terceirização — MVP Fase 1.
 *
 * Visual fiel à proposta PDF do app.web atual (3 páginas):
 *   1. Capa (header + nome contratante + modalidade + hero)
 *   2. Escopo (serviços + naturezas + checklist do que tá incluído)
 *   3. Condições financeiras + operacionais
 *
 * Cliente decide: Aceito / Recusar. Aceite muda status pra 'aceito'
 * (na Fase 2+3 vira disparador de PDF + ClickSign).
 */
import { useMemo, useState } from 'react';
import { Loader2, Check, X, ShieldCheck } from 'lucide-react';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/client';
import {
  type ServicoSocietario, type NaturezaJuridica, type ItemIncluso, type Modalidade,
  SERVICO_LABELS, NATUREZA_LABELS, ITEM_INCLUSO_META, PLANOS,
  fmtBRL,
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
  terc_servicos: ServicoSocietario[];
  terc_naturezas: NaturezaJuridica[];
  terc_inclusos: ItemIncluso[];
  terc_valor_base: number;
  terc_valor_pro: number;
  terc_valor_enterprise: number;
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
    d.setDate(d.getDate() + orc.validade_dias);
    return d;
  }, [orc.created_at, orc.validade_dias]);

  const todosServicos = Object.keys(SERVICO_LABELS) as ServicoSocietario[];
  const todasNaturezas = Object.keys(NATUREZA_LABELS) as NaturezaJuridica[];
  const todosInclusos = Object.keys(ITEM_INCLUSO_META) as ItemIncluso[];

  const valorPrincipal = orc.terc_modalidade === 'pro_5'
    ? orc.terc_valor_pro * 5
    : orc.terc_modalidade === 'enterprise_10'
      ? orc.terc_valor_enterprise * 10
      : orc.terc_valor_base;

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
    } catch (err: any) {
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
            para os próximos passos (assinatura do contrato + onboarding).
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
      {/* ────────── PÁGINA 1 — CAPA ────────── */}
      <section className="bg-emerald-950 text-white">
        <div className="max-w-3xl mx-auto px-6 py-4 border-b border-emerald-800/50 flex items-center justify-between text-xs">
          <div>
            <p className="font-semibold">TREVO ASSESSORIA SOCIETÁRIA LTDA</p>
            <p className="text-emerald-200/80">CNPJ 39.969.412/0001-70 • Atuação Nacional</p>
          </div>
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
            <h2 className="text-2xl font-light">Seu escritório contábil cresceu.</h2>
            <h2 className="text-2xl font-light text-emerald-300">Sua estrutura societária ainda te acompanha?</h2>
            <p className="text-sm text-emerald-100/80 mt-4 max-w-xl leading-relaxed">
              Somos o departamento jurídico-societário que escritórios de alto volume precisam —
              com SLA formalizado, rastreabilidade integral e operação 100% B2B. Processos simples
              ou extremamente complexos, do início ao deferimento.
            </p>
          </div>
        </div>
        <div className="bg-emerald-900/60 border-t border-emerald-800/40">
          <div className="max-w-3xl mx-auto px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <Stat title="12 Anos" sub="de expertise societária" />
            <Stat title="26 Estados" sub="de atuação ativa" />
            <Stat title="Reconhecida Nacionalmente" sub="parcerias com Juntas Comerciais" />
            <Stat title="Exclusivo B2B" sub="só atendemos contabilidades" />
          </div>
        </div>
        <div className="bg-emerald-900/30 border-t border-emerald-800/40">
          <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between text-[11px] text-emerald-200">
            <span>Reconhecida nacionalmente • 12 anos de mercado</span>
            <span className="font-bold">⚠️ EXPIRA EM {expiracao.toLocaleDateString('pt-BR')}</span>
            <span className="font-mono">PROP-{String(orc.numero).padStart(4, '0')}</span>
          </div>
        </div>
      </section>

      {/* ────────── PÁGINA 2 — ANEXO I (Escopo) + Honorários ────────── */}
      <section className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <div>
          <h3 className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-4 pb-2 border-b">
            ANEXO I — ESCOPO DE SERVIÇOS
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-[11px] uppercase font-semibold text-slate-500 mb-2">Serviços Societários</p>
              <div className="flex flex-wrap gap-1.5">
                {todosServicos.map((s) => {
                  const ativo = orc.terc_servicos?.includes(s);
                  return (
                    <span
                      key={s}
                      className={
                        ativo
                          ? 'px-2.5 py-1 rounded bg-slate-900 text-white text-xs font-semibold'
                          : 'px-2.5 py-1 rounded bg-slate-100 text-slate-400 line-through text-xs'
                      }
                    >
                      {SERVICO_LABELS[s]}
                    </span>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-[11px] uppercase font-semibold text-slate-500 mb-2">Natureza Jurídica</p>
              <div className="flex flex-wrap gap-1.5">
                {todasNaturezas.map((n) => {
                  const ativo = orc.terc_naturezas?.includes(n);
                  return (
                    <span
                      key={n}
                      className={
                        ativo
                          ? 'px-2.5 py-1 rounded bg-emerald-600 text-white text-xs font-semibold'
                          : 'px-2.5 py-1 rounded bg-slate-100 text-slate-400 line-through text-xs'
                      }
                    >
                      {NATUREZA_LABELS[n]}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div>
          <p className="text-[11px] uppercase font-semibold text-slate-500 mb-3">O que está incluído no processo</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {todosInclusos.map((it) => {
              const meta = ITEM_INCLUSO_META[it];
              const ativo = orc.terc_inclusos?.includes(it);
              return (
                <div
                  key={it}
                  className={
                    ativo
                      ? 'border-l-2 border-emerald-500 px-3 py-2 bg-emerald-50/50'
                      : 'border-l-2 border-slate-200 px-3 py-2 bg-slate-50/50 opacity-60'
                  }
                >
                  <div className="flex items-baseline gap-2">
                    <span className={ativo ? 'text-emerald-600 text-xs' : 'text-slate-400 text-xs'}>
                      {ativo ? '✓' : '✗'}
                    </span>
                    <span className={ativo ? 'text-sm font-medium text-slate-900' : 'text-sm text-slate-400 line-through'}>
                      {meta.label}
                    </span>
                  </div>
                  <p className={`text-[11px] mt-0.5 ml-5 ${ativo ? 'text-slate-600' : 'text-slate-400'}`}>
                    {meta.descricao}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-4 pb-2 border-b">
            ANEXO II — CONDIÇÕES FINANCEIRAS
          </h3>
          <div className="bg-emerald-900 text-white rounded-lg p-6 mb-4">
            <p className="text-[11px] uppercase tracking-wider text-emerald-200 font-semibold">Honorários — {modalidadeCfg.label}</p>
            <p className="text-5xl font-bold mt-2 tabular-nums">
              {fmtBRL(valorPrincipal)}
              {orc.terc_modalidade !== 'avulso' && <span className="text-base font-normal text-emerald-200">/mês</span>}
            </p>
            <p className="text-xs text-emerald-200/80 mt-2">
              {orc.terc_modalidade === 'avulso'
                ? 'Valor fixo por processo / operação societária'
                : `${orc.terc_modalidade === 'pro_5' ? '5' : '10'} processos inclusos por mês`}
            </p>
          </div>

          <p className="text-[11px] uppercase font-semibold text-slate-500 mb-2">Tabela comparativa</p>
          <div className="space-y-1.5">
            <PlanoLinha
              label="AVULSO"
              processos="—"
              desconto="—"
              unitario={fmtBRL(orc.terc_valor_base)}
              total="—"
              destacado={orc.terc_modalidade === 'avulso'}
            />
            <PlanoLinha
              label="PLANO PRO"
              processos="5/mês"
              desconto="-15%"
              unitario={fmtBRL(orc.terc_valor_pro)}
              total={fmtBRL(orc.terc_valor_pro * 5) + '/mês'}
              destacado={orc.terc_modalidade === 'pro_5'}
            />
            <PlanoLinha
              label="PLANO ENTERPRISE"
              processos="10/mês"
              desconto="-20%"
              unitario={fmtBRL(orc.terc_valor_enterprise)}
              total={fmtBRL(orc.terc_valor_enterprise * 10) + '/mês'}
              destacado={orc.terc_modalidade === 'enterprise_10'}
            />
          </div>
        </div>

        <div>
          <h3 className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-3 pb-2 border-b">CONDIÇÕES OPERACIONAIS</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <CondicaoBox titulo="Pagamento" texto="Cobrança via boleto bancário em até 3 dias da data da solicitação. Pagamento à vista." />
            <CondicaoBox titulo="SLA & Prazos" texto="Prazo de início: até 5 dias úteis após recebimento COMPLETO da documentação. SLA de atendimento: 48 horas úteis." />
            <CondicaoBox titulo="Validade" texto={`Válida por ${orc.validade_dias} dias a partir da data de emissão.`} />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-md p-4 space-y-1.5 text-xs text-slate-700">
            <p>• <strong>MAT:</strong> Responsabilidade técnica do Módulo de Administração Tributária permanece sob encargo EXCLUSIVO da Contabilidade.</p>
            <p>• <strong>Transferência de UF:</strong> Cobrada como 2 processos avulsos.</p>
            <p>• <strong>Alvarás extras:</strong> Processos que exijam Alvarás não inclusos terão cobrança adicional de R$ 400,00 por processo + taxas + responsável técnico.</p>
            <p>• <strong>Urgência (FAST TRACK):</strong> Solicitações com prazo &lt; 24h terão acréscimo de 50% sobre o valor + taxa de registro.</p>
            <p>• <strong>Retrabalho:</strong> Exigências decorrentes de dados incorretos fornecidos pela CONTRATANTE serão cobradas 50% a mais do valor do processo avulso.</p>
            <p>• <strong>Inadimplência:</strong> Atrasos superiores a 5 dias resultarão em suspensão imediata do acesso à plataforma e protocolização de novos processos.</p>
            <p>• <strong>LGPD:</strong> A CONTRATANTE autoriza a CONTRATADA a tratar dados pessoais exclusivamente para execução deste contrato, conforme Lei 13.709/2018.</p>
          </div>
        </div>

        <div className="bg-emerald-900 text-white rounded-lg p-5">
          <p className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold mb-2">VINCULAÇÃO CONTRATUAL</p>
          <p className="text-sm text-emerald-100 leading-relaxed">
            A presente Proposta Comercial é parte integrante do relacionamento jurídico entre{' '}
            <strong className="text-white">{orc.prospect_nome}</strong> e{' '}
            <strong className="text-white">TREVO Assessoria Societária LTDA</strong>, incorporando por referência
            o Contrato Mestre de Prestação de Serviços (Master Service Agreement) celebrado entre as partes.
            O aceite desta proposta, formal ou por execução, implica concordância integral com os termos e
            condições nela estabelecidos.
          </p>
          <p className="text-xs text-emerald-300 mt-3 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            DOCUMENTO VINCULANTE
          </p>
        </div>

        {/* ────────── BOTÕES DE AÇÃO ────────── */}
        <div className="sticky bottom-4 z-10 mt-12">
          <div className="bg-white border-2 border-emerald-200 rounded-xl shadow-xl p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Pronto para começar?</p>
              <p className="text-xs text-muted-foreground">Após aceitar, a Trevo entrará em contato pelo WhatsApp para os próximos passos.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAceitar}
                disabled={aceitando}
                className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {aceitando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Aceitar proposta
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <p className="text-sm font-bold text-emerald-300">{title}</p>
      <p className="text-[10px] text-emerald-200/80 leading-tight mt-0.5">{sub}</p>
    </div>
  );
}

function PlanoLinha({
  label, processos, desconto, unitario, total, destacado,
}: { label: string; processos: string; desconto: string; unitario: string; total: string; destacado: boolean }) {
  return (
    <div
      className={
        destacado
          ? 'grid grid-cols-5 gap-2 px-3 py-3 rounded bg-emerald-50 border-2 border-emerald-500 text-xs items-center'
          : 'grid grid-cols-5 gap-2 px-3 py-2 rounded bg-white border border-slate-200 text-xs items-center'
      }
    >
      <span className="font-bold">{label}</span>
      <span className="text-center text-slate-600">{processos}</span>
      <span className="text-center text-emerald-600 font-semibold">{desconto}</span>
      <span className="text-right font-semibold tabular-nums">{unitario}</span>
      <span className="text-right font-bold tabular-nums">{total}</span>
    </div>
  );
}

function CondicaoBox({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="border-l-2 border-emerald-500 px-3 py-2 bg-emerald-50/30">
      <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-700">{titulo}</p>
      <p className="text-xs text-slate-700 mt-1 leading-relaxed">{texto}</p>
    </div>
  );
}
