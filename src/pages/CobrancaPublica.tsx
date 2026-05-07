import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/client';
import { Loader2, AlertCircle, XCircle } from 'lucide-react';
import logoTrevo from '@/assets/logo-trevo-legaliza.png';
import logoDani from '@/assets/dani-logo-dark.png';
import daniAvatar from '@/assets/dani-avatar.png';
import './CobrancaPublica.css';

interface Taxa {
  descricao: string;
  valor: number;
  categoria?: string | null;
  comprovante_url?: string | null;
}

interface LancamentoCobranca {
  id: string;
  descricao: string;
  valor: number;
  razao_social: string | null;
  tipo_processo: string | null;
  taxas: Taxa[];
  comprovante_url?: string | null;
  observacoes_processo?: string | null;
  observacoes_financeiro?: string | null;
}

interface EmpresaConfig {
  nome: string;
  cnpj: string;
  pix_chave: string;
  pix_banco: string;
  whatsapp: string;
  site: string;
}

interface AsaasInfo {
  payment_id: string | null;
  status: string | null;
  invoice_url: string | null;
  boleto_url: string | null;
  boleto_barcode: string | null;
  pix_qrcode: string | null;
  pix_payload: string | null;
  gerado_em: string | null;
  pago_em: string | null;
}

interface CobrancaData {
  id: string;
  cliente_nome: string;
  cliente_apelido: string | null;
  cliente_cnpj: string | null;
  cliente_nome_contador: string | null;
  total_honorarios: number;
  total_taxas: number;
  total_geral: number;
  data_vencimento: string | null;
  status: 'ativa' | 'vencida' | 'paga' | 'cancelada';
  created_at: string;
  lancamentos: LancamentoCobranca[];
  empresa_config: EmpresaConfig;
  pago_em?: string | null;
  extrato_id?: string | null;
  asaas?: AsaasInfo | null;
}

const fmtData = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const isDateOnly = typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const d = isDateOnly ? new Date(iso + 'T00:00:00') : new Date(iso);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
};

const fmtDataHora = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const fmtBRL = (v: number) =>
  `R$\u00a0${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const cobrancaShortId = (id: string) => `#${id.slice(0, 6)}`;

// Normaliza tipo_processo (DB grava sem acento, lowercase) para exibição correta
const normalizarProcesso = (raw: string | null | undefined): string => {
  if (!raw) return '';
  const k = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  const map: Record<string, string> = {
    alteracao: 'alteração',
    abertura: 'abertura',
    encerramento: 'encerramento',
    transformacao: 'transformação',
  };
  return map[k] || raw.toLowerCase();
};

// Confetti vanilla canvas (executa quando isPaga vira true)
function dispararConfetti() {
  const canvas = document.createElement('canvas');
  canvas.className = 'cobranca-confetti';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  const cores = ['#16a34a', '#22c55e', '#86efac', '#fde047', '#fb923c', '#60a5fa'];
  const particles = Array.from({ length: 140 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * canvas.height * 0.5,
    r: 4 + Math.random() * 6,
    c: cores[Math.floor(Math.random() * cores.length)],
    vx: (Math.random() - 0.5) * 4,
    vy: 2 + Math.random() * 4,
    rot: Math.random() * Math.PI * 2,
    vrot: (Math.random() - 0.5) * 0.3,
  }));
  const start = performance.now();
  const DURATION = 4500;
  function frame(t: number) {
    const elapsed = t - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      p.rot += p.vrot;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
      ctx.restore();
    });
    if (elapsed < DURATION) {
      requestAnimationFrame(frame);
    } else {
      canvas.remove();
    }
  }
  requestAnimationFrame(frame);
}

