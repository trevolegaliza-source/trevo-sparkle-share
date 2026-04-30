import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Search, FileText, Users, ArrowRight } from 'lucide-react';

interface SearchResult {
  id: string;
  tipo: 'processo' | 'cliente';
  titulo: string;
  subtitulo: string;
  path: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Custom event to open from header click
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('open-command-palette', handler);
    return () => window.removeEventListener('open-command-palette', handler);
  }, []);

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setLoading(true);
      const searchTerm = `%${query}%`;

      const [processosRes, clientesRes] = await Promise.all([
        supabase.from('processos')
          .select('id, razao_social, tipo, etapa, cliente_id, clientes(apelido, nome)')
          .or(`razao_social.ilike.${searchTerm}`)
          .neq('is_archived', true)
          .limit(5),
        supabase.from('clientes')
          .select('id, nome, apelido, cnpj')
          .or(`nome.ilike.${searchTerm},apelido.ilike.${searchTerm},cnpj.ilike.${searchTerm}`)
          .eq('is_archived', false)
          .limit(5),
      ]);

      const items: SearchResult[] = [];

      (clientesRes.data || []).forEach(c => {
        items.push({
          id: c.id,
          tipo: 'cliente',
          titulo: c.apelido || c.nome,
          subtitulo: c.cnpj || 'Cliente',
          path: `/clientes/${c.id}`,
        });
      });

      (processosRes.data || []).forEach(p => {
        const cliente = (p as any).clientes;
        items.push({
          id: p.id,
          tipo: 'processo',
          titulo: p.razao_social,
          subtitulo: `${p.tipo} · ${p.etapa} · ${cliente?.apelido || cliente?.nome || ''}`,
          path: `/processos`,
        });
      });

      setResults(items);
      setSelectedIndex(0);
      setLoading(false);
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      navigate(results[selectedIndex].path);
      setOpen(false);
      setQuery('');
    }
  }, [results, selectedIndex, navigate]);

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQuery(''); }}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <div className="flex items-center border-b border-border px-3">
          <Search className="h-4 w-4 text-muted-foreground mr-2 flex-shrink-0" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar processos, clientes, CNPJs..."
            className="border-0 focus-visible:ring-0 h-12 text-base"
            autoFocus
          />
          <kbd className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded ml-2 flex-shrink-0">ESC</kbd>
        </div>

        {results.length > 0 && (
          <div className="max-h-80 overflow-y-auto p-2">
            {results.map((r, i) => {
              const Icon = r.tipo === 'cliente' ? Users : FileText;
              return (
                <button
                  key={`${r.tipo}-${r.id}`}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                    i === selectedIndex ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                  }`}
                  onClick={() => { navigate(r.path); setOpen(false); setQuery(''); }}
                >
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    r.tipo === 'cliente' ? 'bg-blue-500/10 text-blue-500' : 'bg-primary/10 text-primary'
                  }`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.titulo}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.subtitulo}</p>
                  </div>
                  <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                </button>
              );
            })}
          </div>
        )}

        {query.length >= 2 && results.length === 0 && !loading && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhum resultado para "{query}"
          </div>
        )}

        {!query && (
          <div className="p-4 text-center text-xs text-muted-foreground">
            Digite para buscar processos, clientes ou CNPJs
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
