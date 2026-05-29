import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { RootRedirect } from "@/components/auth/RootRedirect";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const MRRDashboard = lazy(() => import("./pages/MRRDashboard"));
const Hoje = lazy(() => import("./pages/Hoje"));
const ProcessosAtivosDetalhe = lazy(() => import("./pages/ProcessosAtivosDetalhe"));
const FaturamentoDetalhe = lazy(() => import("./pages/FaturamentoDetalhe"));
const Clientes = lazy(() => import("./pages/Clientes"));
const ClienteDetalhe = lazy(() => import("./pages/ClienteDetalhe"));
const Financeiro = lazy(() => import("./pages/Financeiro"));
const FinanceiroDashboardDecisional = lazy(() => import("./pages/FinanceiroDashboardDecisional"));
const ContasPagar = lazy(() => import("./pages/ContasPagar"));
const Cartao = lazy(() => import("./pages/Cartao"));
const CartaoDetalhe = lazy(() => import("./pages/CartaoDetalhe"));
const Colaboradores = lazy(() => import("./pages/Colaboradores"));
const CadastroRapido = lazy(() => import("./pages/CadastroRapido"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const Orcamentos = lazy(() => import("./pages/Orcamentos"));
const OrcamentoNovo = lazy(() => import("./pages/OrcamentoNovo"));
const PropostasComerciais = lazy(() => import("./pages/PropostasComerciais"));
const PropostaComercialNova = lazy(() => import("./pages/PropostaComercialNova"));
const Catalogo = lazy(() => import("./pages/Catalogo"));
const RelatoriosDRE = lazy(() => import("./pages/RelatoriosDRE"));
const RelatoriosFluxoCaixa = lazy(() => import("./pages/RelatoriosFluxoCaixa"));
const Tarefas = lazy(() => import("./pages/Tarefas"));
const PortfolioPublico = lazy(() => import("./pages/PortfolioPublico"));
const ReconciliacaoTrello = lazy(() => import("./pages/ReconciliacaoTrello"));
const TrelloCardsPendentes = lazy(() => import("./pages/TrelloCardsPendentes"));
const PropostaPublica = lazy(() => import("./pages/PropostaPublica"));
const CobrancaPublica = lazy(() => import("./pages/CobrancaPublica"));
const Dani = lazy(() => import("./pages/Dani"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));

// 25/05/2026 (Frente 3 audit pós-viagem): defaults antes eram staleTime:2min +
// refetchOnWindowFocus:false. Resultado: troca de aba/janela mantinha dados
// stale por até 2min — causa raiz do bug "Desfazer não reflete na UI" (18/05).
// Fix em useFinanceiroClientes (staleTime:0) era pontual; agora padroniza:
//  - staleTime:30s → permite reuso em interações rápidas (modal/accordion)
//    sem refetch desnecessário, mas curto o bastante pra não confundir
//  - refetchOnWindowFocus:true → ao voltar de outra aba, sempre refresca.
//    Operacional (Letícia/Michele) alterna entre WhatsApp e ERP o tempo todo;
//    ver dado stale após volta da aba é o pior cenário.
//  - gcTime:5min → garbage collect explícita pra não acumular cache
// Hooks que precisam de imediato seguem com override (staleTime:0) — esses
// continuam funcionando, apenas mais consistentes com o resto do app.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: true,
    },
  },
});

