import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';

const MESES_EXTENSO = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

interface Props {
  open: boolean;
  onClose: () => void;
  lancamento: any;
  colaborador?: any;
  /** For benefícios, pass the paired VT/VR items */
  vtItem?: any;
  vrItem?: any;
}

export default function AvisarColaboradorModal({ open, onClose, lancamento, colaborador, vtItem, vrItem }: Props) {
  const [copied, setCopied] = useState(false);

  if (!lancamento) return null;

  const nome = colaborador?.nome || extractName(lancamento.descricao);
  const mes = lancamento.competencia_mes;
  const ano = lancamento.competencia_ano;
  const mesAno = mes && ano ? `${MESES_EXTENSO[mes]}/${ano}` : '';
  const dataPag = lancamento.data_pagamento
    ? new Date(lancamento.data_pagamento + 'T12:00:00').toLocaleDateString('pt-BR')
    : new Date().toLocaleDateString('pt-BR');

  const isBeneficios = lancamento.subcategoria === 'Vale Transporte (VT)' ||
    lancamento.subcategoria === 'Vale Refeição (VR)';

  // For Benefícios, the month displayed is competencia_mes + 1 (payment month, not generation month)
  let displayMesAno = mesAno;
  if (isBeneficios || (vtItem || vrItem)) {
    if (mes && ano) {
      const nextMes = mes === 12 ? 1 : mes + 1;
      const nextAno = mes === 12 ? ano + 1 : ano;
      displayMesAno = `${MESES_EXTENSO[nextMes]}/${nextAno}`;
    }
  }

  let message: string;

  if (isBeneficios || (vtItem || vrItem)) {
    const vtDiario = colaborador?.vt_diario || 0;
    const vrDiario = colaborador?.vr_diario || 0;
    const vtVal = vtItem ? Number(vtItem.valor) : 0;
    const vrVal = vrItem ? Number(vrItem.valor) : 0;
    const vtDias = vtDiario > 0 ? Math.round(vtVal / vtDiario) : 0;
    const vrDias = vrDiario > 0 ? Math.round(vrVal / vrDiario) : 0;
    const total = vtVal + vrVal;

    const lines = [`Olá, ${nome}! 👋`, '', 'Seu pagamento foi realizado:', '', `🚌 Benefícios · ${displayMesAno}`];
    if (vtItem) lines.push(`VT: ${fmt(vtDiario)}/dia × ${vtDias} dias = ${fmt(vtVal)}`);
    if (vrItem) lines.push(`VR: ${fmt(vrDiario)}/dia × ${vrDias} dias = ${fmt(vrVal)}`);
    lines.push(`Total: ${fmt(total)}`, `Data do pagamento: ${dataPag}`);
    message = lines.join('\n');
  } else {
    const subcatLabel = lancamento.subcategoria || 'Pagamento';
    message = [
      `Olá, ${nome}! 👋`,
      '',
      'Seu pagamento foi realizado:',
      '',
      `💰 ${subcatLabel} · ${mesAno}`,
      `Valor: ${fmt(Number(lancamento.valor))}`,
      `Data do pagamento: ${dataPag}`,
    ].join('\n');
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="uppercase">Avisar Colaborador · {nome}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-xs text-muted-foreground uppercase font-medium">Mensagem gerada:</p>
          <div className="bg-muted/40 rounded-lg p-4 text-sm whitespace-pre-line font-mono border border-border">
            {message}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>FECHAR</Button>
          <Button onClick={handleCopy} className="gap-2">
            {copied ? <><Check className="h-4 w-4" /> ✓ COPIADO!</> : <><Copy className="h-4 w-4" /> COPIAR MENSAGEM</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function extractName(desc: string): string {
  const parts = desc.split('—');
  return parts.length > 1 ? parts[parts.length - 1].trim() : desc;
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
