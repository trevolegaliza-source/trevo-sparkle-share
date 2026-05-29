// Barrel — preserves the original public API of ClienteAccordionFinanceiro.tsx.
// Anything that was exported from the monolithic file is re-exported here.
export type { ExtratoGeradoPayload, ExtratoRequestPayload } from './types';
export { getNomeRemetente, buildValoresAdicionaisDetalhadosMap, buildMensagemFromLancamentos } from './helpers';
export { buildExtratoFilename } from './utils';
export { ClientesFaturar } from './FaturarItem';
export { ClientesEnviar } from './EnviarItem';
export { ClientesAguardando } from './AguardandoItem';
export { ClientesRecebidos } from './RecebidoItem';
export { ModalPosExtrato } from './ModalPosExtrato';
