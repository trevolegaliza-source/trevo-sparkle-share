import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Users, Search, Pencil, Trash2, Zap, Copy, Cake, DollarSign, CalendarDays } from 'lucide-react';
import { useColaboradores, useCreateColaborador, useUpdateColaborador, useDeleteColaborador, type Colaborador } from '@/hooks/useColaboradores';
import { getBusinessDaysInMonth } from '@/lib/business-days';
import { gerarVerbasDoMes, estimarCustoTotal, corrigirDatasExistentes } from '@/lib/gerar-verbas';
import ColaboradorForm, { EMPTY_FORM, type ColaboradorFormData } from '@/components/colaboradores/ColaboradorForm';
import ColaboradorDetalheModal from '@/components/colaboradores/ColaboradorDetalheModal';
import GerarVerbasModal from '@/components/colaboradores/GerarVerbasModal';
import { toast } from 'sonner';

function isBirthdayThisMonth(aniversario: string | null): boolean {
  if (!aniversario) return false;
  const d = new Date(aniversario + 'T12:00:00');
  const now = new Date();
  return d.getMonth() === now.getMonth();
}

export default function Colaboradores() {
  const { data: colaboradores, isLoading } = useColaboradores();
  const create = useCreateColaborador();
  const update = useUpdateColaborador();
  const del = useDeleteColaborador();
  const [dialog, setDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ColaboradorFormData>(EMPTY_FORM);
  const [search, setSearch] = useState('');
  const [gerando, setGerando] = useState(false);
  const [verbasModal, setVerbasModal] = useState(false);
  const [detalheColab, setDetalheColab] = useState<Colaborador | null>(null);

  const diasUteis = getBusinessDaysInMonth();

  const filtered = (colaboradores || []).filter(c =>
    !search || c.nome.toLowerCase().includes(search.toLowerCase())
  );

  const totalAtivos = (colaboradores || []).filter(c => c.status === 'ativo');
  const custoTotalMensal = totalAtivos.reduce((s, c) => s + estimarCustoTotal(c, diasUteis), 0);

  const openCreate = () => { setEditId(null); setForm(EMPTY_FORM); setDialog(true); };
  const openEdit = (c: Colaborador, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditId(c.id);
    setForm({
      nome: c.nome, email: c.email || '', regime: c.regime,
      salario_base: String(c.salario_base), vt_diario: String(c.vt_diario),
      vr_diario: String(c.vr_diario), status: c.status,
      possui_adiantamento: c.possui_adiantamento ?? true,
      adiantamento_tipo: c.adiantamento_tipo || 'percentual',
      adiantamento_valor: String(c.adiantamento_valor || 0),
      dia_pagamento_integral: String(c.dia_pagamento_integral || 5),
      pix_tipo: c.pix_tipo || '', pix_chave: c.pix_chave || '',
      valor_das: String(c.valor_das || 0),
      aumento_previsto_valor: String(c.aumento_previsto_valor || ''),
      aumento_previsto_data: c.aumento_previsto_data || '',
      data_inicio: c.data_inicio || '',
      aniversario: c.aniversario || '',
      dia_adiantamento: String(c.dia_adiantamento ?? 20),
      dia_salario: String(c.dia_salario ?? 5),
      dia_vt_vr: String(c.dia_vt_vr ?? 0),
      dia_das: String(c.dia_das ?? 20),
      fgts_percentual: String(c.fgts_percentual ?? 8),
      inss_patronal_percentual: String(c.inss_patronal_percentual ?? 20),
      provisionar_13: c.provisionar_13 ?? true,
      provisionar_ferias: c.provisionar_ferias ?? true,
      observacoes_pagamento: c.observacoes_pagamento || '',
      tipo_transporte: (c as any).tipo_transporte || 'vt',
      auxilio_combustivel_valor: String((c as any).auxilio_combustivel_valor || ''),
      trello_username: (c as any).trello_username || '',
    });
    setDialog(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      nome: form.nome.trim(),
      email: form.email.trim() || null,
      regime: form.regime,
      salario_base: Number(form.salario_base) || 0,
      vt_diario: Number(form.vt_diario) || 0,
      vr_diario: Number(form.vr_diario) || 0,
      status: form.status,
      possui_adiantamento: form.possui_adiantamento,
      adiantamento_tipo: form.adiantamento_tipo,
      adiantamento_valor: Number(form.adiantamento_valor) || 0,
      dia_pagamento_integral: form.possui_adiantamento ? null : (Number(form.dia_pagamento_integral) || 5),
      pix_tipo: form.pix_tipo || null,
      pix_chave: form.pix_chave || null,
      valor_das: form.regime === 'INDEFINIDO' ? 0 : (Number(form.valor_das) || 0),
      aumento_previsto_valor: Number(form.aumento_previsto_valor) || 0,
      aumento_previsto_data: form.aumento_previsto_data || null,
      data_inicio: form.data_inicio || null,
      aniversario: form.aniversario || null,
      tipo_transporte: form.tipo_transporte,
      auxilio_combustivel_valor: Number(form.auxilio_combustivel_valor) || 0,
      trello_username: form.trello_username?.trim().toLowerCase() || null,
      dia_adiantamento: Number(form.dia_adiantamento) || 20,
      dia_salario: Number(form.dia_salario) || 5,
      dia_vt_vr: Number(form.dia_vt_vr) || 0,
      dia_das: Number(form.dia_das) || 20,
      fgts_percentual: Number(form.fgts_percentual) || 8,
      inss_patronal_percentual: Number(form.inss_patronal_percentual) || 20,
      provisionar_13: form.provisionar_13,
      provisionar_ferias: form.provisionar_ferias,
      observacoes_pagamento: form.observacoes_pagamento || null,
    };
    if (!payload.nome) return toast.error('Nome é obrigatório');

    if (editId) {
      update.mutate({ id: editId, ...payload } as any, { onSuccess: () => setDialog(false) });
    } else {
      create.mutate(payload as any, { onSuccess: () => setDialog(false) });
    }
  };

  const handleGerarVerbas = async (selectedIds: string[], year: number, month: number, diasUteis: number) => {
    if (!colaboradores) return;
    setGerando(true);
    try {
      // First, fix any existing records with weekend/holiday dates
      const corrigidos = await corrigirDatasExistentes();
      if (corrigidos > 0) {
        toast.info(`${corrigidos} lançamento(s) existente(s) corrigido(s) — datas movidas para dia útil.`);
      }

      const selected = colaboradores.filter(c => selectedIds.includes(c.id));
      const total = await gerarVerbasDoMes(selected, year, month, diasUteis);
      toast.success(`${total} lançamentos gerados para ${selected.length} colaboradores!`);
      setVerbasModal(false);
    } catch { /* handled */ }
    setGerando(false);
  };

  const copyPix = (chave: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(chave);
    toast.success('Chave PIX copiada!');
  };

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Colaboradores</h1>
          <p className="text-sm text-muted-foreground">Gestão de RH, custo de pessoal e verbas automáticas</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" className="h-9 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setVerbasModal(true)}>
            <Zap className="h-4 w-4 mr-1" /> Gerar Verbas do Mês
          </Button>
          <Dialog open={dialog} onOpenChange={setDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1" /> Novo Colaborador
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle className="text-foreground">{editId ? 'Editar' : 'Novo'} Colaborador</DialogTitle></DialogHeader>
              <ColaboradorForm
                form={form} setForm={setForm} onSubmit={handleSubmit}
                isPending={create.isPending || update.isPending}
                isEdit={!!editId} diasUteis={diasUteis}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/60 card-hover">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5"><Users className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalAtivos.length}</p>
              <p className="text-xs text-muted-foreground">Colaboradores Ativos</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60 card-hover">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5"><DollarSign className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-2xl font-bold text-primary">{fmt(custoTotalMensal)}</p>
              <p className="text-xs text-muted-foreground">Custo Total Mensal</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60 card-hover">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5"><CalendarDays className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{diasUteis}</p>
              <p className="text-xs text-muted-foreground">Dias Úteis (Mês Atual)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar colaborador..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      <Card className="border-border/60">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">Carregando...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-foreground">Nome</TableHead>
                    <TableHead className="text-foreground">Regime</TableHead>
                    <TableHead className="text-right text-foreground">Salário</TableHead>
                    <TableHead className="text-right text-foreground">Custo Total</TableHead>
                    <TableHead className="text-foreground">Chave PIX</TableHead>
                    <TableHead className="text-foreground">Trello</TableHead>
                    <TableHead className="text-center text-foreground">Status</TableHead>
                    <TableHead className="text-center text-foreground">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(c => {
                    const custo = estimarCustoTotal(c, diasUteis);
                    const birthday = isBirthdayThisMonth(c.aniversario);
                    return (
                      <TableRow key={c.id} className="group cursor-pointer hover:bg-muted/50" onClick={() => setDetalheColab(c)}>
                        <TableCell className="font-medium text-foreground">
                          <span className="flex items-center gap-1.5">
                            {c.nome}
                            {birthday && <span title="Aniversariante do mês! 🎂"><Cake className="h-3.5 w-3.5 text-pink-400" /></span>}
                          </span>
                          {c.email && <span className="block text-[10px] text-muted-foreground">{c.email}</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            c.regime === 'CLT' ? 'border-info/40 text-info' :
                            c.regime === 'PJ' ? 'border-warning/40 text-warning' :
                            'border-muted-foreground/40 text-muted-foreground'
                          }>
                            {c.regime}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-foreground">{fmt(Number(c.salario_base))}</TableCell>
                        <TableCell className="text-right font-semibold text-primary">{fmt(custo)}</TableCell>
                        <TableCell>
                          {c.pix_chave ? (
                            <button
                              className="flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer bg-transparent border-0 p-0"
                              onClick={(e) => copyPix(c.pix_chave!, e)}
                              title="Clique para copiar"
                            >
                              <span className="text-xs truncate max-w-[140px] text-foreground">{c.pix_chave}</span>
                              <Copy className="h-3 w-3 text-muted-foreground" />
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {(c as any).trello_username ? (
                            <span className="text-xs text-foreground">@{(c as any).trello_username}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={`border-0 text-[10px] ${c.status === 'ativo' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                            {c.status === 'ativo' ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => openEdit(c, e)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={(e) => { e.stopPropagation(); del.mutate(c.id); }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum colaborador</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gerar Verbas Modal */}
      <GerarVerbasModal
        open={verbasModal}
        onOpenChange={setVerbasModal}
        colaboradores={colaboradores || []}
        onConfirm={handleGerarVerbas}
        isPending={gerando}
      />

      {/* Collaborator Detail Modal */}
      <ColaboradorDetalheModal
        colab={detalheColab}
        open={!!detalheColab}
        onOpenChange={(open) => { if (!open) setDetalheColab(null); }}
      />
    </div>
  );
}
