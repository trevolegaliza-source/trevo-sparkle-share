/**
 * Modal de confirmação do aceite (passo final antes do RPC).
 * Mostra bullets de reversibilidade (COM-05 27/05 noite) pra reduzir fricção.
 *
 * Extraído do arquivo monolítico em 29/05 — só movimentação.
 */
import { Check, CheckCircle2, Loader2 } from 'lucide-react';

export function ModalConfirmarAceite({
  numero,
  aceitando,
  onCancelar,
  onConfirmar,
}: {
  numero: number;
  aceitando: boolean;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-12 w-12 rounded-full bg-emerald-100 inline-flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Confirmar aceite</h3>
            <p className="text-xs text-slate-500">PROP-{String(numero).padStart(4, '0')}</p>
          </div>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed mb-4">
          Ao confirmar, o Contrato Mestre (MSA) será enviado automaticamente pela
          ClickSign pra sua assinatura digital. O aceite verbal já tem validade
          legal (art. 107 CC + Lei 14.063/2020).
        </p>
        {/* COM-05 (27/05 noite): bullets de reversibilidade pra reduzir fricção */}
        <ul className="text-xs text-slate-700 space-y-2 mb-6 bg-emerald-50/60 border border-emerald-100 rounded-lg p-4">
          <li className="flex items-start gap-2">
            <Check className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" strokeWidth={3} />
            <span>Sem cobrança até o primeiro processo iniciar</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" strokeWidth={3} />
            <span>Assinatura formal acontece depois — você ainda confere o MSA na ClickSign</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" strokeWidth={3} />
            <span>Onboarding humano em até 1h útil pra tirar qualquer dúvida</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" strokeWidth={3} />
            <span>Rescisão por qualquer motivo com aviso de 30 dias (cláusula 17)</span>
          </li>
        </ul>
        <div className="flex gap-2">
          <button
            onClick={onCancelar}
            disabled={aceitando}
            className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            disabled={aceitando}
            className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {aceitando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Aceitar e iniciar onboarding
          </button>
        </div>
      </div>
    </div>
  );
}
