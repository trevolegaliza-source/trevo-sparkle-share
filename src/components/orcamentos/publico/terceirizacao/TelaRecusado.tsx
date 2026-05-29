/**
 * Tela exibida quando statusLocal === 'recusado'.
 * Early-return da TerceirizacaoPublicaView — substitui a landing inteira.
 *
 * Extraído do arquivo monolítico em 29/05 — só movimentação.
 */
import { MessageCircle, X } from 'lucide-react';

export function TelaRecusado() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md text-center space-y-5">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-200">
          <X className="h-10 w-10 text-slate-500" strokeWidth={2.5} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Recusa registrada</h1>
        <p className="text-slate-600 leading-relaxed">
          Obrigado pelo retorno. Sua resposta foi anotada e ajuda a Trevo a
          evoluir. Se mudar de ideia ou quiser revisar o escopo, fale com a
          gente pelo WhatsApp.
        </p>
        <a
          href="https://wa.me/5511934927001"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-all"
        >
          <MessageCircle className="h-4 w-4" />
          Falar com a Trevo
        </a>
      </div>
    </div>
  );
}
