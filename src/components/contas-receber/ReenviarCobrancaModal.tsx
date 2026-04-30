import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { gerarMensagemCobranca } from '@/lib/mensagem-cobranca';
import { supabase } from '@/integrations/supabase/client';
import { diasAtraso, useRegistrarContato } from '@/hooks/useContasReceber';
import type { LancamentoReceber } from '@/hooks/useContasReceber';

interface Props {
  lancamento: LancamentoReceber | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function ReenviarCobrancaModal({ lancamento, open, onOpenChange }: Props) {
  const registrar = useRegistrarContato();

  if (!lancamento) return null;

  const dias = diasAtraso(lancamento.data_vencimento, lancamento.status);

  const handleCopiarMsg = async () => {
    let valorAdicional = 0;
    let taxasDetalhadas: Array<{ descricao: string; valor: number }> = [];
    if (lancamento.processo_id) {
      const { data: vas } = await supabase
        .from('valores_adicionais')
        .select('descricao, valor')
        .eq('processo_id', lancamento.processo_id);
      if (vas) {
        valorAdicional = vas.reduce((s, v) => s + Number(v.valor), 0);
        taxasDetalhadas = vas.map(v => ({ descricao: (v as any).descricao || 'Taxa', valor: Number(v.valor) || 0 }));
      }
    }
    const honorarios = Number(lancamento.valor);
    const msg = gerarMensagemCobranca({
      tipo: lancamento.processo?.tipo || 'processo',
      razao_social: lancamento.processo?.razao_social || lancamento.descricao,
      valor: honorarios + valorAdicional,
      honorarios,
      taxasExtras: valorAdicional,
      taxasDetalhadas,
      data_vencimento: lancamento.data_vencimento,
      diasAtraso: dias,
    });
    await navigator.clipboard.writeText(msg);
    registrar.mutate({
      id: lancamento.id,
      meio: 'WhatsApp',
      observacao: 'Mensagem de cobrança copiada',
      tentativas_atual: lancamento.tentativas_cobranca || 0,
      notas_atual: lancamento.notas_cobranca || null,
    });
    toast.success('Mensagem copiada para a área de transferência!');
    onOpenChange(false);
  };

  const handleCopiarPix = async () => {
    const txt = `Chave PIX (CNPJ): 39.969.412/0001-70\nValor: ${Number(lancamento.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
    await navigator.clipboard.writeText(txt);
    toast.success('Chave PIX copiada!');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reenviar Cobrança</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm space-y-1">
            <p><span className="text-muted-foreground">Cliente:</span> {lancamento.cliente?.nome || '-'}</p>
            <p><span className="text-muted-foreground">Contato:</span> {lancamento.cliente?.email || '-'}</p>
            <p><span className="text-muted-foreground">Telefone:</span> {lancamento.cliente?.telefone || '-'}</p>
            <p><span className="text-muted-foreground">Valor:</span> {Number(lancamento.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} ({dias} dias em atraso)</p>
          </div>
          <div className="space-y-2">
            <Button variant="outline" className="w-full justify-start" onClick={handleCopiarMsg}>
              <Copy className="h-4 w-4 mr-2" /> Copiar mensagem de cobrança (WhatsApp)
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={handleCopiarPix}>
              <Copy className="h-4 w-4 mr-2" /> Copiar chave PIX + valor
            </Button>
            <Button variant="outline" className="w-full justify-start text-muted-foreground" disabled>
              📄 Reenviar extrato PDF por email (em breve)
            </Button>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
