import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { Users, Loader2, UserPlus, MoreHorizontal, UserX, UserCheck, Shield, Mail, Lock, Trash2, AlertTriangle, ShieldOff, Eye } from 'lucide-react';
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';
import { ROLES, MODULOS_DISPONIVEIS, GRUPOS_MODULOS, getRoleInfo, type RoleValue } from '@/constants/roles';
import { MfaEnroll } from '@/components/auth/MfaEnroll';
import { validatePassword } from '@/lib/password-validator';

interface Profile {
  id: string;
  empresa_id: string;
  nome: string | null;
  email: string | null;
  role: string;
  ativo: boolean | null;
  ultimo_acesso: string | null;
  motivo_inativacao: string | null;
  convidado_em: string | null;
  convidado_por: string | null;
}

interface Permission {
  id: string;
  user_id: string;
  empresa_id: string;
  modulo: string;
  pode_ver: boolean;
  pode_criar: boolean;
  pode_editar: boolean;
  pode_excluir: boolean;
  pode_aprovar: boolean;
}

interface RoleTemplate {
  role: string;
  modulos_padrao: string[];
}

const PERM_LABELS = ['Ver', 'Criar', 'Editar', 'Excluir', 'Aprovar'];

function formatUltimoAcesso(date: string | null): string {
  if (!date) return 'Nunca';
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) {
    return `Hoje ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return `Há ${diffDays} dias`;
  if (diffDays < 30) return `Há ${Math.floor(diffDays / 7)} semanas`;
  return d.toLocaleDateString('pt-BR');
}

function getInitials(name: string | null, email: string | null): string {
  const src = name || email || '?';
  const parts = src.split(/[\s@]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.substring(0, 2).toUpperCase();
}

export default function GestaoUsuarios() {
  const { user } = useAuth();
  const { isMaster } = usePermissions();
  const canEdit = isMaster();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roleTemplates, setRoleTemplates] = useState<RoleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [empresaId, setEmpresaId] = useState('');

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<Profile | null>(null);
  const [editRole, setEditRole] = useState('operacional');
  const [editModulos, setEditModulos] = useState<Set<string>>(new Set());
  const [editPerms, setEditPerms] = useState<Record<string, boolean[]>>({});
  const [editNome, setEditNome] = useState('');
  const [saving, setSaving] = useState(false);

  // PERM (13/05/2026): rastreia estado inicial pra detectar mudanças
  // não salvas. Antes do refactor, Thales relatou que mexia no modal
  // mas as mudanças não persistiam — provavelmente fechava sem clicar
  // Salvar. Agora detectamos isso e avisamos.
  const [editInitialSnapshot, setEditInitialSnapshot] = useState<string>('');

  // Deactivation state
  const [deactivateUser, setDeactivateUser] = useState<Profile | null>(null);
  const [deactivateMotivo, setDeactivateMotivo] = useState('');

  // Delete confirmation (apenas desativa — historico preservado)
  const [deleteConfirm, setDeleteConfirm] = useState<Profile | null>(null);
  // FEAT-USR-DELETE (12/05/2026): excluir DEFINITIVO (deleta profile + auth.user)
  const [excluirDefinitivo, setExcluirDefinitivo] = useState<Profile | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [confirmExcluirTexto, setConfirmExcluirTexto] = useState('');
  // FEAT-USR-SET-PASS (12/05/2026): master define senha sem depender de email
  // (resolve rate limit do SMTP do Supabase).
  const [setPassUser, setSetPassUser] = useState<Profile | null>(null);
  const [novaSenha, setNovaSenha] = useState('');
  const [novaSenha2, setNovaSenha2] = useState('');
  const [definindoSenha, setDefinindoSenha] = useState(false);

  // Invite modal state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('operacional');
  // UX-USR-CREATE (12/05/2026): modo "criar com senha agora" (sem email)
  const [inviteModoDireto, setInviteModoDireto] = useState(false);
  const [inviteNome, setInviteNome] = useState('');
  const [inviteSenha, setInviteSenha] = useState('');
  const [inviteSenha2, setInviteSenha2] = useState('');
  const [inviting, setInviting] = useState(false);

  // MFA enrollment modal
  const [mfaEnrollOpen, setMfaEnrollOpen] = useState(false);

  // MFA factors for current users
  const [mfaFactors, setMfaFactors] = useState<Record<string, boolean>>({});

  // SEC-023 (12/05/2026): master reseta 2FA de outro user quando ele
  // perde o celular. Sem isso, master só conseguia resetar via Supabase
  // Dashboard direto.
  const [resetMfaUser, setResetMfaUser] = useState<Profile | null>(null);
  const [resetandoMfa, setResetandoMfa] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const { data: myProfile } = await supabase
      .from('profiles').select('empresa_id').eq('id', user?.id ?? '').single() as any;
    if (!myProfile) { setLoading(false); return; }
    setEmpresaId(myProfile.empresa_id);

    const [profilesRes, permsRes, templatesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('empresa_id', myProfile.empresa_id) as any,
      supabase.from('user_permissions').select('*').eq('empresa_id', myProfile.empresa_id) as any,
      supabase.from('role_templates').select('role, modulos_padrao').order('ordem') as any,
    ]);

    setProfiles(profilesRes.data || []);
    setPermissions(permsRes.data || []);
    setRoleTemplates(templatesRes.data || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user]);

  // Check MFA for current user
  useEffect(() => {
    const checkMfa = async () => {
      const { data } = await supabase.auth.mfa.listFactors();
      if (data?.totp && data.totp.length > 0) {
        setMfaFactors(prev => ({ ...prev, [user?.id || '']: true }));
      }
    };
    if (user) checkMfa();
  }, [user]);

  // KPI calculations
  const kpis = useMemo(() => {
    const total = profiles.length;
    const ativos = profiles.filter(p => p.ativo !== false).length;
    const pendentes = profiles.filter(p => p.ativo === false && !p.motivo_inativacao).length;
    const inativos = profiles.filter(p => p.ativo === false && !!p.motivo_inativacao).length;
    return { total, ativos, pendentes, inativos };
  }, [profiles]);

  // Sort: pendentes first, then ativos, then inativos
  const sortedProfiles = useMemo(() => {
    return [...profiles].sort((a, b) => {
      const statusOrder = (p: Profile) => {
        if (p.ativo === false && !p.motivo_inativacao) return 0; // pendente
        if (p.ativo !== false) return 1; // ativo
        return 2; // inativo
      };
      return statusOrder(a) - statusOrder(b);
    });
  }, [profiles]);

  const getTemplateModulos = (role: string): string[] => {
    return roleTemplates.find(t => t.role === role)?.modulos_padrao || [];
  };

  const openEdit = (profile: Profile) => {
    setEditUser(profile);
    setEditNome(profile.nome || '');
    setEditRole(profile.role);

    const userPerms = permissions.filter(p => p.user_id === profile.id);
    const permsMap: Record<string, boolean[]> = {};
    const moduloSet = new Set<string>();

    if (userPerms.length > 0) {
      MODULOS_DISPONIVEIS.forEach(m => {
        const p = userPerms.find(up => up.modulo === m.value);
        permsMap[m.value] = p
          ? [p.pode_ver, p.pode_criar, p.pode_editar, p.pode_excluir, p.pode_aprovar]
          : [false, false, false, false, false];
        if (p?.pode_ver) moduloSet.add(m.value);
      });
    } else {
      const templateMods = getTemplateModulos(profile.role);
      MODULOS_DISPONIVEIS.forEach(m => {
        const isInTemplate = templateMods.includes(m.value);
        permsMap[m.value] = isInTemplate
          ? [true, profile.role !== 'visualizador', profile.role !== 'visualizador', false, false]
          : [false, false, false, false, false];
        if (isInTemplate) moduloSet.add(m.value);
      });
    }

    setEditPerms(permsMap);
    setEditModulos(moduloSet);
    // Snapshot do estado inicial pra detectar mudanças não salvas
    setEditInitialSnapshot(JSON.stringify({ role: profile.role, perms: permsMap, nome: profile.nome || '' }));
    setEditModalOpen(true);
  };

  // PERM (13/05/2026): true se houve mudança no role/nome/permissões
  // desde abrir o modal. Computado a cada render — barato.
  const editHasChanges = (() => {
    if (!editModalOpen) return false;
    if (!editInitialSnapshot) return false;
    const current = JSON.stringify({ role: editRole, perms: editPerms, nome: editNome });
    return current !== editInitialSnapshot;
  })();

  // Tenta fechar o modal: se há mudanças não salvas, pede confirmação.
  const tryCloseEditModal = () => {
    if (editHasChanges) {
      const ok = window.confirm('Você tem alterações não salvas. Fechar mesmo assim e perder as mudanças?');
      if (!ok) return;
    }
    setEditModalOpen(false);
  };

  // Preview do menu lateral que o user vai ver, baseado nas permissões
  // atuais do modal (sem ter salvo ainda). Reflete o filtro do AppSidebar.
  const editPreviewMenu = (() => {
    if (!editModalOpen) return [] as string[];
    const items: Array<{ label: string; mod: string }> = [
      { label: 'Cadastro Rápido', mod: 'cadastro_rapido' },
      { label: 'Clientes', mod: 'clientes' },
      { label: 'Orçamentos', mod: 'orcamentos' },
      { label: 'Financeiro', mod: 'financeiro' },
      { label: 'Contas a Pagar', mod: 'contas_pagar' },
      { label: 'Cartão', mod: 'contas_pagar' },
      { label: 'Colaboradores', mod: 'colaboradores' },
      { label: 'Configurações', mod: 'configuracoes' },
    ];
    return items.filter(i => editPerms[i.mod]?.[0]).map(i => i.label);
  })();

  // Módulos críticos: acesso a financeiro/configuracoes/colaboradores
  // expõe dados sensíveis. Renderizamos badge de aviso pra master
  // pensar duas vezes antes de marcar pra operacional.
  const isModuloCritico = (mod: string) =>
    ['financeiro','contas_pagar','colaboradores','configuracoes','relatorios_dre','fluxo_caixa'].includes(mod);

  const handleRoleChange = (newRole: string) => {
    setEditRole(newRole);
    const templateMods = getTemplateModulos(newRole);
    const newModulos = new Set(templateMods);
    const newPerms: Record<string, boolean[]> = {};

    MODULOS_DISPONIVEIS.forEach(m => {
      const isInTemplate = templateMods.includes(m.value);
      newPerms[m.value] = isInTemplate
        ? [true, newRole !== 'visualizador', newRole !== 'visualizador', false, false]
        : [false, false, false, false, false];
    });

    setEditModulos(newModulos);
    setEditPerms(newPerms);
  };

  const toggleModulo = (modulo: string, checked: boolean) => {
    const next = new Set(editModulos);
    if (checked) {
      next.add(modulo);
      setEditPerms(prev => ({
        ...prev,
        [modulo]: [true, editRole !== 'visualizador', editRole !== 'visualizador', false, false],
      }));
    } else {
      next.delete(modulo);
      setEditPerms(prev => ({
        ...prev,
        [modulo]: [false, false, false, false, false],
      }));
    }
    setEditModulos(next);
  };

  const togglePerm = (modKey: string, idx: number, val: boolean) => {
    const curr = [...(editPerms[modKey] || [false, false, false, false, false])];
    curr[idx] = val;
    if (idx === 0 && !val) {
      setEditPerms({ ...editPerms, [modKey]: [false, false, false, false, false] });
      setEditModulos(prev => { const n = new Set(prev); n.delete(modKey); return n; });
    } else {
      if (val && idx > 0) curr[0] = true;
      setEditPerms({ ...editPerms, [modKey]: curr });
      if (curr[0]) setEditModulos(prev => new Set(prev).add(modKey));
    }
  };

  const handleSave = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          role: editRole,
          nome: editNome || editUser.nome,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', editUser.id)
        .eq('empresa_id', empresaId);

      if (updateError) throw updateError;

      await supabase.from('user_permissions').delete().eq('user_id', editUser.id) as any;

      const inserts = MODULOS_DISPONIVEIS.map(m => ({
        user_id: editUser.id,
        empresa_id: empresaId,
        modulo: m.value,
        pode_ver: editPerms[m.value]?.[0] || false,
        pode_criar: editPerms[m.value]?.[1] || false,
        pode_editar: editPerms[m.value]?.[2] || false,
        pode_excluir: editPerms[m.value]?.[3] || false,
        pode_aprovar: editPerms[m.value]?.[4] || false,
      }));

      const { error: insError } = await supabase.from('user_permissions').insert(inserts as any);
      if (insError) throw insError;

      toast.success('Usuário atualizado!');
      setEditModalOpen(false);
      await loadData();
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateUser) return;
    try {
      await supabase
        .from('profiles')
        .update({
          ativo: false,
          motivo_inativacao: deactivateMotivo || 'Desativado pelo administrador',
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', deactivateUser.id)
        .eq('empresa_id', empresaId);

      toast.success('Usuário desativado');
      setDeactivateUser(null);
      setDeactivateMotivo('');
      await loadData();
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    }
  };

  const handleReactivate = async (profile: Profile) => {
    try {
      await supabase
        .from('profiles')
        .update({
          ativo: true,
          motivo_inativacao: null,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', profile.id)
        .eq('empresa_id', empresaId);

      toast.success('Usuário reativado');
      await loadData();
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    }
  };

  // SEC-012 (12/05/2026): aprovar/rejeitar mudam acesso ao sistema — clique
  // errado libera quem não devia ou bloqueia legítimo. Confirm explícito.
  const handleApprove = async (profile: Profile) => {
    const nome = profile.nome || profile.email || 'este usuário';
    const role = getRoleInfo(profile.role).label;
    if (!window.confirm(`Aprovar acesso de ${nome} como ${role}?\n\nApós aprovar, o usuário pode entrar no sistema imediatamente.`)) {
      return;
    }
    try {
      await supabase
        .from('profiles')
        .update({
          ativo: true,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', profile.id)
        .eq('empresa_id', empresaId);

      toast.success(`${profile.nome || profile.email} aprovado como ${getRoleInfo(profile.role).label}!`);
      await loadData();
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    }
  };

  const handleReject = async (profile: Profile) => {
    const nome = profile.nome || profile.email || 'este usuário';
    if (!window.confirm(`Rejeitar acesso de ${nome}?\n\nO usuário NÃO poderá entrar no sistema. Você pode reativar depois se mudar de ideia.`)) {
      return;
    }
    try {
      await supabase
        .from('profiles')
        .update({
          ativo: false,
          motivo_inativacao: 'Acesso rejeitado',
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', profile.id)
        .eq('empresa_id', empresaId);

      toast.success('Acesso rejeitado');
      await loadData();
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await supabase
        .from('profiles')
        .update({
          ativo: false,
          motivo_inativacao: 'Removido pelo administrador',
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', deleteConfirm.id)
        .eq('empresa_id', empresaId);

      toast.success(`Usuário ${deleteConfirm.nome || deleteConfirm.email} removido`);
      setDeleteConfirm(null);
      await loadData();
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    }
  };

  // FEAT-USR-DELETE: chamada à edge function excluir-usuario que deleta
  // permanentemente (profile + auth.user).
  const handleExcluirDefinitivo = async () => {
    if (!excluirDefinitivo) return;
    const target = excluirDefinitivo;
    setExcluindo(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('Sessão expirada');
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/excluir-usuario`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            apikey: SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ user_id: target.id }),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || `HTTP ${response.status}`);
      }
      if (result?.warning) {
        toast.warning(result.warning, { duration: 10000 });
      } else {
        toast.success(`${target.nome || target.email} excluído definitivamente.`);
      }
      setExcluirDefinitivo(null);
      setConfirmExcluirTexto('');
      await loadData();
    } catch (e: any) {
      toast.error('Erro ao excluir: ' + (e.message || 'tente novamente'));
    } finally {
      setExcluindo(false);
    }
  };

  // SEC-023: chama edge function resetar-2fa-usuario. Remove fatores TOTP
  // do target — próximo login dele cai de novo em forceSetup (SEC-021).
  const handleResetar2FA = async () => {
    if (!resetMfaUser) return;
    const target = resetMfaUser;
    setResetandoMfa(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('Sessão expirada');
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/resetar-2fa-usuario`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            apikey: SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ user_id: target.id }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || `HTTP ${response.status}`);
      const n = result?.deletados ?? 0;
      if (n === 0) {
        toast.info(`${target.nome || target.email} não tinha 2FA configurado.`);
      } else {
        toast.success(`2FA resetado (${n} fator${n > 1 ? 'es' : ''} removido${n > 1 ? 's' : ''}). No próximo login, ${target.nome || target.email} vai configurar de novo.`, { duration: 8000 });
      }
      setResetMfaUser(null);
      await loadData();
    } catch (e: any) {
      toast.error('Erro ao resetar 2FA: ' + (e.message || 'tente novamente'));
    } finally {
      setResetandoMfa(false);
    }
  };

  // FEAT-USR-SET-PASS: chama edge function definir-senha-usuario
  const handleDefinirSenha = async () => {
    if (!setPassUser) return;
    const v = validatePassword(novaSenha);
    if (!v.ok) { toast.error(v.reason ?? 'Senha inválida'); return; }
    if (novaSenha !== novaSenha2) { toast.error('As senhas não conferem'); return; }
    setDefinindoSenha(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('Sessão expirada');
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/definir-senha-usuario`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            apikey: SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ user_id: setPassUser.id, nova_senha: novaSenha }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || `HTTP ${response.status}`);
      toast.success(`Senha de ${setPassUser.nome || setPassUser.email} definida. Comunique por canal externo (WhatsApp).`);
      setSetPassUser(null);
      setNovaSenha('');
      setNovaSenha2('');
    } catch (e: any) {
      toast.error('Erro: ' + (e.message || 'tente novamente'));
    } finally {
      setDefinindoSenha(false);
    }
  };

  // UX-USR-CREATE: cria usuário com senha imediata (sem email), bypassa rate limit
  const handleCriarComSenha = async () => {
    if (!inviteEmail.trim()) { toast.error('Informe o email'); return; }
    const v = validatePassword(inviteSenha);
    if (!v.ok) { toast.error(v.reason ?? 'Senha inválida'); return; }
    if (inviteSenha !== inviteSenha2) { toast.error('As senhas não conferem'); return; }
    setInviting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('Sessão expirada');
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/criar-usuario-com-senha`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            apikey: SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            email: inviteEmail.trim(),
            role: inviteRole,
            nome: inviteNome.trim() || undefined,
            senha: inviteSenha,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || `HTTP ${response.status}`);
      toast.success(`Usuário criado e ativado. Comunique a senha por canal externo.`, { duration: 8000 });
      setInviteModalOpen(false);
      setInviteEmail('');
      setInviteRole('operacional');
      setInviteNome('');
      setInviteSenha('');
      setInviteSenha2('');
      setInviteModoDireto(false);
      await loadData();
    } catch (e: any) {
      toast.error('Erro: ' + (e.message || 'tente novamente'));
    } finally {
      setInviting(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      toast.error('Informe o email');
      return;
    }
    setInviting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('Sessão expirada');

      const supabaseUrl = SUPABASE_URL;
      const anonKey = SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/convidar-usuario`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            apikey: anonKey,
          },
          body: JSON.stringify({
            email: inviteEmail.trim(),
            role: inviteRole,
            convidado_por: user?.id,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Erro ao convidar');

      toast.success(`Convite enviado para ${inviteEmail}!`);
      setInviteModalOpen(false);
      setInviteEmail('');
      setInviteRole('operacional');
      await loadData();
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    } finally {
      setInviting(false);
    }
  };

  const getStatus = (p: Profile) => {
    if (p.ativo === false && p.motivo_inativacao) return 'inativo';
    if (p.ativo === false) return 'pendente';
    return 'ativo';
  };

  if (loading) {
    return (
      <Card className="border-border/60">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total', value: kpis.total, color: 'text-foreground' },
          { label: 'Ativos', value: kpis.ativos, color: 'text-emerald-500' },
          { label: 'Pendentes', value: kpis.pendentes, color: 'text-amber-500' },
          { label: 'Inativos', value: kpis.inativos, color: 'text-muted-foreground' },
        ].map(kpi => (
          <Card key={kpi.label} className="border-border/60">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Usuários & Acesso</h2>
        </div>
        <div className="flex gap-2">
          {/* UX-USR-INVITE (12/05/2026): botão de convidar tinha sumido em
              algum refactor — modal + handleInvite estavam órfãos. Re-conectado. */}
          {canEdit && (
            <Button size="sm" onClick={() => setInviteModalOpen(true)} className="gap-1.5">
              <UserPlus className="h-4 w-4" /> Convidar Usuário
            </Button>
          )}
          {canEdit && (
            <Button size="sm" onClick={() => setMfaEnrollOpen(true)} variant="outline" className="gap-1.5">
              <Lock className="h-4 w-4" /> Configurar 2FA
            </Button>
          )}
        </div>
      </div>

      {/* User cards */}
      <div className="space-y-3">
        {sortedProfiles.map(p => {
          const status = getStatus(p);
          const roleInfo = getRoleInfo(p.role);
          const isMe = p.id === user?.id;
          const hasMfa = mfaFactors[p.id];

          return (
            <Card
              key={p.id}
              className={`border-border/60 ${status === 'inativo' ? 'opacity-60' : ''} ${status === 'pendente' ? 'border-amber-500/40 bg-amber-500/5' : ''}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-xs font-bold text-white ${roleInfo.corDot}`}>
                    {getInitials(p.nome, p.email)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate">{p.nome || p.email}</p>
                      {isMe && <span className="text-[10px] text-muted-foreground">(você)</span>}
                      {hasMfa && <span title="2FA ativo"><Lock className="h-3 w-3 text-emerald-500" /></span>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <Badge className={`${roleInfo.cor} border text-[10px] uppercase`}>
                        {roleInfo.label}
                      </Badge>
                      {status === 'ativo' && (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Ativo
                        </span>
                      )}
                      {status === 'pendente' && (
                        <span className="flex items-center gap-1 text-[10px] text-amber-500 animate-pulse">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Pendente
                        </span>
                      )}
                      {status === 'inativo' && (
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" /> Inativo
                        </span>
                      )}
                    </div>
                    {status === 'pendente' && p.convidado_em && (
                      <p className="text-[10px] text-amber-500 mt-0.5">
                        Convidado em {new Date(p.convidado_em).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Último acesso: {formatUltimoAcesso(p.ultimo_acesso)}
                    </p>
                  </div>

                  {/* Actions */}
                  {!isMe && canEdit && (
                    <div className="flex items-center gap-1 shrink-0 flex-wrap">
                      {status === 'pendente' && (
                        <>
                          <Button variant="default" size="sm" className="h-8 text-xs gap-1" onClick={() => handleApprove(p)}>
                            <UserCheck className="h-3.5 w-3.5" /> Aprovar
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 text-xs gap-1 text-destructive" onClick={() => handleReject(p)}>
                            <UserX className="h-3.5 w-3.5" /> Rejeitar
                          </Button>
                        </>
                      )}
                      <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => openEdit(p)}>
                        <Shield className="h-3.5 w-3.5" /> Editar
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64">
                          {/* Auditoria 18/05/2026 (f): grupos visuais + descrições inline
                              pra master entender o que cada ação faz sem precisar hover. */}
                          <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">Estado</DropdownMenuLabel>
                          {status === 'ativo' && (
                            <DropdownMenuItem
                              onClick={() => setDeactivateUser(p)}
                              disabled={isMe}
                              title={isMe ? 'Você não pode se auto-desativar' : undefined}
                              className="flex-col items-start gap-0.5"
                            >
                              <div className="flex items-center w-full"><UserX className="h-3.5 w-3.5 mr-2" /> Desativar</div>
                              <span className="text-[10px] text-muted-foreground ml-5">User não loga, dados preservados</span>
                            </DropdownMenuItem>
                          )}
                          {status === 'inativo' && (
                            <DropdownMenuItem onClick={() => handleReactivate(p)} className="flex-col items-start gap-0.5">
                              <div className="flex items-center w-full"><UserCheck className="h-3.5 w-3.5 mr-2" /> Reativar</div>
                              <span className="text-[10px] text-muted-foreground ml-5">Volta a poder logar</span>
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuSeparator />
                          <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">Credenciais</DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={() => setSetPassUser(p)}
                            disabled={isMe || p.role === 'master'}
                            title={
                              isMe ? 'Use Configurações → Segurança → Trocar senha' :
                              p.role === 'master' ? 'Não é permitido alterar senha de outro master' : undefined
                            }
                            className="flex-col items-start gap-0.5"
                          >
                            <div className="flex items-center w-full"><Lock className="h-3.5 w-3.5 mr-2" /> Definir senha</div>
                            <span className="text-[10px] text-muted-foreground ml-5">Cria/troca senha sem enviar email</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setResetMfaUser(p)}
                            disabled={isMe || p.role === 'master'}
                            title={
                              isMe ? 'Use Configurações → Segurança pra gerenciar seu próprio 2FA' :
                              p.role === 'master' ? 'Não é permitido resetar 2FA de outro master' : undefined
                            }
                            className="flex-col items-start gap-0.5"
                          >
                            <div className="flex items-center w-full"><ShieldOff className="h-3.5 w-3.5 mr-2" /> Resetar 2FA</div>
                            <span className="text-[10px] text-muted-foreground ml-5">User perdeu celular — pede config nova no próximo login</span>
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />
                          <DropdownMenuLabel className="text-[10px] uppercase text-destructive">Zona perigosa</DropdownMenuLabel>
                          <DropdownMenuItem
                            className="text-destructive flex-col items-start gap-0.5"
                            onClick={() => setDeleteConfirm(p)}
                            disabled={isMe}
                            title={isMe ? 'Você não pode se auto-remover' : undefined}
                          >
                            <div className="flex items-center w-full"><UserX className="h-3.5 w-3.5 mr-2" /> Desativar permanente</div>
                            <span className="text-[10px] opacity-70 ml-5">Marca removido — preserva histórico, não loga mais</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive font-semibold flex-col items-start gap-0.5"
                            onClick={() => setExcluirDefinitivo(p)}
                            disabled={isMe || p.role === 'master'}
                            title={
                              isMe ? 'Você não pode se auto-excluir' :
                              p.role === 'master' ? 'Rebaixe o role antes de excluir outro master' : undefined
                            }
                          >
                            <div className="flex items-center w-full"><Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir DEFINITIVO</div>
                            <span className="text-[10px] opacity-70 ml-5">Apaga profile + auth.user. Irreversível.</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}

                  {!isMe && !canEdit && (
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1 shrink-0" disabled>
                      <Shield className="h-3.5 w-3.5" /> Editar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Invite Modal — UX-USR-CREATE (12/05/2026): 2 modos
          - "Enviar Convite" (existente, depende de SMTP/rate limit)
          - "Criar com senha agora" (novo, sem email, sem rate limit) */}
      <Dialog open={inviteModalOpen} onOpenChange={o => {
        if (!o) {
          setInviteModalOpen(false);
          setInviteModoDireto(false);
          setInviteNome('');
          setInviteSenha('');
          setInviteSenha2('');
        }
      }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <UserPlus className="h-4 w-4 text-primary" />
              {inviteModoDireto ? 'Criar usuário com senha' : 'Convidar Novo Usuário'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                placeholder="nome@empresa.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                style={{ fontSize: '16px' }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Perfil inicial</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.filter(r => r.value !== 'master').map(r => (
                    <SelectItem key={r.value} value={r.value}>
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${r.corDot}`} />
                        <span>{r.label}</span>
                        <span className="text-xs text-muted-foreground">— {r.descricao}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {inviteModoDireto && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome (opcional)</Label>
                  <Input
                    placeholder="Nome completo do usuário"
                    value={inviteNome}
                    onChange={e => setInviteNome(e.target.value)}
                    style={{ fontSize: '16px' }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Senha (mínimo 8 caracteres)</Label>
                  <Input
                    type="password"
                    value={inviteSenha}
                    onChange={e => setInviteSenha(e.target.value)}
                    style={{ fontSize: '16px' }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Confirmar senha</Label>
                  <Input
                    type="password"
                    value={inviteSenha2}
                    onChange={e => setInviteSenha2(e.target.value)}
                    style={{ fontSize: '16px' }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  ✅ Usuário criado e ATIVADO imediatamente. Não envia email — comunique a senha por canal externo (WhatsApp).
                </p>
              </>
            )}

            {!inviteModoDireto && (
              <p className="text-xs text-muted-foreground">
                Email com link de cadastro será enviado. Após criar, fica "Pendente" até você ativar.
                <br />
                <span className="text-amber-600">⚠ Depende do SMTP do Supabase (rate limit baixo).</span>
              </p>
            )}

            <button
              type="button"
              onClick={() => setInviteModoDireto(!inviteModoDireto)}
              className="text-xs text-primary hover:underline"
            >
              {inviteModoDireto ? '← Voltar para envio por email' : 'Criar com senha agora (sem email) →'}
            </button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteModalOpen(false)}>Cancelar</Button>
            {inviteModoDireto ? (
              <Button onClick={handleCriarComSenha} disabled={
                inviting ||
                !inviteEmail.trim() ||
                inviteSenha.length < 8 ||
                inviteSenha !== inviteSenha2
              }>
                {inviting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UserPlus className="h-4 w-4 mr-1" />}
                Criar e Ativar
              </Button>
            ) : (
              <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
                {inviting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Mail className="h-4 w-4 mr-1" />}
                Enviar Convite
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={editModalOpen} onOpenChange={o => { if (!o) tryCloseEditModal(); }}>
        <DialogContent
          className="sm:max-w-lg"
          style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
          onPointerDownOutside={(e) => { if (editHasChanges) e.preventDefault(); }}
          onEscapeKeyDown={(e) => { if (editHasChanges) { e.preventDefault(); tryCloseEditModal(); } }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Shield className="h-4 w-4 text-primary" />
              Editar Usuário — {editUser?.nome || editUser?.email}
              {editHasChanges && (
                <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium text-amber-500 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                  ALTERAÇÕES NÃO SALVAS
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 flex-1 min-h-0 overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase">Nome</Label>
              <Input value={editNome} onChange={e => setEditNome(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase">Email</Label>
              <Input value={editUser?.email || ''} disabled className="opacity-60" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase">Perfil</Label>
              <div className="space-y-1">
                {ROLES.map(r => (
                  <label
                    key={r.value}
                    className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer border transition-colors ${
                      editRole === r.value
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-transparent hover:bg-muted/30'
                    }`}
                    onClick={() => handleRoleChange(r.value)}
                  >
                    <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      editRole === r.value ? 'border-primary' : 'border-muted-foreground/40'
                    }`}>
                      {editRole === r.value && <div className="h-2 w-2 rounded-full bg-primary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${r.corDot}`} />
                        <span className="text-sm font-medium">{r.label}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{r.descricao}</p>
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Ao trocar o perfil, os módulos são atualizados automaticamente.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase">Módulos (ajuste fino)</Label>
              <div
                className="border rounded-lg border-border/40 overflow-y-auto"
                style={{ maxHeight: '300px' }}
              >
                <div className="p-3 space-y-4">
                  {GRUPOS_MODULOS.map(grupo => {
                    const modulosDoGrupo = MODULOS_DISPONIVEIS.filter(m => m.grupo === grupo);
                    return (
                      <div key={grupo}>
                        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 border-b border-border pb-1">
                          {grupo}
                        </h4>
                        <div className="space-y-0.5">
                          {modulosDoGrupo.map(modulo => (
                            <div key={modulo.value} className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-muted/30">
                              <Checkbox
                                checked={editModulos.has(modulo.value)}
                                onCheckedChange={(checked) => toggleModulo(modulo.value, !!checked)}
                              />
                              <span className="text-sm flex-1 min-w-0 flex items-center gap-1.5">
                                {modulo.label}
                                {isModuloCritico(modulo.value) && (
                                  <span
                                    className="text-[9px] font-semibold text-destructive bg-destructive/10 border border-destructive/30 px-1.5 py-0.5 rounded-full"
                                    title="Módulo crítico: dá acesso a dados sensíveis (financeiro/colaboradores/configurações). Marque com cuidado."
                                  >
                                    SENSÍVEL
                                  </span>
                                )}
                              </span>
                              {editModulos.has(modulo.value) && (
                                <div className="flex gap-2">
                                  {PERM_LABELS.slice(1).map((acao, idx) => (
                                    <label key={acao} className="flex flex-col items-center gap-0.5 cursor-pointer">
                                      <span className="text-[8px] text-muted-foreground">{acao}</span>
                                      <Checkbox
                                        className="h-3.5 w-3.5"
                                        checked={editPerms[modulo.value]?.[idx + 1] ?? false}
                                        onCheckedChange={(checked) => togglePerm(modulo.value, idx + 1, !!checked)}
                                      />
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* PERM (13/05/2026): preview do menu lateral que o usuário verá
              com as permissões atuais. Ajuda a master verificar antes de salvar. */}
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs space-y-1.5">
            <div className="flex items-center gap-2 font-semibold uppercase text-[10px] text-muted-foreground">
              <Eye className="h-3 w-3" />
              Preview · menu lateral do usuário
            </div>
            {editPreviewMenu.length === 0 ? (
              <p className="text-muted-foreground italic">
                Nenhum módulo marcado — usuário não verá itens no menu.
              </p>
            ) : (
              <p className="text-muted-foreground">
                {editPreviewMenu.join(' · ')}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={tryCloseEditModal}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !editHasChanges}
              className={editHasChanges ? 'bg-primary text-primary-foreground' : ''}
              title={!editHasChanges ? 'Nenhuma alteração pra salvar' : undefined}
            >
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editHasChanges ? 'Salvar alterações' : 'Sem alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivation Dialog */}
      <Dialog open={!!deactivateUser} onOpenChange={o => !o && setDeactivateUser(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Desativar {deactivateUser?.nome || deactivateUser?.email}?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              O usuário não conseguirá mais acessar o sistema. Você pode reativá-lo depois.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Motivo (opcional)</Label>
              <Textarea
                value={deactivateMotivo}
                onChange={e => setDeactivateMotivo(e.target.value)}
                placeholder="Ex: Saiu da empresa"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateUser(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeactivate}>Desativar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation (desativar permanente) */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={o => !o && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar usuário permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteConfirm?.nome || deleteConfirm?.email}</strong> será marcado como removido.
              Não conseguirá mais entrar no sistema, mas o histórico fica preservado.
              Use "Excluir DEFINITIVO" se quiser apagar de verdade.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Desativar permanente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* SEC-023 (12/05/2026): confirma reset de 2FA antes de invalidar. */}
      <AlertDialog open={!!resetMfaUser} onOpenChange={o => !o && !resetandoMfa && setResetMfaUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resetar 2FA de {resetMfaUser?.nome || resetMfaUser?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              Use isso quando o usuário <strong>perdeu o celular</strong> ou trocou de aparelho sem
              desativar o autenticador antes. Após o reset, no próximo login dele:
              <ul className="list-disc ml-5 mt-2 space-y-0.5">
                <li>Vai aparecer a tela de configuração de 2FA obrigatória.</li>
                <li>Ele precisa escanear o novo QR Code com o app autenticador.</li>
                <li>O 2FA antigo (do celular perdido) fica inútil.</li>
              </ul>
              <p className="mt-2 text-amber-500">
                ⚠️ Só faça isso se você confirmou pessoalmente que é o usuário pedindo
                (pode ser engenharia social).
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetandoMfa}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-500 text-white hover:bg-amber-500/90"
              onClick={handleResetar2FA}
              disabled={resetandoMfa}
            >
              {resetandoMfa ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldOff className="h-4 w-4 mr-2" />}
              Resetar 2FA
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* FEAT-USR-SET-PASS (12/05/2026): master define senha sem email. */}
      <Dialog
        open={!!setPassUser}
        onOpenChange={o => { if (!o) { setSetPassUser(null); setNovaSenha(''); setNovaSenha2(''); } }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" />
              Definir senha — {setPassUser?.nome || setPassUser?.email}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Define uma senha imediatamente, sem enviar email de recovery.
              Útil quando o SMTP do Supabase está em rate limit.
              Comunique a nova senha por WhatsApp privado.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Nova senha (mínimo 8 caracteres)</Label>
              <Input type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Confirmar nova senha</Label>
              <Input type="password" value={novaSenha2} onChange={e => setNovaSenha2(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSetPassUser(null); setNovaSenha(''); setNovaSenha2(''); }} disabled={definindoSenha}>Cancelar</Button>
            <Button onClick={handleDefinirSenha} disabled={definindoSenha || novaSenha.length < 8 || novaSenha !== novaSenha2}>
              {definindoSenha ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Lock className="h-4 w-4 mr-1" />}
              Definir senha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* FEAT-USR-DELETE: exclusão de fato (profile + auth.user).
          Operação irreversível — exige digitar nome/email pra confirmar. */}
      <AlertDialog
        open={!!excluirDefinitivo}
        onOpenChange={o => { if (!o) { setExcluirDefinitivo(null); setConfirmExcluirTexto(''); } }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Excluir DEFINITIVO?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Você está prestes a <strong className="text-destructive">apagar de fato</strong>{' '}
                  <strong>{excluirDefinitivo?.nome || excluirDefinitivo?.email}</strong> — o perfil e a conta
                  de autenticação somem do banco. <strong>Irreversível.</strong>
                </p>
                <p className="text-xs">
                  Pra confirmar, digite o email do usuário abaixo:{' '}
                  <code className="bg-muted px-1 py-0.5 rounded text-foreground">
                    {excluirDefinitivo?.email}
                  </code>
                </p>
                <Input
                  value={confirmExcluirTexto}
                  onChange={e => setConfirmExcluirTexto(e.target.value)}
                  placeholder="cole o email aqui"
                  autoFocus
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={
                excluindo ||
                !confirmExcluirTexto ||
                confirmExcluirTexto.trim().toLowerCase() !== (excluirDefinitivo?.email || '').toLowerCase()
              }
              onClick={handleExcluirDefinitivo}
            >
              {excluindo ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Excluir DEFINITIVO
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* MFA Enrollment */}
      <MfaEnroll
        open={mfaEnrollOpen}
        onOpenChange={setMfaEnrollOpen}
        onSuccess={() => {
          setMfaFactors(prev => ({ ...prev, [user?.id || '']: true }));
        }}
      />
    </>
  );
}
