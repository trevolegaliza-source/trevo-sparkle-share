import { type OrcamentoItem, type OrcamentoPacote, type OrcamentoSecao, getItemValor } from './types';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  prospect_nome: string;
  prospect_cnpj: string;
  itens: OrcamentoItem[];
  pacotes: OrcamentoPacote[];
  secoes: OrcamentoSecao[];
  modoContador?: boolean;
  desconto_pct: number;
  validade_dias: number;
  pagamento: string;
}

export function PreviewDetalhado({ prospect_nome, prospect_cnpj, itens, pacotes, secoes, modoContador, desconto_pct, validade_dias, pagamento }: Props) {
  const validItems = itens.filter(i => i.descricao.trim());
  const grouped = secoes
    .map(s => ({ ...s, items: validItems.filter(i => i.secao === s.key).sort((a, b) => a.ordem - b.ordem) }))
    .filter(g => g.items.length > 0);

  const totalHonorarios = validItems.reduce((s, i) => s + getItemValor(i) * i.quantidade, 0);
  const totalTaxaMin = validItems.reduce((s, i) => s + i.taxa_min, 0);
  const totalTaxaMax = validItems.reduce((s, i) => s + i.taxa_max, 0);
  const descontoValor = totalHonorarios * (desconto_pct / 100);
  const honorarioFinal = totalHonorarios - descontoValor;

  return (
    <div className="bg-gradient-to-br from-[hsl(120,60%,8%)] to-[hsl(120,40%,12%)] p-5 text-white rounded-lg">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg font-extrabold">
          <span className="text-primary">Trevo</span>{' '}
          <span className="opacity-60">Legaliza</span>
        </span>
      </div>
      <p className="text-[10px] font-bold uppercase tracking-[3px] text-primary/80 mb-1">
        Proposta Comercial
      </p>

      {prospect_nome && (
        <div className="mb-4">
          <p className="text-[10px] text-primary/60">Preparada para</p>
          <p className="font-bold text-sm">{prospect_nome}</p>
          {prospect_cnpj && <p className="text-[10px] opacity-40">{prospect_cnpj}</p>}
        </div>
      )}

      {grouped.map(group => (
        <div key={group.key} className="mb-3">
          {group.key !== 'geral' && (
            <p className="text-[9px] font-bold uppercase tracking-widest text-primary/70 mb-1">
              {group.label} ({group.items.length})
            </p>
          )}
          <div className="space-y-1">
            {group.items.map((item, idx) => (
              <div key={item.id}>
                <div className="flex justify-between text-xs">
                  <span className="opacity-70 truncate mr-3">
                    {item.ordem || idx + 1}. {item.descricao}
                  </span>
                  <span className="font-bold whitespace-nowrap">
                      {fmt((modoContador && item.honorario_contador > 0 ? item.honorario_contador : getItemValor(item)) * item.quantidade)}
                  </span>
                </div>
                {(item.taxa_min > 0 || item.taxa_max > 0) && (
                  <p className="text-[9px] opacity-40 ml-4">
                    Taxas: {fmt(item.taxa_min)} a {fmt(item.taxa_max)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {pacotes.length > 0 && (
        <div className="mb-3 border-t border-white/10 pt-2">
          <p className="text-[9px] font-bold uppercase tracking-widest text-primary/70 mb-1">Pacotes</p>
          {pacotes.filter(p => p.nome && p.itens_ids.length > 0).map(p => {
            const selected = validItems.filter(i => p.itens_ids.includes(i.id));
            const h = selected.reduce((s, i) => s + getItemValor(i) * i.quantidade, 0);
            return (
              <div key={p.id} className="text-xs flex justify-between opacity-70">
                <span>□ {p.nome} ({p.itens_ids.length} itens, -{p.desconto_pct}%)</span>
                <span className="font-bold">{fmt(h * (1 - p.desconto_pct / 100))}</span>
              </div>
            );
          })}
        </div>
      )}

      {desconto_pct > 0 && totalHonorarios > 0 && (
        <div className="flex justify-between text-xs border-t border-white/10 pt-2">
          <span className="opacity-50">Desconto ({desconto_pct}%)</span>
          <span className="text-primary/80">-{fmt(descontoValor)}</span>
        </div>
      )}

      <div className="border-t border-white/20 pt-3 mt-3 space-y-1">
        <div className="flex justify-between text-xs">
          <span className="opacity-60">Honorários</span>
          <span className="font-bold">{fmt(modoContador ? itens.filter(i => i.descricao.trim()).reduce((s, i) => s + (i.honorario_contador > 0 ? i.honorario_contador : getItemValor(i)) * i.quantidade, 0) * (1 - desconto_pct / 100) : honorarioFinal)}</span>
        </div>
        {(totalTaxaMin > 0 || totalTaxaMax > 0) && (
          <div className="flex justify-between text-xs">
            <span className="opacity-60">Taxas estimadas</span>
            <span>{fmt(totalTaxaMin)} a {fmt(totalTaxaMax)}</span>
          </div>
        )}
        <div className="flex justify-between pt-1">
          <span className="text-primary/80 font-bold text-[10px] uppercase">
            {totalTaxaMin > 0 || totalTaxaMax > 0 ? 'Investimento' : 'Total'}
          </span>
          <span className="text-xl font-extrabold">
            {totalTaxaMin > 0 || totalTaxaMax > 0
              ? `${fmt(honorarioFinal + totalTaxaMin)} a ${fmt(honorarioFinal + totalTaxaMax)}`
              : fmt(honorarioFinal)
            }
          </span>
        </div>
      </div>

      <p className="mt-3 text-[10px] opacity-30">
        Válida por {validade_dias} dias
        {pagamento ? ` · ${pagamento.substring(0, 50)}${pagamento.length > 50 ? '...' : ''}` : ''}
      </p>
    </div>
  );
}
