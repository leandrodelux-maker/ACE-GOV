import React, { useState, useEffect, useCallback } from 'react';
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
  fetchRolePermissions,
  saveRolePermissions,
} from '../../services/rbac';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader } from '../ui';

const PROTECTED_ROLES: UserRole[] = ['SUPER_ADMIN', 'MUNICIPAL_ADMIN'];

export const RolesPermissionsView: React.FC = () => {
  const { user, realRole } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>('FIELD_SUPERVISOR');
  const [activePermissions, setActivePermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isProtected = PROTECTED_ROLES.includes(selectedRole);
  // A matriz é global (vale para todos os municípios): só a plataforma altera (migration 31).
  const canEditMatrix = realRole === 'SUPER_ADMIN';
  const readOnly = isProtected || !canEditMatrix;

  // Módulos agrupados para a matriz (slugs canônicos em PT)
  const MODULES = [
    { key: 'painel', name: 'Sala de Situação', icon: '📊' },
    { key: 'mapas', name: 'Mapas', icon: '🗺️' },
    { key: 'imoveis', name: 'Cadastro de Imóveis', icon: '🏠' },
    { key: 'visitas', name: 'Visitas Domiciliares', icon: '📝' },
    { key: 'territorio', name: 'Território Municipal', icon: '📍' },
    { key: 'equipes', name: 'Equipes de Campo', icon: '👥' },
    { key: 'agentes', name: 'Agentes (ACE)', icon: '🩺' },
    { key: 'ciclos', name: 'Ciclos de Trabalho (LIRAa)', icon: '🔄' },
    { key: 'focos', name: 'Focos e Surtos', icon: '🔥' },
    { key: 'ovitrampas', name: 'Ovitrampas (Entomologia)', icon: '🔬' },
    { key: 'pontos_estrategicos', name: 'Pontos Estratégicos (PE)', icon: '🎯' },
    { key: 'imoveis_especiais', name: 'Imóveis Especiais (IE)', icon: '🏢' },
    { key: 'denuncias', name: 'Denúncias do Cidadão', icon: '📢' },
    { key: 'epidemiologia', name: 'Epidemiologia & Bloqueios', icon: '⚠️' },
    { key: 'planejamento', name: 'Planejamento & Rotas', icon: '🧭' },
    { key: 'relatorios', name: 'Relatórios Oficiais', icon: '📄' },
    { key: 'motor_risco', name: 'Motor de Risco', icon: '📈' },
    { key: 'usuarios', name: 'Usuários do Sistema', icon: '👤' },
    { key: 'perfis', name: 'Perfis e Permissões (RBAC)', icon: '🔐' },
    { key: 'configuracoes', name: 'Configurações Municipais', icon: '⚙️' },
    { key: 'auditoria', name: 'Auditoria & Logs', icon: '🛡️' },
  ];

  const loadRole = useCallback(async (role: UserRole) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const perms = await fetchRolePermissions(role);
      setActivePermissions(perms);
    } catch {
      setActivePermissions(ROLES_REGISTRY[role]?.defaultPermissions || []);
      setErrorMsg('Não foi possível carregar as permissões do banco; exibindo o padrão do perfil.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRole(selectedRole);
  }, [selectedRole, loadRole]);

  const handleSelectRole = (role: UserRole) => {
    setSelectedRole(role);
    setSaveSuccess(false);
  };

  const handleTogglePermission = (slug: string) => {
    if (readOnly) return; // papéis de plataforma têm tudo; matriz global só pela plataforma

    setActivePermissions((prev) =>
      prev.includes(slug) ? prev.filter((p) => p !== slug) : [...prev, slug]
    );
    setSaveSuccess(false);
  };

  const handleToggleActionForModule = (moduleKey: string, actionPattern: string) => {
    if (readOnly) return;

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

  const persist = async (perms: string[]) => {
    setSaving(true);
    setErrorMsg(null);
    try {
      await saveRolePermissions(selectedRole, perms);
      setActivePermissions(perms);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      setErrorMsg(e?.message?.includes('forbidden')
        ? 'A matriz de permissões é global e só pode ser alterada pelo administrador da plataforma.'
        : 'Falha ao salvar as permissões no banco. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (readOnly) return;
    persist(activePermissions);
  };

  const handleResetDefault = () => {
    if (readOnly) return;
    persist(ROLES_REGISTRY[selectedRole]?.defaultPermissions || []);
  };

  const roleInfo = ROLES_REGISTRY[selectedRole] || ROLES_REGISTRY.FIELD_SUPERVISOR;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <PageHeader
        icon={KeyRound}
        title="Matriz de Controle de Acesso e Permissões (RBAC)"
        subtitle="Configuração granular de segurança: Visualizar, Criar, Editar, Excluir e Exportar por módulo"
        actions={
          <>
            <button
              onClick={handleResetDefault}
              disabled={readOnly || saving || loading}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Restaurar permissões oficiais recomendadas pelo SUS"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Padrão SUS</span>
            </button>

            <button
              onClick={handleSave}
              disabled={readOnly || saving || loading}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 transition shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Salvando...' : 'Salvar Permissões'}</span>
            </button>
          </>
        }
      />

      {isProtected && (
        <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 text-xs flex items-center gap-2">
          <Shield className="w-4 h-4 text-slate-500 shrink-0" />
          <span>Perfis de plataforma (<strong>SUPER_ADMIN</strong> / <strong>MUNICIPAL_ADMIN</strong>) têm acesso total e não podem ser editados aqui.</span>
        </div>
      )}

      {!isProtected && !canEditMatrix && (
        <div role="note" className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
          <Shield className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Somente leitura: a matriz de permissões vale para <strong>todos os municípios</strong> e só pode ser alterada pelo administrador da plataforma (SUPER_ADMIN). Para mudar o acesso de uma pessoa, altere o perfil dela em Usuários.</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

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
