import { supabase } from '@/integrations/supabase/client';
import { empresaPath } from '@/lib/storage-path';

/**
 * Download an extrato PDF as a Blob, trying multiple candidate paths.
 * Bypasses ad-blockers / public-URL CORS issues by going through the SDK.
 */
export async function fetchExtratoBlob(extratoId: string): Promise<{ blob: Blob; filename: string } | null> {
  const { data: extrato } = await supabase
    .from('extratos')
    .select('cliente_id, filename, pdf_url')
    .eq('id', extratoId)
    .single();

  if (!extrato) return null;
  const filename = (extrato as any).filename as string;
  const clienteId = (extrato as any).cliente_id as string;
  const pdfUrl = (extrato as any).pdf_url as string | null;

  // Build candidate paths in order of preference
  const candidates: string[] = [];

  // 1. Path embedded in pdf_url (covers tenant-scoped paths)
  if (pdfUrl?.includes('/object/public/documentos/')) {
    candidates.push(decodeURIComponent(pdfUrl.split('/object/public/documentos/')[1]));
  }
  if (pdfUrl?.includes('/object/sign/documentos/')) {
    candidates.push(decodeURIComponent(pdfUrl.split('/object/sign/documentos/')[1].split('?')[0]));
  }

  // 2. Tenant-scoped path
  try {
    candidates.push(await empresaPath(`extratos/${clienteId}/${filename}`));
  } catch { /* not authenticated */ }

  // 3. Legacy unscoped path
  candidates.push(`extratos/${clienteId}/${filename}`);

  for (const path of [...new Set(candidates)]) {
    const { data, error } = await supabase.storage.from('documentos').download(path);
    if (!error && data) {
      return { blob: data, filename };
    }
  }
  return null;
}

/** Download to user's machine via blob URL (avoids ERR_BLOCKED_BY_CLIENT). */
export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
