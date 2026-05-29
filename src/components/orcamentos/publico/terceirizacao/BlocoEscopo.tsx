/**
 * Bloco Escopo Customizado (Anexo I).
 * Serviços + Naturezas (2 colunas com chips) + "O que está incluso" (institucional
 * fixo + itens do banco, filtrando duplicatas "plataforma trevo" e "dani.ai" —
 * COM-08 27/05 noite).
 *
 * Extraído do arquivo monolítico em 29/05 — só movimentação.
 */
import { Check, X } from 'lucide-react';
import type { ItemEditavel } from '@/lib/terceirizacao-engine';
import { CardEscopo } from './atoms';

export function BlocoEscopo({
  servicos,
  naturezas,
  inclusos,
}: {
  servicos: ItemEditavel[];
  naturezas: ItemEditavel[];
  inclusos: ItemEditavel[];
}) {
  return (
    <section id="proposta-detalhes" className="py-20 bg-slate-50">
      <div className="max-w-5xl mx-auto px-6">
        <div className="max-w-2xl mb-12">
          <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700 font-bold mb-2">Anexo I — Escopo</p>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">
            O que vamos executar para você
          </h2>
          <p className="text-slate-600 mt-4 leading-relaxed">
            Escopo definido em conjunto na nossa reunião. Itens marcados são
            entregues dentro do contrato. Itens riscados são fora de escopo —
            se precisar, orçamos à parte.
          </p>
        </div>

        {/* Serviços + Naturezas em 2 colunas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <CardEscopo titulo="Serviços Societários" itens={servicos} corChip="bg-slate-900 text-white border-slate-900" labelInativos="Fora de escopo" />
          <CardEscopo titulo="Natureza Jurídica Atendida" itens={naturezas} corChip="bg-emerald-600 text-white border-emerald-600" labelInativos="Demais naturezas geram orçamento condicional" />
        </div>

        {/* O que está incluso */}
        <div className="bg-white rounded-2xl border p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700 font-bold">O que está incluso</p>
              <h3 className="text-xl font-bold text-slate-900 mt-1">Cada processo entregue inclui</h3>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Itens institucionais sempre presentes (não vêm do banco) */}
            <div className="flex items-start gap-3 p-3 rounded-lg border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-emerald-100/40 md:col-span-2">
              <div className="shrink-0 h-5 w-5 rounded-full bg-emerald-600 inline-flex items-center justify-center">
                <Check className="h-3 w-3 text-white" strokeWidth={4} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900">Plataforma Trevo Engine + Aplicativo Mobile</p>
                <p className="text-[11px] mt-0.5 leading-relaxed text-slate-600">
                  Acesso completo à plataforma proprietária via web e app mobile (iOS/Android). Cartão dedicado por processo com timeline, documentos, notificações push e comunicação centralizada.
                </p>
              </div>
            </div>
            {/* COM-08 (27/05 noite): item dani.ai removido daqui — já aparece como
                card destaque no bloco diferenciais (CardDaniAi) + step 04 "Como
                funciona". Tripla menção virava ruído. */}

            {inclusos
              .filter((it) => !/plataforma\s+trevo/i.test(it.label) && !/dani\.?ai/i.test(it.label))
              .map((it) => (
              <div
                key={it.id}
                className={
                  it.ativo
                    ? 'flex items-start gap-3 p-3 rounded-lg border border-emerald-200 bg-emerald-50/30'
                    : 'flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50/30 opacity-50'
                }
              >
                <div className={
                  it.ativo
                    ? 'shrink-0 h-5 w-5 rounded-full bg-emerald-600 inline-flex items-center justify-center'
                    : 'shrink-0 h-5 w-5 rounded-full bg-slate-300 inline-flex items-center justify-center'
                }>
                  {it.ativo
                    ? <Check className="h-3 w-3 text-white" strokeWidth={4} />
                    : <X className="h-3 w-3 text-white" strokeWidth={4} />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${it.ativo ? 'text-slate-900' : 'text-slate-400 line-through'}`}>
                    {it.label}
                  </p>
                  {it.descricao && (
                    <p className={`text-[11px] mt-0.5 leading-relaxed ${it.ativo ? 'text-slate-600' : 'text-slate-400'}`}>
                      {it.descricao}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
