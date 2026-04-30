import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Cliente, ClienteInsert, ClienteUpdate } from '@/types/supabase';
import type { ClienteDB, ProcessoDB, Lancamento, TipoProcesso } from '@/types/financial';
import { toast } from 'sonner';

const normalizeNullableText = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const normalizeRequiredText = (value: string | null | undefined) => value?.trim() || '';

const normalizeOptionalNullableText = (value: string | null | undefined) => {
  if (value === undefined) return undefined;
  return normalizeNullableText(value);
};

const sanitizeSearch = (value: string) => value.replace(/[,%]/g, '').trim();

const normalizeClienteInsert = (cliente: Record<string, any>): Record<string, any> => {
  const normalized: Record<string, any> = { ...cliente };
  if (normalized.codigo_identificador) normalized.codigo_identificador = normalized.codigo_identificador.trim();
  if (normalized.nome) normalized.nome = normalized.nome.trim();
  normalized.email = normalizeNullableText(normalized.email);
  normalized.telefone = normalizeNullableText(normalized.telefone);
  normalized.nome_contador = normalizeRequiredText(normalized.nome_contador);
  normalized.apelido = normalizeRequiredText(normalized.apelido);
  return normalized;
};

// ---- CLIENTES ----
export function useClientes(searchTerm?: string) {
  return useQuery({
    queryKey: ['clientes', searchTerm ?? ''],
    queryFn: async () => {
      const { data, error } = await supabase.from('clientes').select('*').order('nome');
      if (error) throw error;

      const clientes = (data || []) as ClienteDB[];
      const normalizedSearch = searchTerm ? sanitizeSearch(searchTerm).toLowerCase() : '';
      if (!normalizedSearch) return clientes;

      return clientes.filter((cliente) => {
        const searchable = [
          cliente.nome,
          cliente.codigo_identificador,
          cliente.nome_contador || '',
          cliente.apelido || '',
        ]
          .join(' ')
          .toLowerCase();

        return searchable.includes(normalizedSearch);
      });
    },
  });
}

