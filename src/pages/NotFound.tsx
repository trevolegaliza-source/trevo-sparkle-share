import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404: rota não encontrada:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="text-center max-w-md">
        <h1 className="mb-2 text-6xl font-bold text-primary">404</h1>
        <p className="mb-2 text-xl font-semibold">Página não encontrada</p>
        <p className="mb-6 text-sm text-muted-foreground">
          A rota <code className="px-1 py-0.5 rounded bg-background text-xs">{location.pathname}</code> não existe ou foi movida.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <Button onClick={() => navigate("/")}>
            <Home className="mr-2 h-4 w-4" />
            Ir para o Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
