import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useClientes, useCreateProcesso } from '@/hooks/useFinanceiro';
import { useServiceNegotiations } from '@/hooks/useServiceNegotiations';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ClienteDB, TipoProcesso } from '@/types/financial';

import WizardSteps from '@/components/cadastro-rapido/WizardSteps';
import StepCliente from '@/components/cadastro-rapido/StepCliente';
import StepProcesso, { type ProcessoFormData } from '@/components/cadastro-rapido/StepProcesso';
import StepValor, { type ValorFormData } from '@/components/cadastro-rapido/StepValor';
import StepRevisao from '@/components/cadastro-rapido/StepRevisao';
import FichaCliente from '@/components/cadastro-rapido/FichaCliente';
import PreviewFinanceiro, { calcPreview } from '@/components/cadastro-rapido/PreviewFinanceiro';
import UltimosProcessos from '@/components/cadastro-rapido/UltimosProcessos';
import FilaBatch, { type ProcessoNaFila } from '@/components/cadastro-rapido/FilaBatch';
import FeedbackSucesso, { type ProcessoSalvo } from '@/components/cadastro-rapido/FeedbackSucesso';

const INITIAL_PROCESSO: ProcessoFormData = {
  razaoSocial: '',
  tipo: 'abertura',
  responsavel: '',
  prioridade: 'normal',
  mudancaUF: false,
  descricaoAvulso: '',
  dataEntrada: new Date().toISOString().split('T')[0],
  dentroDoPlano: true,
  valorAvulso: 0,
  justificativaAvulso: '',
  etiquetas: [],
  viaAnalise: 'matriz',
};

const INITIAL_VALOR: ValorFormData = {
  metodoPreco: 'automatico',
  valorManual: '',
  motivoManual: '',
  boasVindas: false,
  boasVindasPct: '50',
  jaPago: false,
  observacoes: '',
  servicoPreAcordadoId: '',
};

