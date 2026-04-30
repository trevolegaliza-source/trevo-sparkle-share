import { supabase } from '@/integrations/supabase/client';
import { STORAGE_BUCKETS } from '@/constants/storage';
import { empresaPath } from '@/lib/storage-path';
import { toast } from 'sonner';

const BUCKET = STORAGE_BUCKETS.CONTRACTS;

export async function uploadFile(
  file: File,
  folder: string,
  processoId: string,
): Promise<string> {
  const ext = file.name.split('.').pop();
  const relativePath = `${folder}/${processoId}/${Date.now()}.${ext}`;
  const storagePath = await empresaPath(relativePath);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { upsert: true });

  if (error) {
    toast.error('Erro no upload: ' + error.message);
    throw error;
  }

  return storagePath;
}

export async function getSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600);

  if (error) {
    toast.error('Erro ao gerar URL: ' + error.message);
    throw error;
  }
  return data.signedUrl;
}

export async function viewFile(storagePath: string) {
  const { abrirArquivoStorage } = await import('@/lib/storage-utils');
  await abrirArquivoStorage(BUCKET, storagePath);
}
