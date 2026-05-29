/**
 * Bloco "Diferenciais" — grid 2×2 de Diferencial + CardDaniAi full-width abaixo.
 *
 * Extraído do arquivo monolítico em 29/05 — só movimentação.
 */
import { FileText, Target, Users, Zap } from 'lucide-react';
import { Diferencial } from './atoms';
import { CardDaniAi } from './CardDaniAi';

export function BlocoDiferenciais() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-5xl mx-auto px-6">
        <div className="max-w-2xl mb-12">
          <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700 font-bold mb-2">Por que a Trevo Legaliza</p>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">
            Não somos só mais um. Somos a infraestrutura.
          </h2>
          <p className="text-slate-600 mt-4 leading-relaxed">
            Há 12 anos só fazemos isso. E só atendemos quem faz o que você faz.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Diferencial
            icon={Users}
            titulo="Você para de perder tempo"
            texto="Não gerencie processos societários sem controle. Nós assumimos, executamos e entregamos dentro do SLA — você foca no seu cliente."
          />
          <Diferencial
            icon={Target}
            titulo="Qualquer estado, mesmo padrão"
            texto="Atendemos 26 estados. Seu cliente em São Paulo ou no Pará recebe o mesmo nível de execução, acompanhamento e rastreabilidade."
          />
          <Diferencial
            icon={FileText}
            titulo="Zero surpresa financeira"
            texto="Taxas, emolumentos e custos extras são informados antes da execução. Sem cobrança surpresa para você, sem atrito com seu cliente final."
          />
          <Diferencial
            icon={Zap}
            titulo="Estruturado pra escalar"
            texto="Modelo desenhado pra acompanhar o crescimento do seu escritório — sem precisar contratar um departamento societário interno nem treinar uma equipe do zero."
          />
        </div>

        {/* Card destaque Dani.ai (full-width) */}
        <div className="mt-6">
          <CardDaniAi />
        </div>
      </div>
    </section>
  );
}
