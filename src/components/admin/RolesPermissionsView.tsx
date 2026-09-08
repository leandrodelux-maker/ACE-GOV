import React, { useState } from 'react';
import {
  Shield,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Save,
  RotateCcw,
  Sliders,
  Check,
  X,
  Users,
} from 'lucide-react';
import { UserRole } from '../../types';
import {
  PERMISSIONS_CATALOG,
  ROLES_REGISTRY,
  getCustomPermissionsForRole,
  saveCustomPermissionsForRole,
} from '../../services/rbac';
import { useAuth } from '../../contexts/AuthContext';

export const RolesPermissionsView: React.FC = () => {
  const { user } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>('FIELD_SUPERVISOR');
  const [activePermissions, setActivePermissions] = useState<string[]>(() => {
    return getCustomPermissionsForRole('FIELD_SUPERVISOR');
  });
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Módulos agrupados para a matriz
  const MODULES = [
    { key: 'dashboard', name: 'Sala de Situação & Mapas', icon: '📊' },
    { key: 'properties', name: 'Cadastro de Imóveis', icon: '🏠' },
    { key: 'visits', name: 'Visitas Domiciliares', icon: '📝' },
    { key: 'territory', name: 'Território Municipal', icon: '📍' },
    { key: 'teams', name: 'Equipes de Campo', icon: '👥' },
    { key: 'agents', name: 'Agentes (ACE)', icon: '🩺' },
    { key: 'cycles', name: 'Ciclos de Trabalho (LIRAa)', icon: '🔄' },
    { key: 'ovitraps', name: 'Ovitrampas (Entomologia)', icon: '🔬' },
    { key: 'strategic_points', name: 'Pontos Estratégicos (PE)', icon: '🎯' },
    { key: 'special_properties', name: 'Imóveis Especiais (IE)', icon: '🏢' },
    { key: 'complaints', name: 'Denúncias do Cidadão', icon: '📢' },
    { key: 'epidemiology', name: 'Epidemiologia & Bloqueios', icon: '⚠️' },
    { key: 'field_planning', name: 'Planejamento & Rotas', icon: '🗺️' },
    { key: 'reports', name: 'Relatórios Oficiais', icon: '📄' },
    { key: 'users', name: 'Usuários do Sistema', icon: '👤' },
    { key: 'roles', name: 'Perfis e Permissões (RBAC)', icon: '🔐' },
    { key: 'settings', name: 'Configurações Municipais', icon: '⚙️' },
    { key: 'audit', name: 'Auditoria & Logs', icon: '🛡️' },
  ];

  const handleSelectRole = (role: UserRole) => {
    setSelectedRole(role);
    setActivePermissions(getCustomPermissionsForRole(role));
    setSaveSuccess(false);
  };

  const handleTogglePermission = (slug: string) => {
    if (selectedRole === 'SUPER_ADMIN') return; // Super admin sempre possui tudo

    setActivePermissions((prev) =>
      prev.includes(slug) ? prev.filter((p) => p !== slug) : [...prev, slug]
    );
    setSaveSuccess(false);
  };

  const handleToggleActionForModule = (moduleKey: string, actionPattern: string) => {
    if (selectedRole === 'SUPER_ADMIN') return;

    const modulePerms = PERMISSIONS_CATALOG.filter(
      (p) => p.module === moduleKey && (p.slug.endsWith(`.${actionPattern}`) || p.action === actionPattern)
    );

    const allActive = modulePerms.every((p) => activePermissions.includes(p.slug));

    if (allActive) {
      // Desativa
      const slugsToRemove = modulePerms.map((p) => p.slug);
      setActivePermissions((prev) => prev.filter((p) => !slugsToRemove.includes(p)));
    } else {
      // Ativa
      const slugsToAdd = modulePerms.map((p) => p.slug);
      setActivePermissions((prev) => Array.from(new Set([...prev, ...slugsToAdd])));
    }
  };

  const handleSave = () => {
    saveCustomPermissionsForRole(selectedRole, activePermissions);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleResetDefault = () => {
    const defaultPerms = ROLES_REGISTRY[selectedRole]?.defaultPermissions || [];
    setActivePermissions(defaultPerms);
    saveCustomPermissionsForRole(selectedRole, defaultPerms);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const roleInfo = ROLES_REGISTRY[selectedRole] || ROLES_REGISTRY.FIELD_SUPERVISOR;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-sky-600" />
            <span>Matriz de Controle de Acesso e Permissões (RBAC)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configuração granular de segurança: Visualizar, Criar, Editar, Excluir e Exportar por módulo
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetDefault}
            className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition flex items-center gap-1.5 cursor-pointer"
            title="Restaurar permissões oficiais recomendadas pelo SUS"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Padrão SUS</span>
          </button>

          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 transition shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Salvar Permissões</span>
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Matriz de permissões para o perfil <strong>{roleInfo.name}</strong> atualizada com sucesso no banco de dados!</span>
        </div>
      )}

      {/* Seletor dos 8 Perfis Centrais */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
          Selecione o Perfil para Configurar:
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Object.values(ROLES_REGISTRY).map((role) => {
            const isSelected = selectedRole === role.slug;
            return (
              <button
                key={role.slug}
                onClick={() => handleSelectRole(role.slug)}
                className={`p-3 rounded-xl text-left border transition cursor-pointer ${
                  isSelected
                    ? 'bg-sky-50 border-sky-400 ring-2 ring-sky-500/20 shadow-xs'
                    : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/80'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${role.badgeColor}`}>
                    {role.slug}
                  </span>
                  {isSelected && <Check className="w-4 h-4 text-sky-600" />}
                </div>
                <p className="text-xs font-bold text-slate-800 leading-tight">{role.name}</p>
                <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{role.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Matriz Interativa: Perfil | Visualizar | Criar | Editar | Excluir | Exportar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-sky-600" />
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Matriz Operacional: {roleInfo.name}
            </h2>
          </div>
          <span className="text-xs font-medium text-slate-500">
            {activePermissions.length} de {PERMISSIONS_CATALOG.length} permissões ativas
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 text-slate-600 border-b border-slate-200 font-semibold uppercase text-[10px] tracking-wider">
                <th className="p-3.5 pl-5">Módulo / Recurso</th>
                <th className="p-3.5 text-center">Visualizar</th>
                <th className="p-3.5 text-center">Criar</th>
                <th className="p-3.5 text-center">Editar</th>
                <th className="p-3.5 text-center">Excluir</th>
                <th className="p-3.5 text-center">Exportar / Gerenciar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {MODULES.map((mod) => {
                // Encontrar permissões deste módulo
                const viewPerm = PERMISSIONS_CATALOG.find((p) => p.module === mod.key && p.action === 'view');
                const createPerm = PERMISSIONS_CATALOG.find((p) => p.module === mod.key && p.action === 'create');
                const updatePerm = PERMISSIONS_CATALOG.find((p) => p.module === mod.key && p.action === 'update');
                const deletePerm = PERMISSIONS_CATALOG.find((p) => p.module === mod.key && (p.action === 'delete' || p.action === 'disable'));
                const manageOrExportPerm = PERMISSIONS_CATALOG.find(
                  (p) => p.module === mod.key && (p.action === 'manage' || p.action === 'export' || p.action === 'use')
                );

                const isChecked = (slug?: string) => slug ? activePermissions.includes(slug) : false;

                return (
                  <tr key={mod.key} className="hover:bg-slate-50/60 transition">
                    <td className="p-3.5 pl-5">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{mod.icon}</span>
                        <div>
                          <p className="font-bold text-slate-800">{mod.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{mod.key}.*</p>
                        </div>
                      </div>
                    </td>

                    {/* Visualizar */}
                    <td className="p-3.5 text-center">
                      {viewPerm ? (
                        <button
                          type="button"
                          onClick={() => handleTogglePermission(viewPerm.slug)}
                          className={`w-6 h-6 rounded-lg inline-flex items-center justify-center transition cursor-pointer ${
                            isChecked(viewPerm.slug)
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                          title={`Alternar ${viewPerm.slug}`}
                        >
                          {isChecked(viewPerm.slug) ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                        </button>
                      ) : (
                        <span className="text-slate-300 font-mono">—</span>
                      )}
                    </td>

                    {/* Criar */}
                    <td className="p-3.5 text-center">
                      {createPerm ? (
                        <button
                          type="button"
                          onClick={() => handleTogglePermission(createPerm.slug)}
                          className={`w-6 h-6 rounded-lg inline-flex items-center justify-center transition cursor-pointer ${
                            isChecked(createPerm.slug)
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                          title={`Alternar ${createPerm.slug}`}
                        >
                          {isChecked(createPerm.slug) ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                        </button>
                      ) : (
                        <span className="text-slate-300 font-mono">—</span>
                      )}
                    </td>

                    {/* Editar */}
                    <td className="p-3.5 text-center">
                      {updatePerm ? (
                        <button
                          type="button"
                          onClick={() => handleTogglePermission(updatePerm.slug)}
                          className={`w-6 h-6 rounded-lg inline-flex items-center justify-center transition cursor-pointer ${
                            isChecked(updatePerm.slug)
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                          title={`Alternar ${updatePerm.slug}`}
                        >
                          {isChecked(updatePerm.slug) ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                        </button>
                      ) : (
                        <span className="text-slate-300 font-mono">—</span>
                      )}
                    </td>

                    {/* Excluir / Desativar */}
                    <td className="p-3.5 text-center">
                      {deletePerm ? (
                        <button
                          type="button"
                          onClick={() => handleTogglePermission(deletePerm.slug)}
                          className={`w-6 h-6 rounded-lg inline-flex items-center justify-center transition cursor-pointer ${
                            isChecked(deletePerm.slug)
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                          title={`Alternar ${deletePerm.slug}`}
                        >
                          {isChecked(deletePerm.slug) ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                        </button>
                      ) : (
                        <span className="text-slate-300 font-mono">—</span>
                      )}
                    </td>

                    {/* Exportar / Gerenciar */}
                    <td className="p-3.5 text-center">
                      {manageOrExportPerm ? (
                        <button
                          type="button"
                          onClick={() => handleTogglePermission(manageOrExportPerm.slug)}
                          className={`w-6 h-6 rounded-lg inline-flex items-center justify-center transition cursor-pointer ${
                            isChecked(manageOrExportPerm.slug)
                              ? 'bg-purple-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                          title={`Alternar ${manageOrExportPerm.slug}`}
                        >
                          {isChecked(manageOrExportPerm.slug) ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                        </button>
                      ) : (
                        <span className="text-slate-300 font-mono">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
