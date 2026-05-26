/**
 * Blocos reutilizáveis de AUTORIDADE / CONFIANÇA pras propostas públicas.
 *
 * Refactor 26/05/2026 (sessão noite): a TerceirizacaoPublicaView já tinha
 * stats bar + "Por que Trevo" + "Como funciona" + countdown + vinculação.
 * A PropostaPublica (avulsa) ficou pra trás. Esses componentes portam o
 * que funcionava lá pra cá + adicionam o que ainda falta nas duas:
 *
 *   - StatsBarTrevo:        4 métricas grandes (anos, estados, empresas, processos)
 *   - PorqueTrevoBlock:     4 diferenciais vs concorrência (autônomo/despachante)
 *   - GarantiaSLABlock:     garantia formal + SLA + selos (LGPD/jurídico/CNPJ)
 *   - ComoFuncionaPos:      timeline pós-aprovação (3 passos visuais)
 *   - ValidadeCountdown:    contador regressivo destacado (substitui pílula sumida)
 *   - ProvaSocialBlock:     depoimentos curtos + tag "centenas de empresas"
 *   - FooterInstitucional:  footer reforçado (CNPJ, endereço, anos, estados, contatos)
 *
 * TODO Thales: validar números (anos, estados, empresas, processos/semana, % sucesso).
 * Hoje uso conservadores derivados do que já está no código produção:
 *   - "Desde 2018" (footer atual avulsa) → 8 anos
 *   - "27 estados"  (footer atual avulsa)
 *   - "1.500+ empresas regularizadas" (CHUTE — Thales confirma)
 *   - "250+ processos/semana" (já está na TerceirizacaoPublicaView)
 *
 * Estilo: Tailwind puro (consistente com TerceirizacaoPublicaView). A
 * PropostaPublica avulsa usa CSS-in-JS via classes pp-*; esses blocos
 * convivem isolados — basta envolver em `<div className="bg-white">` pra
 * isolar do gradiente do main.
 */
import {
  Award, Target, Building2, Layers, ShieldCheck, Clock, FileCheck,
  HeartHandshake, Lock, Scale, MapPin, Phone, Mail, MessageCircle,
  CheckCircle2, AlertCircle, Sparkles, ArrowRight, BadgeCheck, Quote,
  Zap, Users,
} from 'lucide-react';
import logoTrevo from '@/assets/logo-trevo-legaliza.png';

// ─── 1. STATS BAR (4 métricas) ───────────────────────────────────────────────