export default function CobrancaPublica() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [cobranca, setCobranca] = useState<CobrancaData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'pix' | 'boleto'>('pix');
  const [pixCopied, setPixCopied] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  // SEO
  useEffect(() => {
    if (!cobranca) return;
    const title = `Cobrança — ${cobranca.cliente_apelido || cobranca.cliente_nome} — Trevo Legaliza`;
    const description = `Cobrança oficial no valor de R$ ${Number(cobranca.total_geral).toFixed(2).replace('.', ',')}. Pague via PIX ou boleto com segurança.`;
    const image = 'https://cobranca.trevolegaliza.com/og-cobranca-sm.png';
    document.title = title;
    const setMeta = (key: 'property' | 'name', value: string, content: string) => {
      let tag = document.querySelector(`meta[${key}="${value}"]`) as HTMLMetaElement | null;
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(key, value);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
    };
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:image', image);
    setMeta('property', 'og:image:width', '400');
    setMeta('property', 'og:image:height', '400');
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:site_name', 'Trevo Legaliza');
    setMeta('name', 'description', description);
    setMeta('name', 'twitter:card', 'summary');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', image);
  }, [cobranca]);

  // Confetti ao detectar pagamento confirmado
  const confettiDisparado = useRef(false);
  useEffect(() => {
    if (cobranca?.status === 'paga' && !confettiDisparado.current) {
      confettiDisparado.current = true;
      dispararConfetti();
    }
  }, [cobranca?.status]);

  // Fetch cobrança
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error: rpcError } = await supabase.rpc(
          'get_cobranca_por_token' as any,
          { p_token: token }
        );
        if (cancelled) return;
        if (rpcError) throw rpcError;
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) {
          setError('not_found');
        } else {
          setCobranca(row as CobrancaData);
          supabase.rpc('mark_cobranca_visualizada' as any, { p_token: token }).then(() => {});
        }
      } catch {
        if (!cancelled) setError('not_found');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 2200);
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const t = document.createElement('textarea');
      t.value = text; document.body.appendChild(t);
      t.select(); document.execCommand('copy'); t.remove();
    }
  };

  if (loading) {
    return (
      <div className="cobranca-public">
        <div className="state-screen">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#16a34a' }} />
        </div>
      </div>
    );
  }

  if (error === 'not_found' || !cobranca) {
    return (
      <div className="cobranca-public">
        <div className="state-screen">
          <div className="state-card">
            <AlertCircle className="h-10 w-10 mx-auto" style={{ color: '#dc2626' }} />
            <h1>Link inválido ou expirado</h1>
            <p>Não encontramos esta cobrança. Entre em contato pelo WhatsApp.</p>
            <a className="btn btn-secondary btn-w-full" href="https://wa.me/5511934927001" target="_blank" rel="noopener">
              Falar no WhatsApp
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (cobranca.status === 'cancelada') {
    return (
      <div className="cobranca-public">
        <div className="state-screen">
          <div className="state-card">
            <XCircle className="h-10 w-10 mx-auto" style={{ color: '#6b7280' }} />
            <h1>Cobrança cancelada</h1>
            <p>Esta cobrança foi cancelada. Em caso de dúvida, fale com a Dani.</p>
            <a className="btn btn-secondary btn-w-full" href={`https://wa.me/${cobranca.empresa_config.whatsapp}`} target="_blank" rel="noopener">
              Falar no WhatsApp
            </a>
          </div>
        </div>
      </div>
    );
  }

  const empresa = cobranca.empresa_config;
  const saudacao = cobranca.cliente_apelido || cobranca.cliente_nome;
  const isPaga = cobranca.status === 'paga';

  // Status pill (header) + due chip
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const venc = cobranca.data_vencimento ? new Date(cobranca.data_vencimento + 'T00:00:00') : null;
  const diffDias = venc ? Math.round((venc.getTime() - hoje.getTime()) / 86400000) : null;

  let statusPillClass = '';
  let statusPillLabel = 'Cobrança ativa';
  if (isPaga) { statusPillLabel = 'Cobrança paga'; }
  else if (diffDias !== null && diffDias < 0) { statusPillClass = 'danger'; statusPillLabel = `Em atraso · ${Math.abs(diffDias)}d`; }
  else if (diffDias !== null && diffDias === 0) { statusPillClass = 'warning'; statusPillLabel = 'Vence hoje'; }
  else if (diffDias !== null && diffDias === 1) { statusPillClass = 'warning'; statusPillLabel = 'Vence amanhã'; }

  let dueClass = '';
  let dueText = '';
  if (diffDias !== null) {
    if (diffDias < 0) { dueClass = 'is-overdue'; dueText = `Vencida há ${Math.abs(diffDias)} ${Math.abs(diffDias) === 1 ? 'dia' : 'dias'}`; }
    else if (diffDias === 0) { dueClass = 'is-soon'; dueText = 'Vence hoje'; }
    else if (diffDias === 1) { dueClass = 'is-soon'; dueText = 'Vence amanhã'; }
    else if (diffDias <= 3) { dueClass = 'is-soon'; dueText = `Vence em ${diffDias} dias`; }
    else { dueText = `Vence em ${diffDias} dias`; }
  }

  const temAsaasPix = !!cobranca.asaas?.pix_payload;
  const pixValueToCopy = cobranca.asaas?.pix_payload || empresa.pix_chave;
  const temBoleto = !!cobranca.asaas?.boleto_url;

  const onCopyPix = async () => {
    await copy(pixValueToCopy);
    setPixCopied(true);
    showToast(temAsaasPix ? 'Código PIX copiado' : 'Chave PIX copiada');
    setTimeout(() => setPixCopied(false), 2200);
  };

  const onCopyBoleto = async () => {
    if (!cobranca.asaas?.boleto_barcode) return;
    await copy(cobranca.asaas.boleto_barcode);
    showToast('Linha digitável copiada');
  };

  const baixarBoleto = (e: React.MouseEvent) => {
    if (!cobranca.asaas?.boleto_url) {
      e.preventDefault();
      showToast('Boleto indisponível');
    }
  };

  const baixarExtrato = async () => {
    if (!token) return;
    try {
      const fnUrl = `${SUPABASE_URL}/functions/v1/cobranca-pdf?token=${encodeURIComponent(token)}`;
      const resp = await fetch(fnUrl, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY } });
      if (!resp.ok) { showToast('PDF indisponível'); return; }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cobranca-${cobranca.cliente_nome || token}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      showToast('PDF baixado');
    } catch {
      showToast('Erro ao baixar PDF');
    }
  };

  const tipoPrincipal = normalizarProcesso(cobranca.lancamentos[0]?.tipo_processo);
  const empresaPrincipal = cobranca.lancamentos[0]?.razao_social || cobranca.cliente_nome;
  const multiplosProcessos = cobranca.lancamentos.length > 1;

  return (
    <div className="cobranca-public">
      <div className="shell">
        <div className="top-bar"></div>

        <header className="header">
          <div className="header-inner">
            <a href="https://trevolegaliza.com.br" className="header-logo" aria-label="Trevo Legaliza">
              <img src={logoTrevo} alt="Trevo Legaliza" />
            </a>
            <span className={`status-pill ${statusPillClass}`}>
              <span className="status-dot"></span>
              {statusPillLabel}
            </span>
          </div>
        </header>

        <main>
          <div className="grid">
            {/* COLUNA ESQUERDA */}
            <div>
              <section className="card" style={{ marginBottom: 20 }}>
                <div className="card-hero">
                  <p className="hero-greet">Olá, <b>{saudacao}</b>. {isPaga ? 'Recebemos seu pagamento.' : 'Sua cobrança está pronta.'}</p>

                  {isPaga && (
                    <div className="paid-banner" role="status">
                      <div className="paid-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </div>
                      <div className="paid-text">
                        <b>Pagamento confirmado</b>
                        <span>Recebemos {fmtBRL(cobranca.total_geral)}{cobranca.pago_em ? ` em ${fmtDataHora(cobranca.pago_em)}` : ''}</span>
                      </div>
                    </div>
                  )}

                  <p className="hero-amount-label">{isPaga ? 'Valor pago' : 'Total a pagar'}</p>
                  <p className="hero-amount">{fmtBRL(cobranca.total_geral)}</p>

                  {!isPaga && cobranca.data_vencimento && dueText && (
                    <span className={`due ${dueClass}`}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                      <span>{dueText}</span>
                      <span className="due-sep"></span>
                      <b>{fmtData(cobranca.data_vencimento)}</b>
                    </span>
                  )}
                </div>

                {!isPaga && (
                  <div className="pay-block">
                    <div className="pay-tabs" role="tablist" aria-label="Forma de pagamento">
                      <button
                        className="pay-tab"
                        role="tab"
                        aria-selected={tab === 'pix'}
                        onClick={() => setTab('pix')}
                        tabIndex={tab === 'pix' ? 0 : -1}
                      >
                        <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                          <path d="M11.917 11.71a2.046 2.046 0 0 1-1.454-.602l-2.1-2.1a.4.4 0 0 0-.551 0l-2.108 2.108a2.044 2.044 0 0 1-1.454.602h-.414l2.66 2.66c.83.83 2.177.83 3.007 0l2.667-2.668h-.253zM4.25 4.282c.55 0 1.066.214 1.454.602l2.108 2.108a.39.39 0 0 0 .552 0l2.1-2.1a2.044 2.044 0 0 1 1.453-.602h.253L9.503 1.623a2.127 2.127 0 0 0-3.007 0l-2.66 2.66h.414z" />
                          <path d="m14.377 6.496-1.612-1.612a.307.307 0 0 1-.114.023h-.733c-.379 0-.75.154-1.017.422l-2.1 2.1a1.005 1.005 0 0 1-1.425 0L5.268 5.32a1.448 1.448 0 0 0-1.018-.422h-.9a.306.306 0 0 1-.109-.021L1.623 6.496c-.83.83-.83 2.177 0 3.008l1.618 1.618a.305.305 0 0 1 .108-.022h.901c.38 0 .75-.153 1.018-.421L7.375 8.57a1.034 1.034 0 0 1 1.426 0l2.1 2.1c.267.268.638.421 1.017.421h.733c.04 0 .079.01.114.024l1.612-1.612c.83-.83.83-2.178 0-3.008z" />
                        </svg>
                        PIX
                      </button>
                      {temBoleto && (
                        <button
                          className="pay-tab"
                          role="tab"
                          aria-selected={tab === 'boleto'}
                          onClick={() => setTab('boleto')}
                          tabIndex={tab === 'boleto' ? 0 : -1}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="6" y1="4" x2="6" y2="20" />
                            <line x1="10" y1="4" x2="10" y2="20" />
                            <line x1="14" y1="4" x2="14" y2="20" />
                            <line x1="18" y1="4" x2="18" y2="20" />
                          </svg>
                          Boleto
                        </button>
                      )}
                    </div>

                    {tab === 'pix' && (
                      <div className="pay-panel" data-active>
                        <div className="pix-row">
                          <div className="qr-box" aria-label="QR Code PIX">
                            {cobranca.asaas?.pix_qrcode ? (
                              <img src={`data:image/png;base64,${cobranca.asaas.pix_qrcode}`} alt="QR Code PIX" />
                            ) : (
                              <QRCodeSVG value={pixValueToCopy} size={180} level="M" />
                            )}
                          </div>
                          <div className="pix-info">
                            <div>
                              <div className="pix-label">{temAsaasPix ? 'PIX Copia e Cola' : 'Chave PIX'}</div>
                              <div className="pix-code">{pixValueToCopy}</div>
                            </div>
                            <button className={`btn btn-primary btn-w-full ${pixCopied ? 'copied' : ''}`} onClick={onCopyPix}>
                              {pixCopied ? (
                                <>
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                  <span>Código copiado</span>
                                </>
                              ) : (
                                <>
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                  </svg>
                                  <span>Copiar código PIX</span>
                                </>
                              )}
                            </button>
                            <p className="pix-help">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                              </svg>
                              Pagamento confirmado em segundos. Cole no app do seu banco ou escaneie o QR.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {tab === 'boleto' && temBoleto && (
                      <div className="pay-panel" data-active>
                        {cobranca.asaas?.boleto_barcode && (
                          <>
                            <div className="pix-label" style={{ marginBottom: 8 }}>Linha digitável</div>
                            <div className="boleto-line">
                              <code>{cobranca.asaas.boleto_barcode}</code>
                            </div>
                          </>
                        )}
                        <div className="boleto-actions">
                          <a href={cobranca.asaas?.boleto_url || '#'} target="_blank" rel="noopener" onClick={baixarBoleto} className="btn btn-secondary">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            Baixar boleto em PDF
                          </a>
                          {cobranca.asaas?.boleto_barcode && (
                            <button className="btn btn-secondary" onClick={onCopyBoleto}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                              Copiar linha digitável
                            </button>
                          )}
                        </div>
                        <p className="pix-help" style={{ marginTop: 14 }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                          Compensação em até 2 dias úteis. Para confirmação imediata, recomendamos o PIX.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </section>

              <p className="trust-line">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Pagamento processado em ambiente seguro
              </p>
            </div>

            {/* COLUNA DIREITA */}
            <div>
              <section className="side-section">
                <h2 className="side-title">Detalhes da cobrança</h2>
                <div className="detail-card">
                  {cobranca.lancamentos.map((l, idx) => (
                    <div className="detail-row" key={l.id || idx}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p className="detail-name">{l.razao_social || l.descricao}</p>
                        {l.tipo_processo && <span className="detail-tag">{l.tipo_processo}</span>}
                      </div>
                      <span className="detail-amount">{fmtBRL(l.valor)}</span>
                    </div>
                  ))}
                  <div className="detail-divider"></div>
                  <div className="detail-total">
                    <span className="lbl">Total</span>
                    <span className="val">{fmtBRL(cobranca.total_geral)}</span>
                  </div>
                </div>
              </section>

              <section className="side-section">
                <h2 className="side-title">Precisa de ajuda?</h2>
                <div className="dani-card">
                  <div className="dani-head">
                    <div className="dani-avatar">
                      <img src={daniAvatar} alt="" />
                    </div>
                    <div className="dani-meta">
                      <span className="dani-role">Digital Assistant for National Incorporation</span>
                    </div>
                  </div>
                  <p className="dani-msg">
                    {multiplosProcessos ? (
                      <>Tem dúvida referente aos <b>processos desta cobrança</b> ou sobre essa cobrança? Posso te ajudar agora.</>
                    ) : tipoPrincipal ? (
                      <>Tem dúvida referente ao processo de <b>{tipoPrincipal} da {empresaPrincipal}</b> ou sobre essa cobrança? Posso te ajudar agora.</>
                    ) : (
                      <>Posso te ajudar com qualquer dúvida sobre essa cobrança.</>
                    )}
                  </p>
                  <a
                    href={`https://wa.me/${empresa.whatsapp}?text=${encodeURIComponent(`Oi Dani, tenho uma dúvida sobre a cobrança ${cobrancaShortId(cobranca.id)}`)}`}
                    target="_blank"
                    rel="noopener"
                    className="btn-whatsapp"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.149-.174.198-.298.298-.496.099-.198.05-.372-.025-.521-.074-.149-.669-1.611-.916-2.206-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                    </svg>
                    Falar com a Dani no WhatsApp
                  </a>
                </div>
              </section>

              <section className="side-section">
                <h2 className="side-title">
                  Histórico
                  <button className="side-title-link" onClick={baixarExtrato}>Baixar PDF</button>
                </h2>
                <div className="detail-card" style={{ padding: '14px 16px' }}>
                  <p className="pix-help" style={{ margin: 0 }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    Esta é a primeira cobrança que você recebe da Trevo Legaliza.
                  </p>
                </div>
              </section>
            </div>
          </div>

          <div className="meta-bar">
            <span>Cobrança <b>{cobrancaShortId(cobranca.id)}</b></span>
            <span className="meta-sep"></span>
            <span>Emitida em {fmtDataHora(cobranca.created_at)}</span>
          </div>
        </main>

        <footer>
          <div className="footer-inner">
            <div className="footer-brands">
              <div className="footer-brand footer-brand-trevo">
                <img src={logoTrevo} alt="Trevo Legaliza" />
              </div>
              <div className="footer-divider"></div>
              <div className="footer-brand footer-brand-dani">
                <div className="footer-dani-row">
                  <img src={logoDani} alt="dani" />
                  <span className="footer-dani-reg">®</span>
                </div>
                <span className="footer-brand-cap">Powered by Trevo Legaliza</span>
              </div>
            </div>
            <p className="footer-text">
              <b>{empresa.nome}</b> · CNPJ {empresa.cnpj} · {empresa.site}
            </p>
          </div>
        </footer>
      </div>

      {toastMsg && (
        <div className="toast show" role="status" aria-live="polite">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
