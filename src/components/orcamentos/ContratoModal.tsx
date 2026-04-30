import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { gerarContratoPDF, type ContratoData } from '@/lib/contrato-pdf';
import { downloadBlob } from '@/lib/orcamento-pdf';
import { toast } from 'sonner';
import type { Orcamento } from '@/hooks/useOrcamentos';

interface ContratoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orcamento: Orcamento;
  onSuccess: () => void;
}

export default function ContratoModal({ open, onOpenChange, orcamento, onSuccess }: ContratoModalProps) {
  const isDirecto = (orcamento as any).destinatario === 'cliente_direto';

  const [form, setForm] = useState({
    contratante_tipo: 'juridica' as 'juridica' | 'fisica',
    contratante_nome: isDirecto ? orcamento.prospect_nome : ((orcamento as any).escritorio_nome || orcamento.prospect_nome || ''),
    contratante_cnpj_cpf: isDirecto ? (orcamento.prospect_cnpj || '') : ((orcamento as any).escritorio_cnpj || orcamento.prospect_cnpj || ''),
    contratante_endereco: '',
    contratante_representante: '',
    contratante_representante_cpf: '',
    contratante_representante_qualificacao: '',
    cidade_contrato: 'São Bernardo do Campo/SP',
    data_contrato: new Date().toISOString().split('T')[0],
  });

  const [loading, setLoading] = useState(false);

  const set = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const docLabel = form.contratante_tipo === 'juridica' ? 'CNPJ' : 'CPF';

  async function gerarNumeroContrato(): Promise<string> {
    const ano = new Date().getFullYear();
    const { data } = await supabase
      .from('contratos')
      .select('numero_contrato')
      .like('numero_contrato', `CT-${ano}-%`)
      .order('created_at', { ascending: false })
      .limit(1);

    let seq = 1;
    if (data && data.length > 0) {
      const parts = data[0].numero_contrato.split('-');
      seq = (parseInt(parts[2] || '0', 10) || 0) + 1;
    }
    return `CT-${ano}-${String(seq).padStart(3, '0')}`;
  }

  async function handleSubmit() {
    if (!form.contratante_nome.trim() || !form.contratante_cnpj_cpf.trim() ||
        !form.contratante_endereco.trim() || !form.contratante_representante.trim() ||
        !form.contratante_representante_cpf.trim()) {
      toast.error('Preencha todos os campos obrigatórios do contratante');
      return;
    }

    setLoading(true);
    try {
      const numero = await gerarNumeroContrato();
      const numeroProposta = String(orcamento.numero).padStart(3, '0');

      const contratoData: ContratoData = {
        numero_contrato: numero,
        contratante_tipo: form.contratante_tipo,
        contratante_nome: form.contratante_nome,
        contratante_cnpj_cpf: form.contratante_cnpj_cpf,
        contratante_endereco: form.contratante_endereco,
        contratante_representante: form.contratante_representante,
        contratante_representante_cpf: form.contratante_representante_cpf,
        contratante_representante_qualificacao: form.contratante_representante_qualificacao || undefined,
        cidade_contrato: form.cidade_contrato,
        data_contrato: form.data_contrato,
        numero_proposta: numeroProposta,
        data_proposta: new Date(orcamento.created_at).toLocaleDateString('pt-BR'),
      };

      // Generate PDF
      const blob = await gerarContratoPDF(contratoData);

      // Upload to storage
      const { empresaPath } = await import('@/lib/storage-path');
      const storagePath = await empresaPath(`${numero}.pdf`);
      const { error: uploadError } = await supabase.storage
        .from('contratos')
        .upload(storagePath, blob, { contentType: 'application/pdf', upsert: true });

      if (uploadError) throw uploadError;

      // Save contract record
      const { error: insertError } = await supabase.from('contratos').insert({
        orcamento_id: orcamento.id,
        numero_contrato: numero,
        contratante_tipo: form.contratante_tipo,
        contratante_nome: form.contratante_nome,
        contratante_cnpj_cpf: form.contratante_cnpj_cpf,
        contratante_endereco: form.contratante_endereco,
        contratante_representante: form.contratante_representante,
        contratante_representante_cpf: form.contratante_representante_cpf,
        contratante_representante_qualificacao: form.contratante_representante_qualificacao || null,
        cidade_contrato: form.cidade_contrato,
        data_contrato: form.data_contrato,
        pdf_url: storagePath,
      } as any);

      if (insertError) throw insertError;

      // Update orcamento status
      const { error: updateError } = await supabase.from('orcamentos')
        .update({ status: 'convertido', convertido_em: new Date().toISOString() } as any)
        .eq('id', orcamento.id);

      if (updateError) throw updateError;

      // Download the PDF locally
      downloadBlob(blob, `Contrato_${numero}.pdf`);

      toast.success(`Contrato ${numero} gerado com sucesso!`);
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error('Erro ao gerar contrato: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Gerar Contrato de Prestação de Serviços</DialogTitle>
          <p className="text-sm text-muted-foreground">A proposta aprovada será anexada como Anexo I do contrato.</p>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-2">
            {/* Contratante */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Dados do Contratante</h3>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <RadioGroup
                    value={form.contratante_tipo}
                    onValueChange={v => set('contratante_tipo', v)}
                    className="flex gap-4 mt-1"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="juridica" id="tipo-pj" />
                      <Label htmlFor="tipo-pj" className="text-sm font-normal">Pessoa Jurídica</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="fisica" id="tipo-pf" />
                      <Label htmlFor="tipo-pf" className="text-sm font-normal">Pessoa Física</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div>
                  <Label className="text-xs">Nome / Razão Social *</Label>
                  <Input value={form.contratante_nome} onChange={e => set('contratante_nome', e.target.value)} />
                </div>

                <div>
                  <Label className="text-xs">{docLabel} *</Label>
                  <Input value={form.contratante_cnpj_cpf} onChange={e => set('contratante_cnpj_cpf', e.target.value)} />
                </div>

                <div>
                  <Label className="text-xs">Endereço completo *</Label>
                  <Input value={form.contratante_endereco} onChange={e => set('contratante_endereco', e.target.value)} placeholder="Rua, nº, bairro, cidade/UF" />
                </div>

                <div>
                  <Label className="text-xs">Representante Legal *</Label>
                  <Input value={form.contratante_representante} onChange={e => set('contratante_representante', e.target.value)} />
                </div>

                <div>
                  <Label className="text-xs">CPF do Representante *</Label>
                  <Input value={form.contratante_representante_cpf} onChange={e => set('contratante_representante_cpf', e.target.value)} />
                </div>

                <div>
                  <Label className="text-xs">Qualificação</Label>
                  <Input value={form.contratante_representante_qualificacao} onChange={e => set('contratante_representante_qualificacao', e.target.value)} placeholder="empresário(a), brasileiro(a), casado(a)" />
                </div>
              </div>
            </div>

            {/* Contratada - Read only */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Dados da Contratada</h3>
              <div className="space-y-2 rounded-md bg-muted/50 p-4">
                <p className="text-sm"><span className="font-medium">Razão Social:</span> TREVO ASSESSORIA SOCIETÁRIA LTDA</p>
                <p className="text-sm"><span className="font-medium">CNPJ:</span> 39.969.412/0001-70</p>
                <p className="text-sm"><span className="font-medium">Endereço:</span> Rua Brasil, nº 1170, Rudge Ramos, São Bernardo do Campo/SP</p>
                <p className="text-sm"><span className="font-medium">Representante:</span> Dr. Thales Felipe Burger</p>
                <p className="text-sm"><span className="font-medium">CPF:</span> 447.821.658-46</p>
                <p className="text-sm"><span className="font-medium">Qualificação:</span> empresário e advogado, brasileiro, solteiro</p>
              </div>
            </div>

            {/* Contrato metadata */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Cidade do contrato</Label>
                <Input value={form.cidade_contrato} onChange={e => set('cidade_contrato', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Data do contrato</Label>
                <Input type="date" value={form.data_contrato} onChange={e => set('data_contrato', e.target.value)} />
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Gerando...' : 'Gerar Contrato'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
