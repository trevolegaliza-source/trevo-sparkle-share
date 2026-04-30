import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  /** Texto opcional para identificar a área que crashou (ex: "Financeiro") */
  scope?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Captura erros de renderização em qualquer descendente e mostra um
 * fallback amigável em vez de tela em branco.
 *
 * Uso típico em volta de cada rota / página, dentro do <Suspense>.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Console.error é suficiente até integrarmos Sentry/log drain.
    console.error(
      `[ErrorBoundary${this.props.scope ? ` · ${this.props.scope}` : ""}]`,
      error,
      info,
    );
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      const message = this.state.error?.message ?? "Erro desconhecido";
      return (
        <div className="flex min-h-[60vh] items-center justify-center px-4 py-10">
          <div className="text-center max-w-md">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h2 className="mb-2 text-xl font-semibold">Algo deu errado</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              {this.props.scope
                ? `Falha ao carregar a tela de ${this.props.scope}.`
                : "A tela encontrou um erro inesperado."}{" "}
              Tente novamente. Se persistir, recarregue a página.
            </p>
            <pre className="mb-6 max-h-32 overflow-auto rounded bg-muted p-3 text-left text-xs text-muted-foreground">
              {message}
            </pre>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button variant="outline" onClick={this.handleReset}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Tentar novamente
              </Button>
              <Button onClick={this.handleGoHome}>
                <Home className="mr-2 h-4 w-4" />
                Voltar ao Dashboard
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
