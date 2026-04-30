import { supabase } from '@/integrations/supabase/client';
import { empresaPath } from '@/lib/storage-path';
import { toast } from 'sonner';

/**
 * Faz download de um arquivo do Storage e retorna Blob URL local.
 * Não utiliza URL pública direta, evitando bloqueios do navegador.
 */
export async function downloadStorageFile(bucket: string, path: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(path);

    if (error || !data) {
      console.error('Storage download error:', error);
      return null;
    }

    const pdfBlob = new Blob([data], { type: 'application/pdf' });
    return URL.createObjectURL(pdfBlob);
  } catch (err) {
    console.error('Storage download exception:', err);
    return null;
  }
}

/**
 * Faz download direto de um arquivo do Supabase Storage para o PC do usuário.
 * Mais confiável que preview em modal — funciona em 100% dos navegadores.
 */
export async function downloadExtrato(bucket: string, path: string, filename: string): Promise<void> {
  try {
    toast.info('Baixando extrato...');

    const candidatePaths = [path];
    try {
      const scopedPath = await empresaPath(path);
      if (scopedPath !== path) candidatePaths.push(scopedPath);
    } catch {
      // ignore: fallback para caminhos legados sem empresa_id
    }

    for (const candidatePath of candidatePaths) {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(candidatePath, 300);

      if (!error && data?.signedUrl) {
        window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
        toast.success(`Extrato ${filename} aberto!`);
        return;
      }

      console.error('Storage signed URL error:', { bucket, path: candidatePath, error });
    }

    toast.error('Erro ao baixar o extrato. Tente gerar novamente.');
  } catch (err) {
    console.error('Download error:', err);
    toast.error('Erro ao baixar o extrato.');
  }
}

/**
 * Abre um arquivo do Supabase Storage em nova aba via Signed URL.
 *
 * IMPORTANTE: NÃO usar URL.createObjectURL + window.open(blobUrl).
 * O ERP roda dentro do iframe do preview Lovable. Chrome bloqueia
 * blob URLs criadas em iframe quando abertas em nova janela
 * (ERR_BLOCKED_BY_CLIENT). Em modo anônimo o Lovable não vai pra
 * iframe, por isso parecia bug do navegador.
 *
 * Solução: signed URL (URL https real, válida 1h).
 */
export async function abrirArquivoStorage(bucket: string, path: string): Promise<void> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600);

    if (error || !data?.signedUrl) {
      console.error('Erro signed URL:', error);
      toast.error('Erro ao abrir o arquivo.');
      return;
    }

    const win = window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    if (!win) {
      await navigator.clipboard.writeText(data.signedUrl).catch(() => {});
      toast.info('Pop-up bloqueado. Link copiado pra área de transferência — cola no navegador.', { duration: 8000 });
    }
  } catch (err) {
    console.error('Erro storage:', err);
    toast.error('Erro ao abrir o arquivo.');
  }
}
