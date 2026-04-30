import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, ExternalLink, FileWarning, Download } from 'lucide-react';

interface ContractPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string | null;
  fileName: string;
  clienteName?: string;
}

export default function ContractPreviewModal({ open, onOpenChange, url, fileName, clienteName }: ContractPreviewModalProps) {
  const [loadError, setLoadError] = useState(false);

  const ext = fileName?.split('.').pop()?.toLowerCase() || '';
  const isImage = ['png', 'jpg', 'jpeg', 'webp'].includes(ext);
  const isPdf = ext === 'pdf';
  const isValidUrl = url && url.startsWith('http');

  // Cache-bust URL with timestamp
  const cacheBustedUrl = isValidUrl && url
    ? url.includes('?')
      ? `${url}&t=${Date.now()}`
      : `${url}?t=${Date.now()}`
    : null;

  // Google Docs Viewer proxy for PDFs (bypasses extension blocks)
  const googleViewerUrl = cacheBustedUrl
    ? `https://docs.google.com/viewer?url=${encodeURIComponent(cacheBustedUrl)}&embedded=true`
    : null;

  const handleClose = () => {
    setLoadError(false);
    onOpenChange(false);
  };

  const renderContent = () => {
    if (!isValidUrl || !cacheBustedUrl) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center gap-4 px-8">
          <FileWarning className="h-16 w-16 text-muted-foreground/50" />
          <div>
            <p className="text-base font-medium text-foreground mb-2">Documento não encontrado ou formato incompatível</p>
            <p className="text-sm text-muted-foreground max-w-md">
              Por favor, re-anexe o contrato usando o campo de Drag & Drop na aba de Contratos.
            </p>
          </div>
        </div>
      );
    }

    if (isImage) {
      return (
        <div className="flex flex-col h-full">
          <div className="flex-1 flex items-center justify-center p-4 min-h-0">
            {!loadError ? (
              <img
                src={cacheBustedUrl}
                alt={fileName}
                className="max-w-full max-h-full object-contain rounded-md"
                onError={() => setLoadError(true)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-3">
                <FileWarning className="h-12 w-12 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Não foi possível carregar a imagem.</p>
                <Button variant="outline" size="sm" asChild>
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Abrir em nova aba
                  </a>
                </Button>
              </div>
            )}
          </div>
          <div className="shrink-0 px-4 py-2 border-t border-border/40 flex items-center justify-end gap-3">
            <a href={url} download className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              <Download className="h-3 w-3" /> Baixar arquivo original
            </a>
          </div>
        </div>
      );
    }

    if (isPdf && googleViewerUrl) {
      return (
        <div className="flex flex-col h-full">
          <div className="flex-1 min-h-0">
            <iframe
              src={googleViewerUrl}
              className="w-full h-full border-0"
              title={fileName}
              sandbox="allow-scripts allow-same-origin allow-popups"
              onError={() => setLoadError(true)}
            />
          </div>
          <div className="shrink-0 px-4 py-2 border-t border-border/40 flex items-center justify-between">
            <a href={url} download className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              <Download className="h-3 w-3" /> Problemas no preview? Baixar arquivo original
            </a>
            <Button variant="secondary" size="sm" className="gap-1.5" asChild>
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" /> Abrir em nova aba
              </a>
            </Button>
          </div>
        </div>
      );
    }

    // Unknown format
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-sm text-muted-foreground">Pré-visualização não disponível para este formato.</p>
        <Button variant="outline" size="sm" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Abrir em nova aba
          </a>
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-[92vw] h-[92vh] flex flex-col p-0 gap-0 bg-background/95 backdrop-blur-md border-border/60"
        aria-describedby="contract-preview-desc"
      >
        <DialogDescription id="contract-preview-desc" className="sr-only">
          Visualização do contrato {fileName}
        </DialogDescription>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border/60 shrink-0">
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold truncate text-foreground">
              {clienteName ? `${clienteName} — ` : ''}{fileName}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full hover:bg-destructive/10 hover:text-destructive shrink-0 ml-4"
            onClick={handleClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        {/* Content */}
        <div className="flex-1 min-h-0 relative bg-muted/10">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
