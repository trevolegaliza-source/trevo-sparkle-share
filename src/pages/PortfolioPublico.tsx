import { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, BookOpen, Loader2, ArrowLeft, ArrowRight, ChevronRight, DollarSign, AlertCircle } from 'lucide-react';
import { CATALOG_HIERARCHY, type HierarchyGroup, type HierarchyChild } from '@/constants/catalogo-hierarchy';
import { UFS_BRASIL, UF_NOMES } from '@/constants/estados-brasil';
import { CATEGORIAS_SERVICO } from '@/hooks/useCatalogo';

const GLASS_CSS = `
.glass-card {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 24px;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}
.glass-card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 24px;
  padding: 1px;
  background: linear-gradient(135deg, rgba(255,255,255,0.1), transparent 50%);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}
.glass-card:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.12);
  transform: translateY(-4px) scale(1.01);
}
.glass-card-glow {
  position: absolute;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.4;
  top: -40px;
  right: -40px;
  pointer-events: none;
  transition: opacity 0.4s;
}
.glass-card:hover .glass-card-glow {
  opacity: 0.7;
}
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
.service-detail-card {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 20px;
  transition: all 0.3s;
}
.service-detail-card:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
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

interface PublicServico {
  id: string;
  nome: string;
  categoria: string;
  descricao: string | null;
  prazo_estimado: string | null;
}

interface PublicPreco {
  servico_id: string;
  uf: string;
  honorario_trevo: number;
  taxa_orgao: number;
  observacoes: string | null;
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getAllCategoriesForGroup(group: HierarchyGroup): string[] {
  if (group.categories) return group.categories;
  if (group.children) return group.children.flatMap(c => c.categories);
  return [];
}

function countServicosForCategories(servicos: PublicServico[], categories: string[]): number {
  return servicos.filter(s => categories.includes(s.categoria)).length;
}

export default function PortfolioPublico() {
  const { token } = useParams<{ token: string }>();
  const [servicos, setServicos] = useState<PublicServico[]>([]);
  const [precos, setPrecos] = useState<PublicPreco[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [path, setPath] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [animKey, setAnimKey] = useState(0);
  const [ufFilter, setUfFilter] = useState<string>('todas');

  useEffect(() => {
    if (!token) { setError('Token não informado'); setLoading(false); return; }
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    fetch(`https://${projectId}.supabase.co/functions/v1/portfolio-publico?token=${token}`)
      .then(async res => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Erro ao carregar portfólio');
        }
        return res.json();
      })
      .then(data => {
        setServicos(data.servicos || []);
        setPrecos(data.precos || []);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  function navigate(newPath: string[]) {
    setPath(newPath);
    setAnimKey(k => k + 1);
  }

  const searchResults = useMemo(() => {
    if (!search) return null;
    const q = search.toLowerCase();
    return servicos.filter(s =>
      s.nome.toLowerCase().includes(q) ||
      (s.descricao || '').toLowerCase().includes(q)
    );
  }, [servicos, search]);

  const currentGroup = path.length >= 1 ? CATALOG_HIERARCHY.find(g => g.key === path[0]) : null;
  const currentChild = path.length >= 2 && currentGroup?.children
    ? currentGroup.children.find(c => c.key === path[1])
    : null;
  const currentServiceId = path.length >= 3 ? path[2] : (path.length === 2 && currentGroup && !currentGroup.children ? path[1] : null);

  const level2Categories = useMemo(() => {
    if (path.length === 2 && currentChild) return currentChild.categories;
    if (path.length === 1 && currentGroup && currentGroup.categories && !currentGroup.children) return currentGroup.categories;
    return null;
  }, [path, currentGroup, currentChild]);

  const level2Services = useMemo(() => {
    if (!level2Categories) return [];
    return servicos.filter(s => level2Categories.includes(s.categoria));
  }, [servicos, level2Categories]);

  const level3Service = currentServiceId ? servicos.find(s => s.id === currentServiceId) : null;

  const breadcrumbs = useMemo(() => {
    const crumbs: { label: string; path: string[] }[] = [
      { label: '🍀 Portfólio', path: [] },
    ];
    if (currentGroup) crumbs.push({ label: currentGroup.label, path: [currentGroup.key] });
    if (currentChild) crumbs.push({ label: currentChild.label, path: [path[0], currentChild.key] });
    if (level3Service) crumbs.push({ label: level3Service.nome, path: [...path] });
    return crumbs;
  }, [path, currentGroup, currentChild, level3Service]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md px-6">
          <AlertCircle className="h-16 w-16 text-red-400 mx-auto" />
          <h1 className="text-2xl font-bold">Portfólio não encontrado</h1>
          <p className="text-muted-foreground">
            Verifique o link com seu contato na Trevo Legaliza.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <style dangerouslySetInnerHTML={{ __html: GLASS_CSS }} />
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Header com branding */}
        <div className="text-center mb-8">
          <img
            src="https://aahhauquuicvtwtrxyan.supabase.co/storage/v1/object/public/documentos/logo/trevo-legaliza-hd.png"
            alt="Trevo Legaliza"
            className="h-16 mx-auto mb-4"
          />
          <h1 className="text-3xl font-bold">Portfólio de Serviços</h1>
          <p className="text-muted-foreground mt-2">Trevo Legaliza · Assessoria societária com atuação nacional</p>
        </div>

        {/* Busca */}
        <div className="flex justify-center">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar serviço..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-10"
            />
          </div>
        </div>

        {/* Breadcrumb */}
        {path.length > 0 && !search && (
          <div className="flex items-center gap-1 text-sm flex-wrap">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                {i < breadcrumbs.length - 1 ? (
                  <span className="breadcrumb-item text-muted-foreground hover:text-primary" onClick={() => navigate(crumb.path)}>
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
        {search && searchResults ? (
          <div className="space-y-3 catalog-enter">
            <p className="text-sm text-muted-foreground">{searchResults.length} resultado(s) para "{search}"</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {searchResults.map((s, i) => {
                const catLabel = CATEGORIAS_SERVICO.find(c => c.value === s.categoria)?.label || s.categoria;
                return (
                  <div
                    key={s.id}
                    className="service-detail-card p-4 cursor-pointer flex flex-col gap-2"
                    style={{ animationDelay: `${i * 40}ms` }}
                    onClick={() => {
                      setSearch('');
                      for (const group of CATALOG_HIERARCHY) {
                        const allCats = getAllCategoriesForGroup(group);
                        if (allCats.includes(s.categoria)) {
                          if (group.children) {
                            const child = group.children.find(c => c.categories.includes(s.categoria));
                            if (child) { navigate([group.key, child.key, s.id]); return; }
                          } else {
                            navigate([group.key, s.id]); return;
                          }
                        }
                      }
                    }}
                  >
                    <span className="font-semibold text-sm">{s.nome}</span>
                    {s.descricao && <p className="text-xs text-muted-foreground line-clamp-2">{s.descricao}</p>}
                    <Badge variant="outline" className={`text-[10px] w-fit ${CATEGORIA_COLORS[s.categoria] || ''}`}>{catLabel}</Badge>
                  </div>
                );
              })}
            </div>
          </div>
        ) : level3Service ? (
          <PublicServiceDetail
            key={animKey}
            service={level3Service}
            precos={precos.filter(p => p.servico_id === level3Service.id && (p.honorario_trevo > 0 || p.taxa_orgao > 0))}
            ufFilter={ufFilter}
            setUfFilter={setUfFilter}
            onBack={() => navigate(path.slice(0, -1))}
          />
        ) : level2Categories ? (
          <div className="space-y-4 catalog-enter" key={animKey}>
            <Button variant="ghost" size="sm" onClick={() => navigate(path.slice(0, -1))} className="text-muted-foreground">
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
            {level2Services.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <BookOpen className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhum serviço nesta categoria.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {level2Services.map((s, i) => {
                  const catLabel = CATEGORIAS_SERVICO.find(c => c.value === s.categoria)?.label || s.categoria;
                  return (
                    <div
                      key={s.id}
                      className="service-detail-card p-4 cursor-pointer flex flex-col gap-2"
                      style={{ animationDelay: `${i * 40}ms` }}
                      onClick={() => navigate([...path, s.id])}
                    >
                      <span className="font-semibold text-sm">{s.nome}</span>
                      {s.descricao && <p className="text-xs text-muted-foreground line-clamp-2">{s.descricao}</p>}
                      <div className="flex items-center gap-2 mt-auto flex-wrap">
                        <Badge variant="outline" className={`text-[10px] ${CATEGORIA_COLORS[s.categoria] || ''}`}>{catLabel}</Badge>
                        {s.prazo_estimado && (
                          <Badge variant="outline" className="text-[10px] bg-muted/50 border-foreground/10">{s.prazo_estimado}</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : currentGroup?.children ? (
          <div className="space-y-4 catalog-enter" key={animKey}>
            <Button variant="ghost" size="sm" onClick={() => navigate([])} className="text-muted-foreground">
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{currentGroup.icon}</span>
              <div>
                <h2 className="text-xl font-bold">{currentGroup.label}</h2>
                <p className="text-sm text-muted-foreground">{currentGroup.description}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {currentGroup.children.map((child, i) => {
                const count = countServicosForCategories(servicos, child.categories);
                return (
                  <div key={child.key} className="glass-card p-5 min-h-[140px] flex flex-col justify-between" style={{ animationDelay: `${i * 60}ms` }} onClick={() => navigate([currentGroup.key, child.key])}>
                    <div className="glass-card-glow" style={{ background: currentGroup.glowColor }} />
                    <div className="relative z-10">
                      <h3 className="font-semibold text-base mb-1">{child.label}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-2">{child.description}</p>
                    </div>
                    <div className="relative z-10 flex items-center justify-between mt-3">
                      <Badge variant="outline" className="text-[10px] bg-muted/30 border-foreground/10">{count} {count === 1 ? 'serviço' : 'serviços'}</Badge>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 catalog-enter" key={animKey}>
            {CATALOG_HIERARCHY.map((group, i) => {
              const allCats = getAllCategoriesForGroup(group);
              const count = countServicosForCategories(servicos, allCats);
              return (
                <div
                  key={group.key}
                  className="glass-card p-6 min-h-[180px] flex flex-col justify-between"
                  style={{ animationDelay: `${i * 60}ms` }}
                  onClick={() => navigate(group.children ? [group.key] : [group.key])}
                >
                  <div className="glass-card-glow" style={{ background: group.glowColor }} />
                  <div className="relative z-10">
                    <span className="text-3xl mb-3 block">{group.icon}</span>
                    <h3 className="font-bold text-lg mb-1.5">{group.label}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{group.description}</p>
                  </div>
                  <div className="relative z-10 flex items-center justify-between mt-4">
                    <Badge variant="outline" className="text-[10px] bg-muted/30 border-foreground/10">{count} {count === 1 ? 'serviço' : 'serviços'}</Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Rodapé */}
        <div className="text-center mt-12 pt-8 border-t border-foreground/5">
          <p className="text-sm text-muted-foreground">
            Trevo Legaliza · CNPJ 39.969.412/0001-70 · (11) 93492-7001
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            administrativo@trevolegaliza.com.br · trevolegaliza.com.br
          </p>
        </div>
      </div>
    </div>
  );
}

// ═══════════ DETALHE READ-ONLY ═══════════
function PublicServiceDetail({
  service,
  precos,
  ufFilter,
  setUfFilter,
  onBack,
}: {
  service: PublicServico;
  precos: PublicPreco[];
  ufFilter: string;
  setUfFilter: (v: string) => void;
  onBack: () => void;
}) {
  const catLabel = CATEGORIAS_SERVICO.find(c => c.value === service.categoria)?.label || service.categoria;
  const filteredPrecos = ufFilter === 'todas' ? precos : precos.filter(p => p.uf === ufFilter);

  return (
    <div className="space-y-6 catalog-enter max-w-4xl mx-auto">
      <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
      </Button>

      <div className="service-detail-card p-6 space-y-4">
        <h2 className="text-xl font-bold mb-2">{service.nome}</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={`text-[10px] ${CATEGORIA_COLORS[service.categoria] || ''}`}>{catLabel}</Badge>
          {service.prazo_estimado && (
            <Badge variant="outline" className="text-[10px] bg-muted/50 border-foreground/10">Prazo: {service.prazo_estimado}</Badge>
          )}
        </div>
        {service.descricao && (
          <div className="text-sm text-muted-foreground whitespace-pre-line bg-foreground/[0.02] rounded-xl p-4 border border-foreground/5 leading-relaxed">
            {service.descricao}
          </div>
        )}
      </div>

      {/* Preços por UF */}
      <div className="service-detail-card p-6 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <DollarSign className="h-4 w-4" /> Preços por UF
          </h3>
          <Select value={ufFilter} onValueChange={setUfFilter}>
            <SelectTrigger className="h-8 w-48 text-xs">
              <SelectValue placeholder="Selecione seu estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todos os estados</SelectItem>
              {UFS_BRASIL.map(uf => (
                <SelectItem key={uf} value={uf}>{uf} — {UF_NOMES[uf]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filteredPrecos.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              {ufFilter !== 'todas' ? `Nenhum preço cadastrado para ${UF_NOMES[ufFilter] || ufFilter}.` : 'Nenhum preço cadastrado ainda.'}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-foreground/5 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-foreground/5 bg-foreground/[0.02]">
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">UF</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Honorário</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Taxa do Órgão</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Total</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Obs.</th>
                </tr>
              </thead>
              <tbody>
                {filteredPrecos.map(p => (
                  <tr key={p.uf} className="border-b border-foreground/5">
                    <td className="py-2 px-3 font-medium">{p.uf}</td>
                    <td className="py-2 px-3 text-right text-emerald-400">{fmt(p.honorario_trevo)}</td>
                    <td className="py-2 px-3 text-right text-muted-foreground">{fmt(p.taxa_orgao)}</td>
                    <td className="py-2 px-3 text-right font-medium">{fmt(p.honorario_trevo + p.taxa_orgao)}</td>
                    <td className="py-2 px-3 text-xs text-muted-foreground">{p.observacoes || '—'}</td>
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
