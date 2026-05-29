// Refatorado em 29/05/2026 — código original fragmentado em ./cliente-accordion/*.
// Este arquivo permanece como shim de compatibilidade pra não quebrar imports
// existentes (pages/Financeiro.tsx etc). Toda a lógica vive em ./cliente-accordion/.
export type { ExtratoGeradoPayload, ExtratoRequestPayload } from './cliente-accordion';
export {
  getNomeRemetente,
  buildValoresAdicionaisDetalhadosMap,
  buildMensagemFromLancamentos,
  buildExtratoFilename,
  ClientesFaturar,
  ClientesEnviar,
  ClientesAguardando,
  ClientesRecebidos,
  ModalPosExtrato,
} from './cliente-accordion';
