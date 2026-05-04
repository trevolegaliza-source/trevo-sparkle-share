import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Modal pra visualizar comprovante in-place, sem sair da tela.
 * Antes vivia inline em CategoriaAccordion — extraído em 04/05/2026 (P1.5)
 * pra compartilhar com Histórico e Lista, padronizando UX.
 *
 * Estratégia de download:
 *   1. Tenta bucket "contratos" (onde os uploads do bulk vão).
 *   2. Fallback "documentos" (legacy).
 *   3. Último recurso: signed URL.
 *
 * Suporta:
 *   - Imagens (PNG/JPG/JPEG/WebP) → renderiza inline
 *   - Outros (PDF) → iframe embedded
 *   - Botão "BAIXAR" pra salvar local
 */
export default function ComprovanteLightbox({
  open,
  onClose,
  comprovanteUrl,
  titulo,
  subtitulo,
}: {
  open: boolean;
  onClose: () => void;
  comprovanteUrl: string | null | undefined;
  titulo?: string;
  subtitulo?: string;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const ext = comprovanteUrl?.split('.').pop()?.toLowerCase() || '';
  const isImage = ['png', 'jpg', 'jpeg', 'webp'].includes(ext);

  useEffect(() => {
    if (!open || !comprovanteUrl) { setBlobUrl(null); return; }
    setLoading(true);
    let revoke: string | null = null;

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
      // Fallback signed URL
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
    a.download = `comprovante-${(titulo || 'pagamento').replace(/[^\w-]/g, '_')}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-[80vw] max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogDescription className="sr-only">Visualização do comprovante</DialogDescription>
        <DialogHeader className="px-6 py-3 border-b border-border/60 shrink-0">
          <DialogTitle className="uppercase text-sm">COMPROVANTE{titulo ? ` · ${titulo}` : ''}</DialogTitle>
          {subtitulo && <p className="text-xs text-muted-foreground uppercase">{subtitulo}</p>}
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