export default function CadastroRapido() {
  const { data: clientes } = useClientes();
  const createProcesso = useCreateProcesso();
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [processoForm, setProcessoForm] = useState<ProcessoFormData>(INITIAL_PROCESSO);
  const [valorForm, setValorForm] = useState<ValorFormData>(INITIAL_VALOR);
  const [fila, setFila] = useState<ProcessoNaFila[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [savedProcessos, setSavedProcessos] = useState<ProcessoSalvo[]>([]);
  const [totalEconomia, setTotalEconomia] = useState(0);
  const [isFirstProcess, setIsFirstProcess] = useState(false);
  const isSubmitting = useRef(false);
  const prefillApplied = useRef(false);

  // Pré-preencher via query params (vindos da Reconciliação Trello)
  useEffect(() => {
    if (prefillApplied.current) return;
    if (!clientes || clientes.length === 0) return;

    const codigo = searchParams.get('cliente_codigo');
    const razao = searchParams.get('razao_social');
    const tipo = searchParams.get('tipo') as TipoProcesso | null;

    if (!codigo && !razao && !tipo) return;

    if (codigo) {
      const c = clientes.find((c) => c.codigo_identificador === codigo);
      if (c) setClienteId(c.id);
    }
    if (razao || tipo) {
      setProcessoForm((prev) => ({
        ...prev,
        razaoSocial: razao || prev.razaoSocial,
        tipo: (tipo as any) || prev.tipo,
      }));
    }
    prefillApplied.current = true;
    // Limpar query params para não re-aplicar
    setSearchParams({}, { replace: true });
  }, [clientes, searchParams, setSearchParams]);

  const selectedCliente = (clientes || []).find(c => c.id === clienteId) || null;
  const { data: negotiations } = useServiceNegotiations(clienteId || undefined);

  // Fetch colaboradores for responsavel select
  const { data: colaboradores } = useQuery({
    queryKey: ['colaboradores_ativos_cadastro'],
    queryFn: async () => {
      const { data } = await supabase.from('colaboradores').select('id, nome').eq('status', 'ativo');
      return data || [];
    },
  });

  // Count processes this month
  const { data: processosNoMes = 0 } = useQuery({
    queryKey: ['processos_mes_count', clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { count } = await supabase
        .from('processos')
        .select('id', { count: 'exact', head: true })
        .eq('cliente_id', clienteId!)
        .gte('created_at', startOfMonth);
      return count ?? 0;
    },
  });

  const checkFirstProcess = useCallback(async (cliente: ClienteDB | null) => {
    if (!cliente?.id) {
      setIsFirstProcess(false);
      return false;
    }

    const { count, error } = await supabase
      .from('processos')
      .select('*', { count: 'exact', head: true })
      .eq('cliente_id', cliente.id);

    if (error) {
      console.error('Erro ao checar primeiro processo:', error);
      setIsFirstProcess(false);
      return false;
    }

    const jaAplicou = (cliente as any).desconto_boas_vindas_aplicado === true;
    const ehPrimeiro = (count ?? 0) === 0;
    const mostrarBoasVindas = ehPrimeiro;

    console.log('CHECK BOAS-VINDAS:', {
      clienteId: cliente.id,
      count,
      jaAplicou,
      ehPrimeiro,
      mostrarBoasVindas,
    });

    if (ehPrimeiro && jaAplicou) {
      console.warn('Cliente com 0 processos e flag de boas-vindas já aplicada; habilitando switch para correção de legado.');
    }

    setIsFirstProcess(mostrarBoasVindas);
    return mostrarBoasVindas;
  }, []);

  useEffect(() => {
    checkFirstProcess(selectedCliente);
  }, [selectedCliente?.id, checkFirstProcess]);

  const isAvulso = processoForm.tipo === 'avulso';
  const clienteTipo = selectedCliente?.tipo || 'AVULSO_4D';
  const saldoPrepago = Number((selectedCliente as any)?.saldo_prepago ?? 0);
  const franquiaProcessos = Number((selectedCliente as any)?.franquia_processos ?? 0);
  const nextSlot = processosNoMes + fila.length + 1;

  // Preview calculation
  const preview = selectedCliente
    ? calcPreview({
        cliente: selectedCliente,
        processosNoMes,
        filaLength: fila.length,
        prioridade: processoForm.prioridade,
        metodoPreco: valorForm.metodoPreco,
        valorManual: valorForm.valorManual,
        boasVindas: valorForm.boasVindas,
        boasVindasPct: valorForm.boasVindasPct,
        mudancaUF: processoForm.mudancaUF,
        isAvulso,
      })
    : { valorFinal: 0, slotNumero: 1, descontoAplicado: 0 };

  // Step navigation
  const goToStep = (s: number) => setStep(s as 1 | 2 | 3 | 4);

  const handleSelectCliente = (id: string) => {
    setClienteId(id);
  };

  const proceedToStep2 = () => {
    setCompletedSteps(prev => prev.includes(1) ? prev : [...prev, 1]);
    setStep(2);
  };

  const handleNextStep1 = async () => {
    if (!selectedCliente) return;

    await checkFirstProcess(selectedCliente);
    setValorForm(prev => ({ ...prev, boasVindas: false, boasVindasPct: '50' }));
    proceedToStep2();
  };

  const handleNextStep2 = () => {
    setCompletedSteps(prev => prev.includes(2) ? prev : [...prev, 2]);
    setStep(3);
  };

  const handleNextStep3 = () => {
    setCompletedSteps(prev => prev.includes(3) ? prev : [...prev, 3]);
    setStep(4);
  };

  // Build a queue item from current form state
  const buildQueueItem = (): ProcessoNaFila => ({
    id: crypto.randomUUID(),
    razaoSocial: processoForm.razaoSocial,
    tipo: processoForm.tipo,
    responsavel: processoForm.responsavel,
    prioridade: processoForm.prioridade,
    mudancaUF: processoForm.mudancaUF,
    metodoPreco: valorForm.metodoPreco,
    valorManual: valorForm.valorManual,
    motivoManual: valorForm.motivoManual,
    boasVindas: valorForm.boasVindas,
    boasVindasPct: valorForm.boasVindasPct,
    jaPago: valorForm.jaPago,
    observacoes: valorForm.observacoes,
    descricaoAvulso: processoForm.descricaoAvulso,
    dataEntrada: processoForm.dataEntrada,
    dentroDoPlano: processoForm.dentroDoPlano,
    valorAvulso: processoForm.valorAvulso,
    justificativaAvulso: processoForm.justificativaAvulso,
    etiquetas: processoForm.etiquetas || [],
    viaAnalise: processoForm.viaAnalise,
    valorFinal: preview.valorFinal,
    slotNumero: preview.slotNumero,
    descontoAplicado: preview.descontoAplicado,
  });

  const handleAddToQueue = () => {
    const item = buildQueueItem();
    const newFila = [...fila, item];
    setFila(recalcFila(newFila, selectedCliente!, processosNoMes));
    setProcessoForm(INITIAL_PROCESSO);
    setValorForm(INITIAL_VALOR);
    setStep(2);
    setCompletedSteps([1]);
    toast.success('Adicionado à fila!');
  };

  const recalcFila = (items: ProcessoNaFila[], cliente: ClienteDB, mesCount: number): ProcessoNaFila[] => {
    let slotOffset = mesCount;
    return items.map(item => {
      const isItemAvulso = item.tipo === 'avulso';
      if (isItemAvulso || item.metodoPreco === 'manual' || item.metodoPreco === 'servico_preacordado') {
        const slot = slotOffset + 1;
        slotOffset += item.mudancaUF ? 2 : 1;
        return { ...item, slotNumero: slot, valorFinal: Number(item.valorManual) || 0, descontoAplicado: 0 };
      }
      const p = calcPreview({
        cliente,
        processosNoMes: slotOffset,
        filaLength: 0,
        prioridade: item.prioridade,
        metodoPreco: item.metodoPreco,
        valorManual: item.valorManual,
        boasVindas: item.boasVindas,
        boasVindasPct: item.boasVindasPct,
        mudancaUF: item.mudancaUF,
        isAvulso: false,
      });
      slotOffset += item.mudancaUF ? 2 : 1;
      return { ...item, valorFinal: p.valorFinal, slotNumero: p.slotNumero, descontoAplicado: p.descontoAplicado };
    });
  };

  const handleRemoveFromQueue = (id: string) => {
    const newFila = fila.filter(p => p.id !== id);
    setFila(selectedCliente ? recalcFila(newFila, selectedCliente, processosNoMes) : newFila);
  };

  const handleClearQueue = () => {
    setFila([]);
  };

  // Anti-duplicata: check for recent duplicate
  const checkDuplicate = async (items: ProcessoNaFila[]): Promise<boolean> => {
    if (!clienteId) return false;
    const sixtySecondsAgo = new Date(Date.now() - 60000).toISOString();
    for (const item of items) {
      const { count } = await supabase
        .from('processos')
        .select('id', { count: 'exact', head: true })
        .eq('cliente_id', clienteId)
        .eq('razao_social', item.razaoSocial)
        .eq('tipo', item.tipo as any)
        .gte('created_at', sixtySecondsAgo);
      if ((count ?? 0) > 0) {
        toast.error(`Processo "${item.razaoSocial}" já cadastrado nos últimos 60 segundos. Aguarde.`);
        return true;
      }
    }
    return false;
  };

  // Save processes
  // Fluxo tolerante a falhas: cada item roda no seu try/catch.
  // Sucessos vão pra `saved`, falhas pra `failed`. No final:
  //   - Tudo OK → feedback sucesso + limpa estado
  //   - Tudo falhou → toast de erro + mantém fila pra retry
  //   - Parcial → toast explícito (X salvos, Y falharam, lista quais)
  //              + mantém SÓ os que falharam na fila (retry só do que falta)
  const saveProcessos = async (items: ProcessoNaFila[]) => {
    // Double-click guard
    if (isSubmitting.current) return;
    isSubmitting.current = true;
    setIsSaving(true);

    try {
      // Anti-duplicata check
      const hasDuplicate = await checkDuplicate(items);
      if (hasDuplicate) {
        setIsSaving(false);
        isSubmitting.current = false;
        return;
      }

      const saved: ProcessoSalvo[] = [];
      const failed: Array<{ item: ProcessoNaFila; error: string }> = [];
      let economia = 0;

      for (const item of items) {
        const neg = (negotiations || []).find(n => n.id === item.tipo);
        const tipoFinal = neg ? 'avulso' : item.tipo;
        const valorFinal = item.metodoPreco === 'manual' || item.metodoPreco === 'servico_preacordado' || item.tipo === 'avulso'
          ? Number(item.valorManual) || 0
          : undefined;

        let notas = item.observacoes || '';
        if (item.tipo === 'avulso' && item.descricaoAvulso) {
          notas = `[AVULSO:${item.descricaoAvulso}]${notas ? '\n' + notas : ''}`;
        }
        if (item.motivoManual) {
          notas = `Motivo valor manual: ${item.motivoManual}${notas ? '\n' + notas : ''}`;
        }
        if (neg) {
          notas = `Valor fixo conforme negociação: ${neg.service_name}.${notas ? '\n' + notas : ''}`;
        }

        try {
          await createProcesso.mutateAsync({
            cliente_id: clienteId!,
            razao_social: item.razaoSocial,
            tipo: tipoFinal as TipoProcesso,
            prioridade: item.prioridade,
            responsavel: item.responsavel || undefined,
            valor_manual: valorFinal,
            notas: notas || undefined,
            ja_pago: item.jaPago,
            descricao_avulso: item.tipo === 'avulso' ? item.descricaoAvulso : undefined,
            desconto_boas_vindas: item.boasVindas ? Number(item.boasVindasPct) : undefined,
            mudanca_uf: item.mudancaUF,
            data_entrada: item.dataEntrada,
            dentro_do_plano: selectedCliente?.tipo === 'MENSALISTA' ? item.dentroDoPlano : undefined,
            valor_avulso: !item.dentroDoPlano ? item.valorAvulso : 0,
            justificativa_avulso: !item.dentroDoPlano ? item.justificativaAvulso : undefined,
            etiquetas: item.etiquetas || [],
            via_analise: item.viaAnalise,
          });

          saved.push({
            razaoSocial: item.razaoSocial,
            tipo: tipoFinal,
            valorFinal: item.valorFinal,
          });
          economia += item.descontoAplicado;
        } catch (err: any) {
          const msg = err?.message || 'Erro desconhecido';
          console.error(`[saveProcessos] Falha em "${item.razaoSocial}":`, err);
          failed.push({ item, error: msg });
        }
      }

      // Decide desfecho
      if (failed.length === 0) {
        // Tudo salvou
        setSavedProcessos(saved);
        setTotalEconomia(economia);
        setFeedbackOpen(true);
        setFila([]);
        setProcessoForm(INITIAL_PROCESSO);
        setValorForm(INITIAL_VALOR);
        setStep(1);
        setCompletedSteps([]);
        setClienteId(null);
      } else if (saved.length === 0) {
        // Nada salvou — mantém fila pra retry
        const primeirosErros = failed.slice(0, 3).map(f => `• "${f.item.razaoSocial}": ${f.error}`).join('\n');
        toast.error(
          `Nenhum processo salvo (${failed.length} falharam). Fila mantida pra retry.\n${primeirosErros}${failed.length > 3 ? `\n… e mais ${failed.length - 3}` : ''}`,
          { duration: 10000 }
        );
        // Fila permanece intacta — Thales/Carolina clica "Salvar Todos" de novo
      } else {
        // Salvou alguns, falhou outros — mantém só os que falharam
        const nomesSalvos = saved.map(s => `"${s.razaoSocial}"`).join(', ');
        const nomesFalharam = failed.map(f => `"${f.item.razaoSocial}"`).join(', ');
        toast.warning(
          `${saved.length} salvo(s) com sucesso: ${nomesSalvos}.\n${failed.length} falhou(aram): ${nomesFalharam}. Fila mantida só com os que falharam.`,
          { duration: 10000 }
        );
        // Fila fica só com os que falharam — user corrige e reenvia
        setFila(failed.map(f => f.item));
        // Mostra feedback dos que salvaram
        setSavedProcessos(saved);
        setTotalEconomia(economia);
        setFeedbackOpen(true);
        // Não limpa cliente/step — ele pode querer continuar corrigindo
      }
    } catch (err: any) {
      // Erro fora do loop (check_duplicate, etc) — falha geral
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setIsSaving(false);
      isSubmitting.current = false;
    }
  };

  const handleSave = () => {
    const allItems = [...fila, buildQueueItem()];
    saveProcessos(allItems);
  };

  const handleSaveAll = () => {
    saveProcessos(fila);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cadastro Rápido</h1>
        <p className="text-sm text-muted-foreground">Cadastre processos com preview financeiro em tempo real</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Wizard */}
        <div className="lg:col-span-3">
          <div className="rounded-lg border border-border bg-card p-6">
            <WizardSteps
              currentStep={step}
              completedSteps={completedSteps}
              onStepClick={goToStep}
            />

            {step === 1 && (
              <StepCliente
                clientes={clientes || []}
                clienteId={clienteId}
                onSelectCliente={handleSelectCliente}
                onNext={handleNextStep1}
                onClienteCreated={(id) => {
                  setClienteId(id);
                }}
              />
            )}

            {step === 2 && (
              <StepProcesso
                form={processoForm}
                onChange={setProcessoForm}
                negotiations={negotiations || []}
                colaboradores={colaboradores || []}
                clienteTipo={selectedCliente?.tipo}
                onBack={() => goToStep(1)}
                onNext={handleNextStep2}
              />
            )}

            {step === 3 && (
              <StepValor
                form={valorForm}
                onChange={setValorForm}
                isFirstProcess={isFirstProcess}
                isAvulso={isAvulso}
                clienteTipo={clienteTipo}
                negotiations={negotiations || []}
                saldoPrepago={saldoPrepago}
                valorPreview={preview.valorFinal}
                franquiaProcessos={franquiaProcessos}
                processosNoMes={processosNoMes + fila.length}
                onBack={() => goToStep(2)}
                onNext={handleNextStep3}
              />
            )}

            {step === 4 && selectedCliente && (
              <StepRevisao
                cliente={selectedCliente}
                processo={{
                  ...processoForm,
                  ...valorForm,
                }}
                valorCalculado={preview.valorFinal}
                slotNumero={preview.slotNumero}
                descontoAplicado={preview.descontoAplicado}
                onBack={() => goToStep(3)}
                onSave={handleSave}
                onAddToQueue={handleAddToQueue}
                isSaving={isSaving}
                filaLength={fila.length}
              />
            )}
          </div>
        </div>

        {/* Right: Context Panel */}
        <div className="lg:col-span-2 space-y-4">
          {selectedCliente && (
            <>
              <FichaCliente
                cliente={selectedCliente}
                processosNoMes={processosNoMes}
                nextSlot={nextSlot}
              />

              {step >= 2 && (
                <PreviewFinanceiro
                  cliente={selectedCliente}
                  processosNoMes={processosNoMes}
                  filaLength={fila.length}
                  prioridade={processoForm.prioridade}
                  metodoPreco={valorForm.metodoPreco}
                  valorManual={valorForm.valorManual}
                  boasVindas={valorForm.boasVindas}
                  boasVindasPct={valorForm.boasVindasPct}
                  mudancaUF={processoForm.mudancaUF}
                  isAvulso={isAvulso}
                />
              )}

              <UltimosProcessos clienteId={selectedCliente.id} />
            </>
          )}

          <FilaBatch
            fila={fila}
            onRemove={handleRemoveFromQueue}
            onClear={handleClearQueue}
            onSaveAll={handleSaveAll}
            isSaving={isSaving}
          />
        </div>
      </div>

      <FeedbackSucesso
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        clienteNome={selectedCliente?.apelido || selectedCliente?.nome || ''}
        processos={savedProcessos}
        totalEconomia={totalEconomia}
      />
    </div>
  );
}
