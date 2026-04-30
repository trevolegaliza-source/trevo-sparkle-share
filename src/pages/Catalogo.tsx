import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, DollarSign, Trash2, BookOpen, Loader2, Save, ArrowLeft, ArrowRight, ChevronRight, Settings, Pencil, Link2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  useServicos,
  usePrecosUF,
  useCreateServico,
  useUpdateServico,
  useDeleteServico,
  useUpsertPrecoUF,
  CATEGORIAS_SERVICO,
  type ServicosCatalogo,
} from '@/hooks/useCatalogo';
import { CATALOG_HIERARCHY, type HierarchyGroup, type HierarchyChild } from '@/constants/catalogo-hierarchy';
import { UFS_BRASIL, UF_NOMES } from '@/constants/estados-brasil';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// Inline CSS kept minimal — glass effects moved to index.css
const GLASS_CSS = `
.breadcrumb-item {
  cursor: pointer;
  transition: color 0.2s;
}
.breadcrumb-item:hover {
  color: hsl(142 71% 45%);
}
.catalog-enter {
  animation: catalogFadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}
@keyframes catalogFadeIn {
  from { opacity: 0; transform: translateY(16px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
`;

const CATEGORIA_COLORS: Record<string, string> = {
  abertura: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  alteracao: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  transformacao: 'bg-purple-500/15 text-purple-500 border-purple-500/30',
  baixa: 'bg-red-500/15 text-red-500 border-red-500/30',
  licenca: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  certidao: 'bg-cyan-500/15 text-cyan-500 border-cyan-500/30',
  regularizacao: 'bg-orange-500/15 text-orange-500 border-orange-500/30',
  registros_especiais: 'bg-indigo-500/15 text-indigo-500 border-indigo-500/30',
  marcas_patentes: 'bg-violet-500/15 text-violet-500 border-violet-500/30',
  cartorario: 'bg-slate-500/15 text-slate-500 border-slate-500/30',
  consultoria: 'bg-pink-500/15 text-pink-500 border-pink-500/30',
  recorrentes: 'bg-teal-500/15 text-teal-500 border-teal-500/30',
  outros: 'bg-muted text-muted-foreground',
};

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ═══════════ HELPERS ═══════════
function getAllCategoriesForGroup(group: HierarchyGroup): string[] {
  if (group.categories) return group.categories;
  if (group.children) return group.children.flatMap(c => c.categories);
  return [];
}

function countServicosForCategories(servicos: ServicosCatalogo[], categories: string[]): number {
  return servicos.filter(s => categories.includes(s.categoria)).length;
}

