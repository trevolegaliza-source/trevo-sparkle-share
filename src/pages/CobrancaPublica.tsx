import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/client';
import { Loader2, AlertCircle, XCircle } from 'lucide-react';
import logoTrevo from '@/assets/logo-trevo-legaliza.png';
import logoDani from '@/assets/dani-logo-dark.png';
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

const fmtDataExtenso = (iso: string | null | undefined) => {
  if (!iso) return '';
  const isDateOnly = typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const d = isDateOnly ? new Date(iso + 'T00:00:00') : new Date(iso);
  return d.toLocaleDateString('pt-BR', { weekday: 'long' });
};

const fmtDataHora = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).replace(',', ' ·');
};

const cobrancaShortId = (id: string) => `#${id.slice(0, 6)}`;

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
    const image = 'https://cobranca.trevolegaliza.com/og-cobranca.png';
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
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:site_name', 'Trevo Legaliza');
    setMeta('name', 'description', description);
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', image);
  }, [cobranca]);

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

  // Status pill (header)
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const venc = cobranca.data_vencimento ? new Date(cobranca.data_vencimento + 'T00:00:00') : null;
  const diffDias = venc ? Math.floor((venc.getTime() - hoje.getTime()) / 86400000) : null;
  let statusPillClass = '';
  let statusPillLabel = 'Cobrança ativa';
  if (isPaga) { statusPillLabel = 'Cobrança paga'; }
  else if (diffDias !== null && diffDias < 0) { statusPillClass = 'danger'; statusPillLabel = `Em atraso · ${Math.abs(diffDias)}d`; }
  else if (diffDias !== null && diffDias === 0) { statusPillClass = 'warning'; statusPillLabel = 'Vence hoje'; }
  else if (diffDias !== null && diffDias === 1) { statusPillClass = 'warning'; statusPillLabel = 'Vence amanhã'; }

  const valorFmt = cobranca.total_geral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

  return (
    <div className="cobranca-public">
      <div className="shell">
        <div className="top-bar"></div>

        <header className="header">
          <div className="header-inner">
            <a href="#" className="header-logo" aria-label="Trevo Legaliza">
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
              <section className="card card-hud" style={{ marginBottom: 20 }}>
                {isPaga && (
                  <div className="paid-banner">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    Pagamento confirmado{cobranca.pago_em ? ` em ${fmtData(cobranca.pago_em)}` : ''}
                  </div>
                )}
                <div className="card-hero">
                  <div className="hero-meta">
                    <span>Cobrança</span>
                    <span className="hero-meta-dot"></span>
                    <span>{cobrancaShortId(cobranca.id)}</span>
                    <span className="hero-meta-dot"></span>
                    <span>Emitida {fmtData(cobranca.created_at)}</span>
                  </div>
                  <p className="hero-greet">Olá, <b>{saudacao}</b>. {isPaga ? 'Recebemos seu pagamento.' : 'Sua cobrança está pronta.'}</p>
                  <p className="hero-amount-label">{isPaga ? 'Valor pago' : 'Total a pagar'}</p>
                  <p className="hero-amount">
                    <span className="currency">R$</span>
                    <span>{valorFmt}</span>
                  </p>
                  {!isPaga && cobranca.data_vencimento && (
                    <p className="hero-due">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                      Vence em <b>{fmtData(cobranca.data_vencimento)}</b> ({fmtDataExtenso(cobranca.data_vencimento)})
                    </p>
                  )}
                </div>

                {!isPaga && (
                  <div className="pay-block" style={{ borderTop: '1px dashed var(--border)', paddingTop: 24 }}>
                    <div className="pay-tabs" role="tablist">
                      <button className="pay-tab" role="tab" aria-selected={tab === 'pix'} onClick={() => setTab('pix')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M16 6l-4 4-4-4M8 18l4-4 4 4M6 8l-4 4 4 4M18 16l4-4-4-4" />
                        </svg>
                        PIX
                      </button>
                      {temBoleto && (
                        <button className="pay-tab" role="tab" aria-selected={tab === 'boleto'} onClick={() => setTab('boleto')}>
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
                              <button className="icon-btn" onClick={onCopyBoleto} aria-label="Copiar linha digitável">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                </svg>
                              </button>
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

              {/* Trust strip */}
              <div className="trust">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
                Cobrança emitida por <b>&nbsp;Trevo Legaliza</b>&nbsp;·&nbsp;ambiente protegido por criptografia e validação bancária
              </div>

              <button className="btn btn-secondary btn-w-full" style={{ marginTop: 16 }} onClick={baixarExtrato}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Baixar extrato em PDF
              </button>
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
                      <span className="detail-amount">{`R$\u00a0${l.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</span>
                    </div>
                  ))}
                  <div className="detail-divider"></div>
                  <div className="detail-total">
                    <span className="lbl">Total</span>
                    <span className="val">{`R$\u00a0${valorFmt}`}</span>
                  </div>
                </div>
              </section>

              <section className="side-section">
                <h2 className="side-title">Sua atendente IA</h2>
                <div className="dani-card">
                  <div className="dani-head">
                    <div className="dani-avatar">
                      <img src={logoDani} alt="dani.ai" />
                    </div>
                    <div className="dani-meta">
                      <span className="dani-name"><b>dani.ai</b> — Powered by Trevo Legaliza</span>
                      <span className="dani-role">Online · 24h</span>
                    </div>
                  </div>
                  <p className="dani-msg">
                    Eu gerei esta cobrança e sigo acompanhando seu processo. Qualquer dúvida sobre o pagamento ou o andamento, é só chamar.
                  </p>
                  <a href={`https://wa.me/${empresa.whatsapp}`} target="_blank" rel="noopener" className="btn-whatsapp">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.149-.174.198-.298.298-.496.099-.198.05-.372-.025-.521-.074-.149-.669-1.611-.916-2.206-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                    </svg>
                    Falar com a Dani no WhatsApp
                  </a>
                </div>
              </section>
            </div>
          </div>

          <div className="meta-bar">
            <span>Cobrança&nbsp;<span className="id">{cobrancaShortId(cobranca.id)}</span></span>
            <span>Emitida em {fmtDataHora(cobranca.created_at)}</span>
          </div>
        </main>

        <footer>
          <div className="footer-inner">
            <div className="footer-brands">
              <div className="footer-brand footer-brand-dani">
                <img src={logoDani} alt="dani.ai" />
                <span className="footer-brand-cap">dani<span className="reg">®</span>.ai</span>
              </div>
              <div className="footer-divider"></div>
              <div className="footer-brand">
                <img src={logoTrevo} alt="Trevo Legaliza" />
                <span className="footer-brand-cap">Powered by <b>Trevo Legaliza<span className="reg">®</span></b></span>
              </div>
            </div>
            <p className="footer-text">
              <b>{empresa.nome}</b><br />
              CNPJ {empresa.cnpj} · {empresa.site}
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
