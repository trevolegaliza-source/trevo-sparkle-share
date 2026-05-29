/**
 * Bloco Cláusulas + Observações específicas da proposta.
 * Só renderiza se houver regras ativas OU texto de observações.
 *
 * Extraído do arquivo monolítico em 29/05 — só movimentação.
 */
import { ShieldCheck } from 'lucide-react';

export function BlocoClausulasObservacoes({
  regras,
  observacoes,
}: {
  regras: { id: string; texto: string }[];
  observacoes: string | null | undefined;
}) {
  const obsTrimmed = observacoes?.trim();
  if (regras.length === 0 && !obsTrimmed) return null;

  return (
    <section className="py-16 bg-slate-50">
      <div className="max-w-5xl mx-auto px-6">
        <div className="max-w-2xl mb-10">
          <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700 font-bold mb-2">Condições operacionais</p>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 leading-tight">
            Regras claras desde o início
          </h2>
        </div>

        {regras.length > 0 && (
          <div className="bg-white rounded-2xl border p-6 md:p-8 mb-4">
            <div className="space-y-4">
              {regras.map((r) => (
                <div key={r.id} className="flex items-start gap-3">
                  <div className="shrink-0 h-6 w-6 rounded-full bg-emerald-100 text-emerald-700 inline-flex items-center justify-center text-[10px] font-bold">
                    <ShieldCheck className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed flex-1">{r.texto}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {obsTrimmed && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
            <p className="text-[10px] uppercase tracking-wider font-bold text-amber-700 mb-2">
              Observações específicas desta proposta
            </p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
              {obsTrimmed}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
