import { Link } from 'react-router-dom';
import { ArrowLeft, Building2, User, Pencil, FileBarChart, FileText, Archive, ArchiveRestore } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ValorProtegido } from '@/components/auth/ValorProtegido';
import TrelloProvisionButton from '@/components/clientes/TrelloProvisionButton';
import { formatCNPJ, maskCodigo } from '@/lib/cnpj';
import { formatCPF } from '@/lib/cpf';
import { cn } from '@/lib/utils';
import type { ClienteDB } from '@/types/financial';

interface HeaderClienteProps {
  cliente: ClienteDB;
  isMensalista: boolean;
  isPrePago: boolean;
  isDeferimento: boolean;
  isArchived: boolean;
  totalProcessos: number;
  processosAtivos: number;
  totalFaturado: number;
  totalPendente: number;
  onEditCadastro: () => void;
  onOpenRelatorio: () => void;
  onOpenCobranca: () => void;
  onToggleArchive: () => void;
  onProvisioned: () => void;
}

export default function HeaderCliente({
  cliente,
  isMensalista,
  isPrePago,
  isDeferimento,
  isArchived,
  totalProcessos,
  processosAtivos,
  totalFaturado,
  totalPendente,
  onEditCadastro,
  onOpenRelatorio,
  onOpenCobranca,
  onToggleArchive,
  onProvisioned,
}: HeaderClienteProps) {
  // 18/05/2026: clientes podem ser PF (contadores autônomos) ou PJ (default).
  // tipo_pessoa default = 'PJ' por retrocompat — clientes antigos continuam com CNPJ.
  const tipoPessoa: 'PF' | 'PJ' = ((cliente as any).tipo_pessoa as 'PF' | 'PJ') || 'PJ';
  const cnpjInfo = tipoPessoa === 'PJ'
    ? formatCNPJ((cliente as any).cnpj)
    : formatCPF((cliente as any).cpf);
  const codigoDisplay = cliente.codigo_identificador || '—';

  return (
    <>
      {/* Back + Header */}
      <div className="flex items-start gap-4">
        <Button aria-label="Voltar para clientes" variant="ghost" size="icon" className="mt-1" asChild>
          <Link to="/clientes"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">{cliente.apelido || cliente.nome}</h1>
            <Badge className={cn('text-xs', isMensalista ? 'bg-primary/10 text-primary border-primary/30' : isPrePago ? 'bg-info/10 text-info border-info/30' : 'bg-warning/10 text-warning border-warning/30')} variant="outline">
              {isMensalista ? 'Mensalista' : isPrePago ? 'Pré-Pago' : 'Avulso'}
            </Badge>
            {isDeferimento && (
              <Badge variant="outline" className="text-xs border-warning/30 text-warning">
                Fatura no Deferimento
              </Badge>
            )}
            {isArchived && (
              <Badge variant="outline" className="text-xs border-muted-foreground/30 text-muted-foreground">
                Arquivado
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm flex-wrap">
            <span className="flex items-center gap-1 text-muted-foreground"><Building2 className="h-3.5 w-3.5" />{cliente.nome}</span>
            {(cliente as any).cnpj && (
              <span className={`text-xs font-mono ${!cnpjInfo.valid ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                CNPJ: {cnpjInfo.formatted}
              </span>
            )}
            <span className="text-xs text-muted-foreground">Código: {maskCodigo(codigoDisplay)}</span>
            {cliente.nome_contador && <span className="flex items-center gap-1 text-muted-foreground"><User className="h-3.5 w-3.5" />{cliente.nome_contador}</span>}
          </div>
        </div>
        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs text-foreground" onClick={onEditCadastro}>
            <Pencil className="h-3.5 w-3.5" /> Editar Cadastro
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs text-foreground" onClick={onOpenRelatorio}>
            <FileBarChart className="h-3.5 w-3.5" /> Gerar Relatório
          </Button>
          {/* UX-011 (11/05/2026): renomeado de "Gerar Cobrança" pra "Baixar resumo .txt".
              O botão NÃO gera cobrança real (sem Asaas, sem extrato, sem cobrança no
              banco) — só baixa um arquivo de texto local. Antes a label enganava.
              Cobrança real é o botão "Gerar Extrato" (ou via /financeiro → Auditoria). */}
          <Button variant="outline" size="sm" className="gap-1.5 text-xs text-foreground" onClick={onOpenCobranca}>
            <FileText className="h-3.5 w-3.5" /> Baixar resumo (.txt)
          </Button>
          <TrelloProvisionButton cliente={cliente} onProvisioned={onProvisioned} />
          {isArchived ? (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs text-primary" onClick={onToggleArchive}>
              <ArchiveRestore className="h-3.5 w-3.5" /> Desarquivar
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs text-warning" onClick={onToggleArchive}>
              <Archive className="h-3.5 w-3.5" /> Arquivar
            </Button>
          )}
          {/* CLI-005 fix (26/05): removido botão duplicado "Arquivar" com ícone
              Trash2+texto vermelho. Era armadilha visual — usuário achava que
              deletava, mas internamente o useDeleteCliente também só arquiva
              (audit fix #5). O botão Archive acima já cobre a ação. */}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Processos</p>
            <p className="text-2xl font-bold">{totalProcessos}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Ativos</p>
            <p className="text-2xl font-bold text-primary">{processosAtivos}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Faturado</p>
            <p className="text-2xl font-bold"><ValorProtegido valor={totalFaturado} /></p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pendente</p>
            <p className="text-2xl font-bold text-warning"><ValorProtegido valor={totalPendente} /></p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
