// SEC-019 (12/05/2026): filtro client-side de visibilidade de notificações
// por role. Extraído de NotificationPopover.tsx (mesma rodada) pra ficar
// testável de forma isolada.
//
// AVISO: este filtro é cosmético — payload realtime ainda chega via
// WebSocket pra todos os autenticados da mesma empresa. Não conta como
// controle de segurança. SEC-020 (refactor estrutural notificação) resolve
// adicionando `destinatario_id` na tabela.

export type NotificacaoTipo =
  | 'aprovacao'
  | 'recusa'
  | 'assinatura'
  | 'cobranca'
  | 'pagamento'
  | 'login_novo';

export interface NotificacaoFilterInput {
  tipo: NotificacaoTipo;
  orcamento_id: string | null;
}

export interface PermCtx {
  isMaster: boolean;
  podeVerFinanceiro: boolean;
  podeVerOrcamentos: boolean;
}

export function canSeeNotificacao(n: NotificacaoFilterInput, ctx: PermCtx): boolean {
  if (ctx.isMaster) return true;

  // "Novo usuário aguardando aprovação" usa tipo=aprovacao sem orcamento_id.
  // Só master aprova usuário → não-master nunca vê.
  if (n.tipo === 'aprovacao' && !n.orcamento_id) return false;

  // SEC-025: alerta de login novo é só pra master.
  if (n.tipo === 'login_novo') return false;

  if (n.tipo === 'cobranca' || n.tipo === 'pagamento') return ctx.podeVerFinanceiro;
  if (n.tipo === 'aprovacao' || n.tipo === 'recusa' || n.tipo === 'assinatura') {
    return ctx.podeVerOrcamentos;
  }
  return false;
}
