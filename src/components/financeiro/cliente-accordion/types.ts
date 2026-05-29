import type { LancamentoFinanceiro } from '@/hooks/useFinanceiroClientes';

export type ExtratoGeradoPayload = {
  blob: Blob;
  filename: string;
  clienteId: string;
  clienteNome: string;
  clienteTelefone: string;
  total: number;
  /** Lancamentos included in this extrato — used for WhatsApp message */
  lancamentos: LancamentoFinanceiro[];
  cobrancaUrl?: string;
  cobrancaId?: string;
  /** 27/05 noite: true quando o ERP disparou asaas-gerar-cobranca em background.
   *  Popup mostra spinner "Gerando Boleto/PIX..." no lugar do botão até o
   *  useCobrancaAsaas detectar asaas_payment_id (via invalidateQueries).
   *  Quando false ou Asaas falhou, popup mostra botão manual de retry. */
  asaasGerandoAuto?: boolean;
  cleanup?: () => void;
};

export type ExtratoRequestPayload = {
  requestKey: string;
  clienteId: string;
  clienteNome: string;
  clienteTelefone: string;
  lancamentos: LancamentoFinanceiro[];
};

export interface MsgBuilderParams {
  lancamentos: LancamentoFinanceiro[];
  vaMap: Record<string, number>;
  vaDetalhadoMap?: Record<string, Array<{ descricao: string; valor: number }>>;
  diasAtraso: number;
  nomeRemetente: string;
  observacao?: string;
  /** 27/05 noite: data vencimento da cobrança (vinda do Asaas ou ajustada
   *  manualmente). Quando passada, sobrescreve a data do lançamento. */
  dataVencimentoOverride?: string | null;
}
