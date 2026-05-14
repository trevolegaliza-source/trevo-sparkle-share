import { useEffect, useRef, useState } from 'react';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import {
  GripVertical, Trash2, Lock, CircleDashed, ChevronRight,
} from 'lucide-react';
import { type OrcamentoItem, getItemValor } from './types';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  item: OrcamentoItem;
  idx: number;
  onChange: (idx: number, field: keyof OrcamentoItem, value: any) => void;
  onRemove: (idx: number) => void;
  isNew?: boolean;
  /** Modo interno (Trevo → Contador) — mostra precificação avançada por padrão */
  showAdvancedPricingByDefault?: boolean;
  /** Se true, esconde completamente o bloco de precificação avançada (cliente final) */
  hideAdvancedPricing?: boolean;
}

/**
 * Card de item da proposta — redesign Thales 14/05/2026.
 * Substitui ItemCardSimples + ItemCardDetalhado por um componente único
 * com toggle de "precificação avançada".
 *
 * Estilos em src/styles/orcamento-redesign.css (classes .on-item, .on-pricing-*)
 */
export function ItemCardRedesign({
  item, idx, onChange, onRemove, isNew,
  showAdvancedPricingByDefault = false,
  hideAdvancedPricing = false,
}: Props) {
  const [pricingOpen, setPricingOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isNew && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isNew]);

  const isObrig = !item.isOptional;
  const cls = isObrig ? 'req' : 'opt';
  const showPricing = !hideAdvancedPricing && (showAdvancedPricingByDefault || pricingOpen);
  const valorVenda = item.valorVendaDireto ?? item.honorario;
  const subtotal = getItemValor(item) * (item.quantidade || 1);

  return (
    <div
      ref={ref}
      className={`on-item ${cls} ${isNew ? 'on-item-enter on-item-flash' : ''}`}
    >
      <div className="on-item-head">
        <span className="on-item-handle" title="Arrastar para reordenar (em breve)">
          <GripVertical size={14} />
        </span>
        <span className="on-item-num">{String(idx + 1).padStart(2, '0')}</span>
        <input
          className="on-item-title-input"
          value={item.descricao}
          onChange={(e) => onChange(idx, 'descricao', e.target.value)}
          placeholder="Descrição do serviço"
        />
        <button
          className="on-btn on-btn-danger-ghost on-btn-sm"
          onClick={() => onRemove(idx)}
          aria-label="Remover item"
          type="button"
        >
          <Trash2 size={13} /> Remover
        </button>
      </div>

      <div className="on-item-body">
        <div>
          <label className="on-label">Valor de venda</label>
          <div className="on-input-money-prefix">
            <input
              className="on-input on-input-money"
              type="number"
              value={valorVenda || ''}
              onChange={(e) => {
                const v = parseFloat(e.target.value) || 0;
                if (hideAdvancedPricing) {
                  // Modo cliente: o "Valor de venda" é o honorario direto
                  onChange(idx, 'honorario', v);
                } else {
                  // Modo interno: salva como valorVendaDireto (separa do honorario interno)
                  onChange(idx, 'valorVendaDireto', v);
                }
              }}
              placeholder="0,00"
              step="0.01"
            />
          </div>
        </div>
        <div>
          <label className="on-label">Quantidade</label>
          <input
            className="on-input"
            style={{ textAlign: 'center' }}
            type="number"
            min={1}
            value={item.quantidade}
            onChange={(e) => onChange(idx, 'quantidade', parseInt(e.target.value) || 1)}
          />
        </div>
        <div style={{ textAlign: 'right' }}>
          <label className="on-label">Subtotal</label>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-1)', fontVariantNumeric: 'tabular-nums', padding: '9px 0' }}>
            {fmt(subtotal)}
          </div>
        </div>
      </div>

      {!hideAdvancedPricing && (
        <div className="on-item-pricing">
          {!showAdvancedPricingByDefault && (
            <button
              type="button"
              className={`on-pricing-toggle ${pricingOpen ? 'open' : ''}`}
              onClick={() => setPricingOpen((v) => !v)}
            >
              <ChevronRight size={13} />
              {pricingOpen ? 'Ocultar' : 'Mostrar'} precificação avançada
              <span className="badge">Interno</span>
            </button>
          )}
          {showPricing && (
            <div className="on-pricing-grid">
              <div className="on-pricing-block">
                <div className="lbl">Honorário Trevo (custo)</div>
                <input
                  className="on-input on-input-money"
                  type="number"
                  value={item.honorario || ''}
                  onChange={(e) => onChange(idx, 'honorario', parseFloat(e.target.value) || 0)}
                  placeholder="0,00"
                  step="0.01"
                />
              </div>
              <div className="on-pricing-block">
                <div className="lbl">Sugestão mínima</div>
                <input
                  className="on-input on-input-money"
                  type="number"
                  value={item.honorario_minimo_contador || ''}
                  onChange={(e) => onChange(idx, 'honorario_minimo_contador', parseFloat(e.target.value) || 0)}
                  placeholder="0,00"
                  step="0.01"
                />
              </div>
              <div className="on-pricing-block">
                <div className="lbl">Valor de mercado</div>
                <input
                  className="on-input on-input-money"
                  type="number"
                  value={item.valor_mercado || ''}
                  onChange={(e) => onChange(idx, 'valor_mercado', parseFloat(e.target.value) || 0)}
                  placeholder="0,00"
                  step="0.01"
                />
              </div>
              <div className="on-pricing-block">
                <div className="lbl">Valor premium</div>
                <input
                  className="on-input on-input-money"
                  type="number"
                  value={item.valor_premium || ''}
                  onChange={(e) => onChange(idx, 'valor_premium', parseFloat(e.target.value) || 0)}
                  placeholder="0,00"
                  step="0.01"
                />
              </div>
              <div className="on-pricing-block">
                <div className="lbl">Taxa órgão (min)</div>
                <input
                  className="on-input on-input-money"
                  type="number"
                  value={item.taxa_min || ''}
                  onChange={(e) => onChange(idx, 'taxa_min', parseFloat(e.target.value) || 0)}
                  placeholder="0,00"
                  step="0.01"
                />
              </div>
              <div className="on-pricing-block">
                <div className="lbl">Taxa órgão (max)</div>
                <input
                  className="on-input on-input-money"
                  type="number"
                  value={item.taxa_max || ''}
                  onChange={(e) => onChange(idx, 'taxa_max', parseFloat(e.target.value) || 0)}
                  placeholder="0,00"
                  step="0.01"
                />
              </div>
              <div className="on-pricing-block">
                <div className="lbl">Prazo estimado</div>
                <input
                  className="on-input"
                  value={item.prazo || ''}
                  onChange={(e) => onChange(idx, 'prazo', e.target.value)}
                  placeholder="Ex: 15–25 dias úteis"
                />
              </div>
              <div className="on-pricing-block" style={{ gridColumn: '1 / -1' }}>
                <div className="lbl">Documentos necessários</div>
                <input
                  className="on-input"
                  value={item.docs_necessarios || ''}
                  onChange={(e) => onChange(idx, 'docs_necessarios', e.target.value)}
                  placeholder="RG, CPF, contrato social, comprovante de endereço..."
                />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="on-rt" style={{ marginTop: 12 }}>
        <RichTextEditor
          value={item.detalhes}
          onChange={(html) => onChange(idx, 'detalhes', html)}
          placeholder="Detalhes, escopo, o que está incluso… (opcional)"
          minHeight="80px"
        />
      </div>

      <div className="on-item-foot">
        <div className="on-toggle">
          <button
            type="button"
            className={`on-toggle-sw ${isObrig ? 'req' : 'opt'}`}
            onClick={() => onChange(idx, 'isOptional', isObrig)}
            aria-pressed={isObrig}
            aria-label={isObrig ? 'Marcado como obrigatório' : 'Marcado como opcional'}
          >
            <span className="knob" />
          </button>
          <div className="on-toggle-meta">
            <span className={`on-toggle-ttl ${isObrig ? 'req' : 'opt'}`}>
              {isObrig ? <Lock size={12} /> : <CircleDashed size={12} />}
              {isObrig ? 'Obrigatório — cliente não pode desmarcar' : 'Opcional — cliente pode escolher'}
            </span>
            <span className="on-toggle-sub">
              {isObrig
                ? 'Item sempre vai junto da proposta.'
                : 'Cliente verá um checkbox pra incluir ou não.'}
            </span>
          </div>
        </div>
        <div className="on-subtotal">
          Subtotal item:<b>{fmt(subtotal)}</b>
        </div>
      </div>
    </div>
  );
}
