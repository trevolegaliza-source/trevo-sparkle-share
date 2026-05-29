import { supabase } from '@/integrations/supabase/client';
import { gerarExtratoPDF, fetchValoresAdicionaisMulti, fetchCompetenciaProcessos } from '@/lib/extrato-pdf';
import type { ClienteDB, ProcessoDB, Lancamento } from '@/types/financial';
import type { ProcessoFinanceiro } from '@/hooks/useProcessosFinanceiro';
import { toast } from 'sonner';

interface GerarExtratoArgs {
  cliente: ClienteDB;
  procsToGenerate: ProcessoDB[];
  lancamentos: Lancamento[];
}

/**
 * Pipeline de geração do extrato PDF: busca metadados do cliente,
 * valores adicionais por processo, mês de competência e gera o PDF
 * com `gerarExtratoPDF`. Faz o download via blob. Retorna `true` se
 * gerou com sucesso, `false` em erro.
 */
export async function gerarExtratoClienteDetalhe({
  cliente,
  procsToGenerate,
  lancamentos,
}: GerarExtratoArgs): Promise<boolean> {
  try {
    const { data: clienteData } = await supabase
      .from('clientes')
      .select('nome, cnpj, apelido, valor_base, desconto_progressivo, valor_limite_desconto, telefone, email, nome_contador, dia_cobranca, dia_vencimento_mensal')
      .eq('id', cliente.id)
      .single();

    if (clienteData?.dia_vencimento_mensal && clienteData.dia_vencimento_mensal > 0 && !clienteData.dia_cobranca) {
      toast.info(`Atenção: o cliente ${clienteData.apelido || clienteData.nome} tem vencimento fixo no dia ${clienteData.dia_vencimento_mensal} de cada mês.`);
    }
    const processosFin: ProcessoFinanceiro[] = procsToGenerate.map(p => ({
      ...p,
      etapa_financeiro: 'solicitacao_criada' as const,
      lancamento: lancamentos.find(l => l.processo_id === p.id && l.tipo === 'receber') || null,
    }));
    const [valoresAdicionais, allCompetencia] = await Promise.all([
      fetchValoresAdicionaisMulti(procsToGenerate.map(p => p.id)),
      fetchCompetenciaProcessos(cliente.id),
    ]);
    const result = await gerarExtratoPDF({
      processos: processosFin,
      allCompetencia,
      valoresAdicionais,
      cliente: clienteData as any,
    });
    const blob = result.doc.output('blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const clienteName = clienteData?.apelido || clienteData?.nome || 'extrato';
    a.download = `extrato_${clienteName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Extrato gerado com sucesso!');
    return true;
  } catch (err: any) {
    toast.error('Erro ao gerar extrato: ' + err.message);
    return false;
  }
}

/**
 * Marca lançamentos de "cobranca_gerada" (faturado) após extrato.
 * Guard: não rebaixa honorario_pago/cobranca_enviada. Bug DERMAE
 * 07/05/2026 — UI rebaixava processo já pago.
 */
export async function marcarProcessosFaturado(
  selectedProcs: ProcessoDB[],
  lancamentos: Lancamento[],
): Promise<void> {
  const now = new Date().toISOString();
  for (const p of selectedProcs) {
    const lanc = lancamentos.find(l => l.processo_id === p.id && l.tipo === 'receber');
    if (lanc) {
      if (
        lanc.etapa_financeiro === 'honorario_pago' ||
        lanc.etapa_financeiro === 'cobranca_enviada'
      ) continue;
      await supabase
        .from('lancamentos')
        .update({
          etapa_financeiro: 'cobranca_gerada',
          updated_at: now,
        })
        .eq('id', lanc.id);
    }
  }
}
