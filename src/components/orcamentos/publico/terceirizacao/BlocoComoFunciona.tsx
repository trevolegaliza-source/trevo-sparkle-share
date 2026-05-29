/**
 * Bloco "Como funciona" — 4 cards numerados (01/02/03 padrão + 04 destaque dani.ai).
 *
 * Extraído do arquivo monolítico em 29/05 — só movimentação.
 */
import logoDaniDark from '@/assets/dani-dark.png';
import { ComoFunciona } from './atoms';

export function BlocoComoFunciona() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-5xl mx-auto px-6">
        <div className="max-w-2xl mb-12">
          <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700 font-bold mb-2">Operação</p>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">
            Você vê tudo. Em tempo real.
          </h2>
          <p className="text-slate-600 mt-4 leading-relaxed">
            Sem ligação pra saber onde está o processo. Sem &ldquo;deixa eu checar
            com o pessoal&rdquo;. Você abre o aplicativo e vê.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <ComoFunciona
            numero="01"
            titulo="Plataforma própria"
            texto="Acesso à plataforma Trevo via app ou web. Cada processo tem cartão dedicado com timeline, documentos anexados e comunicação centralizada."
          />
          <ComoFunciona
            numero="02"
            titulo="Esteira de especialistas"
            texto="Equipes dedicadas por etapa: viabilidade, DBE, contrato, junta comercial, inscrições. Cada processo passa pelo especialista certo da etapa certa."
          />
          <ComoFunciona
            numero="03"
            titulo="SLA formalizado"
            texto="Tempo de início garantido após documentação completa. Comunicação proativa em exigências. Acompanhamento até o deferimento final."
          />
          <div className="relative p-6 rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white hover:border-emerald-400 transition-colors">
            <p className="text-5xl font-bold text-emerald-200 leading-none mb-4">04</p>
            <div className="flex items-center gap-2 mb-2">
              <img src={logoDaniDark} alt="dani.ai" loading="lazy" decoding="async" className="h-4 object-contain" />
              <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-bold uppercase tracking-wider">24/7</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Monitoramento por IA</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Nossa IA própria varre Juntas, Receita, Prefeituras e órgãos competentes em tempo real e <strong className="text-slate-900">avisa o contador</strong> a cada movimentação — sem espera, sem ligação.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
