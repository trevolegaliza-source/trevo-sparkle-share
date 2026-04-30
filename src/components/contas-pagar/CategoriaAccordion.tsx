import { useState, useCallback, useEffect } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, CheckCircle, AlertTriangle, Clock, Check, MessageCircle, Key, Copy, Eye, Download } from 'lucide-react';
import { CATEGORIAS_DESPESAS, type CategoriaKey } from '@/constants/categorias-despesas';
import { useColaboradores } from '@/hooks/useColaboradores';
import AvisarColaboradorModal from './AvisarColaboradorModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import * as LucideIcons from 'lucide-react';

interface Props {
  lancamentos: any[];
  onEdit: (l: any) => void;
  onMarcarPago: (l: any) => void;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

type Urgencia = 'pago' | 'atrasado' | 'urgente' | 'normal';

function getUrgencia(l: any): Urgencia {
  if (l.status === 'pago') return 'pago';
  const hoje = new Date().toISOString().split('T')[0];
  if (l.status === 'atrasado' || (l.status === 'pendente' && l.data_vencimento < hoje)) return 'atrasado';
  const em7dias = new Date();
  em7dias.setDate(em7dias.getDate() + 7);
  const limite7 = em7dias.toISOString().split('T')[0];
  if (l.status === 'pendente' && l.data_vencimento <= limite7) return 'urgente';
  return 'normal';
}

function getStatusBadge(l: any) {
  const urgencia = getUrgencia(l);
  if (urgencia === 'pago') return <Badge className="bg-primary/15 text-primary border-0 text-[10px]">Pago</Badge>;
  if (urgencia === 'atrasado') return <Badge className="bg-destructive/15 text-destructive border-0 text-[10px]">Vencido</Badge>;
  if (urgencia === 'urgente') return <Badge className="bg-warning/15 text-warning border-0 text-[10px]">Pendente</Badge>;
  return <Badge className="bg-warning/15 text-warning border-0 text-[10px]">Pendente</Badge>;
}

function getRowStyle(urgencia: Urgencia): { bg: string; borderLeft: string; textClass: string } {
  switch (urgencia) {
    case 'pago':
      return { bg: '#F0FDF4', borderLeft: '', textClass: 'text-green-300' };
    case 'atrasado':
      return { bg: '#FEF2F2', borderLeft: '3px solid #EF4444', textClass: '' };
    case 'urgente':
      return { bg: '#FFFBEB', borderLeft: '3px solid #F59E0B', textClass: '' };
    default:
      return { bg: '', borderLeft: '', textClass: '' };
  }
}

function StatusIcon({ urgencia }: { urgencia: Urgencia }) {
  if (urgencia === 'pago') return <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />;
  if (urgencia === 'atrasado') return <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />;
  if (urgencia === 'urgente') return <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
  return null;
}

function PixInfo({ colaborador }: { colaborador: any | null }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!colaborador?.pix_chave) return;
    navigator.clipboard.writeText(colaborador.pix_chave);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [colaborador?.pix_chave]);

  if (!colaborador) return null;

  const pixTipo = colaborador.pix_tipo ? colaborador.pix_tipo : 'Chave';
  const pixChave = colaborador.pix_chave;

  return (
    <p className="flex items-center gap-1.5">
      <Key className="h-3 w-3 shrink-0" />
      {pixChave ? (
        <>
          <span>PIX ({pixTipo.toUpperCase()}): {pixChave}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 text-[10px] font-semibold uppercase"
            onClick={handleCopy}
          >
            {copied ? (
              <span className="flex items-center gap-0.5 text-green-600"><Check className="h-3 w-3" /> COPIADO!</span>
            ) : (
              <span className="flex items-center gap-0.5"><Copy className="h-3 w-3" /> COPIAR</span>
            )}
          </Button>
        </>
      ) : (
        <span className="italic">PIX: NÃO CADASTRADO</span>
      )}
    </p>
  );
}

