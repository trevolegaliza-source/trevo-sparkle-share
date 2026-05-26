/**
 * RegrasRapidas — pills clicáveis que adicionam observações pré-definidas.
 * Cada pill = uma cláusula contratual reusável. Clica → vira parte das
 * observações públicas que o cliente vê. Clica de novo → remove.
 */
import { MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { REGRAS_RAPIDAS_CATALOGO } from '@/lib/terceirizacao-engine';

interface Props {
  regrasAtivas: string[];
  textoLivre: string;
  onChangeRegras: (ids: string[]) => void;
  onChangeTexto: (texto: string) => void;
}

export function RegrasRapidas({ regrasAtivas, textoLivre, onChangeRegras, onChangeTexto }: Props) {
  const toggle = (id: string) => {
    if (regrasAtivas.includes(id)) {
      onChangeRegras(regrasAtivas.filter((x) => x !== id));
    } else {
      onChangeRegras([...regrasAtivas, id]);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <MessageSquare className="h-4 w-4" /> OBSERVAÇÕES (cliente vê)
        </div>

        {/* Pills de cláusulas pré-definidas */}
        <div className="space-y-2">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Cláusulas rápidas — clique pra adicionar
          </Label>
          <div className="flex flex-wrap gap-2">
            {REGRAS_RAPIDAS_CATALOGO.map((r) => {
              const ativa = regrasAtivas.includes(r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => toggle(r.id)}
                  className={cn(
                    'px-4 py-1.5 rounded-full text-xs font-medium border transition-all',
                    ativa
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                      : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-50 hover:border-slate-400'
                  )}
                  title={r.texto}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Preview das cláusulas selecionadas */}
        {regrasAtivas.length > 0 && (
          <div className="bg-slate-50 dark:bg-slate-900/30 border-l-2 border-emerald-500 rounded-md p-3 space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
              Cláusulas selecionadas ({regrasAtivas.length})
            </p>
            {REGRAS_RAPIDAS_CATALOGO
              .filter((r) => regrasAtivas.includes(r.id))
              .map((r) => (
                <p key={r.id} className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                  • {r.texto}
                </p>
              ))}
          </div>
        )}

        {/* Texto livre adicional */}
        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Observação adicional (livre)
          </Label>
          <Textarea
            value={textoLivre}
            onChange={(e) => onChangeTexto(e.target.value)}
            rows={4}
            placeholder="Ex: Cliente terá 50% de desconto no primeiro processo a título de cortesia..."
          />
        </div>
      </CardContent>
    </Card>
  );
}