const PageFallback = () => (
  <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
    Carregando...
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light">
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ErrorBoundary>
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/" element={<RootRedirect />} />
                  {/* DECISION-001 Fase 3 (13/05/2026): /processos deletada
                      junto com a página kanban. Redirect mantido pra ninguém
                      cair em 404 vindo de bookmark velho. */}
                  <Route path="/processos" element={<Navigate to="/processos-ativos" replace />} />
                  <Route path="/processos-ativos" element={
                    <RequirePermission modulo="processos">
                      <ErrorBoundary scope="Processos Ativos">
                        <ProcessosAtivosDetalhe />
                      </ErrorBoundary>
                    </RequirePermission>
                  } />
                  <Route path="/faturamento" element={
                    <RequirePermission modulo="financeiro">
                      <ErrorBoundary scope="Faturamento">
                        <FaturamentoDetalhe />
                      </ErrorBoundary>
                    </RequirePermission>
                  } />
                  <Route path="/clientes" element={
                    <RequirePermission modulo="clientes">
                      <Clientes />
                    </RequirePermission>
                  } />
                  <Route path="/clientes/:id" element={
                    <RequirePermission modulo="clientes">
                      <ErrorBoundary scope="Cliente Detalhe">
                        <ClienteDetalhe />
                      </ErrorBoundary>
                    </RequirePermission>
                  } />
                  <Route path="/orcamentos" element={
                    <RequirePermission modulo="orcamentos">
                      <Orcamentos />
                    </RequirePermission>
                  } />
                  <Route path="/orcamentos/novo" element={
                    <RequirePermission modulo="orcamentos" acao="criar">
                      <OrcamentoNovo />
                    </RequirePermission>
                  } />
                  {/* 25/05/2026: separação Orçamentos (serviço pontual) vs
                      Propostas Comerciais (terceirização). Mesma tabela, filtros diferentes.
                      Refactor (mesmo dia): preenchimento de proposta tem page PRÓPRIA,
                      sem reuso de OrcamentoNovo. */}
                  <Route path="/propostas-comerciais" element={
                    <RequirePermission modulo="orcamentos">
                      <PropostasComerciais />
                    </RequirePermission>
                  } />
                  <Route path="/propostas-comerciais/nova" element={
                    <RequirePermission modulo="orcamentos" acao="criar">
                      <PropostaComercialNova />
                    </RequirePermission>
                  } />
                  <Route path="/propostas-comerciais/editar/:id" element={
                    <RequirePermission modulo="orcamentos">
                      <PropostaComercialNova />
                    </RequirePermission>
                  } />
                  <Route path="/cadastro-rapido" element={
                    <RequirePermission modulo="processos" acao="criar">
                      <CadastroRapido />
                    </RequirePermission>
                  } />
                  <Route path="/financeiro" element={
                    <RequirePermission modulo="financeiro">
                      <ErrorBoundary scope="Financeiro">
                        <Financeiro />
                      </ErrorBoundary>
                    </RequirePermission>
                  } />
                  {/* FIN-005 (27/05 noite): dashboard decisional separado pra master ver DSO/churn/forecast */}
                  <Route path="/financeiro/dashboard" element={
                    <RequirePermission modulo="financeiro">
                      <ErrorBoundary scope="Dashboard Decisional">
                        <FinanceiroDashboardDecisional />
                      </ErrorBoundary>
                    </RequirePermission>
                  } />
                  <Route path="/mrr" element={
                    <RequirePermission modulo="mrr">
                      <MRRDashboard />
                    </RequirePermission>
                  } />
                  <Route path="/hoje" element={
                    <RequirePermission modulo="dashboard">
                      <Hoje />
                    </RequirePermission>
                  } />
                  <Route path="/contas-receber" element={<Navigate to="/financeiro" replace />} />
                  <Route path="/contas-pagar" element={
                    <RequirePermission modulo="contas_pagar">
                      <ErrorBoundary scope="Contas a Pagar">
                        <ContasPagar />
                      </ErrorBoundary>
                    </RequirePermission>
                  } />
                  <Route path="/cartao" element={
                    <RequirePermission modulo="cartao">
                      <Cartao />
                    </RequirePermission>
                  } />
                  <Route path="/cartao/:id" element={
                    <RequirePermission modulo="cartao">
                      <CartaoDetalhe />
                    </RequirePermission>
                  } />
                  <Route path="/colaboradores" element={
                    <RequirePermission modulo="colaboradores">
                      <Colaboradores />
                    </RequirePermission>
                  } />
                  {/* Rota /documentos removida em 13/05/2026 noite — feature
                      sem uso (0 registros) confirmado na auditoria. */}
                  {/* Rotas /inteligencia-geografica removidas em 13/05/2026 noite
                      (auditoria): Thales nunca usou — CRM territorial com mapa
                      Brasil pra ERP que serve só SP. Tabelas contatos_estado,
                      notas_estado, ratings continuam no banco. */}
                  <Route path="/catalogo" element={
                    <RequirePermission modulo="catalogo">
                      <Catalogo />
                    </RequirePermission>
                  } />
                  <Route path="/relatorios/dre" element={
                    <RequirePermission modulo="relatorios_dre">
                      <RelatoriosDRE />
                    </RequirePermission>
                  } />
                  <Route path="/relatorios/fluxo-caixa" element={
                    <RequirePermission modulo="fluxo_caixa">
                      <RelatoriosFluxoCaixa />
                    </RequirePermission>
                  } />
                  <Route path="/reconciliacao-trello" element={
                    /* PERM-005 (11/05/2026): rota estava sem RequirePermission —
                       qualquer authenticated (operacional/visualizador) podia
                       acessar dados de reconciliação Trello↔ERP via URL direta.
                       Protegida com modulo='configuracoes' (admin-only). */
                    <RequirePermission modulo="configuracoes">
                      <ReconciliacaoTrello />
                    </RequirePermission>
                  } />
                  {/* 29/05/2026: revisão manual dos processos sem trello_card_id
                      (ambíguos + sem_match do backfill automático). Master-only —
                      mexe em link de processo↔card que vai impactar automação
                      de deferimento. Página gate via role no componente. */}
                  <Route path="/admin/trello-cards-pendentes" element={
                    <RequirePermission modulo="configuracoes">
                      <TrelloCardsPendentes />
                    </RequirePermission>
                  } />
                  {/* 25/05/2026: Tarefas — checklist sem gate de modulo
                      (qualquer perfil ativo da empresa pode ver/criar).
                      AUDIT-045 (29/05/2026): adicionado RequirePermission
                      modulo='configuracoes' (master/gerente). Vendedor/estagiário
                      não precisa ver pendências internas — só vaza prioridade
                      comercial. */}
                  <Route path="/tarefas" element={
                    <RequirePermission modulo="configuracoes">
                      <Tarefas />
                    </RequirePermission>
                  } />
                  <Route path="/configuracoes" element={
                    <RequirePermission modulo="configuracoes">
                      <Configuracoes />
                    </RequirePermission>
                  } />
                </Route>
                <Route path="/portfolio/:token" element={<PortfolioPublico />} />
                <Route path="/proposta/:token" element={<PropostaPublica />} />
                <Route path="/cobranca/:token" element={<CobrancaPublica />} />
                {/* 27/05 noite: página dedicada da dani.ai (sem auth, sem token) */}
                <Route path="/dani" element={<Dani />} />
                {/* REL-019 (12/05/2026): rota pública pra recovery de senha.
                    Link enviado pelo email do Supabase aterriza aqui com hash. */}
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            </ErrorBoundary>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
