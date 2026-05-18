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
const ContasPagar = lazy(() => import("./pages/ContasPagar"));
const Cartao = lazy(() => import("./pages/Cartao"));
const CartaoDetalhe = lazy(() => import("./pages/CartaoDetalhe"));
const Colaboradores = lazy(() => import("./pages/Colaboradores"));
const CadastroRapido = lazy(() => import("./pages/CadastroRapido"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const Orcamentos = lazy(() => import("./pages/Orcamentos"));
const OrcamentoNovo = lazy(() => import("./pages/OrcamentoNovo"));
const Catalogo = lazy(() => import("./pages/Catalogo"));
const RelatoriosDRE = lazy(() => import("./pages/RelatoriosDRE"));
const RelatoriosFluxoCaixa = lazy(() => import("./pages/RelatoriosFluxoCaixa"));
const PortfolioPublico = lazy(() => import("./pages/PortfolioPublico"));
const ReconciliacaoTrello = lazy(() => import("./pages/ReconciliacaoTrello"));
const PropostaPublica = lazy(() => import("./pages/PropostaPublica"));
const CobrancaPublica = lazy(() => import("./pages/CobrancaPublica"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      refetchOnWindowFocus: false,
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
                      <ProcessosAtivosDetalhe />
                    </RequirePermission>
                  } />
                  <Route path="/faturamento" element={
                    <RequirePermission modulo="financeiro">
                      <FaturamentoDetalhe />
                    </RequirePermission>
                  } />
                  <Route path="/clientes" element={
                    <RequirePermission modulo="clientes">
                      <Clientes />
                    </RequirePermission>
                  } />
                  <Route path="/clientes/:id" element={
                    <RequirePermission modulo="clientes">
                      <ClienteDetalhe />
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
                  <Route path="/cadastro-rapido" element={
                    <RequirePermission modulo="processos" acao="criar">
                      <CadastroRapido />
                    </RequirePermission>
                  } />
                  <Route path="/financeiro" element={
                    <RequirePermission modulo="financeiro">
                      <Financeiro />
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
                      <ContasPagar />
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
                  <Route path="/configuracoes" element={
                    <RequirePermission modulo="configuracoes">
                      <Configuracoes />
                    </RequirePermission>
                  } />
                </Route>
                <Route path="/portfolio/:token" element={<PortfolioPublico />} />
                <Route path="/proposta/:token" element={<PropostaPublica />} />
                <Route path="/cobranca/:token" element={<CobrancaPublica />} />
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
