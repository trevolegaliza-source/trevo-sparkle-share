/**
 * Bloco CTA final — "Vamos começar?" + botão aceitar/baixar PDF + WhatsApp + recusar.
 * Lida com 3 estados: pré-aceite (mostra aceitar), aceito sem PDF (loader),
 * aceito com PDF (download).
 *
 * Extraído do arquivo monolítico em 29/05 — só movimentação.
 */
import { ArrowRight, Check, Download, FileText, Loader2, Lock, MessageCircle, ShieldCheck } from 'lucide-react';

export function CtaFinal({
  numero,
  statusLocal,
  aceitando,
  pdfUrl,
  preExistingPdfUrl,
  onSolicitarAceite,
  onAbrirRecusa,
}: {
  numero: number;
  statusLocal: string;
  aceitando: boolean;
  pdfUrl: string | null;
  preExistingPdfUrl: string | null | undefined;
  /** Cliente clicou em "Aceitar proposta" — decidir abrir upsell ou confirm direto. */
  onSolicitarAceite: () => void;
  onAbrirRecusa: () => void;
}) {
  return (
    <section className="py-20 bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 text-white relative overflow-hidden">
      <div className="absolute inset-0 grain pointer-events-none" />
      <div className="relative max-w-3xl mx-auto px-6 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 mb-6">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
          <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-200 font-semibold">
            Documento vinculante
          </p>
        </div>

        <h2 className="text-3xl md:text-5xl font-bold leading-tight mb-6">
          Vamos começar?
        </h2>
        <p className="text-emerald-100/80 leading-relaxed mb-3">
          Esta proposta é parte integrante do <strong className="text-white">Contrato Mestre de
          Prestação de Serviços (MSA)</strong> entre as partes. O aceite implica
          concordância integral com os termos.
        </p>
        <p className="text-sm text-emerald-200/80 leading-relaxed mb-10">
          Após o aceite, você recebe acesso à plataforma em até 2 dias úteis
          e a equipe Trevo entra em contato pra iniciar o onboarding.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {statusLocal === 'aceito' ? (
            // Modo "aceito" — CTA vira download PDF
            pdfUrl ? (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-base font-bold inline-flex items-center justify-center gap-2 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
              >
                <Download className="h-5 w-5" strokeWidth={2.5} />
                Baixar Proposta + Contrato (PDF)
              </a>
            ) : (
              <div className="px-8 py-4 rounded-xl bg-emerald-500/30 text-emerald-100 text-base font-bold inline-flex items-center justify-center gap-2 cursor-wait">
                <Loader2 className="h-5 w-5 animate-spin" />
                Gerando PDF — quase pronto
              </div>
            )
          ) : (
            <button
              onClick={onSolicitarAceite}
              disabled={aceitando}
              className="px-8 py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-base font-bold inline-flex items-center justify-center gap-2 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5 disabled:opacity-50"
            >
              <Check className="h-5 w-5" strokeWidth={3} />
              Aceitar proposta
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
          <a
            href="https://wa.me/5511934927001?text=Olá!%20Tenho%20uma%20dúvida%20sobre%20a%20proposta%20comercial."
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/20 text-white text-base font-semibold inline-flex items-center justify-center gap-2 transition-all"
          >
            <MessageCircle className="h-4 w-4" />
            {statusLocal === 'aceito' ? 'Falar com a Trevo' : 'Tirar dúvidas no WhatsApp'}
          </a>
        </div>

        {statusLocal !== 'aceito' && (
          <div className="mt-4">
            <button
              onClick={onAbrirRecusa}
              className="px-4 py-2 text-xs text-emerald-200/70 hover:text-emerald-100 hover:bg-white/5 rounded-md transition-colors min-h-[40px] inline-flex items-center"
            >
              Não tenho interesse — recusar com motivo
            </button>
          </div>
        )}

        {preExistingPdfUrl && (
          <div className="mt-6">
            <a
              href={preExistingPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-emerald-200/80 hover:text-white underline inline-flex items-center gap-1.5"
            >
              <FileText className="h-3 w-3" />
              Pré-visualizar proposta + contrato em PDF
            </a>
          </div>
        )}

        <p className="text-[11px] text-emerald-200/70 mt-12 flex items-center justify-center gap-1.5">
          <Lock className="h-3 w-3" />
          Documento gerado pela plataforma Trevo Engine ·  PROP-{String(numero).padStart(4, '0')}
        </p>
      </div>
    </section>
  );
}
