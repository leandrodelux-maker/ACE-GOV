import React, { useCallback, useEffect, useState } from 'react';
import {
  Users,
  Search,
  Plus,
  Edit2,
  Key,
  UserCheck,
  UserX,
  AlertTriangle,
  X,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { UserRole } from '../../types';
import { ROLES_REGISTRY } from '../../services/rbac';
import { useAuth, useMunicipalityId } from '../../contexts/AuthContext';
import { userAdminService, ManagedUser, RESTRICTED_ROLES } from '../../services/userAdminService';
import { auditLogService } from '../../services/auditLogService';
import { PageHeader } from '../ui';

type Feedback = { kind: 'success' | 'error'; text: string } | null;

const EMPTY_FORM = {
  name: '',
  email: '',
  registrationNumber: '',
  jobTitle: '',
  phone: '',
  role: 'ACE' as UserRole,
};

export const UsersManagementView: React.FC = () => {
  const { user: currentUser, can, hasRole } = useAuth();
  const municipalityId = useMunicipalityId();
  const canCreate = can('users.create');
  const canUpdate = can('users.update');
  const canManageAgents = can('agents.manage');
  const isSuperAdmin = hasRole('SUPER_ADMIN');

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<ManagedUser | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  // Espelha a política user_roles_write (migration 31): SUPER_ADMIN só pela plataforma;
  // MUNICIPAL_ADMIN só por outro administrador municipal; nunca o próprio perfil.
  const isMunicipalAdmin = hasRole('MUNICIPAL_ADMIN');
  const canGrant = (slug: UserRole) => isSuperAdmin || (!RESTRICTED_ROLES.includes(slug) && (slug !== 'MUNICIPAL_ADMIN' || isMunicipalAdmin));
  const assignableRoles = Object.values(ROLES_REGISTRY).filter((r) => canGrant(r.slug));
  const editingSelf = !!editingUser && editingUser.id === currentUser?.id;

  const showFeedback = (f: Feedback) => {
    setFeedback(f);
    if (f) setTimeout(() => setFeedback(null), 5000);
  };

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    const { users: list, error } = await userAdminService.list(municipalityId);
    setUsers(list);
    setLoadError(error ? 'Não foi possível carregar os usuários do município.' : null);
    setIsLoading(false);
  }, [municipalityId]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const audit = (action: string, entityId: string, oldData?: unknown, newData?: unknown) =>
    auditLogService.log({
      municipalityId,
      userId: currentUser?.id,
      action,
      module: 'Gestão de Usuários',
      entity: 'profiles',
      entityId,
      oldData,
      newData,
    });

  const handleOpenNewUser = () => {
    setFormData(EMPTY_FORM);
    setEditingUser(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (u: ManagedUser) => {
    setEditingUser(u);
    setFormData({
      name: u.name,
      email: u.email,
      registrationNumber: u.registrationNumber,
      jobTitle: u.jobTitle,
      phone: u.phone,
      role: u.roles[0] || 'ACE',
    });
    setIsFormOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canGrant(formData.role)) {
      showFeedback({ kind: 'error', text: 'Seu perfil não pode atribuir esse perfil de acesso.' });
      return;
    }
    if (editingSelf && editingUser && editingUser.roles[0] !== formData.role) {
      showFeedback({ kind: 'error', text: 'Você não pode alterar o próprio perfil de acesso; peça a outro administrador.' });
      return;
    }
    setIsSaving(true);
    try {
      if (editingUser) {
        await userAdminService.updateProfile(municipalityId, editingUser.id, formData);
        if (editingUser.roles[0] !== formData.role) {
          await userAdminService.setRole(municipalityId, editingUser.id, formData.role);
        }
        await audit('EDICAO', editingUser.id, editingUser, formData);
        showFeedback({ kind: 'success', text: `Cadastro de ${formData.name} atualizado.` });
      } else {
        const created = await userAdminService.createProfile(municipalityId, formData, formData.role);
        await audit('CADASTRO', created.id, null, formData);
        showFeedback({
          kind: 'success',
          text: `Perfil de ${created.name} cadastrado. O acesso (login) é criado pelo provisionamento de contas ou convite do administrador da plataforma.`,
        });
      }
      setIsFormOpen(false);
      await loadUsers();
    } catch (err: any) {
      showFeedback({ kind: 'error', text: `Não foi possível salvar: ${err?.message || 'erro desconhecido'}.` });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (u: ManagedUser) => {
    if (u.id === currentUser?.id) {
      showFeedback({ kind: 'error', text: 'Você não pode desativar o próprio usuário.' });
      return;
    }
    try {
      await userAdminService.setActive(municipalityId, u.id, !u.active);
      await audit(u.active ? 'DESATIVACAO' : 'REATIVACAO', u.id, { active: u.active }, { active: !u.active });
      showFeedback({ kind: 'success', text: `Usuário ${u.name} ${u.active ? 'desativado' : 'reativado'} (histórico preservado).` });
      await loadUsers();
    } catch (err: any) {
      showFeedback({ kind: 'error', text: `Não foi possível alterar o status: ${err?.message || 'erro desconhecido'}.` });
    }
  };

  const handleLinkAgent = async (u: ManagedUser) => {
    try {
      const agentId = await userAdminService.linkAgent(municipalityId, u.id, u.registrationNumber);
      await audit('VINCULO_AGENTE', u.id, null, { agent_id: agentId });
      showFeedback({ kind: 'success', text: `${u.name} vinculado como agente de campo. As visitas do PWA passam a ser registradas em seu nome.` });
      await loadUsers();
    } catch (err: any) {
      showFeedback({ kind: 'error', text: `Não foi possível vincular o agente: ${err?.message || 'erro desconhecido'}.` });
    }
  };

  const handleConfirmResetPassword = async (u: ManagedUser) => {
    setResetPasswordUser(null);
    const res = await userAdminService.sendPasswordReset(u.email);
    if (res.success) {
      await audit('REDEFINICAO_SENHA', u.id);
      showFeedback({ kind: 'success', text: `E-mail de redefinição de senha solicitado para ${u.email}.` });
    } else {
      showFeedback({ kind: 'error', text: res.message || 'Não foi possível solicitar a redefinição de senha.' });
    }
  };

  const term = searchTerm.toLowerCase();
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      u.registrationNumber.toLowerCase().includes(term);
    const matchesRole = roleFilter === 'ALL' || u.roles.includes(roleFilter as UserRole);
    const matchesStatus =
      statusFilter === 'ALL' || (statusFilter === 'ACTIVE' && u.active) || (statusFilter === 'INACTIVE' && !u.active);
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Users}
        title="Gestão de Usuários e Operadores Municipais"
        subtitle="Perfis de servidores do município e atribuição de perfis de acesso (RBAC)"
        actions={
          <>
            <button
              onClick={loadUsers}
              disabled={isLoading}
              className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition"
              title="Atualizar lista"
              aria-label="Atualizar lista de usuários"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            {canCreate && (
              <button
                onClick={handleOpenNewUser}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition shadow-sm flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Usuário</span>
              </button>
            )}
          </>
        }
      />

      {feedback && (
        <div
          role={feedback.kind === 'error' ? 'alert' : 'status'}
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
            feedback.kind === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-indigo-50 border-indigo-200 text-indigo-800'
          }`}
        >
          {feedback.kind === 'error' ? (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 flex-1 min-w-[220px] text-xs">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome, e-mail ou matrícula..."
            aria-label="Buscar usuários"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent outline-none text-slate-800 placeholder-slate-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            aria-label="Filtrar por perfil"
            className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 font-medium text-slate-700 outline-none cursor-pointer"
          >
            <option value="ALL">Todos os Perfis</option>
            {Object.values(ROLES_REGISTRY).map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filtrar por status"
            className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 font-medium text-slate-700 outline-none cursor-pointer"
          >
            <option value="ALL">Todos os Status</option>
            <option value="ACTIVE">Somente Ativos</option>
            <option value="INACTIVE">Somente Desativados</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold uppercase text-[10px] tracking-wider">
                <th className="p-3.5 pl-5">Nome / Matrícula</th>
                <th className="p-3.5">E-mail</th>
                <th className="p-3.5">Perfil</th>
                <th className="p-3.5 text-center">Login</th>
                <th className="p-3.5 text-center">Agente de campo</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5">Último Acesso</th>
                <th className="p-3.5 text-right pr-5">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400" role="status">
                    Carregando usuários do município...
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-rose-600" role="alert">
                    {loadError}
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    {users.length === 0 ? 'Sem usuários registrados para o município.' : 'Nenhum usuário corresponde aos filtros.'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const roleDef = u.roles[0] ? ROLES_REGISTRY[u.roles[0]] : undefined;
                  const protectedRow = !isSuperAdmin && u.roles.some((r) => !canGrant(r));
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-3.5 pl-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0 border border-slate-200">
                            {u.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 leading-tight">{u.name}</p>
                            <p className="text-[11px] text-slate-400 font-mono">{u.registrationNumber || 'Sem matrícula'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className="text-slate-600 font-mono text-[11px]">{u.email}</span>
                      </td>
                      <td className="p-3.5">
                        {roleDef ? (
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${roleDef.badgeColor}`}>{roleDef.name}</span>
                        ) : (
                          <span className="text-[11px] text-amber-700">Sem perfil atribuído</span>
                        )}
                      </td>
                      <td className="p-3.5 text-center text-[11px]">
                        {u.authUserId ? (
                          <span className="text-emerald-700 font-semibold">Vinculado</span>
                        ) : (
                          <span className="text-amber-700" title="Perfil ainda sem conta de acesso — aguarda provisionamento">
                            Pendente
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-center text-[11px]">
                        {u.agentId ? (
                          <span className="text-emerald-700 font-semibold">Vinculado</span>
                        ) : canManageAgents && u.active ? (
                          <button
                            onClick={() => handleLinkAgent(u)}
                            className="px-2 py-0.5 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-semibold"
                            title="Criar o cadastro de agente (necessário para registrar visitas e ovitrampas no PWA)"
                          >
                            Vincular
                          </button>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {u.active ? 'Ativo' : 'Desativado'}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-500 text-[11px]">
                        {u.lastLogin ? new Date(u.lastLogin).toLocaleString('pt-BR') : 'Sem acesso registrado'}
                      </td>
                      <td className="p-3.5 text-right pr-5">
                        {canUpdate && !protectedRow && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenEdit(u)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition"
                              title="Editar usuário e perfil"
                              aria-label={`Editar ${u.name}`}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {u.authUserId && (
                              <button
                                onClick={() => setResetPasswordUser(u)}
                                className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-500 hover:text-amber-700 transition"
                                title="Enviar e-mail de redefinição de senha"
                                aria-label={`Redefinir senha de ${u.name}`}
                              >
                                <Key className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => handleToggleActive(u)}
                              className={`p-1.5 rounded-lg transition ${
                                u.active
                                  ? 'hover:bg-rose-50 text-slate-400 hover:text-rose-600'
                                  : 'hover:bg-emerald-50 text-slate-400 hover:text-emerald-600'
                              }`}
                              title={u.active ? 'Desativar usuário' : 'Reativar usuário'}
                              aria-label={u.active ? `Desativar ${u.name}` : `Reativar ${u.name}`}
                            >
                              {u.active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs" role="dialog" aria-modal="true" aria-labelledby="user-form-title">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 id="user-form-title" className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                <span>{editingUser ? 'Editar Usuário' : 'Cadastrar Perfil de Servidor'}</span>
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600" aria-label="Fechar">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="mt-4 space-y-3 text-xs">
              <div>
                <label htmlFor="uf-name" className="block font-semibold text-slate-700 mb-1">Nome Completo</label>
                <input
                  id="uf-name"
                  type="text"
                  required
                  minLength={3}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="uf-email" className="block font-semibold text-slate-700 mb-1">E-mail Institucional</label>
                  <input
                    id="uf-email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label htmlFor="uf-reg" className="block font-semibold text-slate-700 mb-1">Matrícula Funcional</label>
                  <input
                    id="uf-reg"
                    type="text"
                    value={formData.registrationNumber}
                    onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="uf-role" className="block font-semibold text-slate-700 mb-1">Perfil de Acesso</label>
                  <select
                    id="uf-role"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                    disabled={editingSelf}
                    title={editingSelf ? 'O próprio perfil de acesso só pode ser alterado por outro administrador.' : undefined}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-medium"
                  >
                    {assignableRoles.map((r) => (
                      <option key={r.slug} value={r.slug}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="uf-phone" className="block font-semibold text-slate-700 mb-1">Telefone</label>
                  <input
                    id="uf-phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="uf-job" className="block font-semibold text-slate-700 mb-1">Cargo / Função</label>
                <input
                  id="uf-job"
                  type="text"
                  value={formData.jobTitle}
                  onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-500"
                />
              </div>

              {!editingUser && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Este cadastro cria o perfil do servidor no município. A conta de login é criada pelo provisionamento de contas
                    (convite por e-mail) feito pelo administrador da plataforma. Registros não são apagados, apenas desativados.
                  </span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 rounded-xl font-medium text-slate-600 hover:bg-slate-100">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-sm disabled:opacity-60"
                >
                  {isSaving ? 'Salvando...' : editingUser ? 'Salvar Alterações' : 'Cadastrar Perfil'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {resetPasswordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs" role="dialog" aria-modal="true" aria-labelledby="reset-title">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-slate-900">
            <h3 id="reset-title" className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-600" />
              <span>Redefinir Senha do Usuário</span>
            </h3>
            <p className="text-xs text-slate-600 mt-2">
              Enviar o e-mail de redefinição de senha para <strong>{resetPasswordUser.name}</strong> ({resetPasswordUser.email})?
            </p>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button onClick={() => setResetPasswordUser(null)} className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100">
                Cancelar
              </button>
              <button
                onClick={() => handleConfirmResetPassword(resetPasswordUser)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 shadow-sm"
              >
                Enviar e-mail
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