function ComprovanteLightbox({ open, onClose, lancamento }: { open: boolean; onClose: () => void; lancamento: any }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const comprovanteUrl = lancamento?.comprovante_url || lancamento?.url_comprovante;
  const ext = comprovanteUrl?.split('.').pop()?.toLowerCase() || '';
  const isImage = ['png', 'jpg', 'jpeg', 'webp'].includes(ext);

  const colabName = (() => {
    const parts = (lancamento?.descricao || '').split('—');
    return parts.length > 1 ? parts[parts.length - 1].trim().toUpperCase() : (lancamento?.descricao || '').toUpperCase();
  })();
  const subcatLabel = (lancamento?.subcategoria || 'PAGAMENTO').toUpperCase();
  const dateStr = lancamento?.data_vencimento ? new Date(lancamento.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR') : '';

  useEffect(() => {
    if (!open || !comprovanteUrl) { setBlobUrl(null); return; }
    setLoading(true);
    let revoke: string | null = null;

    // Try contratos bucket first (where uploads go), then documentos as fallback
    const tryDownload = async () => {
      for (const bucket of ['contratos', 'documentos']) {
        const { data, error } = await supabase.storage.from(bucket).download(comprovanteUrl);
        if (data && !error) {
          const url = URL.createObjectURL(data);
          revoke = url;
          setBlobUrl(url);
          setLoading(false);
          return;
        }
      }
      // If direct download fails, try createSignedUrl
      const { data: signedData } = await supabase.storage.from('contratos').createSignedUrl(comprovanteUrl, 3600);
      if (signedData?.signedUrl) {
        setBlobUrl(signedData.signedUrl);
      }
      setLoading(false);
    };
    tryDownload();

    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [open, comprovanteUrl]);

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `comprovante-${colabName}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-[80vw] max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogDescription className="sr-only">Visualização do comprovante</DialogDescription>
        <DialogHeader className="px-6 py-3 border-b border-border/60 shrink-0">
          <DialogTitle className="uppercase text-sm">COMPROVANTE · {colabName}</DialogTitle>
          <p className="text-xs text-muted-foreground uppercase">{subcatLabel} · {dateStr}</p>
        </DialogHeader>
        <div className="flex-1 min-h-0 flex items-center justify-center p-4 bg-muted/10 overflow-auto">
          {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {!loading && blobUrl && isImage && (
            <img src={blobUrl} alt="Comprovante" className="max-w-full max-h-[70vh] object-contain rounded-md" />
          )}
          {!loading && blobUrl && !isImage && (
            <iframe src={blobUrl} className="w-full h-[70vh] border-0 rounded-md" title="Comprovante" />
          )}
          {!loading && !blobUrl && <p className="text-sm text-muted-foreground">Não foi possível carregar o comprovante.</p>}
        </div>
        <DialogFooter className="px-6 py-3 border-t border-border/60">
          <Button variant="outline" onClick={handleDownload} disabled={!blobUrl} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> BAIXAR
          </Button>
          <Button variant="outline" onClick={onClose}>FECHAR</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DateWithIcon({ l, urgencia }: { l: any; urgencia: Urgencia }) {
  const dateStr = new Date(l.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR');
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      {(urgencia === 'urgente' || urgencia === 'atrasado') && <StatusIcon urgencia={urgencia} />}
      {l.fornecedor && `${l.fornecedor} • `}
      {dateStr}
    </span>
  );
}

function sortByStatusThenDate(items: any[]): any[] {
  return [...items].sort((a, b) => {
    const ua = getUrgencia(a);
    const ub = getUrgencia(b);
    const order: Record<Urgencia, number> = { pago: 0, atrasado: 1, urgente: 2, normal: 3 };
    if (order[ua] !== order[ub]) return order[ua] - order[ub];
    return a.data_vencimento.localeCompare(b.data_vencimento);
  });
}

function SubGroupCounters({ items }: { items: any[] }) {
  const pagos = items.filter(l => l.status === 'pago').length;
  const pendentes = items.length - pagos;
  return (
    <span className="flex items-center gap-2 text-[11px]">
      {pagos > 0 && (
        <span className="flex items-center gap-0.5 text-green-600 font-medium">
          <Check className="h-3 w-3" /> {pagos} pago{pagos > 1 ? 's' : ''}
        </span>
      )}
      {pendentes > 0 && (
        <span className="flex items-center gap-0.5 text-amber-600 font-medium">
          ⏳ {pendentes} pendente{pendentes > 1 ? 's' : ''}
        </span>
      )}
    </span>
  );
}

function LancamentoRow({ l, onEdit, onMarcarPago }: { l: any; onEdit: (l: any) => void; onMarcarPago: (l: any) => void }) {
  const urgencia = getUrgencia(l);
  const style = getRowStyle(urgencia);
  return (
    <div
      className="flex items-center justify-between py-2.5 px-2 gap-3 rounded-md"
      style={{ backgroundColor: style.bg, borderLeft: style.borderLeft }}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {urgencia === 'pago' && <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />}
        <div className="min-w-0">
          <p className={`text-sm font-medium truncate ${urgencia === 'pago' ? 'text-green-300' : 'text-foreground'}`}>
            {l.descricao}
          </p>
          <DateWithIcon l={l} urgencia={urgencia} />
        </div>
      </div>
      <span className={`font-bold text-sm whitespace-nowrap ${urgencia === 'pago' ? 'text-green-300' : 'text-foreground'}`}>
        {fmt(Number(l.valor))}
      </span>
      {getStatusBadge(l)}
      <div className="flex gap-1">
        {l.status === 'pendente' && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onMarcarPago(l)}>
            <CheckCircle className="h-3.5 w-3.5 text-primary" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(l)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// Unified VT+VR "Benefícios" row
function BeneficiosRow({
  vtItem,
  vrItem,
  colaborador,
  onEdit,
  onMarcarPago,
}: {
  vtItem: any | null;
  vrItem: any | null;
  colaborador: any | null;
  onEdit: (l: any) => void;
  onMarcarPago: (l: any) => void;
}) {
  const [showAvisar, setShowAvisar] = useState(false);
  const [showComprovante, setShowComprovante] = useState<any>(null);
  const items = [vtItem, vrItem].filter(Boolean);
  const totalValor = items.reduce((s, i) => s + Number(i.valor), 0);
  const anyPendente = items.some(i => i.status !== 'pago');
  const allPago = items.every(i => i.status === 'pago');
  const representativeItem = anyPendente ? items.find(i => i.status !== 'pago') || items[0] : items[0];
  const urgencia = anyPendente ? getUrgencia(representativeItem) : 'pago';
  const style = getRowStyle(urgencia);

  const cleanName = (desc: string) => {
    const parts = desc.split('—');
    return parts.length > 1 ? parts[parts.length - 1].trim() : parts[0].trim();
  };
  const displayName = vtItem ? cleanName(vtItem.descricao) : vrItem ? cleanName(vrItem.descricao) : colaborador?.nome || 'Colaborador';

  const vtDiario = colaborador?.vt_diario || 0;
  const vrDiario = colaborador?.vr_diario || 0;
  const vtDias = vtItem && vtDiario > 0 ? Math.round(Number(vtItem.valor) / vtDiario) : 0;
  const vrDias = vrItem && vrDiario > 0 ? Math.round(Number(vrItem.valor) / vrDiario) : 0;

  const vencimento = vtItem?.data_vencimento || vrItem?.data_vencimento;

  // Build title parts
  const benefParts: string[] = [];
  if (vtItem) benefParts.push('VT');
  if (vrItem) benefParts.push('VR');
  const days = vtDias || vrDias;
  const titleSuffix = benefParts.join(' + ') + (days > 0 ? ` (${days}d)` : '');

  return (
    <>
      <div
        className="py-2.5 px-2 rounded-md space-y-1"
        style={{ backgroundColor: style.bg, borderLeft: style.borderLeft }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {urgencia === 'pago' && <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />}
            <p className={`text-sm font-medium truncate uppercase ${urgencia === 'pago' ? 'text-green-300' : 'text-foreground'}`}>
              BENEFÍCIOS — {titleSuffix} - {displayName}
            </p>
          </div>
          <span className={`font-bold text-sm whitespace-nowrap ${urgencia === 'pago' ? 'text-green-300' : 'text-foreground'}`}>
            {fmt(totalValor)}
          </span>
          {getStatusBadge(representativeItem)}
          <div className="flex gap-1">
            {allPago && (
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Avisar colaborador" onClick={() => setShowAvisar(true)}>
                <MessageCircle className="h-3.5 w-3.5 text-green-600" />
              </Button>
            )}
            {(() => {
              const comprovanteItem = (vtItem && (vtItem.comprovante_url || vtItem.url_comprovante)) ? vtItem
                : (vrItem && (vrItem.comprovante_url || vrItem.url_comprovante)) ? vrItem
                : null;
              return comprovanteItem ? (
                <Button variant="ghost" size="icon" className="h-7 w-7" title="Ver comprovante" onClick={() => setShowComprovante(comprovanteItem)}>
                  <Eye className="h-3.5 w-3.5 text-blue-500" />
                </Button>
              ) : null;
            })()}
            {items.map(item => (
              item.status === 'pendente' && (
                <Button key={`pay-${item.id}`} variant="ghost" size="icon" className="h-7 w-7" title={`Pagar ${item.subcategoria}`} onClick={() => onMarcarPago(item)}>
                  <CheckCircle className="h-3.5 w-3.5 text-primary" />
                </Button>
              )
            ))}
            {items.map(item => (
              <Button key={`edit-${item.id}`} variant="ghost" size="icon" className="h-7 w-7" title={`Editar ${item.subcategoria}`} onClick={() => onEdit(item)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            ))}
          </div>
        </div>
        <div className={`text-xs pl-6 space-y-0.5 uppercase ${urgencia === 'pago' ? 'text-green-300' : 'text-muted-foreground'}`}>
          {vtItem && (
            <p>VT: {fmt(vtDiario)}/DIA × {vtDias} DIAS = {fmt(Number(vtItem.valor))}</p>
          )}
          {vrItem && (
            <p>VR: {fmt(vrDiario)}/DIA × {vrDias} DIAS = {fmt(Number(vrItem.valor))}</p>
          )}
          {vencimento && (
            <p className="flex items-center gap-1">
              {(urgencia === 'urgente' || urgencia === 'atrasado') && <StatusIcon urgencia={urgencia} />}
              VENCIMENTO: {new Date(vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}
            </p>
           )}
          {urgencia !== 'pago' && <PixInfo colaborador={colaborador} />}
        </div>
      </div>
      <AvisarColaboradorModal
        open={showAvisar}
        onClose={() => setShowAvisar(false)}
        lancamento={representativeItem}
        colaborador={colaborador}
        vtItem={vtItem}
        vrItem={vrItem}
      />
      <ComprovanteLightbox
        open={!!showComprovante}
        onClose={() => setShowComprovante(null)}
        lancamento={showComprovante}
      />
    </>
  );
}

const SUBCATEGORIA_ORDER = ['Adiantamento', 'Salário', 'Benefícios', '13º Salário (Provisão)', 'DAS Colaborador', 'Férias (Provisão)', 'FGTS', 'INSS'];

const DIAS_SEMANA = ['DOMINGO', 'SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SÁBADO'];

type DateGroupUrgency = 'atrasado' | 'urgente' | 'normal' | 'pago';

function getDateGroupUrgency(dateStr: string, items: any[]): DateGroupUrgency {
  const allPago = items.every(l => l.status === 'pago');
  if (allPago) return 'pago';
  const hoje = new Date().toISOString().split('T')[0];
  if (dateStr <= hoje) return 'atrasado';
  const em7dias = new Date();
  em7dias.setDate(em7dias.getDate() + 7);
  const limite7 = em7dias.toISOString().split('T')[0];
  if (dateStr <= limite7) return 'urgente';
  return 'normal';
}

function getDateGroupSortKey(dateStr: string, urgency: DateGroupUrgency): number {
  // 1=atrasado, 2=urgente, 3=normal, 4=pago
  const map: Record<DateGroupUrgency, number> = { atrasado: 1, urgente: 2, normal: 3, pago: 4 };
  return map[urgency];
}

function getDateGroupIcon(urgency: DateGroupUrgency) {
  switch (urgency) {
    case 'atrasado': return <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />;
    case 'urgente': return <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
    case 'normal': return <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
    case 'pago': return <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />;
  }
}

function DateGroupHeader({ dateStr, total, items, urgency }: { dateStr: string; total: number; items: any[]; urgency: DateGroupUrgency }) {
  const date = new Date(dateStr + 'T12:00:00');
  const formatted = date.toLocaleDateString('pt-BR');
  const diaSemana = DIAS_SEMANA[date.getDay()];
  const pagos = items.filter(l => l.status === 'pago').length;
  const pendentes = items.length - pagos;

  return (
    <div className="flex items-center gap-2 w-full flex-wrap">
      {getDateGroupIcon(urgency)}
      <span className="font-medium text-foreground uppercase text-sm">{formatted} · {diaSemana}</span>
      <span className="ml-auto mr-2 font-bold text-sm text-foreground">{fmt(total)}</span>
      <span className="flex items-center gap-2 text-[11px]">
        {pagos > 0 && (
          <span className="flex items-center gap-0.5 text-green-600 font-medium uppercase">
            <Check className="h-3 w-3" /> {pagos} {pagos === 1 ? 'PAGO' : 'PAGOS'}
          </span>
        )}
        {pendentes > 0 && (
          <span className={`flex items-center gap-0.5 font-medium uppercase ${urgency === 'atrasado' ? 'text-destructive' : urgency === 'urgente' ? 'text-amber-600' : 'text-muted-foreground'}`}>
            {urgency === 'atrasado' ? '⚠' : urgency === 'urgente' ? '⏰' : '⏳'} {pendentes} {pendentes === 1 ? 'PENDENTE' : 'PENDENTES'}
          </span>
        )}
      </span>
    </div>
  );
}

function isVtVr(l: any): boolean {
  const sub = (l.subcategoria || '').toLowerCase();
  return sub.includes('vt') || sub.includes('vr') || sub.includes('vale transporte') || sub.includes('vale refeição') || sub.includes('transporte') || sub.includes('refeição');
}

function getSubcatLabel(l: any): string {
  if (isVtVr(l)) return 'BENEFÍCIOS';
  return (l.subcategoria || 'OUTROS').toUpperCase();
}

function getColabName(desc: string): string {
  const parts = desc.split('—');
  return parts.length > 1 ? parts[parts.length - 1].trim().toUpperCase() : desc.toUpperCase();
}

function FolhaSubgrupos({ items, onEdit, onMarcarPago }: { items: any[]; onEdit: (l: any) => void; onMarcarPago: (l: any) => void }) {
  const [avisarTarget, setAvisarTarget] = useState<any>(null);
  const [comprovanteTarget, setComprovanteTarget] = useState<any>(null);
  const { data: colaboradores } = useColaboradores();

  // Group by date
  const byDate: Record<string, any[]> = {};
  items.forEach(l => {
    const d = l.data_vencimento;
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(l);
  });

  // Sort date groups
  const sortedDates = Object.keys(byDate).sort((a, b) => {
    const ua = getDateGroupUrgency(a, byDate[a]);
    const ub = getDateGroupUrgency(b, byDate[b]);
    const ka = getDateGroupSortKey(a, ua);
    const kb = getDateGroupSortKey(b, ub);
    if (ka !== kb) return ka - kb;
    // Within same urgency group
    if (ua === 'pago') return b.localeCompare(a); // most recent first for paid
    return a.localeCompare(b); // earliest first for others
  });

  // Determine default open groups (those with any pending)
  const defaultOpen = sortedDates.filter(d => {
    const urgency = getDateGroupUrgency(d, byDate[d]);
    return urgency !== 'pago';
  });

  // Build beneficios unified rows for a set of VT/VR items
  const buildBeneficiosRows = (vtVrRaw: any[]) => {
    const byColab: Record<string, { vt: any | null; vr: any | null }> = {};
    vtVrRaw.forEach(l => {
      const key = l.colaborador_id || 'none';
      if (!byColab[key]) byColab[key] = { vt: null, vr: null };
      const sub = (l.subcategoria || '').toLowerCase();
      if (sub.includes('vt') || sub.includes('vale transporte') || sub.includes('transporte')) {
        byColab[key].vt = l;
      } else if (sub.includes('vr') || sub.includes('vale refeição') || sub.includes('refeição')) {
        byColab[key].vr = l;
      }
    });
    return Object.values(byColab);
  };

  // Render items within a date group, sorted: pendentes first, pagos last; grouped by subcategoria label
  const renderDateItems = (dateItems: any[]) => {
    // Sort: pendentes/atrasados first, pagos last
    const sorted = [...dateItems].sort((a, b) => {
      const aP = a.status === 'pago' ? 1 : 0;
      const bP = b.status === 'pago' ? 1 : 0;
      if (aP !== bP) return aP - bP;
      // Then by subcategoria order
      const sa = SUBCATEGORIA_ORDER.indexOf(getSubcatLabel(a) === 'BENEFÍCIOS' ? 'Benefícios' : (a.subcategoria || ''));
      const sb = SUBCATEGORIA_ORDER.indexOf(getSubcatLabel(b) === 'BENEFÍCIOS' ? 'Benefícios' : (b.subcategoria || ''));
      return (sa === -1 ? 99 : sa) - (sb === -1 ? 99 : sb);
    });

    // Separate VT/VR for unified display
    const vtVrItems = sorted.filter(l => isVtVr(l));
    const regularItems = sorted.filter(l => !isVtVr(l));

    // Determine where to insert beneficios rows (at the position of Benefícios in SUBCATEGORIA_ORDER)
    const beneficiosRows = vtVrItems.length > 0 ? buildBeneficiosRows(vtVrItems) : [];

    return (
      <div className="space-y-1">
        {regularItems.map((l: any) => {
          const urgencia = getUrgencia(l);
          const style = getRowStyle(urgencia);
          const subcatLabel = getSubcatLabel(l);
          const colabName = getColabName(l.descricao);
            return (
              <div
                key={l.id}
                className="py-2.5 px-2 rounded-md space-y-1"
                style={{ backgroundColor: style.bg, borderLeft: style.borderLeft }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {urgencia === 'pago' && <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />}
                    <p className={`text-sm font-medium truncate uppercase ${urgencia === 'pago' ? 'text-green-300' : 'text-foreground'}`}>
                      {subcatLabel} · {colabName}
                    </p>
                  </div>
                  <span className={`font-bold text-sm whitespace-nowrap ${urgencia === 'pago' ? 'text-green-300' : 'text-foreground'}`}>
                    {fmt(Number(l.valor))}
                  </span>
                  {getStatusBadge(l)}
                  <div className="flex gap-1">
                    {(l.comprovante_url || l.url_comprovante) && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Ver comprovante" onClick={() => setComprovanteTarget(l)}>
                        <Eye className="h-3.5 w-3.5 text-blue-500" />
                      </Button>
                    )}
                    {l.status === 'pago' && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Avisar colaborador" onClick={() => setAvisarTarget(l)}>
                        <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                      </Button>
                    )}
                    {l.status === 'pendente' && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onMarcarPago(l)}>
                        <CheckCircle className="h-3.5 w-3.5 text-primary" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(l)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {urgencia !== 'pago' && l.colaborador_id && (() => {
                  const colab = colaboradores?.find(c => c.id === l.colaborador_id) || null;
                  return (
                    <div className="text-xs pl-6 text-muted-foreground uppercase">
                      <PixInfo colaborador={colab} />
                    </div>
                  );
                })()}
              </div>
            );
        })}
        {beneficiosRows.map((pair, idx) => {
          const colabId = pair.vt?.colaborador_id || pair.vr?.colaborador_id;
          const colab = colaboradores?.find(c => c.id === colabId) || null;
          return (
            <BeneficiosRow
              key={`ben-${idx}`}
              vtItem={pair.vt}
              vrItem={pair.vr}
              colaborador={colab}
              onEdit={onEdit}
              onMarcarPago={onMarcarPago}
            />
          );
        })}
      </div>
    );
  };

  const avisarColab = avisarTarget ? colaboradores?.find(c => c.id === avisarTarget.colaborador_id) || undefined : undefined;

  return (
    <>
      <Accordion type="multiple" defaultValue={defaultOpen} className="space-y-1">
        {sortedDates.map(dateStr => {
          const dateItems = byDate[dateStr];
          const urgency = getDateGroupUrgency(dateStr, dateItems);
          const total = dateItems.reduce((s: number, l: any) => s + Number(l.valor), 0);

          return (
            <AccordionItem key={dateStr} value={dateStr} className="border rounded-md overflow-hidden">
              <AccordionTrigger className="px-3 py-2 hover:no-underline text-sm">
                <DateGroupHeader dateStr={dateStr} total={total} items={dateItems} urgency={urgency} />
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-2">
                {renderDateItems(dateItems)}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
      <AvisarColaboradorModal
        open={!!avisarTarget}
        onClose={() => setAvisarTarget(null)}
        lancamento={avisarTarget}
        colaborador={avisarColab}
      />
      <ComprovanteLightbox
        open={!!comprovanteTarget}
        onClose={() => setComprovanteTarget(null)}
        lancamento={comprovanteTarget}
      />
    </>
  );
}

export default function CategoriaAccordion({ lancamentos, onEdit, onMarcarPago }: Props) {
  const categorias = Object.entries(CATEGORIAS_DESPESAS) as [CategoriaKey, typeof CATEGORIAS_DESPESAS[CategoriaKey]][];

  const grouped = categorias.map(([key, cat]) => {
    const items = lancamentos.filter(l => (l.categoria || 'outros') === key);
    const total = items.reduce((s: number, l: any) => s + Number(l.valor), 0);
    return { key, cat, items, total };
  });

  return (
    <Accordion type="multiple" className="space-y-2">
      {grouped.map(({ key, cat, items, total }) => {
        const IconComp = (LucideIcons as any)[cat.icon] || LucideIcons.Circle;
        const hasItems = items.length > 0;

        return (
          <AccordionItem
            key={key}
            value={key}
            className={`border rounded-lg overflow-hidden ${!hasItems ? 'opacity-50' : ''}`}
            style={{ borderLeftWidth: '4px', borderLeftColor: cat.color }}
          >
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-3 w-full">
                <IconComp className="h-4 w-4 shrink-0" style={{ color: cat.color }} />
                <span className="font-semibold text-sm text-foreground">{cat.label}</span>
                <span className="ml-auto mr-3 font-bold text-sm" style={{ color: cat.color }}>{fmt(total)}</span>
                <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-3">
              {items.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2">Nenhuma despesa nesta categoria</p>
              ) : key === 'folha' ? (
                <FolhaSubgrupos items={items} onEdit={onEdit} onMarcarPago={onMarcarPago} />
              ) : (
                <div className="divide-y divide-border">
                  {items.map((l: any) => (
                    <div key={l.id} className="flex items-center justify-between py-2.5 gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{l.subcategoria || l.descricao}</p>
                        <p className="text-xs text-muted-foreground">
                          {l.fornecedor && `${l.fornecedor} • `}
                          {new Date(l.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <span className="font-bold text-sm text-foreground whitespace-nowrap">{fmt(Number(l.valor))}</span>
                      {getStatusBadge(l)}
                      <div className="flex gap-1">
                        {l.status === 'pendente' && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onMarcarPago(l)}>
                            <CheckCircle className="h-3.5 w-3.5 text-primary" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(l)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
