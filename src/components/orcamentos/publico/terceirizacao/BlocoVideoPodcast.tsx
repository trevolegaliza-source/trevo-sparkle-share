/**
 * Bloco vídeo ou podcast — só renderiza se houver URL parseada.
 * Suporta YouTube/Vimeo (iframe responsivo), MP4 (tag video), Spotify/Anchor (iframe podcast).
 *
 * Extraído do arquivo monolítico em 29/05 — só movimentação.
 */
import type { ParsedVideo } from './videoUtils';

export function BlocoVideoPodcast({ video }: { video: ParsedVideo }) {
  return (
    <section className="py-16 md:py-20 bg-gradient-to-b from-emerald-950 to-slate-50">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-8">
          <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700 font-bold mb-2">
            {video.type === 'spotify' || video.type === 'anchor' ? 'Conheça nosso CEO no podcast' : 'Conheça a Trevo em 2 minutos'}
          </p>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 leading-tight">
            {video.type === 'spotify' || video.type === 'anchor'
              ? 'Como pensamos a operação societária do Brasil.'
              : 'Quem é, como atende, por que confiar.'}
          </h2>
        </div>
        <div className={`relative rounded-2xl overflow-hidden shadow-2xl bg-black ${video.type === 'spotify' || video.type === 'anchor' ? '' : 'aspect-video'}`}>
          {video.type === 'mp4' && (
            <video
              src={video.embed}
              controls
              className="w-full h-full"
              playsInline
              preload="metadata"
            >
              Seu navegador não suporta vídeo HTML5.
            </video>
          )}
          {(video.type === 'youtube' || video.type === 'vimeo' || video.type === 'iframe') && (
            <iframe
              src={video.embed}
              title="Trevo Legaliza — vídeo institucional"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="w-full h-full"
            />
          )}
          {(video.type === 'spotify' || video.type === 'anchor') && (
            <iframe
              src={video.embed}
              title="Trevo Legaliza — podcast"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              className="w-full"
              style={{ height: '232px', border: 0 }}
            />
          )}
        </div>
      </div>
    </section>
  );
}
