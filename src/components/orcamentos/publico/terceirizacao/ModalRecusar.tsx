/**
 * Modal Recusar com Motivo.
 * Cliente escolhe um de 4 motivos (preco/escopo/timing/outro) + texto opcional.
 * Chama RPC `recusar_proposta_terceirizacao`.
 *
 * ITEM-02 (27/05 noite): checa res.ok ANTES de parsear body. Em 502/504
 * gateway, body não é JSON e .json() lança antes de detectarmos o status.
 *
 * Extraído do arquivo monolítico em 29/05 — só movimentação.
 */
import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { SUPABASE_URL } from '@/integrations/supabase/client';
import { anonHeaders } from './constants';

export function ModalRecusar({
  token,
  numero,
  onClose,
  onRecusado,
}: {
  token: string;
  numero: number;
  onClose: () => void;
  onRecusado: () => void;
}) {
  const [motivo, setMotivo] = useState<'preco' | 'escopo' | 'timing' | 'outro' | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const motivos: { id: 'preco' | 'escopo' | 'timing' | 'outro'; label: string; desc: string }[] = [
    { id: 'preco', label: 'Preço', desc: 'Acima do meu orçamento agora' },
    { id: 'escopo', label: 'Escopo', desc: 'Não bate com o que preciso' },
    { id: 'timing', label: 'Momento', desc: 'Hoje não é o melhor momento' },
    { id: 'outro', label: 'Outro motivo', desc: 'Explico no campo abaixo' },
  ];

  const handleEnviar = async () => {
    if (!motivo) return;
    setEnviando(true);
    setErro(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/recusar_proposta_terceirizacao`, {
        method: 'POST',
        headers: anonHeaders,
        body: JSON.stringify({ p_token: token, p_motivo: motivo, p_texto: texto || null }),
      });
      // ITEM-02 (27/05 noite): checa res.ok ANTES de parsear body. Em 502/504
      // gateway, body não é JSON e .json() lança antes de detectarmos o status.
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json().catch(() => null);
      if (data?.ok === false) {
        throw new Error(data?.error || 'Erro ao registrar recusa');
      }
      onRecusado();
    } catch (e) {
      setErro('Não conseguimos registrar agora. Tente recarregar a página.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full p-7 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-11 w-11 rounded-full bg-slate-100 inline-flex items-center justify-center">
            <X className="h-5 w-5 text-slate-500" strokeWidth={3} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Recusar proposta</h3>
            <p className="text-xs text-slate-500">PROP-{String(numero).padStart(4, '0')}</p>
          </div>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed mb-4">
          Pode dizer o motivo? Ajuda a gente a evoluir e a entender se faz sentido revisitar a proposta.
        </p>

        <div className="space-y-2 mb-4">
          {motivos.map((m) => (
            <button
              key={m.id}
              onClick={() => setMotivo(m.id)}
              className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                motivo === m.id
                  ? 'border-emerald-500 bg-emerald-50/60'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <p className={`text-sm font-bold ${motivo === m.id ? 'text-emerald-700' : 'text-slate-900'}`}>{m.label}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{m.desc}</p>
            </button>
          ))}
        </div>

        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value.slice(0, 500))}
          placeholder="Comentário opcional — o que faria você reconsiderar?"
          rows={3}
          maxLength={500}
          className="w-full text-sm border border-slate-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent resize-none"
        />
        <p className="text-[10px] text-slate-400 text-right mt-1">{texto.length}/500</p>

        {erro && <p className="text-xs text-red-600 mt-2">{erro}</p>}

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            disabled={enviando}
            className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
          >
            Voltar
          </button>
          <button
            onClick={handleEnviar}
            disabled={!motivo || enviando}
            className="flex-1 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Confirmar recusa
          </button>
        </div>
      </div>
    </div>
  );
}
