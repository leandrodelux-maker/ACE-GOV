import React, { useState } from 'react';
import {
  Users,
  Search,
  Plus,
  Edit2,
  Key,
  ShieldCheck,
  UserCheck,
  UserX,
  AlertTriangle,
  X,
  CheckCircle2,
  Mail,
  Building,
  Filter,
} from 'lucide-react';
import { db } from '../../services/storage';
import { User, UserRole } from '../../types';
import { ROLES_REGISTRY } from '../../services/rbac';
import { useAuth } from '../../contexts/AuthContext';

export const UsersManagementView: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>(db.getUsers());
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modais
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Form State Novo/Edição
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    registrationNumber: '',
    cpf: '',
    role: 'ACE' as UserRole,
    teamId: 'equipe-01',
    phone: '',
  });

  const teams = db.getTeams();

  const handleOpenNewUser = () => {
    setFormData({
      name: '',
      email: '',
      registrationNumber: `MAT-${Math.floor(1000 + Math.random() * 9000)}`,
      cpf: '',
      role: 'ACE',
      teamId: teams[0]?.id || 'equipe-01',
      phone: '',
    });
    setEditingUser(null);
    setIsNewUserModalOpen(true);
  };

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      registrationNumber: user.registrationNumber,
      cpf: user.cpf,
      role: user.role,
      teamId: user.teamId || teams[0]?.id || 'equipe-01',
      phone: user.phone || '',
    });
    setIsNewUserModalOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingUser) {
      // Atualização
      const updates = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        teamId: formData.teamId,
        registrationNumber: formData.registrationNumber,
        phone: formData.phone,
      };

      db.updateUser(editingUser.id, updates);
      db.addAuditLog(
        'EDICAO',
        'Gestão de Usuários',
        `Atualizado cadastro de ${editingUser.name} (${editingUser.email})`,
        JSON.stringify(editingUser),
        JSON.stringify({ ...editingUser, ...updates })
      );

      setUsers(db.getUsers());
      setFeedbackMessage(`Servidor ${formData.name} atualizado com sucesso.`);
    } else {
      // Criação
      const newUser = db.addUser({
        name: formData.name,
        email: formData.email,
        cpf: formData.cpf || '000.000.000-00',
        registrationNumber: formData.registrationNumber,
        role: formData.role,
        municipalityId: currentUser?.municipalityId || '00000000-0000-0000-0000-000000000001',
        teamId: formData.teamId,
        phone: formData.phone,
        active: true,
      });

      db.addAuditLog(
        'CADASTRO',
        'Gestão de Usuários',
        `Criado novo usuário ${newUser.name} com papel ${newUser.role}`
      );

      setUsers(db.getUsers());
      setFeedbackMessage(`Novo servidor ${newUser.name} habilitado no sistema.`);
    }

    setIsNewUserModalOpen(false);
    setTimeout(() => setFeedbackMessage(null), 3000);
  };

  const handleToggleActive = (userToToggle: User) => {
    const newActiveState = !userToToggle.active;
    db.updateUser(userToToggle.id, { active: newActiveState });

    db.addAuditLog(
      newActiveState ? 'EDICAO' : 'EXCLUSAO',
      'Gestão de Usuários',
      `Conta de ${userToToggle.name} ${newActiveState ? 'REATIVADA' : 'DESATIVADA'} pelo administrador`,
      JSON.stringify({ active: userToToggle.active }),
      JSON.stringify({ active: newActiveState })
    );

    setUsers(db.getUsers());
    setFeedbackMessage(
      `Usuário ${userToToggle.name} ${newActiveState ? 'ativado' : 'desativado'} com preservação de histórico.`
    );
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  const handleConfirmResetPassword = (userToReset: User) => {
    db.addAuditLog(
      'EDICAO',
      'Segurança e Acesso',
      `Redefinição de senha solicitada para ${userToReset.name} (${userToReset.email})`
    );

    setResetPasswordUser(null);
    setFeedbackMessage(`Instruções de redefinição de senha enviadas para ${userToReset.email}.`);
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  // Filtragem
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.registrationNumber.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && u.active) ||
      (statusFilter === 'INACTIVE' && !u.active);

    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <span>Gestão de Usuários e Operadores Municipais</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cadastro de servidores SUS, atribuição de perfis RBAC e equipes de trabalho
          </p>
        </div>

        <button
          onClick={handleOpenNewUser}
          className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition shadow-sm flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Usuário</span>
        </button>
      </div>

      {feedbackMessage && (
        <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 flex-1 min-w-[260px] text-xs">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome, e-mail ou matrícula funcional..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent outline-none text-slate-800 placeholder-slate-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
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
            className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 font-medium text-slate-700 outline-none cursor-pointer"
          >
            <option value="ALL">Todos os Status</option>
            <option value="ACTIVE">Somente Ativos</option>
            <option value="INACTIVE">Somente Desativados</option>
          </select>
        </div>
      </div>

      {/* Tabela de Usuários */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold uppercase text-[10px] tracking-wider">
                <th className="p-3.5 pl-5">Nome / Matrícula</th>
                <th className="p-3.5">E-mail</th>
                <th className="p-3.5">Perfil RBAC</th>
                <th className="p-3.5">Equipe</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5">Último Acesso</th>
                <th className="p-3.5 text-right pr-5">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    Nenhum usuário localizado com os critérios selecionados.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const roleDef = ROLES_REGISTRY[u.role] || ROLES_REGISTRY.ACE;
                  const teamName = teams.find((t) => t.id === u.teamId)?.name || 'Sem Equipe';

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-3.5 pl-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0 border border-slate-200">
                            {u.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 leading-tight">{u.name}</p>
                            <p className="text-[11px] text-slate-400 font-mono">{u.registrationNumber}</p>
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5">
                        <span className="text-slate-600 font-mono text-[11px]">{u.email}</span>
                      </td>

                      <td className="p-3.5">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${roleDef.badgeColor}`}>
                          {roleDef.name}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <span className="font-medium text-slate-800">{teamName}</span>
                      </td>

                      <td className="p-3.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.active
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {u.active ? 'Ativo' : 'Desativado'}
                        </span>
                      </td>

                      <td className="p-3.5 text-slate-500 text-[11px]">
                        {u.lastLogin ? new Date(u.lastLogin).toLocaleString('pt-BR') : 'Aguardando login'}
                      </td>

                      <td className="p-3.5 text-right pr-5">
                        <div className="flex items-center justify-end gap-1">
                          {/* Editar */}
                          <button
                            onClick={() => handleOpenEdit(u)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition"
                            title="Editar usuário e perfil"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Redefinir Senha */}
                          <button
                            onClick={() => setResetPasswordUser(u)}
                            className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-500 hover:text-amber-700 transition"
                            title="Redefinir senha de acesso"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>

                          {/* Ativar / Desativar (sem exclusão física) */}
                          <button
                            onClick={() => handleToggleActive(u)}
                            className={`p-1.5 rounded-lg transition ${
                              u.active
                                ? 'hover:bg-rose-50 text-slate-400 hover:text-rose-600'
                                : 'hover:bg-emerald-50 text-slate-400 hover:text-emerald-600'
                            }`}
                            title={u.active ? 'Desativar usuário' : 'Reativar usuário'}
                          >
                            {u.active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Criação / Edição de Usuário */}
      {isNewUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                <span>{editingUser ? 'Editar Usuário do Sistema' : 'Cadastrar Novo Operador SUS'}</span>
              </h3>
              <button
                onClick={() => setIsNewUserModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Carlos Eduardo dos Santos"
                  className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">E-mail Institucional</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="carlos.ace@municipio.gov.br"
                    className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Matrícula Funcional</label>
                  <input
                    type="text"
                    required
                    value={formData.registrationNumber}
                    onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Perfil RBAC</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-medium"
                  >
                    {Object.values(ROLES_REGISTRY).map((r) => (
                      <option key={r.slug} value={r.slug}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Equipe Operacional</label>
                  <select
                    value={formData.teamId}
                    onChange={(e) => setFormData({ ...formData, teamId: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-medium"
                  >
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  O cadastro habilitará o acesso deste servidor ao sistema municipal. Por questões de auditoria do Ministério da Saúde, o registro nunca será apagado definitivamente.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewUserModalOpen(false)}
                  className="px-4 py-2 rounded-xl font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-sm"
                >
                  {editingUser ? 'Salvar Alterações' : 'Cadastrar Servidor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Redefinição de Senha */}
      {resetPasswordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-slate-900">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-600" />
              <span>Redefinir Senha do Usuário</span>
            </h3>
            <p className="text-xs text-slate-600 mt-2">
              Deseja gerar um link oficial de redefinição de acesso para <strong>{resetPasswordUser.name}</strong> ({resetPasswordUser.email})?
            </p>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                onClick={() => setResetPasswordUser(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleConfirmResetPassword(resetPasswordUser)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 shadow-sm"
              >
                Confirmar e Notificar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