// ═══════════ COMPONENTE PRINCIPAL ═══════════
export default function Catalogo() {
  const { data: servicos = [], isLoading } = useServicos();
  const updateMut = useUpdateServico();
  const deleteMut = useDeleteServico();
  const [path, setPath] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [servicoModal, setServicoModal] = useState<ServicosCatalogo | null>(null);
  const [precosServicoId, setPrecosServicoId] = useState<string | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const [adminMode, setAdminMode] = useState(false);

  async function handleCopyLink() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from('profiles')
      .select('empresa_id')
      .eq('id', user.id)
      .single();
    if (!profile) return;
    const link = `${window.location.origin}/portfolio/${profile.empresa_id}`;
    await navigator.clipboard.writeText(link);
    toast.success('Link público copiado! Envie para seus clientes.');
  }

  function handleDeleteServico(id: string) {
    if (!confirm('Tem certeza que deseja excluir este serviço? Esta ação não pode ser desfeita.')) return;
    deleteMut.mutate(id);
    if (path.length > 0 && path[path.length - 1] === id) {
      setPath(path.slice(0, -1));
    }
  }

  function navigate(newPath: string[]) {
    setPath(newPath);
    setAnimKey(k => k + 1);
  }

  // Search results
  const searchResults = useMemo(() => {
    if (!search) return null;
    const q = search.toLowerCase();
    return servicos.filter(s =>
      s.nome.toLowerCase().includes(q) ||
      (s.descricao || '').toLowerCase().includes(q)
    );
  }, [servicos, search]);

  // Resolve current level
  const currentGroup = path.length >= 1 ? CATALOG_HIERARCHY.find(g => g.key === path[0]) : null;
  const currentChild = path.length >= 2 && currentGroup?.children
    ? currentGroup.children.find(c => c.key === path[1])
    : null;
  const currentServiceId = path.length >= 3 ? path[2] : null;

  // Level 2: get services for current categories
  const level2Categories = useMemo(() => {
    if (path.length === 2 && currentChild) return currentChild.categories;
    if (path.length === 1 && currentGroup && currentGroup.categories && !currentGroup.children) return currentGroup.categories;
    return null;
  }, [path, currentGroup, currentChild]);

  const level2Services = useMemo(() => {
    if (!level2Categories) return [];
    return servicos.filter(s => level2Categories.includes(s.categoria));
  }, [servicos, level2Categories]);

  // Level 3: single service
  const level3Service = currentServiceId ? servicos.find(s => s.id === currentServiceId) : null;

  // Breadcrumb
  const breadcrumbs = useMemo(() => {
    const crumbs: { label: string; path: string[] }[] = [
      { label: '🍀 Portfólio', path: [] },
    ];
    if (currentGroup) {
      crumbs.push({ label: currentGroup.label, path: [currentGroup.key] });
    }
    if (currentChild) {
      crumbs.push({ label: currentChild.label, path: [path[0], currentChild.key] });
    }
    if (level3Service) {
      crumbs.push({ label: level3Service.nome, path: [...path] });
    }
    return crumbs;
  }, [path, currentGroup, currentChild, level3Service]);

  const precosServico = servicos.find(s => s.id === precosServicoId);

  return (
    <div className="space-y-6">
      <style dangerouslySetInnerHTML={{ __html: GLASS_CSS }} />

      {/* Admin mode indicator */}
      {adminMode && (
        <div className="fixed top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500 z-50" />
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6" /> Portfólio de Serviços
          </h1>
          <p className="text-sm text-muted-foreground">
            {servicos.length} serviços cadastrados · {CATALOG_HIERARCHY.length} áreas de atuação
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Admin</span>
            <Switch checked={adminMode} onCheckedChange={setAdminMode} />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar serviço..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 w-64"
            />
          </div>
          {adminMode && (
            <>
              <Button variant="outline" onClick={handleCopyLink}>
                <Link2 className="h-4 w-4 mr-1" /> Copiar Link Público
              </Button>
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4 mr-1" /> Novo Serviço
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Breadcrumb */}
      {path.length > 0 && !search && (
        <div className="flex items-center gap-1 text-sm flex-wrap">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
              {i < breadcrumbs.length - 1 ? (
                <span
                  className="breadcrumb-item text-muted-foreground hover:text-primary"
                  onClick={() => navigate(crumb.path)}
                >
                  {crumb.label}
                </span>
              ) : (
                <span className="font-medium text-foreground">{crumb.label}</span>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Carregando catálogo...
        </div>
      ) : search && searchResults ? (
        <SearchResultsView
          results={searchResults}
          search={search}
          onSelectService={(s) => {
            setSearch('');
            // Find which group/child this service belongs to
            for (const group of CATALOG_HIERARCHY) {
              const allCats = getAllCategoriesForGroup(group);
              if (allCats.includes(s.categoria)) {
                if (group.children) {
                  const child = group.children.find(c => c.categories.includes(s.categoria));
                  if (child) {
                    navigate([group.key, child.key, s.id]);
                    return;
                  }
                } else {
                  navigate([group.key, s.id]);
                  return;
                }
              }
            }
          }}
        />
      ) : level3Service ? (
        <ServiceDetailView
          key={animKey}
          service={level3Service}
          adminMode={adminMode}
          onBack={() => navigate(path.slice(0, -1))}
          onPrecos={() => setPrecosServicoId(level3Service.id)}
          onDelete={() => handleDeleteServico(level3Service.id)}
        />
      ) : level2Categories ? (
        <Level2View
          key={animKey}
          services={level2Services}
          adminMode={adminMode}
          onSelectService={(s) => navigate([...path, s.id])}
          onBack={() => navigate(path.slice(0, -1))}
          onEditService={(s) => setServicoModal(s)}
          onPrecosService={(s) => setPrecosServicoId(s.id)}
          onDeleteService={(s) => handleDeleteServico(s.id)}
        />
      ) : currentGroup?.children ? (
        <Level1View
          key={animKey}
          group={currentGroup}
          servicos={servicos}
          onSelectChild={(child) => navigate([currentGroup.key, child.key])}
          onBack={() => navigate([])}
        />
      ) : (
        <Level0View
          key={animKey}
          servicos={servicos}
          onSelectGroup={(group) => {
            if (group.children) {
              navigate([group.key]);
            } else {
              navigate([group.key]);
            }
          }}
        />
      )}

      {/* Modais */}
      <ServicoFormModal
        open={showCreate || !!servicoModal}
        servico={servicoModal}
        onClose={() => { setShowCreate(false); setServicoModal(null); }}
      />
      {precosServicoId && precosServico && (
        <PrecosUFModal
          servicoId={precosServicoId}
          servicoNome={precosServico.nome}
          onClose={() => setPrecosServicoId(null)}
        />
      )}
    </div>
  );
}

// ═══════════ NÍVEL 0: MEGA-CARDS ═══════════
function Level0View({
  servicos,
  onSelectGroup,
}: {
  servicos: ServicosCatalogo[];
  onSelectGroup: (group: HierarchyGroup) => void;
}) {
  return (
    <div className="relative">
      {/* Ambient glow background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-[120px]" />
      </div>
      <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 catalog-enter">
        {CATALOG_HIERARCHY.map((group, i) => {
          const allCats = getAllCategoriesForGroup(group);
          const count = countServicosForCategories(servicos, allCats);
          return (
            <GlassCard
              key={group.key}
              glowColor={group.glowColor}
              style={{ animationDelay: `${i * 60}ms` }}
              onClick={() => onSelectGroup(group)}
            >
              <div className="relative z-10 flex flex-col justify-between min-h-[152px]">
                <div>
                  <span className="text-3xl mb-3 block">{group.icon}</span>
                  <h3 className="font-bold text-lg mb-1.5 text-foreground">{group.label}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{group.description}</p>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <span className="text-xs font-medium text-foreground/80 px-3 py-1.5 rounded-full bg-foreground/5 backdrop-blur-sm border border-foreground/10">
                    {count} {count === 1 ? 'serviço' : 'serviços'}
                  </span>
                  <span className="text-muted-foreground group-hover:text-foreground/80 transition-colors text-lg">→</span>
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════ NÍVEL 1: CHILDREN DO GRUPO ═══════════
function Level1View({
  group,
  servicos,
  onSelectChild,
  onBack,
}: {
  group: HierarchyGroup;
  servicos: ServicosCatalogo[];
  onSelectChild: (child: HierarchyChild) => void;
  onBack: () => void;
}) {
  if (!group.children) return null;
  return (
    <div className="space-y-4 catalog-enter">
      <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
      </Button>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{group.icon}</span>
        <div>
          <h2 className="text-xl font-bold">{group.label}</h2>
          <p className="text-sm text-muted-foreground">{group.description}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {group.children.map((child, i) => {
          const count = countServicosForCategories(servicos, child.categories);
          return (
            <GlassCard
              key={child.key}
              variant="sm"
              glowColor={group.glowColor}
              style={{ animationDelay: `${i * 60}ms` }}
              onClick={() => onSelectChild(child)}
            >
              <div className="relative z-10 flex flex-col justify-between min-h-[100px]">
                <div>
                  <h3 className="font-semibold text-base mb-1 text-foreground">{child.label}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2">{child.description}</p>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-[10px] font-medium text-foreground/80 px-2.5 py-1 rounded-full bg-foreground/5 border border-foreground/10">
                    {count} {count === 1 ? 'serviço' : 'serviços'}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════ NÍVEL 2: SERVIÇOS INDIVIDUAIS ═══════════
function Level2View({
  services,
  adminMode,
  onSelectService,
  onBack,
  onEditService,
  onPrecosService,
  onDeleteService,
}: {
  services: ServicosCatalogo[];
  adminMode: boolean;
  onSelectService: (s: ServicosCatalogo) => void;
  onBack: () => void;
  onEditService: (s: ServicosCatalogo) => void;
  onPrecosService: (s: ServicosCatalogo) => void;
  onDeleteService: (s: ServicosCatalogo) => void;
}) {
  return (
    <div className="space-y-4 catalog-enter">
      <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
      </Button>
      {services.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum serviço cadastrado nesta categoria.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((s, i) => {
            const catLabel = CATEGORIAS_SERVICO.find(c => c.value === s.categoria)?.label || s.categoria;
            return (
              <GlassCard
                key={s.id}
                variant="service"
                glowColor="rgba(34, 197, 94, 0.1)"
                style={{ animationDelay: `${i * 40}ms` }}
                onClick={() => onSelectService(s)}
              >
                <div className="relative z-10 flex flex-col gap-2">
                  {adminMode && (
                    <div className="absolute top-0 right-0 flex gap-1 z-10" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => onEditService(s)}
                        className="p-1.5 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-all"
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => onPrecosService(s)}
                        className="p-1.5 rounded-lg bg-foreground/5 hover:bg-emerald-500/20 text-muted-foreground hover:text-emerald-400 transition-all"
                        title="Preços por UF"
                      >
                        <DollarSign className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteService(s)}
                        className="p-1.5 rounded-lg bg-foreground/5 hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-all"
                        title="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-foreground">{s.nome}</span>
                  </div>
                  {s.descricao && (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{s.descricao}</p>
                  )}
                  <div className="flex items-center gap-2 mt-auto flex-wrap">
                    <Badge variant="outline" className={`text-[10px] ${CATEGORIA_COLORS[s.categoria] || ''}`}>
                      {catLabel}
                    </Badge>
                    {s.prazo_estimado && (
                      <Badge variant="outline" className="text-[10px] bg-muted/50 border-foreground/10">
                        {s.prazo_estimado}
                      </Badge>
                    )}
                    <Badge variant="outline" className={`text-[10px] ${s.ativo ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : 'bg-red-500/10 text-red-500 border-red-500/30'}`}>
                      {s.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════ NÍVEL 3: DETALHE DO SERVIÇO ═══════════
function ServiceDetailView({
  service,
  adminMode,
  onBack,
  onPrecos,
  onDelete,
}: {
  service: ServicosCatalogo;
  adminMode: boolean;
  onBack: () => void;
  onPrecos: () => void;
  onDelete: () => void;
}) {
  const { data: precos = [], isLoading: loadingPrecos } = usePrecosUF(service.id);
  const updateMut = useUpdateServico();
  const catLabel = CATEGORIAS_SERVICO.find(c => c.value === service.categoria)?.label || service.categoria;

  const [editNome, setEditNome] = useState(service.nome);
  const [editDesc, setEditDesc] = useState(service.descricao || '');
  const [editPrazo, setEditPrazo] = useState(service.prazo_estimado || '');
  const [editCat, setEditCat] = useState(service.categoria);
  const [editAtivo, setEditAtivo] = useState(service.ativo);

  useEffect(() => {
    setEditNome(service.nome);
    setEditDesc(service.descricao || '');
    setEditPrazo(service.prazo_estimado || '');
    setEditCat(service.categoria);
    setEditAtivo(service.ativo);
  }, [service.id]);

  function handleSaveEdit() {
    updateMut.mutate({
      id: service.id,
      updates: {
        nome: editNome,
        descricao: editDesc || undefined,
        prazo_estimado: editPrazo || undefined,
        categoria: editCat,
        ativo: editAtivo,
      },
    });
  }

  const precosPreenchidos = precos.filter(p => p.honorario_trevo > 0 || p.taxa_orgao > 0);

  return (
    <div className="space-y-6 catalog-enter max-w-4xl">
      <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
      </Button>

      {/* Hero card */}
      <div className="glass-card-inner p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold mb-2">{service.nome}</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={`text-[10px] ${CATEGORIA_COLORS[service.categoria] || ''}`}>
                {catLabel}
              </Badge>
              {service.prazo_estimado && (
                <Badge variant="outline" className="text-[10px] bg-muted/50 border-white/10">
                  Prazo: {service.prazo_estimado}
                </Badge>
              )}
              <Badge variant="outline" className={`text-[10px] ${service.ativo ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : 'bg-red-500/10 text-red-500 border-red-500/30'}`}>
                {service.ativo ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
          </div>
        </div>

        {service.descricao && (
          <div className="text-sm text-muted-foreground whitespace-pre-line bg-white/[0.02] rounded-xl p-4 border border-white/5 leading-relaxed">
            {service.descricao}
          </div>
        )}
      </div>

      {/* Admin: Edição inline */}
      {adminMode && (
        <div className="glass-card-inner p-6 space-y-4">
          <h3 className="font-semibold text-sm">Editar Serviço</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nome do serviço</label>
              <Input value={editNome} onChange={e => setEditNome(e.target.value)} className="h-8 text-xs mt-1 bg-white/5 border-white/10" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Categoria</label>
              <Select value={editCat} onValueChange={setEditCat}>
                <SelectTrigger className="h-8 text-xs mt-1 bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_SERVICO.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Prazo estimado</label>
              <Input value={editPrazo} onChange={e => setEditPrazo(e.target.value)} className="h-8 text-xs mt-1 bg-white/5 border-white/10" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Descrição</label>
            <Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={6} className="text-xs mt-1 bg-white/5 border-white/10" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <div className="flex items-center gap-2 mt-1">
              <Switch checked={editAtivo} onCheckedChange={setEditAtivo} />
              <span className="text-sm">{editAtivo ? 'Ativo' : 'Inativo'}</span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 pt-2">
            <Button variant="destructive" size="sm" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir Serviço
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onPrecos}>
                <DollarSign className="h-3.5 w-3.5 mr-1" /> Gerenciar Preços por UF
              </Button>
              <Button size="sm" onClick={handleSaveEdit} disabled={updateMut.isPending} className="bg-emerald-600 hover:bg-emerald-700">
                {updateMut.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                Salvar Alterações
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tabela de preços por UF */}
      <div className="glass-card-inner p-6 space-y-4">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <DollarSign className="h-4 w-4" /> Preços por UF
        </h3>
        {loadingPrecos ? (
          <p className="text-xs text-muted-foreground">Carregando preços...</p>
        ) : precosPreenchidos.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">Nenhum preço cadastrado ainda.</p>
            {adminMode && (
              <Button variant="outline" size="sm" className="mt-3" onClick={onPrecos}>
                <DollarSign className="h-3.5 w-3.5 mr-1" /> Cadastrar Preços
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-white/5 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="text-left p-2.5 font-medium text-xs">UF</th>
                  <th className="text-right p-2.5 font-medium text-xs">Honorário</th>
                  <th className="text-right p-2.5 font-medium text-xs">Taxa Órgão</th>
                  <th className="text-right p-2.5 font-medium text-xs">Total</th>
                </tr>
              </thead>
              <tbody>
                {precosPreenchidos.map(p => (
                  <tr key={p.uf} className="border-b border-white/5 last:border-0">
                    <td className="p-2.5">
                      <span className="font-medium">{p.uf}</span>
                      <span className="text-xs text-muted-foreground ml-1.5">{UF_NOMES[p.uf]}</span>
                    </td>
                    <td className="p-2.5 text-right text-xs">{fmt(p.honorario_trevo)}</td>
                    <td className="p-2.5 text-right text-xs">{fmt(p.taxa_orgao)}</td>
                    <td className="p-2.5 text-right text-xs font-medium">{fmt(p.honorario_trevo + p.taxa_orgao)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════ BUSCA GLOBAL ═══════════
function SearchResultsView({
  results,
  search,
  onSelectService,
}: {
  results: ServicosCatalogo[];
  search: string;
  onSelectService: (s: ServicosCatalogo) => void;
}) {
  return (
    <div className="space-y-4 catalog-enter">
      <p className="text-sm text-muted-foreground">
        {results.length} resultado(s) para "<span className="font-medium text-foreground">{search}</span>"
      </p>
      {results.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum serviço encontrado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map(s => {
            const catLabel = CATEGORIAS_SERVICO.find(c => c.value === s.categoria)?.label || s.categoria;
            return (
              <div
                key={s.id}
                className="glass-card-inner p-4 cursor-pointer flex flex-col gap-2"
                onClick={() => onSelectService(s)}
              >
                <span className="font-semibold text-sm">{s.nome}</span>
                {s.descricao && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{s.descricao}</p>
                )}
                <div className="flex items-center gap-2 mt-auto flex-wrap">
                  <Badge variant="outline" className={`text-[10px] ${CATEGORIA_COLORS[s.categoria] || ''}`}>
                    {catLabel}
                  </Badge>
                  {s.prazo_estimado && (
                    <Badge variant="outline" className="text-[10px] bg-muted/50 border-white/10">
                      {s.prazo_estimado}
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════ MODAL SERVIÇO (INALTERADO) ═══════════
function ServicoFormModal({ open, servico, onClose }: { open: boolean; servico: ServicosCatalogo | null; onClose: () => void }) {
  const createMut = useCreateServico();
  const updateMut = useUpdateServico();
  const deleteMut = useDeleteServico();

  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState('abertura');
  const [descricao, setDescricao] = useState('');
  const [prazo, setPrazo] = useState('');

  const isEdit = !!servico;

  const [lastId, setLastId] = useState<string | null>(null);
  if (open && servico && servico.id !== lastId) {
    setNome(servico.nome);
    setCategoria(servico.categoria);
    setDescricao(servico.descricao || '');
    setPrazo(servico.prazo_estimado || '');
    setLastId(servico.id);
  } else if (open && !servico && lastId !== 'new') {
    setNome('');
    setCategoria('abertura');
    setDescricao('');
    setPrazo('');
    setLastId('new');
  }

  function handleSave() {
    if (!nome.trim()) return;
    const payload = { nome: nome.trim(), categoria, descricao: descricao.trim() || undefined, prazo_estimado: prazo.trim() || undefined };
    if (isEdit && servico) {
      updateMut.mutate({ id: servico.id, updates: payload }, { onSuccess: () => { onClose(); setLastId(null); } });
    } else {
      createMut.mutate(payload, { onSuccess: () => { onClose(); setLastId(null); } });
    }
  }

  function handleDelete() {
    if (!servico) return;
    if (!confirm('Excluir este serviço e todos os preços associados?')) return;
    deleteMut.mutate(servico.id, { onSuccess: () => { onClose(); setLastId(null); } });
  }

  const loading = createMut.isPending || updateMut.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setLastId(null); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Serviço' : 'Novo Serviço'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium">Nome do serviço *</label>
            <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Abertura de MEI" />
          </div>
          <div>
            <label className="text-xs font-medium">Categoria *</label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIAS_SERVICO.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium">Descrição</label>
            <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Detalhes do serviço..." rows={3} />
          </div>
          <div>
            <label className="text-xs font-medium">Prazo estimado</label>
            <Input value={prazo} onChange={e => setPrazo(e.target.value)} placeholder="Ex: 15-20 dias úteis" />
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          {isEdit && (
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleteMut.isPending} className="mr-auto">
              <Trash2 className="h-4 w-4 mr-1" /> Excluir
            </Button>
          )}
          <Button variant="outline" onClick={() => { onClose(); setLastId(null); }}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading || !nome.trim()}>
            {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════ MODAL PREÇOS POR UF (INALTERADO) ═══════════
function PrecosUFModal({ servicoId, servicoNome, onClose }: { servicoId: string; servicoNome: string; onClose: () => void }) {
  const { data: precos = [], isLoading } = usePrecosUF(servicoId);
  const upsertMut = useUpsertPrecoUF();

  const [formData, setFormData] = useState<Record<string, { honorario: string; taxa: string; obs: string }>>({});
  const [initialized, setInitialized] = useState(false);

  if (!isLoading && !initialized) {
    const initial: typeof formData = {};
    for (const uf of UFS_BRASIL) {
      const existing = precos.find(p => p.uf === uf);
      initial[uf] = {
        honorario: existing ? String(existing.honorario_trevo) : '',
        taxa: existing ? String(existing.taxa_orgao) : '',
        obs: existing?.observacoes || '',
      };
    }
    setFormData(initial);
    setInitialized(true);
  }

  function updateField(uf: string, field: 'honorario' | 'taxa' | 'obs', value: string) {
    setFormData(prev => ({
      ...prev,
      [uf]: { ...prev[uf], [field]: value },
    }));
  }

  async function handleSaveAll() {
    let count = 0;
    for (const uf of UFS_BRASIL) {
      const d = formData[uf];
      if (!d) continue;
      const hon = parseFloat(d.honorario) || 0;
      const taxa = parseFloat(d.taxa) || 0;
      if (hon === 0 && taxa === 0 && !d.obs) continue;
      await upsertMut.mutateAsync({
        servico_id: servicoId,
        uf,
        honorario_trevo: hon,
        taxa_orgao: taxa,
        observacoes: d.obs || undefined,
      });
      count++;
    }
    if (count === 0) {
      toast.info('Nenhum preço preenchido para salvar.');
    }
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" /> Preços — {servicoNome}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">Carregando preços...</div>
        ) : (
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="rounded-lg border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background z-10">
                  <tr className="border-b bg-muted/40">
                    <th className="text-left p-2 font-medium w-24">UF</th>
                    <th className="text-left p-2 font-medium">Honorário (R$)</th>
                    <th className="text-left p-2 font-medium">Taxa Órgão (R$)</th>
                    <th className="text-right p-2 font-medium w-28">Total</th>
                    <th className="text-left p-2 font-medium">Obs.</th>
                  </tr>
                </thead>
                <tbody>
                  {UFS_BRASIL.map(uf => {
                    const d = formData[uf] || { honorario: '', taxa: '', obs: '' };
                    const total = (parseFloat(d.honorario) || 0) + (parseFloat(d.taxa) || 0);
                    return (
                      <tr key={uf} className="border-b last:border-0 hover:bg-muted/10">
                        <td className="p-2">
                          <span className="font-medium">{uf}</span>
                          <span className="text-xs text-muted-foreground ml-1 hidden sm:inline">{UF_NOMES[uf]}</span>
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0,00"
                            value={d.honorario}
                            onChange={e => updateField(uf, 'honorario', e.target.value)}
                            className="h-8 w-28"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0,00"
                            value={d.taxa}
                            onChange={e => updateField(uf, 'taxa', e.target.value)}
                            className="h-8 w-28"
                          />
                        </td>
                        <td className="p-2 text-right font-medium text-muted-foreground">
                          {total > 0 ? fmt(total) : '—'}
                        </td>
                        <td className="p-2">
                          <Input
                            placeholder="Observações"
                            value={d.obs}
                            onChange={e => updateField(uf, 'obs', e.target.value)}
                            className="h-8"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        )}

        <Separator />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={handleSaveAll} disabled={upsertMut.isPending}>
            {upsertMut.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Salvar Todos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
