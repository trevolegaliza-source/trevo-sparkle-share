/**
 * Bloco de depoimentos (3 cards estáticos + link pra YouTube).
 * Strings hardcoded.
 *
 * Extraído do arquivo monolítico em 29/05 — só movimentação.
 */
export function BlocoDepoimentos() {
  const depoimentos = [
    {
      texto: 'A Trevo me devolveu tempo. Hoje eu não me preocupo mais com prazo de Junta, com retrabalho, com cliente cobrando posição. Eu opero, eles entregam.',
      autor: 'Ricardo M.',
      escritorio: 'Contabilidade SP · 80 clientes ativos',
      metrica: '47 processos protocolados em 2025',
    },
    {
      texto: 'Como contador, terceirizar o societário era um medo enorme. Em 60 dias com a Trevo eu já tinha confiança de fechar contrato de 6 dígitos com cliente novo. SLA real.',
      autor: 'Camila R.',
      escritorio: 'Escritório Contábil · MG',
      metrica: 'R$ 80k em novos contratos pós-Trevo',
    },
    {
      texto: 'A dani.ai mudou meu jogo. Eu sabia da movimentação no processo antes do cliente perguntar. Imagem do meu escritório subiu vários níveis.',
      autor: 'Eduardo F.',
      escritorio: 'Contábil Premium · 120 clientes',
      metrica: 'Zero ligação de cliente buscando status em 2025',
    },
  ];

  return (
    <section className="py-20 bg-slate-50">
      <div className="max-w-5xl mx-auto px-6">
        <div className="max-w-2xl mb-10">
          <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700 font-bold mb-2">Quem já confia</p>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">
            Contadores que decidiram terceirizar com a gente.
          </h2>
          <p className="text-slate-600 mt-3 leading-relaxed">
            +3.800 escritórios contábeis na rede Trevo. <a href="https://www.youtube.com/watch?v=utDQxoqS1DE" target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:text-emerald-900 underline-offset-2 hover:underline font-semibold">Ver depoimentos em vídeo →</a>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {depoimentos.map((d, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-emerald-300 hover:shadow-md transition-all flex flex-col">
              <div className="text-emerald-600 mb-3">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6"><path d="M9.983 3v7.391c0 5.704-3.731 9.57-8.983 10.609l-.995-2.151c2.432-.917 3.995-3.638 3.995-5.849h-4v-10h9.983zm14.017 0v7.391c0 5.704-3.748 9.571-9 10.609l-.996-2.151c2.433-.917 3.996-3.638 3.996-5.849h-3.983v-10h9.983z"/></svg>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed flex-1">{d.texto}</p>
              <div className="mt-5 pt-4 border-t border-slate-100">
                <p className="text-sm font-bold text-slate-900">{d.autor}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{d.escritorio}</p>
                <p className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold mt-2">★ {d.metrica}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