export function useCreateCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cliente: Record<string, any>) => {
      const payload = normalizeClienteInsert(cliente);
      const { data, error } = await supabase.from('clientes').insert(payload as any).select('*').single();
      if (error) throw error;
      return data as ClienteDB;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes'] });
      qc.invalidateQueries({ queryKey: ['mapa_clientes_estado'] });
      toast.success('Cliente criado com sucesso!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ClienteDB> & { id: string }) => {
      const payload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (updates.codigo_identificador !== undefined) payload.codigo_identificador = updates.codigo_identificador?.trim();
      if (updates.nome !== undefined) payload.nome = updates.nome?.trim();

      const email = normalizeOptionalNullableText(updates.email);
      if (email !== undefined) payload.email = email;

      const telefone = normalizeOptionalNullableText(updates.telefone);
      if (telefone !== undefined) payload.telefone = telefone;

      if (updates.nome_contador !== undefined) payload.nome_contador = normalizeRequiredText(updates.nome_contador);
      if (updates.apelido !== undefined) payload.apelido = normalizeRequiredText(updates.apelido);

      // Financial columns
      const numericFields = ['valor_base', 'desconto_progressivo', 'dia_cobranca', 'valor_limite_desconto', 'mensalidade', 'vencimento', 'qtd_processos', 'dia_vencimento_mensal', 'franquia_processos', 'saldo_prepago', 'saldo_ultima_recarga'] as const;
      for (const field of numericFields) {
        if ((updates as any)[field] !== undefined) payload[field] = (updates as any)[field];
      }
      if (updates.momento_faturamento !== undefined) payload.momento_faturamento = updates.momento_faturamento;
      if ((updates as any).observacoes !== undefined) payload.observacoes = (updates as any).observacoes;
      if ((updates as any).cnpj !== undefined) payload.cnpj = (updates as any).cnpj;
      if ((updates as any).tipo !== undefined) payload.tipo = (updates as any).tipo;
      if ((updates as any).desconto_boas_vindas_aplicado !== undefined) payload.desconto_boas_vindas_aplicado = (updates as any).desconto_boas_vindas_aplicado;
      if ((updates as any).data_ultima_recarga !== undefined) payload.data_ultima_recarga = (updates as any).data_ultima_recarga;
      const textFields = ['estado', 'cidade', 'cep', 'logradouro', 'numero', 'complemento', 'bairro'] as const;
      for (const field of textFields) {
        if ((updates as any)[field] !== undefined) payload[field] = (updates as any)[field];
      }
      const coordFields = ['latitude', 'longitude'] as const;
      for (const field of coordFields) {
        if ((updates as any)[field] !== undefined) payload[field] = (updates as any)[field];
      }

      const { data, error } = await supabase.from('clientes').update(payload as any).eq('id', id).select('*').single();
      if (error) throw error;
      return data as Cliente;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes'] });
      qc.invalidateQueries({ queryKey: ['mapa_clientes_estado'] });
      toast.success('Cliente atualizado!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// audit fix #5 — DELETE bruto era catastrófico:
// Apagava lancamentos + documentos + cliente (cascateando processos/cobrancas).
// 1 clique acidental = todo o histórico financeiro do cliente perdido pra sempre.
// Agora: alias para arquivamento via RPC atômica (arquivar_cliente). Histórico
// financeiro PRESERVADO no banco (lancamentos/cobrancas continuam intactos).
// Para purga real (raríssimo, ex: duplicata sem dados), há `usePurgeClienteForce`
// abaixo, mas o banco bloqueia via RESTRICT se houver dependências.
export function useDeleteCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('arquivar_cliente' as any, {
        p_cliente_id: id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes'] });
      qc.invalidateQueries({ queryKey: ['processos_db'] });
      qc.invalidateQueries({ queryKey: ['lancamentos'] });
      toast.success('Cliente arquivado — histórico financeiro preservado.');
    },
    onError: (e: Error) => toast.error('Erro ao arquivar: ' + e.message),
  });
}

// Purga REAL — só funciona se cliente não tem nenhum lancamento/cobranca/processo.
// Banco bloqueia via FK RESTRICT (audit fix #5). Não exposto na UI por padrão;
// use no console se precisar limpar duplicata acidental sem histórico.
export function usePurgeClienteForce() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('clientes').delete().eq('id', id);
      if (error) {
        if (error.code === '23503') {
          throw new Error(
            'Cliente possui lançamentos, cobranças ou processos. ' +
            'Use arquivar (preserva histórico) em vez de excluir.',
          );
        }
        throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes'] });
      toast.success('Cliente excluído permanentemente.');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// audit fix #5 — usa RPC atômica com role check + tenant check no banco
// (antes: UPDATE direto, dependia 100% do RLS pra barrar cross-tenant)
export function useArchiveCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('arquivar_cliente' as any, {
        p_cliente_id: id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes'] });
      qc.invalidateQueries({ queryKey: ['processos_db'] });
      toast.success('Cliente arquivado!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUnarchiveCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('desarquivar_cliente' as any, {
        p_cliente_id: id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes'] });
      qc.invalidateQueries({ queryKey: ['processos_db'] });
      toast.success('Cliente desarquivado!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---- PROCESSOS ----
export function useProcessos() {
  return useQuery({
    queryKey: ['processos_db'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('processos')
        .select('*, cliente:clientes(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ProcessoDB[];
    },
  });
}

/** Calculate compounding progressive discount */
export function calcularDescontoProgressivo(
  valorBase: number,
  descontoPercent: number,
  processosNoMes: number,
  valorLimite: number | null,
): { valorFinal: number; descontoAcumulado: number; processoNumero: number } {
  let valor = valorBase;
  const processoNumero = processosNoMes + 1; // this will be the Nth process
  for (let i = 0; i < processosNoMes; i++) {
    valor = valor * (1 - descontoPercent / 100);
  }
  if (valorLimite != null && valor < valorLimite) {
    valor = valorLimite;
  }
  valor = Math.max(valor, 0);
  const descontoAcumulado = valorBase - valor;
  return { valorFinal: Math.round(valor * 100) / 100, descontoAcumulado: Math.round(descontoAcumulado * 100) / 100, processoNumero };
}

export function useCreateProcesso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      cliente_id: string;
      razao_social: string;
      tipo: TipoProcesso;
      prioridade?: string;
      responsavel?: string;
      valor_manual?: number;
      notas?: string | null;
      ja_pago?: boolean;
      descricao_avulso?: string;
      desconto_boas_vindas?: number;
      mudanca_uf?: boolean;
      data_entrada?: string;
      dentro_do_plano?: boolean | null;
      valor_avulso?: number;
      justificativa_avulso?: string;
      etiquetas?: string[];
      via_analise?: 'matriz' | 'regional' | 'metodo_trevo';
    }) => {
      const isAvulso = input.tipo === 'avulso';
      const isManualPrice = !!input.valor_manual && input.valor_manual > 0;
      const isUrgente = input.prioridade === 'urgente';

      const { data: clienteData, error: clienteError } = await supabase
        .from('clientes')
        .select('id, tipo, valor_base, momento_faturamento, desconto_progressivo, valor_limite_desconto, franquia_processos, saldo_prepago')
        .eq('id', input.cliente_id)
        .single();
      if (clienteError) throw clienteError;

      const cliente = clienteData as any;
      const isPrePago = cliente.tipo === 'PRE_PAGO';
      const isMensalista = cliente.tipo === 'MENSALISTA';
      const isPrecoPorTipo = cliente.tipo === 'PRECO_POR_TIPO';
      const valorBaseCliente = Number(cliente.valor_base ?? 0);
      const descontoPercent = Number(cliente.desconto_progressivo ?? 0);
      const valorLimite = cliente.valor_limite_desconto != null ? Number(cliente.valor_limite_desconto) : null;

      // Se cliente é PRECO_POR_TIPO, tenta resolver preço fixo do tipo do processo
      let precoPorTipoFixo: number | null = null;
      if (isPrecoPorTipo && !isAvulso && !isManualPrice) {
        const { data: precoRpc, error: precoErr } = await supabase.rpc(
          'get_preco_por_tipo' as any,
          { p_cliente_id: input.cliente_id, p_tipo: input.tipo }
        );
        if (precoErr) {
          console.warn('[useCreateProcesso] erro ao buscar preco_por_tipo:', precoErr);
        }
        if (precoRpc != null) precoPorTipoFixo = Number(precoRpc);
      }

      // Count same-month processes for this client based on data_entrada (or today)
      const refDate = input.data_entrada ? new Date(input.data_entrada + 'T12:00:00') : new Date();
      const startOfMonth = new Date(refDate.getFullYear(), refDate.getMonth(), 1).toISOString();
      const endOfMonth = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 1).toISOString();
      const { count: processosNoMes } = await supabase
        .from('processos')
        .select('id', { count: 'exact', head: true })
        .eq('cliente_id', input.cliente_id)
        .gte('created_at', startOfMonth)
        .lt('created_at', endOfMonth);

      const monthCount = processosNoMes ?? 0;

      // How many "slots" this process consumes (mudança de UF = 2)
      const slots = input.mudanca_uf ? 2 : 1;

      let valorFinal: number;
      let discountInfo = '';

      if (isAvulso) {
        valorFinal = isManualPrice ? Number(input.valor_manual) : 0;
      } else if (isManualPrice) {
        valorFinal = Number(input.valor_manual);
      } else if (isPrecoPorTipo) {
        // Preço fixo por tipo de processo, sem desconto progressivo/franquia.
        // Urgência ainda se aplica (+50%). Mudança UF duplica (2 processos).
        if (precoPorTipoFixo == null) {
          throw new Error(
            `Cliente "${input.razao_social}" é do tipo "Preço por Tipo" mas não tem preço configurado pro tipo "${input.tipo}". Configure em Clientes → Editar → Preços por Tipo antes de cadastrar o processo.`
          );
        }
        let base = precoPorTipoFixo;
        if (isUrgente) base = base * 1.5;
        if (slots === 2) base = base * 2;
        valorFinal = Math.round(base * 100) / 100;
        discountInfo = `Preço fixo por tipo (${input.tipo}): R$ ${precoPorTipoFixo.toFixed(2)}`
          + (isUrgente ? ' × 1.5 Urgência' : '')
          + (slots === 2 ? ' × 2 (Mudança UF)' : '');
      } else if (isPrePago) {
        valorFinal = isManualPrice ? Number(input.valor_manual) : 0;
      } else if (isMensalista) {
        const franquia = Number(cliente.franquia_processos ?? 0);
        if (franquia > 0 && monthCount < franquia) {
          valorFinal = 0;
          discountInfo = `Dentro da franquia (${monthCount + 1}/${franquia})`;
        } else {
          const excedenteCount = franquia > 0 ? monthCount - franquia : monthCount;
          if (isUrgente) {
            valorFinal = valorBaseCliente * 1.5;
            discountInfo = `Método Trevo / Urgência | Base: R$ ${valorBaseCliente.toFixed(2)} × 1.5 = R$ ${valorFinal.toFixed(2)}`;
          } else if (descontoPercent > 0) {
            const calc = calcularDescontoProgressivo(valorBaseCliente, descontoPercent, excedenteCount, valorLimite);
            valorFinal = calc.valorFinal;
            discountInfo = `Excedente nº ${excedenteCount + 1} | Base: R$ ${valorBaseCliente.toFixed(2)} | Desc: R$ ${calc.descontoAcumulado.toFixed(2)}`;
          } else {
            valorFinal = valorBaseCliente;
          }
        }
      } else if (cliente.tipo !== 'MENSALISTA') {
        if (isUrgente) {
          valorFinal = valorBaseCliente * 1.5;
          discountInfo = `Método Trevo / Urgência | Base: R$ ${valorBaseCliente.toFixed(2)} × 1.5 = R$ ${valorFinal.toFixed(2)}`;
        } else if (slots === 2 && descontoPercent > 0) {
          const calc1 = calcularDescontoProgressivo(valorBaseCliente, descontoPercent, monthCount, valorLimite);
          const calc2 = calcularDescontoProgressivo(valorBaseCliente, descontoPercent, monthCount + 1, valorLimite);
          valorFinal = calc1.valorFinal + calc2.valorFinal;
          discountInfo = `Mudança de UF (2 Processos) | Proc ${calc1.processoNumero}: R$ ${calc1.valorFinal.toFixed(2)} + Proc ${calc2.processoNumero}: R$ ${calc2.valorFinal.toFixed(2)}`;
        } else if (slots === 2) {
          valorFinal = valorBaseCliente * 2;
          discountInfo = `Mudança de UF (2 Processos) | 2 × R$ ${valorBaseCliente.toFixed(2)}`;
        } else if (descontoPercent > 0) {
          const calc = calcularDescontoProgressivo(valorBaseCliente, descontoPercent, monthCount, valorLimite);
          valorFinal = calc.valorFinal;
          if (calc.descontoAcumulado > 0) {
            discountInfo = `Desconto Progressivo: ${descontoPercent}% (Processo nº ${calc.processoNumero} do mês) | Base: R$ ${valorBaseCliente.toFixed(2)} | Desconto: R$ ${calc.descontoAcumulado.toFixed(2)}`;
          }
        } else {
          valorFinal = valorBaseCliente;
        }
      } else {
        valorFinal = isUrgente ? valorBaseCliente * 1.5 : valorBaseCliente;
      }

      // Apply welcome discount ATOMICAMENTE
      // RPC tentar_aplicar_boas_vindas faz SELECT FOR UPDATE + UPDATE na
      // mesma transação. Se 2 workers pedem ao mesmo tempo, só 1 ganha o
      // aplicado=true; o outro ignora o desconto sem drama.
      // Se a criação do processo falhar depois, um catch externo chama
      // reverter_boas_vindas pra desfazer a marcação.
      let welcomeDiscountInfo = '';
      let welcomeLockAcquired = false;
      if (input.desconto_boas_vindas && input.desconto_boas_vindas > 0) {
        const { data: lockResult, error: lockErr } = await supabase.rpc(
          'tentar_aplicar_boas_vindas' as any,
          { p_cliente_id: input.cliente_id }
        );
        if (lockErr) throw new Error(`Falha ao reservar boas-vindas: ${lockErr.message}`);
        const applied = (lockResult as any)?.aplicado === true;
        if (applied) {
          welcomeLockAcquired = true;
          const discountAmt = valorFinal * (input.desconto_boas_vindas / 100);
          valorFinal = Math.round((valorFinal - discountAmt) * 100) / 100;
          welcomeDiscountInfo = `Desconto de Boas-vindas aplicado: ${input.desconto_boas_vindas}% (-R$ ${discountAmt.toFixed(2)})`;
        } else {
          // Cliente já recebeu boas-vindas (outra aba/outro worker ganhou a corrida).
          // Não aplica desconto; loga pra telemetria.
          console.warn('[useCreateProcesso] Boas-vindas ignoradas — já aplicadas pra este cliente');
        }
      }

      // A partir daqui: se lockou boas-vindas e quebrar alguma coisa abaixo,
      // precisa reverter pra não "queimar" o direito do cliente.
      try {

      // Append discount info to notas
      let notasFinal = input.notas || '';
      if (welcomeDiscountInfo) {
        notasFinal = notasFinal ? `${notasFinal}\n${welcomeDiscountInfo}` : welcomeDiscountInfo;
      }
      if (discountInfo) {
        notasFinal = notasFinal ? `${notasFinal}\n${discountInfo}` : discountInfo;
      }

      const createdAt = input.data_entrada
        ? new Date(input.data_entrada + 'T12:00:00').toISOString()
        : new Date().toISOString();

      // Build lancamento description
      const serviceName = isAvulso && input.descricao_avulso
        ? input.descricao_avulso
        : `${input.tipo.charAt(0).toUpperCase() + input.tipo.slice(1)}`;
      const descParts = [input.mudanca_uf ? `${serviceName} (Mudança de UF - 2 Processos)` : `${serviceName}`];
      descParts[0] += ` - ${input.razao_social}`;
      if (isUrgente && !isManualPrice && !isAvulso) descParts.push('(+50% Urgência)');
      if (isManualPrice && !isAvulso) descParts.push('(Valor Manual)');
      if (discountInfo && !input.mudanca_uf) descParts.push(`(${descontoPercent}% desc.)`);
      if (welcomeDiscountInfo) descParts.push(`(Boas-vindas ${input.desconto_boas_vindas}%)`);

      const momentoFat = cliente.momento_faturamento || 'na_solicitacao';
      const shouldCreateLancamento = input.ja_pago || momentoFat === 'na_solicitacao';

      const lancDate = input.data_entrada || new Date().toISOString().split('T')[0];

      // Avulso extra lancamento (fora do plano)
      const criarAvulsoExtra = input.dentro_do_plano === false && !!input.valor_avulso && input.valor_avulso > 0;
      const descAvulsoExtra = criarAvulsoExtra
        ? `Honorário avulso - ${input.tipo.charAt(0).toUpperCase() + input.tipo.slice(1)} - ${input.razao_social}${input.justificativa_avulso ? ` (${input.justificativa_avulso})` : ''}`
        : '';

      // RPC criar_processo_com_lancamento aceita p_via_analise.
      // Salva tudo atômico (processo + lançamento + via). Se a coluna
      // via_analise ainda não existir no schema (legado), a RPC ignora
      // silenciosamente o param sem falhar.
      const { data: processoId, error: rpcError } = await supabase.rpc('criar_processo_com_lancamento', {
        p_cliente_id: input.cliente_id,
        p_razao_social: input.razao_social,
        p_tipo: input.tipo,
        p_prioridade: input.prioridade || 'normal',
        p_responsavel: input.responsavel || null,
        p_valor: valorFinal,
        p_notas: notasFinal || null,
        p_created_at: createdAt,
        p_dentro_do_plano: input.dentro_do_plano ?? null,
        p_valor_avulso: input.valor_avulso ?? 0,
        p_justificativa_avulso: input.justificativa_avulso || null,
        p_etiquetas: input.etiquetas || [],
        p_criar_lancamento: shouldCreateLancamento,
        p_descricao_lancamento: descParts.join(' '),
        p_ja_pago: input.ja_pago || false,
        p_data_vencimento: null,
        p_data_lancamento: lancDate,
        p_criar_avulso_extra: criarAvulsoExtra,
        p_valor_avulso_extra: criarAvulsoExtra ? input.valor_avulso! : 0,
        p_descricao_avulso_extra: descAvulsoExtra,
        p_via_analise: input.via_analise || 'matriz',
      } as any);

      if (rpcError) throw rpcError;

      // Fetch complete processo object
      const { data: processo, error: fetchError } = await supabase
        .from('processos')
        .select('*, cliente:clientes(*)')
        .eq('id', processoId)
        .single();
      if (fetchError) throw fetchError;

      // Debit prepaid balance if PRE_PAGO (uses permissive RLS)
      if (isPrePago && valorFinal > 0) {
        const saldoAtual = Number(cliente.saldo_prepago ?? 0);
        const novoSaldo = saldoAtual - valorFinal;
        await supabase
          .from('clientes')
          .update({ saldo_prepago: novoSaldo, updated_at: new Date().toISOString() } as any)
          .eq('id', input.cliente_id);
        await supabase
          .from('prepago_movimentacoes')
          .insert({
            cliente_id: input.cliente_id,
            tipo: 'consumo',
            valor: valorFinal,
            saldo_anterior: saldoAtual,
            saldo_posterior: novoSaldo,
            descricao: `${input.tipo.charAt(0).toUpperCase() + input.tipo.slice(1)} - ${input.razao_social}`,
            processo_id: processoId,
          } as any);
      }

      // NOTA: marcação de boas-vindas já aconteceu atomicamente via RPC
      // tentar_aplicar_boas_vindas (dentro do SELECT FOR UPDATE). Não
      // precisamos mais do UPDATE redundante que existia aqui.

      return processo as ProcessoDB;

      } catch (err) {
        // Se a criação do processo falhou depois de ganhar o lock de
        // boas-vindas, revertemos pra que o cliente NÃO perca o direito.
        if (welcomeLockAcquired) {
          try {
            await supabase.rpc('reverter_boas_vindas' as any, { p_cliente_id: input.cliente_id });
          } catch (revertErr) {
            console.error('[useCreateProcesso] Falha ao reverter boas-vindas:', revertErr);
          }
        }
        throw err;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['processos_db'] });
      qc.invalidateQueries({ queryKey: ['lancamentos'] });
      qc.invalidateQueries({ queryKey: ['dashboard_stats'] });
      qc.invalidateQueries({ queryKey: ['processos_financeiro'] });
      toast.success('Processo criado!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// Generate billing when process is deferred (for 'no_deferimento' clients)
export async function gerarFaturamentoDeferimento(processo: ProcessoDB) {
  const clienteId = processo.cliente_id;
  // Fetch client to get momento_faturamento
  const { data: cliente } = await supabase.from('clientes').select('*').eq('id', clienteId).single();
  if (!cliente) return;
  const momentoFat = (cliente as any)?.momento_faturamento || 'na_solicitacao';
  if (momentoFat !== 'no_deferimento') return;

  // Check if billing already exists for this process
  const { data: existing } = await supabase.from('lancamentos').select('id').eq('processo_id', processo.id).eq('tipo', 'receber');
  if (existing && existing.length > 0) return; // Already billed

  const { data: vencimento } = await supabase.rpc('calcular_vencimento', { p_cliente_id: clienteId });
  const valorFinal = Number(processo.valor) || 0;
  const desc = `${processo.tipo.charAt(0).toUpperCase() + processo.tipo.slice(1)} - ${processo.razao_social} (Deferido)`;

  const { error } = await supabase.from('lancamentos').insert({
    tipo: 'receber',
    cliente_id: clienteId,
    processo_id: processo.id,
    descricao: desc,
    valor: valorFinal,
    status: 'pendente',
    data_vencimento: vencimento || new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0],
  });
  if (error) toast.error('Erro ao gerar faturamento: ' + error.message);
  else toast.success('Faturamento gerado automaticamente (Deferimento)!');
}

// ---- LANÇAMENTOS ----
export function useLancamentos(tipo?: 'receber' | 'pagar') {
  return useQuery({
    queryKey: ['lancamentos', tipo],
    queryFn: async () => {
      let query = supabase
        .from('lancamentos')
        .select('*, cliente:clientes(*), processo:processos(*)')
        .order('data_vencimento', { ascending: true });
      if (tipo) query = query.eq('tipo', tipo);
      const { data, error } = await query;
      if (error) throw error;
      return data as Lancamento[];
    },
  });
}

export function useCreateLancamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lancamento: Partial<Lancamento>) => {
      const { data, error } = await supabase.from('lancamentos').insert(lancamento as any).select().single();
      if (error) throw error;
      return data as Lancamento;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lancamentos'] });
      toast.success('Lançamento criado!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateLancamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Lancamento> & { id: string }) => {
      const { data, error } = await supabase
        .from('lancamentos')
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Lancamento;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lancamentos'] });
      toast.success('Lançamento atualizado!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteLancamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lancamentos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lancamentos'] });
      toast.success('Lançamento excluído!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---- DASHBOARD STATS ----
export function useFinanceiroDashboard() {
  return useQuery({
    queryKey: ['financeiro_dashboard'],
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const in7days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
      const today = now.toISOString().split('T')[0];

      const { data: receitaMes } = await supabase
        .from('lancamentos')
        .select('valor')
        .eq('tipo', 'receber')
        .gte('data_vencimento', startOfMonth)
        .in('status', ['pendente', 'pago']);

      const { data: receber7d } = await supabase
        .from('lancamentos')
        .select('valor')
        .eq('tipo', 'receber')
        .eq('status', 'pendente')
        .gte('data_vencimento', today)
        .lte('data_vencimento', in7days);

      // Taxas a Reembolsar: sum of valores_adicionais without comprovante_url
      const { data: taxasReemb } = await supabase
        .from('valores_adicionais')
        .select('valor, comprovante_url')
        .is('comprovante_url', null);

      const sum = (arr: any[] | null) => (arr || []).reduce((s, r) => s + Number(r.valor), 0);

      return {
        receitaPrevistaMes: sum(receitaMes),
        aReceber7dias: sum(receber7d),
        taxasReembolsar: sum(taxasReemb),
      };
    },
  });
}