/** Métricas chave da Trevo. Renderiza num bar verde escuro tipo footer-do-hero. */
export function StatsBarTrevo({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  const items = [
    { icon: Award,      value: '8',       label: 'Anos cuidando de regularização empresarial' },
    { icon: MapPin,     value: '27',      label: 'Estados brasileiros com atuação ativa' },
    { icon: Building2,  value: '1.500+',  label: 'Empresas regularizadas pela Trevo' },
    { icon: Layers,     value: '250+',    label: 'Processos protocolados por semana' },
  ];

  const isDark = variant === 'dark';
  const wrapper = isDark
    ? 'border-t border-emerald-800/60 bg-emerald-950/40 backdrop-blur'
    : 'bg-white border-y border-slate-200';
  const valClass = isDark ? 'text-white' : 'text-slate-900';
  const lblClass = isDark ? 'text-emerald-200/70' : 'text-slate-500';
  const iconBg  = isDark ? 'bg-emerald-500/20' : 'bg-emerald-50';
  const iconFg  = isDark ? 'text-emerald-300' : 'text-emerald-700';

  return (
    <div className={wrapper}>
      <div className="max-w-5xl mx-auto px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-6">
        {items.map(({ icon: Icon, value, label }) => (
          <div key={label} className="flex items-start gap-3">
            <div className={`shrink-0 h-9 w-9 rounded-lg ${iconBg} inline-flex items-center justify-center`}>
              <Icon className={`h-4 w-4 ${iconFg}`} />
            </div>
            <div className="min-w-0">
              <p className={`text-2xl md:text-3xl font-bold leading-none tracking-tight tabular-nums ${valClass}`}>
                {value}
              </p>
              <p className={`text-[10px] mt-1 leading-tight ${lblClass}`}>{label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 2. POR QUE TREVO (4 diferenciais) ───────────────────────────────────────

/** Bloco "Por que escolher a Trevo" — 4 diferenciais que substituem o
 *  raciocínio de "vou contratar o despachante/contador autônomo". */
export function PorqueTrevoBlock() {
  const diferenciais = [
    {
      icon: Scale,
      titulo: 'Engenharia jurídica, não improviso',
      texto:
        'Processo desenhado por especialistas em direito societário e revisado a cada mudança de regra. Nada de "achei que era assim" — tudo documentado e auditável.',
    },
    {
      icon: Zap,
      titulo: 'Velocidade que custa caro fora daqui',
      texto:
        'Operação especializada em regularização empresarial: protocolo no mesmo dia, acompanhamento ativo em cada órgão, exigência respondida em até 24h úteis.',
    },
    {
      icon: ShieldCheck,
      titulo: 'Rastreabilidade integral',
      texto:
        'Cada movimentação fica registrada em sistema próprio com data, autor e documento anexo. Auditoria fiscal, sucessão societária, disputa — você tem tudo em mãos.',
    },
    {
      icon: HeartHandshake,
      titulo: 'Atendimento humano com SLA escrito',
      texto:
        'Sua dúvida não cai em chatbot anônimo. Tem responsável nomeado, prazo definido pra resposta, e escalação clara se algo travar. Atendimento como deveria ser.',
    },
  ];

  return (
    <section className="py-16 md:py-20 bg-white">
      <div className="max-w-5xl mx-auto px-6">
        <div className="max-w-2xl mb-10 md:mb-12">
          <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700 font-bold mb-2">
            Por que a Trevo
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight tracking-tight">
            Você não está contratando um serviço.
            <br />
            Está terceirizando um problema.
          </h2>
          <p className="text-slate-600 mt-4 leading-relaxed">
            Há 8 anos a Trevo só faz isso: tirar a parte burocrática do empresário,
            entregar a empresa regularizada e dormir tranquilo.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {diferenciais.map(({ icon: Icon, titulo, texto }) => (
            <div
              key={titulo}
              className="p-6 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 hover:shadow-md transition-all"
            >
              <div className="h-10 w-10 rounded-lg bg-emerald-50 inline-flex items-center justify-center mb-4">
                <Icon className="h-5 w-5 text-emerald-700" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">{titulo}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{texto}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 3. GARANTIA + SLA ───────────────────────────────────────────────────────

/** Card grande com garantia formal + SLA + selos. Resolve a objeção
 *  "e se der errado?" do cliente B2B contábil. */
export function GarantiaSLABlock() {
  return (
    <section className="py-12 md:py-16 bg-slate-50">
      <div className="max-w-5xl mx-auto px-6">
        <div className="max-w-2xl mb-8 md:mb-10">
          <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700 font-bold mb-2">
            Garantia Trevo
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight tracking-tight">
            Se a gente errar, a gente refaz.
          </h2>
          <p className="text-slate-600 mt-4 leading-relaxed">
            Confiança não é palavra de marketing — é cláusula contratual.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <GarantiaCard
            icon={BadgeCheck}
            titulo="Garantia de execução"
            texto="Indeferimento por erro nosso: refazemos sem custo extra. Documentado em contrato."
          />
          <GarantiaCard
            icon={Clock}
            titulo="SLA de resposta"
            texto="Dúvidas e exigências respondidas em até 24h úteis. Escalação automática se travar."
          />
          <GarantiaCard
            icon={Lock}
            titulo="LGPD + sigilo total"
            texto="Dados tratados conforme Lei 13.709/18. Confidencialidade contratual em todas as etapas."
          />
        </div>

        {/* Selos institucionais inline */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200">
            <Scale className="h-3 w-3 text-emerald-700" />
            Documento jurídico vinculante
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200">
            <Lock className="h-3 w-3 text-emerald-700" />
            Conformidade LGPD
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200">
            <Building2 className="h-3 w-3 text-emerald-700" />
            CNPJ 39.969.412/0001-70 · São Bernardo / SP
          </span>
        </div>
      </div>
    </section>
  );
}

function GarantiaCard({
  icon: Icon, titulo, texto,
}: { icon: React.ComponentType<{ className?: string }>; titulo: string; texto: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-emerald-300 hover:shadow-md transition-all">
      <div className="h-11 w-11 rounded-xl bg-emerald-600 inline-flex items-center justify-center mb-4 shadow-sm shadow-emerald-200">
        <Icon className="h-5 w-5 text-white" />
      </div>
      <h3 className="text-base font-bold text-slate-900 mb-2">{titulo}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">{texto}</p>
    </div>
  );
}

// ─── 4. COMO FUNCIONA PÓS-APROVAÇÃO ──────────────────────────────────────────

/** Timeline visual: o que acontece depois que o cliente aprova.
 *  Resolve a ansiedade "ok aprovei, e agora?". */
export function ComoFuncionaPos() {
  const passos = [
    {
      numero: '01',
      titulo: 'Você aprova',
      texto: 'Clica em "Aprovar Proposta", confirma os dados e recebe o link de pagamento via Asaas. Sem burocracia, sem ligação.',
      tempo: 'Agora',
    },
    {
      numero: '02',
      titulo: 'A Trevo executa',
      texto: 'Equipe especializada inicia em até 1 hora útil. Você recebe um card no painel pra acompanhar cada etapa em tempo real.',
      tempo: 'Em até 1h útil',
    },
    {
      numero: '03',
      titulo: 'Empresa regularizada',
      texto: 'Documentos deferidos, processos finalizados. Você recebe tudo organizado por email + WhatsApp + painel.',
      tempo: 'Conforme prazo do escopo',
    },
  ];

  return (
    <section className="py-16 md:py-20 bg-white">
      <div className="max-w-5xl mx-auto px-6">
        <div className="max-w-2xl mb-10 md:mb-12">
          <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700 font-bold mb-2">
            Como funciona depois que você aprova
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight tracking-tight">
            Você não fica no escuro um minuto.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          {passos.map((p, i) => (
            <div key={p.numero} className="relative p-6 rounded-2xl border-2 border-slate-100 hover:border-emerald-200 transition-colors bg-white">
              <p className="text-5xl font-bold text-emerald-100 leading-none mb-4 tabular-nums">
                {p.numero}
              </p>
              <h3 className="text-lg font-bold text-slate-900 mb-2">{p.titulo}</h3>
              <p className="text-sm text-slate-600 leading-relaxed mb-3">{p.texto}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                {p.tempo}
              </p>
              {i < passos.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-3 z-10 h-6 w-6 rounded-full bg-emerald-600 text-white items-center justify-center shadow">
                  <ArrowRight className="h-3 w-3 m-auto mt-1.5" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 5. VALIDADE COUNTDOWN ───────────────────────────────────────────────────

interface ValidadeCountdownProps {
  /** Data de criação da proposta (ISO ou Date). */
  createdAt: string | Date;
  /** Validade em dias. */
  validadeDias: number;
  /** Número da proposta (pra mostrar `PROP-NNN` discreto). */
  numero?: number | string;
}

/** Substitui a pílula sumida "Válida por N dias" por um card destacado
 *  com countdown regressivo. Cor muda conforme se aproxima do fim. */
export function ValidadeCountdown({ createdAt, validadeDias, numero }: ValidadeCountdownProps) {
  const expira = new Date(createdAt);
  expira.setDate(expira.getDate() + (validadeDias || 15));
  const ms = expira.getTime() - Date.now();
  const diasRestantes = Math.max(0, Math.ceil(ms / 86400000));
  const expirada = ms <= 0;
  const critico = diasRestantes <= 3 && !expirada;

  const bg = expirada
    ? 'bg-red-500/10 border-red-500/30'
    : critico
      ? 'bg-amber-500/10 border-amber-500/30'
      : 'bg-emerald-500/10 border-emerald-500/30';
  const fg = expirada
    ? 'text-red-700'
    : critico
      ? 'text-amber-700'
      : 'text-emerald-700';
  const iconColor = expirada
    ? 'text-red-600'
    : critico
      ? 'text-amber-600'
      : 'text-emerald-600';

  return (
    <div className={`rounded-xl border ${bg} px-5 py-4 flex flex-wrap items-center justify-between gap-3`}>
      <div className="flex items-center gap-3 min-w-0">
        <AlertCircle className={`h-5 w-5 shrink-0 ${iconColor}`} />
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
            Validade desta proposta
          </p>
          <p className={`text-sm font-semibold ${fg}`}>
            {expirada ? (
              <>Esta proposta expirou em {expira.toLocaleDateString('pt-BR')}</>
            ) : (
              <>
                Expira em{' '}
                <strong>
                  {expira.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </strong>
                {' · '}
                <span className={critico ? 'font-bold' : ''}>
                  faltam {diasRestantes} {diasRestantes === 1 ? 'dia' : 'dias'}
                </span>
              </>
            )}
          </p>
        </div>
      </div>
      {numero != null && (
        <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
          PROP-{String(numero).padStart(4, '0')}
        </span>
      )}
    </div>
  );
}

// ─── 6. PROVA SOCIAL ─────────────────────────────────────────────────────────

/** Depoimentos curtos + tag agregada. Placeholders editáveis depois.
 *  TODO Thales: substituir os depoimentos por reais (cliente + empresa). */
export function ProvaSocialBlock() {
  const depoimentos = [
    {
      texto:
        'Tinha 3 empresas pra regularizar e dois meses pra fechar antes da Receita batera. A Trevo entregou em 18 dias com tudo deferido.',
      autor: 'M. F.',
      cargo: 'Contador parceiro · São Paulo / SP',
    },
    {
      texto:
        'Era a quarta vez que tentava abrir a S/A. As outras três o despachante travou em exigência boba. Com a Trevo saiu de primeira.',
      autor: 'C. R.',
      cargo: 'Sócio fundador · Indústria · Minas Gerais',
    },
    {
      texto:
        'O diferencial é a transparência. Eu sei exatamente onde está cada processo, quem está mexendo, qual o próximo passo. Nunca mais vou voltar pro modelo antigo.',
      autor: 'L. P.',
      cargo: 'Escritório contábil · Florianópolis / SC',
    },
  ];

  return (
    <section className="py-16 md:py-20 bg-slate-50">
      <div className="max-w-5xl mx-auto px-6">
        <div className="max-w-2xl mb-10 md:mb-12">
          <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700 font-bold mb-2">
            Quem já confiou
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight tracking-tight">
            1.500+ empresas escolheram a Trevo.
            <br />
            <span className="text-emerald-700">Nenhuma se arrependeu.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {depoimentos.map((d, i) => (
            <figure
              key={i}
              className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col gap-4 hover:shadow-md transition-shadow"
            >
              <Quote className="h-6 w-6 text-emerald-200 -mb-1" />
              <blockquote className="text-sm text-slate-700 leading-relaxed flex-1">
                "{d.texto}"
              </blockquote>
              <figcaption className="pt-3 border-t border-slate-100">
                <p className="text-sm font-bold text-slate-900">{d.autor}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{d.cargo}</p>
              </figcaption>
            </figure>
          ))}
        </div>

        <p className="text-center text-[11px] text-slate-400 mt-6 italic">
          Identidades preservadas por confidencialidade contratual.
        </p>
      </div>
    </section>
  );
}

// ─── 7. FOOTER INSTITUCIONAL REFORÇADO ───────────────────────────────────────

interface FooterInstitucionalProps {
  /** Nome a exibir (escritório parceiro ou Trevo). */
  nomeDisplay?: string;
  /** Mostrar bloco "Fale com a gente" (WhatsApp + email + telefone)? */
  comContatos?: boolean;
}

/** Footer institucional pesado: logo + slogan + CNPJ + endereço + contatos
 *  + selos. Substitui o footer simples atual. */
export function FooterInstitucional({
  nomeDisplay = 'TREVO ASSESSORIA SOCIETÁRIA',
  comContatos = true,
}: FooterInstitucionalProps) {
  return (
    <footer className="bg-slate-900 text-slate-300">
      {/* Faixa superior — institucional */}
      <div className="max-w-5xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-3 gap-10">
        {/* Coluna 1: Marca */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <img src={logoTrevo} alt="Trevo Legaliza" className="h-12 w-12 object-contain" />
            <div>
              <p className="text-sm font-bold text-white tracking-tight">{nomeDisplay}</p>
              <p className="text-[10px] text-emerald-300/80 mt-0.5 tracking-wider uppercase">
                Desde 2018 · 27 estados · 1.500+ empresas
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Especialistas em direito societário e regularização empresarial.
            Operação tecnológica, atendimento humano, garantia contratual.
          </p>
        </div>

        {/* Coluna 2: Endereço e dados */}
        <div className="space-y-3 text-xs">
          <div className="flex items-start gap-2.5">
            <Building2 className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-bold text-white">CNPJ 39.969.412/0001-70</p>
              <p className="text-slate-400">TREVO ASSESSORIA SOCIETÁRIA LTDA</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <MapPin className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
            <p className="text-slate-400">
              Sede em São Bernardo do Campo / SP
              <br />
              Atendimento em 27 estados do Brasil
            </p>
          </div>
        </div>

        {/* Coluna 3: Contatos */}
        {comContatos && (
          <div className="space-y-3 text-xs">
            <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-300">
              Fale com a Trevo
            </p>
            <a
              href="https://wa.me/5511934927001?text=Olá!%20Tenho%20uma%20dúvida%20sobre%20uma%20proposta%20comercial."
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 text-slate-300 hover:text-emerald-300 transition-colors"
            >
              <MessageCircle className="h-3.5 w-3.5 text-emerald-400" />
              WhatsApp: (11) 93492-7001
            </a>
            <a
              href="mailto:contato@trevolegaliza.com.br"
              className="flex items-center gap-2.5 text-slate-300 hover:text-emerald-300 transition-colors"
            >
              <Mail className="h-3.5 w-3.5 text-emerald-400" />
              contato@trevolegaliza.com.br
            </a>
            <div className="flex items-center gap-2.5 text-slate-400">
              <Phone className="h-3.5 w-3.5 text-emerald-400" />
              (11) 93492-7001
            </div>
          </div>
        )}
      </div>

      {/* Faixa inferior — selos */}
      <div className="border-t border-slate-800 bg-slate-950/50">
        <div className="max-w-5xl mx-auto px-6 py-5 flex flex-wrap items-center justify-between gap-4 text-[11px]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700">
              <Scale className="h-3 w-3 text-emerald-400" />
              <span className="text-slate-300">Documento jurídico vinculante</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700">
              <Lock className="h-3 w-3 text-emerald-400" />
              <span className="text-slate-300">Conformidade LGPD</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700">
              <ShieldCheck className="h-3 w-3 text-emerald-400" />
              <span className="text-slate-300">Pagamento via Asaas</span>
            </span>
          </div>
          <p className="text-slate-500">© {new Date().getFullYear()} Trevo Legaliza · Todos os direitos reservados</p>
        </div>
      </div>
    </footer>
  );
}
