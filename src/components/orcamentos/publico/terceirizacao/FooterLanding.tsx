/**
 * Footer da landing — logo Trevo + assinatura "Powered by dani.ai".
 *
 * Extraído do arquivo monolítico em 29/05 — só movimentação.
 */
import logoTrevo from '@/assets/logo-trevo.png';
import logoDaniDark from '@/assets/dani-dark.png';

export function FooterLanding() {
  return (
    <footer className="bg-slate-100 border-t border-slate-200">
      <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col md:flex-row gap-6 items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-4">
          <img src={logoTrevo} alt="Trevo Legaliza" loading="lazy" decoding="async" className="h-16 w-16 object-contain opacity-90" />
          <div>
            <p className="font-bold text-slate-700">TREVO ASSESSORIA SOCIETÁRIA LTDA</p>
            <p>CNPJ 39.969.412/0001-70 · São Bernardo do Campo / SP</p>
            <p className="mt-1 text-[10px]">© Trevo Legaliza · 12 anos cuidando do societário</p>
          </div>
        </div>
        <div className="flex items-center gap-3 pl-0 md:pl-4 md:border-l border-slate-300">
          <div className="flex items-baseline">
            <img src={logoDaniDark} alt="dani.ai" loading="lazy" decoding="async" className="h-10 object-contain" />
            <span className="text-[10px] text-slate-400 font-semibold ml-0.5" aria-label="marca registrada">®</span>
          </div>
          <div className="leading-tight">
            <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Powered by</p>
            <p className="text-xs font-bold text-slate-700">Trevo Legaliza</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
