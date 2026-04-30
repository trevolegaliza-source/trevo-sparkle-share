import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Users, Search, UserX, FileText, Download, Trash2, Archive, ArchiveRestore, Eye, AlertTriangle, ShieldAlert, Clock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import PasswordConfirmDialog from '@/components/PasswordConfirmDialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useClientes, useUpdateCliente, useArchiveCliente, useUnarchiveCliente } from '@/hooks/useFinanceiro';
import { useProcessos } from '@/hooks/useFinanceiro';
import type { ClienteDB, TipoCliente } from '@/types/financial';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { STORAGE_BUCKETS } from '@/constants/storage';
import { empresaPath } from '@/lib/storage-path';
import ContractDropzone from '@/components/contratos/ContractDropzone';
import ContractPreviewModal from '@/components/contratos/ContractPreviewModal';
import { formatCNPJ, maskCNPJ, isValidCNPJ, maskCodigo } from '@/lib/cnpj';
import { UFS_BRASIL, UF_NOMES } from '@/constants/estados-brasil';
import { useQuery } from '@tanstack/react-query';

export default function Clientes() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const estadoFiltro = searchParams.get('estado');
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editClient, setEditClient] = useState<ClienteDB | null>(null);
  const [editForm, setEditForm] = useState<Partial<ClienteDB>>({});
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [pendingDeleteAction, setPendingDeleteAction] = useState<(() => void) | null>(null);

  const { data: clientes, isLoading } = useClientes(search);
  const { data: processos } = useProcessos();
  const updateCliente = useUpdateCliente();
  // audit fix #5 — useDeleteCliente removido daqui (era rota dupla pra arquivamento).
  const archiveCliente = useArchiveCliente();
  const unarchiveCliente = useUnarchiveCliente();

  // Audit pending counts per client
  const { data: auditPendentes } = useQuery({
    queryKey: ['audit_pendentes_clientes'],
    queryFn: async () => {
      const { data } = await supabase
        .from('lancamentos')
        .select('cliente_id')
        .eq('auditado', false)
        .eq('status', 'pendente')
        .eq('tipo', 'receber') as any;
      const map: Record<string, number> = {};
      for (const row of (data || [])) {
        if (row.cliente_id) map[row.cliente_id] = (map[row.cliente_id] || 0) + 1;
      }
      return map;
    },
    staleTime: 60_000,
  });

  const processCount = (clienteId: string) =>
    (processos || []).filter(p => p.cliente_id === clienteId).length;
  const activeCount = (clienteId: string) =>
    (processos || []).filter(p => p.cliente_id === clienteId && p.etapa !== 'finalizados' && p.etapa !== 'arquivo').length;
  const doneCount = (clienteId: string) =>
    (processos || []).filter(p => p.cliente_id === clienteId && (p.etapa === 'finalizados' || p.etapa === 'arquivo')).length;

  const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString();
  const isInactive = (clienteId: string) => {
    const clientProcesses = (processos || []).filter(p => p.cliente_id === clienteId);
    if (clientProcesses.length === 0) return true;
    return !clientProcesses.some(p => p.created_at >= tenDaysAgo);
  };

  const filtered = (clientes || []).filter(c => {
    const archived = !!(c as any).is_archived;
    if (showArchived) return archived;
    if (archived) return false;
    if (estadoFiltro && (c as any).estado !== estadoFiltro) return false;
    if (showInactive) return isInactive(c.id);
    return true;
  });

  const [contracts, setContracts] = useState<{ name: string; id: string }[]>([]);
  const [uploadingContract, setUploadingContract] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState('');
  const [previewClienteName, setPreviewClienteName] = useState('');

  const openEdit = (client: ClienteDB) => {
    setEditClient(client);
    setEditForm({ ...client });
    loadContracts(client.id);
  };

  const loadContracts = async (clienteId: string) => {
    const folder = await empresaPath(clienteId);
    const { data } = await supabase.storage.from(STORAGE_BUCKETS.CONTRACTS).list(folder);
    setContracts((data || []).map(f => ({ name: f.name, id: f.id })));
  };

  const handleUploadContract = async (file: File) => {
    if (!editClient) return;
    const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
    if (!allowed.includes(file.type)) { toast.error('Formato inválido. Aceitos: PDF, PNG, JPG'); throw new Error('invalid'); }
    if (file.size > 10 * 1024 * 1024) { toast.error('Arquivo muito grande. Máximo: 10MB'); throw new Error('too large'); }
    setUploadingContract(true);
    const relativePath = `${editClient.id}/contrato_${Date.now()}.${file.name.split('.').pop()}`;
    const path = await empresaPath(relativePath);
    const { error } = await supabase.storage.from(STORAGE_BUCKETS.CONTRACTS).upload(path, file);
    if (error) { toast.error('Erro no upload: ' + error.message); setUploadingContract(false); throw error; }
    // Update contrato_url
    await supabase.from('clientes').update({ contrato_url: path, updated_at: new Date().toISOString() }).eq('id', editClient.id);
    toast.success('Contrato anexado!');
    loadContracts(editClient.id);
    setUploadingContract(false);
  };

  const handlePreviewContract = async (fileName: string) => {
    if (!editClient) return;
    const storagePath = await empresaPath(`${editClient.id}/${fileName}`);
    const { data, error } = await supabase.storage.from(STORAGE_BUCKETS.CONTRACTS).createSignedUrl(storagePath, 3600);
    if (data?.signedUrl) {
      setPreviewUrl(data.signedUrl);
      setPreviewFileName(fileName);
      setPreviewClienteName(editClient.nome);
    } else {
      toast.error('Erro: Arquivo antigo incompatível, por favor re-anexe');
    }
  };

  const handleDownloadContract = async (fileName: string) => {
    if (!editClient) return;
    const storagePath = await empresaPath(`${editClient.id}/${fileName}`);
    const { data, error } = await supabase.storage.from(STORAGE_BUCKETS.CONTRACTS).download(storagePath);
    if (error) { toast.error('Erro ao baixar'); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a'); a.href = url; a.download = fileName; a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteContract = async (fileName: string) => {
    if (!editClient) return;
    setPendingDeleteAction(() => async () => {
      const storagePath = await empresaPath(`${editClient.id}/${fileName}`);
      const { error } = await supabase.storage.from(STORAGE_BUCKETS.CONTRACTS).remove([storagePath]);
      if (error) toast.error('Erro ao excluir');
      else { toast.success('Contrato removido'); loadContracts(editClient.id); }
    });
    setShowDeletePassword(true);
  };

  const handleSave = () => {
    if (!editClient) return;
    // Validate CNPJ if provided
    const cnpjRaw = (editForm as any).cnpj;
    if (cnpjRaw && cnpjRaw.replace(/\D/g, '').length > 0 && !isValidCNPJ(cnpjRaw)) {
      toast.error('CNPJ inválido. Deve conter 14 dígitos.');
      return;
    }
    const payload: Record<string, any> = {
      id: editClient.id,
      nome: editForm.nome,
      apelido: editForm.apelido,
      nome_contador: editForm.nome_contador,
      codigo_identificador: editForm.codigo_identificador,
      cnpj: cnpjRaw ? cnpjRaw.replace(/\D/g, '') : (editForm as any).cnpj,
      email: editForm.email,
      telefone: editForm.telefone,
      tipo: editForm.tipo,
      momento_faturamento: (editForm as any).momento_faturamento,
    };
    // Financial fields
    if (editForm.tipo === 'MENSALISTA') {
      payload.mensalidade = (editForm as any).mensalidade;
      payload.vencimento = (editForm as any).vencimento;
      payload.dia_vencimento_mensal = (editForm as any).dia_vencimento_mensal;
      payload.qtd_processos = (editForm as any).qtd_processos;
    } else {
      payload.valor_base = (editForm as any).valor_base;
      payload.desconto_progressivo = (editForm as any).desconto_progressivo;
      payload.valor_limite_desconto = (editForm as any).valor_limite_desconto;
      payload.dia_cobranca = (editForm as any).dia_cobranca;
    }
    updateCliente.mutate(payload as any, {
      onSuccess: () => {
        toast.success('Dados cadastrais atualizados com sucesso');
        setEditClient(null);
      },
    });
  };

  // audit fix #5 — handleDelete removido (botão Excluir não existe mais aqui).
  // Arquivamento é feito via handleArchive abaixo (RPC arquivar_cliente).

  const handleArchive = (clientId: string) => {
    setPendingDeleteAction(() => () => {
      archiveCliente.mutate(clientId, {
        onSuccess: () => setEditClient(null),
      });
    });
    setShowDeletePassword(true);
  };

  const handleUnarchive = (clientId: string) => {
    setPendingDeleteAction(() => () => {
      unarchiveCliente.mutate(clientId, {
        onSuccess: () => setEditClient(null),
      });
    });
    setShowDeletePassword(true);
  };

  const activeClientes = (clientes || []).filter(c => !(c as any).is_archived);
  const totalClientes = activeClientes.length;
  const mensalistas = activeClientes.filter(c => c.tipo === 'MENSALISTA').length;
  const avulsos = activeClientes.filter(c => c.tipo === 'AVULSO_4D').length;

  // Badge color for processes
  const getProcessBadgeClass = (clienteId: string) => {
    const total = processCount(clienteId);
    const active = activeCount(clienteId);
    const done = doneCount(clienteId);
    if (total === 0) return 'bg-muted/40 text-muted-foreground border-0'; // Grey
    if (active === 0 && done === total) return 'bg-primary/10 text-primary border-0'; // Green - all done
    return 'bg-warning/10 text-warning border-0'; // Yellow - in progress
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">{totalClientes} contabilidades cadastradas</p>
        </div>
        <Button size="sm" className="h-9" asChild>
          <Link to="/cadastro-rapido">
            <Plus className="h-4 w-4 mr-1" />
            Novo Cliente
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/60">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5"><Users className="h-5 w-5 text-primary" /></div>
            <div><p className="text-2xl font-bold">{totalClientes}</p><p className="text-xs text-muted-foreground">Total de Clientes</p></div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="rounded-lg bg-info/10 p-2.5"><Users className="h-5 w-5 text-info" /></div>
            <div><p className="text-2xl font-bold">{mensalistas}</p><p className="text-xs text-muted-foreground">Mensalistas</p></div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="rounded-lg bg-warning/10 p-2.5"><Users className="h-5 w-5 text-warning" /></div>
            <div><p className="text-2xl font-bold">{avulsos}</p><p className="text-xs text-muted-foreground">Avulsos</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, código, contador..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button
          variant={showInactive ? 'default' : 'outline'}
          size="sm"
          className="h-9 gap-1.5"
          onClick={() => { setShowInactive(!showInactive); setShowArchived(false); }}
        >
          <UserX className="h-3.5 w-3.5" />
          Inativos ({(clientes || []).filter(c => !(c as any).is_archived && isInactive(c.id)).length})
        </Button>
        <Button
          variant={showArchived ? 'default' : 'outline'}
          size="sm"
          className="h-9 gap-1.5"
          onClick={() => { setShowArchived(!showArchived); setShowInactive(false); }}
        >
          <Archive className="h-3.5 w-3.5" />
          Arquivados ({(clientes || []).filter(c => (c as any).is_archived).length})
        </Button>
        {estadoFiltro && (
          <Badge variant="outline" className="h-9 px-3 flex items-center gap-1.5 cursor-pointer border-primary/30 text-primary" onClick={() => setSearchParams({})}>
            Estado: {estadoFiltro} ✕
          </Badge>
        )}
      </div>

      {/* Table */}
      <Card className="border-border/60">
        <CardHeader className="pb-3"><CardTitle className="text-base">Listagem de Clientes</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Nome / Apelido</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor Base / Mensalidade</TableHead>
                  <TableHead>Desconto</TableHead>
                  <TableHead className="text-center">Processos</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((client) => {
                  const isMens = client.tipo === 'MENSALISTA';
                  const valorExibir = isMens ? (client as any).mensalidade : (client as any).valor_base;
                  const descontoExibir = (client as any).desconto_progressivo;
                  const limiteExibir = (client as any).valor_limite_desconto;
                  const cnpjInfo = formatCNPJ((client as any).cnpj);
                  const hasContract = !!(client as any).contrato_url;

                  return (
                    <TableRow
                      key={client.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/clientes/${client.id}`)}
                      onDoubleClick={() => openEdit(client)}
                    >
                      {/* Compliance column */}
                      <TableCell className="w-8 px-2">
                        {!hasContract && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center justify-center">
                                  <ShieldAlert className="h-4 w-4 text-destructive" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">Atenção: Contrato não anexado</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{client.nome}</p>
                          {client.apelido && <p className="text-xs text-muted-foreground">{client.apelido}</p>}
                          {client.nome_contador && <p className="text-[10px] text-muted-foreground">Contador: {client.nome_contador}</p>}
                          {(auditPendentes?.[client.id] || 0) > 0 && (
                            <Badge variant="outline" className="mt-1 text-[10px] px-1.5 py-0 border-amber-500/30 text-amber-500">
                              ⏳ {auditPendentes![client.id]} proc. s/ auditoria
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs font-mono ${!cnpjInfo.valid ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                          {cnpjInfo.formatted}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={isMens ? 'border-primary/30 text-primary' : 'border-warning/30 text-warning'}>
                          {isMens ? 'Mensalista' : 'Avulso'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          {valorExibir != null
                            ? Number(valorExibir).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                            : '—'}
                        </span>
                        {isMens && (client as any).qtd_processos != null && (
                          <p className="text-[10px] text-muted-foreground">{(client as any).qtd_processos} proc. inclusos</p>
                        )}
                      </TableCell>
                      <TableCell>
                        {descontoExibir != null && descontoExibir > 0 ? (
                          <div>
                            <span className="text-sm font-medium">{descontoExibir}%</span>
                            {limiteExibir != null && (
                              <p className="text-[10px] text-muted-foreground">
                                Mín. {Number(limiteExibir).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={getProcessBadgeClass(client.id)}>
                          {activeCount(client.id)}/{processCount(client.id)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()}>
                          {(client as any).is_archived ? (
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Desarquivar" onClick={() => handleUnarchive(client.id)}>
                              <Archive className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Arquivar" onClick={() => handleArchive(client.id)}>
                              <Archive className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {showInactive ? 'Nenhum cliente inativo' : 'Nenhum cliente encontrado'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
          <p className="text-[11px] text-muted-foreground mt-3">💡 Dê um duplo-clique para editar um cliente</p>
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <Dialog open={!!editClient} onOpenChange={(o) => !o && setEditClient(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label className="text-muted-foreground">Nome da Contabilidade *</Label>
              <Input value={editForm.nome || ''} onChange={e => setEditForm(f => ({ ...f, nome: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-muted-foreground">Nome do Contador</Label>
                <Input value={editForm.nome_contador || ''} onChange={e => setEditForm(f => ({ ...f, nome_contador: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">Apelido</Label>
                <Input value={editForm.apelido || ''} onChange={e => setEditForm(f => ({ ...f, apelido: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-muted-foreground">CNPJ</Label>
                <Input
                  value={maskCNPJ((editForm as any).cnpj || '')}
                  onChange={e => {
                    const masked = maskCNPJ(e.target.value);
                    const digits = e.target.value.replace(/\D/g, '');
                    const codigo = digits.slice(0, 6);
                    setEditForm(f => ({
                      ...f,
                      cnpj: masked,
                      codigo_identificador: codigo || f.codigo_identificador,
                    }));
                  }}
                  placeholder="00.000.000/0000-00"
                  maxLength={18}
                />
                {(editForm as any).cnpj && (editForm as any).cnpj.replace(/\D/g, '').length > 0 && !isValidCNPJ((editForm as any).cnpj) && (
                  <p className="text-[10px] text-destructive">CNPJ deve conter 14 dígitos</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">Código do Cliente</Label>
                <Input
                  value={maskCodigo(editForm.codigo_identificador || '')}
                  onChange={e => setEditForm(f => ({ ...f, codigo_identificador: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                  placeholder="000.000 (auto)"
                  maxLength={7}
                />
                <p className="text-[10px] text-muted-foreground">Extraído automaticamente do CNPJ</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-muted-foreground">Tipo</Label>
                <Select value={editForm.tipo} onValueChange={(v) => setEditForm(f => ({ ...f, tipo: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MENSALISTA">Mensalista</SelectItem>
                    <SelectItem value="AVULSO_4D">Avulso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">Momento do Faturamento</Label>
                <Select value={(editForm as any).momento_faturamento || 'na_solicitacao'} onValueChange={(v) => setEditForm(f => ({ ...f, momento_faturamento: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="na_solicitacao">Na Solicitação</SelectItem>
                    <SelectItem value="no_deferimento">No Deferimento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-muted-foreground">Email</Label>
                <Input value={editForm.email || ''} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">Telefone</Label>
                <Input value={editForm.telefone || ''} onChange={e => setEditForm(f => ({ ...f, telefone: e.target.value }))} />
              </div>
            </div>
            {/* Financial params */}
            {editForm.tipo === 'MENSALISTA' ? (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
                <p className="text-xs font-medium text-primary">Configuração Mensalista</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="grid gap-1">
                    <Label className="text-xs text-muted-foreground">Mensalidade (R$)</Label>
                    <Input type="number" step="0.01" value={(editForm as any).mensalidade ?? ''} onChange={e => setEditForm(f => ({ ...f, mensalidade: e.target.value ? Number(e.target.value) : null }))} />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs text-muted-foreground">Dia Vencimento</Label>
                    <Input type="number" min={1} max={31} value={(editForm as any).vencimento ?? editForm.dia_vencimento_mensal ?? ''} onChange={e => { const v = e.target.value ? Number(e.target.value) : null; setEditForm(f => ({ ...f, vencimento: v, dia_vencimento_mensal: v ?? undefined })); }} />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs text-muted-foreground">Processos Inclusos</Label>
                    <Input type="number" min={0} value={(editForm as any).qtd_processos ?? ''} onChange={e => setEditForm(f => ({ ...f, qtd_processos: e.target.value ? Number(e.target.value) : null }))} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 space-y-3">
                <p className="text-xs font-medium text-warning">Configuração Avulso</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1">
                    <Label className="text-xs text-muted-foreground">Valor Base (R$)</Label>
                    <Input type="number" step="0.01" value={(editForm as any).valor_base ?? ''} onChange={e => setEditForm(f => ({ ...f, valor_base: e.target.value ? Number(e.target.value) : null }))} />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs text-muted-foreground">Desconto (%)</Label>
                    <Input type="number" step="0.1" value={(editForm as any).desconto_progressivo ?? ''} onChange={e => setEditForm(f => ({ ...f, desconto_progressivo: e.target.value ? Number(e.target.value) : null }))} />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs text-muted-foreground">Limite Desconto (R$)</Label>
                    <Input type="number" step="0.01" value={(editForm as any).valor_limite_desconto ?? ''} onChange={e => setEditForm(f => ({ ...f, valor_limite_desconto: e.target.value ? Number(e.target.value) : null }))} />
                  </div>
                  {(editForm as any).momento_faturamento !== 'no_deferimento' && (
                    <div className="grid gap-1">
                      <Label className="text-xs text-muted-foreground">Dia Cobrança (D+X)</Label>
                      <Input type="number" min={1} max={30} value={(editForm as any).dia_cobranca ?? ''} onChange={e => setEditForm(f => ({ ...f, dia_cobranca: e.target.value ? Number(e.target.value) : null }))} />
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Contratos */}
            <div className="grid gap-2 border-t border-border/40 pt-3">
              <Label className="flex items-center gap-1.5 text-muted-foreground"><FileText className="h-3.5 w-3.5" /> Contratos Anexados</Label>
              {contracts.length > 0 ? (
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {contracts.map((c) => (
                    <div key={c.name} className="flex items-center gap-2 text-sm bg-muted/30 rounded-md px-3 py-1.5">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate text-muted-foreground">{c.name}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handlePreviewContract(c.name)} title="Preview">
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDownloadContract(c.name)}>
                        <Download className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDeleteContract(c.name)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhum contrato anexado</p>
              )}
              <ContractDropzone uploading={uploadingContract} onUpload={handleUploadContract} />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex gap-2">
                {/* audit fix #5 — botão "Excluir" removido (era duplicado: agora chama o mesmo
                    arquivar via RPC). Manter apenas Arquivar/Desarquivar evita confusão e
                    elimina rota acidental que apagava histórico financeiro. */}
                {!(editClient as any)?.is_archived ? (
                  <Button variant="outline" size="sm" onClick={() => editClient && handleArchive(editClient.id)}><Archive className="h-3.5 w-3.5 mr-1" />Arquivar</Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => editClient && handleUnarchive(editClient.id)}><Archive className="h-3.5 w-3.5 mr-1" />Desarquivar</Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditClient(null)}>Cancelar</Button>
                <Button size="sm" onClick={handleSave} disabled={updateCliente.isPending}>Salvar</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ContractPreviewModal
        open={!!previewUrl}
        onOpenChange={(o) => { if (!o) { setPreviewUrl(null); setPreviewFileName(''); setPreviewClienteName(''); } }}
        url={previewUrl}
        fileName={previewFileName}
        clienteName={previewClienteName}
      />

      <PasswordConfirmDialog
        open={showDeletePassword}
        onOpenChange={setShowDeletePassword}
        onConfirm={() => { pendingDeleteAction?.(); setPendingDeleteAction(null); }}
      />
    </div>
  );
}
