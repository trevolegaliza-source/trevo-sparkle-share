import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, CheckCircle, X, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const ACCEPTED_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
};
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

interface ContractDropzoneProps {
  uploading: boolean;
  onUpload: (file: File) => Promise<void>;
}

export default function ContractDropzone({ uploading, onUpload }: ContractDropzoneProps) {
  const [uploadedName, setUploadedName] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[], rejectedFiles: any[]) => {
    if (rejectedFiles.length > 0) {
      const err = rejectedFiles[0]?.errors?.[0];
      if (err?.code === 'file-too-large') {
        toast.error('Arquivo muito grande. Máximo: 10MB');
      } else if (err?.code === 'file-invalid-type') {
        toast.error('Formato inválido. Aceitos: PDF, PNG, JPG');
      } else {
        toast.error('Erro ao selecionar arquivo');
      }
      return;
    }
    if (acceptedFiles.length === 0) return;
    const file = acceptedFiles[0];
    try {
      await onUpload(file);
      setUploadedName(file.name);
      setTimeout(() => setUploadedName(null), 4000);
    } catch {
      // error handled by parent
    }
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_SIZE,
    multiple: false,
    disabled: uploading,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-sm cursor-pointer transition-all duration-200',
        isDragActive
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-muted/20 text-muted-foreground hover:border-primary/50 hover:bg-muted/40',
        uploading && 'pointer-events-none opacity-60',
      )}
    >
      <input {...getInputProps()} />
      {uploading ? (
        <span className="animate-pulse">Enviando...</span>
      ) : uploadedName ? (
        <div className="flex items-center gap-2 text-primary">
          <CheckCircle className="h-5 w-5" />
          <span className="font-medium truncate max-w-[200px]">{uploadedName}</span>
        </div>
      ) : (
        <>
          <Upload className={cn('h-6 w-6', isDragActive && 'animate-bounce')} />
          <span className="text-center">
            {isDragActive
              ? 'Solte o arquivo aqui'
              : 'Arraste um contrato ou clique para selecionar'}
          </span>
          <span className="text-[10px] text-muted-foreground">PDF, PNG ou JPG — máx. 10MB</span>
        </>
      )}
    </div>
  );
}
