/**
 * Helper de detecção de plataforma de vídeo (YouTube/Vimeo/Spotify/Anchor/MP4).
 *
 * ITEM-025 fix: validação de protocolo. Recusa qualquer URL que não seja
 * https:// (bloqueia `javascript:`, `data:`, `file:`, http inseguro, etc).
 */
export type ParsedVideo = {
  type: 'youtube' | 'vimeo' | 'mp4' | 'spotify' | 'anchor' | 'iframe';
  embed: string;
};

export function parseVideoUrl(url: string): ParsedVideo | null {
  if (!url || !url.trim()) return null;
  const trimmed = url.trim();
  // Sanitização: só aceita https:// (protege contra javascript:/data:/file:/etc)
  if (!/^https:\/\//i.test(trimmed)) return null;
  // YouTube
  const yt = trimmed.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (yt) return { type: 'youtube', embed: `https://www.youtube.com/embed/${yt[1]}?rel=0&modestbranding=1` };
  // Vimeo
  const vm = trimmed.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return { type: 'vimeo', embed: `https://player.vimeo.com/video/${vm[1]}?title=0&byline=0&portrait=0` };
  // Spotify podcast (episode ou show)
  const sp = trimmed.match(/open\.spotify\.com\/(episode|show|track|playlist)\/([a-zA-Z0-9]+)/);
  if (sp) return { type: 'spotify', embed: `https://open.spotify.com/embed/${sp[1]}/${sp[2]}?utm_source=generator&theme=0` };
  // Anchor.fm (legacy, hoje redirect pra Spotify mas mantém compat)
  const an = trimmed.match(/anchor\.fm\/([a-zA-Z0-9_-]+)(?:\/episodes\/([a-zA-Z0-9_-]+))?/);
  if (an) {
    const slug = an[2] || an[1];
    return { type: 'anchor', embed: `https://anchor.fm/${an[1]}/embed${an[2] ? `/episodes/${slug}` : ''}` };
  }
  // MP4/WebM/OGG direto
  if (/\.(mp4|webm|ogg|m4v)(\?.*)?$/i.test(trimmed)) return { type: 'mp4', embed: trimmed };
  // fallback: iframe (só com https) — recusado se vier de domínio inseguro
  return { type: 'iframe', embed: trimmed };
}
