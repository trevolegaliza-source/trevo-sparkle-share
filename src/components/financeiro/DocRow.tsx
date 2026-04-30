import { Button } from '@/components/ui/button';
import { FileText, Upload, CheckCircle2, Download, Eye, Loader2 } from 'lucide-react';

interface DocRowProps {
  label: string;
  storagePath: string | null | undefined;
  field: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  folder: string;
  uploading: string | null;
  onUpload: (field: string, file: File, folder: string) => void;
  onView: (path: string) => void;
  onDownload: (path: string) => void;
}

export default function DocRow({ label, storagePath, field, inputRef, folder, uploading, onUpload, onView, onDownload }: DocRowProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-foreground">{label}</span>
        {storagePath && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
      </div>
      <div className="flex items-center gap-1.5">
        {storagePath && (
          <>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground" onClick={() => onView(storagePath)}>
              <Eye className="h-3 w-3 mr-1" /> Ver
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground" onClick={() => onDownload(storagePath)}>
              <Download className="h-3 w-3 mr-1" /> Baixar
            </Button>
          </>
        )}
        <Button variant="outline" size="sm" className="h-7 text-xs border-border" disabled={uploading === field} onClick={() => inputRef.current?.click()}>
          {uploading === field ? (
            <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Enviando...</>
          ) : (
            <><Upload className="h-3 w-3 mr-1" /> {storagePath ? 'Substituir' : 'Enviar'}</>
          )}
        </Button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(field, f, folder);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
