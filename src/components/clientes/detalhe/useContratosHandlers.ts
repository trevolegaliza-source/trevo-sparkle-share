import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { STORAGE_BUCKETS } from '@/constants/storage';
import { empresaPath } from '@/lib/storage-path';
import type { ClienteDB } from '@/types/financial';
import { toast } from 'sonner';

interface UseContratosHandlersArgs {
  cliente: ClienteDB | null;
  loadContracts: (clienteId: string) => void;
  setPendingDeleteAction: (action: (() => void) | null) => void;
  setShowDeletePassword: (v: boolean) => void;
}

/**
 * Handlers de contratos (upload/download/view/delete). Antes os 5 handlers
 * inflavam o ClienteDetalhe — vivem aqui agora. setPendingDeleteAction +
 * setShowDeletePassword continuam no caller pra reaproveitar o
 * PasswordConfirmDialog global.
 */
export function useContratosHandlers({
  cliente,
  loadContracts,
  setPendingDeleteAction,
  setShowDeletePassword,
}: UseContratosHandlersArgs) {
  const [uploadingContract, setUploadingContract] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState('');

  const handleUpload = async (file: File) => {
    if (!cliente) return;
    const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
    if (!allowed.includes(file.type)) { toast.error('Formato inválido. Aceitos: PDF, PNG, JPG'); throw new Error('invalid'); }
    if (file.size > 10 * 1024 * 1024) { toast.error('Arquivo muito grande. Máximo: 10MB'); throw new Error('too large'); }
    setUploadingContract(true);
    const path = await empresaPath(`${cliente.id}/${Date.now()}_${file.name}`);
    const { error } = await supabase.storage.from(STORAGE_BUCKETS.CONTRACTS).upload(path, file);
    if (error) { toast.error('Erro no upload: ' + error.message); setUploadingContract(false); throw error; }
    toast.success('Contrato anexado!');
    loadContracts(cliente.id);
    setUploadingContract(false);
  };

  const handleDownload = async (fileName: string) => {
    if (!cliente) return;
    const path = await empresaPath(`${cliente.id}/${fileName}`);
    const { data, error } = await supabase.storage.from(STORAGE_BUCKETS.CONTRACTS).download(path);
    if (error) { toast.error('Erro ao baixar'); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a'); a.href = url; a.download = fileName; a.click();
    URL.revokeObjectURL(url);
  };

  const handleViewContract = async (fileName: string) => {
    if (!cliente) return;
    const storagePath = await empresaPath(`${cliente.id}/${fileName}`);
    const { abrirArquivoStorage } = await import('@/lib/storage-utils');
    await abrirArquivoStorage(STORAGE_BUCKETS.CONTRACTS, storagePath);
  };

  const handleDeleteContract = (fileName: string) => {
    if (!cliente) return;
    setPendingDeleteAction(() => async () => {
      const path = await empresaPath(`${cliente.id}/${fileName}`);
      const { error } = await supabase.storage.from(STORAGE_BUCKETS.CONTRACTS).remove([path]);
      if (error) toast.error('Erro ao excluir');
      else { toast.success('Removido'); loadContracts(cliente.id); }
    });
    setShowDeletePassword(true);
  };

  const handlePreview = (signedUrl: string, fileName: string) => {
    setPreviewUrl(signedUrl);
    setPreviewFileName(fileName);
  };

  const closePreview = () => {
    setPreviewUrl(null);
    setPreviewFileName('');
  };

  return {
    uploadingContract,
    previewUrl,
    previewFileName,
    handleUpload,
    handleDownload,
    handleViewContract,
    handleDeleteContract,
    handlePreview,
    closePreview,
  };
}
