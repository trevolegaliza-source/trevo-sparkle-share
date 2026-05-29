/**
 * Tela de sucesso (já aceito + ainda não voltou pra landing).
 * Early-return da TerceirizacaoPublicaView — substitui a landing inteira.
 *
 * Renderiza confete CSS, anel pulsante e progress fake do PDF enquanto a
 * geração assíncrona não termina. ITEM-024: polling fica no orquestrador,
 * essa tela só recebe `pdfUrl` por prop.
 *
 * Extraído do arquivo monolítico em 29/05 — só movimentação.
 */
import { ArrowLeft, Check, Download, Loader2 } from 'lucide-react';

export function TelaSucesso({
  numero,
  prospectNome,
  pdfUrl,
  onVoltarParaLanding,
}: {
  numero: number;
  prospectNome: string;
  pdfUrl: string | null;
  onVoltarParaLanding: () => void;
}) {
  // 60 partículas de confete com cores/posições/delays aleatórios mas estáveis
  const confettiCores = ['#10b981', '#059669', '#34d399', '#fbbf24', '#f59e0b', '#3b82f6', '#a78bfa'];
  const confetes = Array.from({ length: 60 }, (_, i) => ({
    left: (i * 1.7 + Math.sin(i) * 5) % 100,
    delay: (i * 0.08) % 2.5,
    duration: 2.8 + (i % 5) * 0.3,
    cor: confettiCores[i % confettiCores.length],
    rotate: (i * 47) % 360,
    shape: i % 3,
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-50/60 flex items-center justify-center p-4 relative overflow-hidden">
      <style>{`
        @keyframes confetti-fall { 0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) rotate(720deg); opacity: 0; } }
        .ts-confetti { position: absolute; top: 0; pointer-events: none; animation: confetti-fall linear forwards; }
        @keyframes check-pop { 0% { transform: scale(0); opacity: 0; } 60% { transform: scale(1.2); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        .ts-check-pop { animation: check-pop 0.6s cubic-bezier(.34,1.56,.64,1) both; }
        @keyframes ring-expand { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(2.5); opacity: 0; } }
        .ts-ring-expand { animation: ring-expand 1.8s ease-out infinite; }
        @keyframes fade-up { 0% { transform: translateY(10px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
        .ts-fade-up { animation: fade-up 0.6s ease-out 0.3s both; }
        .ts-fade-up-2 { animation: fade-up 0.6s ease-out 0.5s both; }
        .ts-fade-up-3 { animation: fade-up 0.6s ease-out 0.7s both; }
      `}</style>

      {/* Confete */}
      {confetes.map((c, i) => (
        <div
          key={i}
          className="ts-confetti"
          style={{
            left: `${c.left}%`,
            width: c.shape === 0 ? '8px' : c.shape === 1 ? '10px' : '6px',
            height: c.shape === 0 ? '12px' : c.shape === 1 ? '10px' : '14px',
            background: c.cor,
            borderRadius: c.shape === 1 ? '50%' : '2px',
            animationDelay: `${c.delay}s`,
            animationDuration: `${c.duration}s`,
            transform: `rotate(${c.rotate}deg)`,
          }}
        />
      ))}

      <div className="max-w-md text-center space-y-5 relative z-10">
        <div className="relative inline-flex items-center justify-center w-24 h-24 rounded-full bg-emerald-100 ring-8 ring-emerald-50 ts-check-pop">
          <span className="absolute inset-0 rounded-full bg-emerald-400/40 ts-ring-expand" />
          <span className="absolute inset-0 rounded-full bg-emerald-400/30 ts-ring-expand" style={{ animationDelay: '0.6s' }} />
          <Check className="h-12 w-12 text-emerald-600 relative" strokeWidth={3} />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 ts-fade-up">Proposta aceita! 🍀</h1>
        <p className="text-slate-600 leading-relaxed ts-fade-up-2">
          Excelente decisão. A equipe Trevo recebeu seu aceite e o contrato
          está sendo enviado pela <strong className="text-emerald-700">ClickSign</strong> automaticamente
          para sua assinatura digital. Você também receberá contato pelo WhatsApp em até 1h útil para iniciar o onboarding.
        </p>
        <div className="bg-white rounded-lg border p-4 text-left space-y-2 ts-fade-up-3">
          <p className="text-xs font-mono text-muted-foreground">PROP-{String(numero).padStart(4, '0')}</p>
          <p className="text-sm font-semibold text-slate-900">{prospectNome}</p>
        </div>
        {pdfUrl ? (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ts-fade-up-3 inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-lg hover:shadow-xl transition-all"
          >
            <Download className="h-4 w-4" strokeWidth={2.5} />
            Baixar Proposta + Contrato (PDF)
          </a>
        ) : (
          <div className="ts-fade-up-3 w-full">
            <div className="inline-flex flex-col items-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-50 border-2 border-emerald-200 w-full">
              <div className="flex items-center gap-2.5 text-emerald-700">
                <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2.5} />
                <span className="text-sm font-bold">Gerando Proposta + Contrato</span>
              </div>
              {/* Progress bar fake — animação visual de 25s */}
              <div className="w-full h-1.5 bg-emerald-100 rounded-full overflow-hidden mt-1">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full ts-progress-fake" />
              </div>
              <p className="text-[11px] text-emerald-700/80 mt-1 leading-snug">
                Pode levar até <strong>30 segundos</strong>. <strong>Não feche essa aba</strong> — o botão aparece automaticamente quando pronto.
              </p>
            </div>
            <style>{`
              @keyframes ts-progress-fake {
                0% { width: 0%; }
                20% { width: 25%; }
                50% { width: 55%; }
                75% { width: 78%; }
                95% { width: 92%; }
                100% { width: 95%; }
              }
              .ts-progress-fake {
                animation: ts-progress-fake 25s cubic-bezier(.3,.7,.4,1) forwards;
              }
            `}</style>
          </div>
        )}

        <div className="ts-fade-up-3 pt-1">
          <button
            onClick={onVoltarParaLanding}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-emerald-700 hover:bg-slate-50 rounded-lg transition-colors min-h-[44px]"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar e visualizar proposta
          </button>
        </div>
      </div>
    </div>
  );
}
