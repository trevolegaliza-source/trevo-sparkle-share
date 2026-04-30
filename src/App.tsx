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

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Processos = lazy(() => import("./pages/Processos"));
const ProcessosAtivosDetalhe = lazy(() => import("./pages/ProcessosAtivosDetalhe"));
const FaturamentoDetalhe = lazy(() => import("./pages/FaturamentoDetalhe"));
const Clientes = lazy(() => import("./pages/Clientes"));
const ClienteDetalhe = lazy(() => import("./pages/ClienteDetalhe"));
const Financeiro = lazy(() => import("./pages/Financeiro"));
const ContasPagar = lazy(() => import("./pages/ContasPagar"));
const Colaboradores = lazy(() => import("./pages/Colaboradores"));
const CadastroRapido = lazy(() => import("./pages/CadastroRapido"));
const Documentos = lazy(() => import("./pages/Documentos"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const Orcamentos = lazy(() => import("./pages/Orcamentos"));
const OrcamentoNovo = lazy(() => import("./pages/OrcamentoNovo"));
const InteligenciaGeografica = lazy(() => import("./pages/InteligenciaGeografica"));
const EstadoDetalhe = lazy(() => import("./pages/EstadoDetalhe"));
const Catalogo = lazy(() => import("./pages/Catalogo"));
const RelatoriosDRE = lazy(() => import("./pages/RelatoriosDRE"));
const RelatoriosFluxoCaixa = lazy(() => import("./pages/RelatoriosFluxoCaixa"));
const PortfolioPublico = lazy(() => import("./pages/PortfolioPublico"));
const ReconciliacaoTrello = lazy(() => import("./pages/ReconciliacaoTrello"));
const PropostaPublica = lazy(() => import("./pages/PropostaPublica"));
const CobrancaPublica = lazy(() => import("./pages/CobrancaPublica"));
const NotFound = lazy(() => import("./pages/NotFound"));

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
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/" element={
                    <RequirePermission modulo="dashboard">
                      <Dashboard />
                    </RequirePermission>
                  } />
                  <Route path="/processos" element={
                    <RequirePermission modulo="processos">
                      <Processos />
                    </RequirePermission>
                  } />
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
                  <Route path="/contas-receber" element={<Navigate to="/financeiro" replace />} />
                  <Route path="/contas-pagar" element={
                    <RequirePermission modulo="contas_pagar">
                      <ContasPagar />
                    </RequirePermission>
                  } />
                  <Route path="/colaboradores" element={
                    <RequirePermission modulo="colaboradores">
                      <Colaboradores />
                    </RequirePermission>
                  } />
                  <Route path="/documentos" element={
                    <RequirePermission modulo="documentos">
                      <Documentos />
                    </RequirePermission>
                  } />
                  <Route path="/inteligencia-geografica" element={
                    <RequirePermission modulo="intel_geografica">
                      <InteligenciaGeografica />
                    </RequirePermission>
                  } />
                  <Route path="/inteligencia-geografica/:uf" element={
                    <RequirePermission modulo="intel_geografica">
                      <EstadoDetalhe />
                    </RequirePermission>
                  } />
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
                  <Route path="/reconciliacao-trello" element={<ReconciliacaoTrello />} />
                  <Route path="/configuracoes" element={
                    <RequirePermission modulo="configuracoes">
                      <Configuracoes />
                    </RequirePermission>
                  } />
                </Route>
                <Route path="/portfolio/:token" element={<PortfolioPublico />} />
                <Route path="/proposta/:token" element={<PropostaPublica />} />
                <Route path="/cobranca/:token" element={<CobrancaPublica />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
