import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, CheckCircle2, AlertCircle, XCircle, Search, Filter } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Documento {
  id: string;
  processo_id: string;
  tipo_documento: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  url: string | null;
  observacao: string | null;
  created_at: string;
  processo?: {
    id: string;
    razao_social: string;
    etapa: string;
    cliente?: { nome: string };
  };
}

function useDocumentos() {
  return useQuery({
    queryKey: ['documentos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documentos')
        .select('*, processo:processos(id, razao_social, etapa, cliente:clientes(nome))')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Documento[];
    },
  });
}

function useUpdateDocumento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, observacao }: { id: string; status: string; observacao?: string }) => {
      const { error } = await supabase
        .from('documentos')
        .update({ status, observacao })
        .eq('id', id);
      if (error) throw error;

      // If rejecting, update process stage to analise_documental
      if (status === 'rejeitado') {
        const { data: doc } = await supabase.from('documentos').select('processo_id').eq('id', id).single();
        if (doc) {
          await supabase.from('processos').update({ etapa: 'analise_documental' }).eq('id', doc.processo_id);
        }
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['documentos'] });
      qc.invalidateQueries({ queryKey: ['processos_db'] });
      toast.success(vars.status === 'aprovado' ? 'Documento aprovado!' : 'Documento rejeitado.');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export default function Documentos() {
  const { data: documentos, isLoading } = useDocumentos();
  const updateDoc = useUpdateDocumento();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [search, setSearch] = useState('');

  const filtered = (documentos || []).filter(d => {
    if (filterStatus !== 'all' && d.status !== filterStatus) return false;
    if (search) {
      const s = search.toLowerCase();
      return (d.processo?.razao_social || '').toLowerCase().includes(s) ||
        d.tipo_documento.toLowerCase().includes(s) ||
        (d.processo?.cliente?.nome || '').toLowerCase().includes(s);
    }
    return true;
  });

  const total = (documentos || []).length;
  const approved = (documentos || []).filter(d => d.status === 'aprovado').length;
  const pending = (documentos || []).filter(d => d.status === 'pendente').length;
  const rejected = (documentos || []).filter(d => d.status === 'rejeitado').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Estação de Validação</h1>
        <p className="text-sm text-muted-foreground">Valide os documentos anexados aos processos</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border-border/60">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5"><FileText className="h-5 w-5 text-primary" /></div>
            <div><p className="text-2xl font-bold">{total}</p><p className="text-xs text-muted-foreground">Total</p></div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="rounded-lg bg-success/10 p-2.5"><CheckCircle2 className="h-5 w-5 text-success" /></div>
            <div><p className="text-2xl font-bold">{approved}</p><p className="text-xs text-muted-foreground">Aprovados</p></div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="rounded-lg bg-warning/10 p-2.5"><AlertCircle className="h-5 w-5 text-warning" /></div>
            <div><p className="text-2xl font-bold">{pending}</p><p className="text-xs text-muted-foreground">Pendentes</p></div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="rounded-lg bg-destructive/10 p-2.5"><XCircle className="h-5 w-5 text-destructive" /></div>
            <div><p className="text-2xl font-bold">{rejected}</p><p className="text-xs text-muted-foreground">Rejeitados</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar processo, cliente, documento..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="aprovado">Aprovado</SelectItem>
            <SelectItem value="rejeitado">Rejeitado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="border-border/60">
        <CardHeader className="pb-3"><CardTitle className="text-base">Documentos para Validação</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Processo</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo de Documento</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.processo?.razao_social || '-'}</TableCell>
                    <TableCell className="text-sm">{doc.processo?.cliente?.nome || '-'}</TableCell>
                    <TableCell>{doc.tipo_documento}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={`border-0 text-[10px] ${
                        doc.status === 'aprovado' ? 'bg-success/10 text-success' :
                        doc.status === 'rejeitado' ? 'bg-destructive/10 text-destructive' :
                        'bg-warning/10 text-warning'
                      }`}>
                        {doc.status === 'aprovado' ? 'Aprovado' : doc.status === 'rejeitado' ? 'Rejeitado' : 'Pendente'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {doc.status === 'pendente' && (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-success hover:text-success"
                            onClick={() => updateDoc.mutate({ id: doc.id, status: 'aprovado' })}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Aprovar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-destructive hover:text-destructive"
                            onClick={() => updateDoc.mutate({ id: doc.id, status: 'rejeitado', observacao: 'Documento rejeitado na validação' })}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />Rejeitar
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {total === 0 ? 'Nenhum documento cadastrado. Execute o SQL de migração para criar a tabela documentos.' : 'Nenhum documento encontrado com os filtros aplicados'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
