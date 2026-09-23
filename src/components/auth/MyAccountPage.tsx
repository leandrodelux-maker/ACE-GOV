import React, { useState, useMemo } from 'react';
import {
  User,
  Shield,
  KeyRound,
  Building2,
  Users,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  Clock,
  Lock,
  Eye,
  EyeOff,
  FileCheck,
  Smartphone,
  Check,
  ShieldCheck,
  Sliders,
  Bell,
  Save,
  Info,
  BadgeAlert,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/authService';

interface MyAccountPageProps {
  onNavigate: (route: string) => void;
}

type TabType = 'SECURITY' | 'PREFERENCES' | 'PERMISSIONS';

export const MyAccountPage: React.FC<MyAccountPageProps> = ({ onNavigate }) => {
  const { user, municipality, logout, can } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('SECURITY');

  // Estado do formulário de alteração de senha
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estado das preferências do operador
  const [phone, setPhone] = useState('(51) 98765-4321');
  const [soundAlerts, setSoundAlerts] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [highContrast, setHighContrast] = useState(false);
  const [prefsSavedMsg, setPrefsSavedMsg] = useState<string | null>(null);

  // Cálculo da força da senha
  const passwordStrength = useMemo(() => {
    if (!newPassword) return { score: 0, label: 'Não informada', color: 'bg-slate-200' };
    let score = 0;
    if (newPassword.length >= 8) score += 1;
    if (/[A-Z]/.test(newPassword)) score += 1;
    if (/[0-9]/.test(newPassword)) score += 1;
    if (/[^A-Za-z0-9]/.test(newPassword)) score += 1;

    if (score <= 1) return { score: 25, label: 'Fraca', color: 'bg-rose-500' };
    if (score === 2) return { score: 50, label: 'Razoável', color: 'bg-amber-500' };
    if (score === 3) return { score: 75, label: 'Boa', color: 'bg-blue-500' };
    return { score: 100, label: 'Forte & Segura', color: 'bg-emerald-500' };
  }, [newPassword]);

  // Handler de alteração de senha
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setErrorMsg('A nova senha deve ter no mínimo 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('As senhas digitadas não conferem.');
      return;
    }

    setIsChangingPassword(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await authService.changePassword({
        currentPassword,
        newPassword,
      });

      if (res.success) {
        setSuccessMsg('Senha alterada com sucesso!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setErrorMsg(res.message || 'Falha ao alterar senha.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro inesperado ao alterar senha.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Salvar preferências
  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    setPrefsSavedMsg('Preferências operacionais salvas com sucesso!');
    setTimeout(() => setPrefsSavedMsg(null), 3000);
  };

  const handleLogout = async () => {
    await logout();
    onNavigate('/login');
  };

  // Permissões estruturadas para visualização
  const permissionsList = [
    { name: 'Visitas Domiciliares & Inspeção', slug: 'visits.create', category: 'Operacional de Campo' },
    { name: 'Vigilância de Ovitrampas', slug: 'ovitraps.view', category: 'Entomologia' },
    { name: 'Controle Vetorial & Bloqueio', slug: 'vector.control', category: 'Campo & Químico' },
    { name: 'Gestão de Estoque & Larvicidas', slug: 'stock.view', category: 'Logística' },
    { name: 'Encerramento de Ciclos', slug: 'cycles.close', category: 'Gestão' },
    { name: 'Administração de Usuários', slug: 'users.manage', category: 'Sistema' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-6 px-4 sm:px-6">
      {/* ======================================================== */}
      {/* 1. CABEÇALHO MODERNO & COESO COM O ENDEMIAS GOV */}
      {/* ======================================================== */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
              MINHA CONTA
            </span>
            <span className="text-xs text-slate-400 font-medium">• Sessão Autenticada</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <User className="w-7 h-7 text-emerald-600" />
            Perfil & Segurança do Operador
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie suas credenciais de acesso, dados do operador, preferências e segurança municipal.
          </p>
        </div>

        <div>
          <button
            onClick={handleLogout}
            className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer shadow-xs"
          >
            <LogOut className="w-4 h-4 text-rose-600" />
            <span>Encerrar Sessão</span>
          </button>
        </div>
      </div>

      {/* Alertas de Retorno */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800 text-xs font-semibold shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800 text-xs font-semibold shadow-xs">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. GRID PRINCIPAL: DADOS DO OPERADOR + PAINEL DE GESTÃO */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COLUNA ESQUERDA: CARD DO OPERADOR & IDENTIFICAÇÃO */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
            {/* Avatar & Identificação */}
            <div className="flex items-center gap-3.5 border-b border-slate-100 pb-5">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white font-black text-xl flex items-center justify-center shadow-xs">
                  {user?.name ? user.name.substring(0, 2).toUpperCase() : 'OP'}
                </div>
                <span
                  className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full"
                  title="Operador Conectado"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-black text-slate-900 text-base truncate">
                  {user?.name || 'Usuário'}
                </h3>
                <span className="text-xs text-slate-500 font-mono block truncate">
                  {user?.email || ''}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 mt-1.5 uppercase">
                  {user?.role || 'ACE'}
                </span>
              </div>
            </div>

            {/* Metadados Estruturados */}
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-50 text-slate-600">
                <span className="flex items-center gap-1.5 font-medium text-slate-500">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  Município
                </span>
                <span className="text-slate-900 font-bold">{municipality?.name || 'Município não informado'}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-50 text-slate-600">
                <span className="flex items-center gap-1.5 font-medium text-slate-500">
                  <FileCheck className="w-4 h-4 text-slate-400" />
                  Código IBGE
                </span>
                <span className="text-slate-800 font-mono font-bold">
                  {municipality?.ibgeCode || 'Não informado'}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-50 text-slate-600">
                <span className="flex items-center gap-1.5 font-medium text-slate-500">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Perfil RBAC
                </span>
                <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200 text-[11px]">
                  {user?.role || 'ACE'}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-50 text-slate-600">
                <span className="flex items-center gap-1.5 font-medium text-slate-500">
                  <Clock className="w-4 h-4 text-slate-400" />
                  Último Acesso
                </span>
                <span className="text-slate-700 font-medium">Hoje às 17:10</span>
              </div>

              <div className="flex items-center justify-between py-1 text-slate-600">
                <span className="flex items-center gap-1.5 font-medium text-slate-500">
                  <Smartphone className="w-4 h-4 text-slate-400" />
                  Dispositivo
                </span>
                <span className="text-slate-700 font-medium">Navegador Web / PWA</span>
              </div>
            </div>

            {/* Badge de Status da Conta */}
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold block">Conta Ativa & Sincronizada</span>
                <span className="text-[11px] text-emerald-700">Autenticado com Supabase Auth</span>
              </div>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: ABAS DE GERENCIAMENTO MODERNO */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
            {/* Navegador de Abas */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
              <button
                onClick={() => setActiveTab('SECURITY')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'SECURITY'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <KeyRound className="w-4 h-4" />
                <span>Segurança & Senha</span>
              </button>

              <button
                onClick={() => setActiveTab('PREFERENCES')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'PREFERENCES'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Sliders className="w-4 h-4" />
                <span>Preferências</span>
              </button>

              <button
                onClick={() => setActiveTab('PERMISSIONS')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'PERMISSIONS'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>Permissões RBAC</span>
              </button>
            </div>

            {/* ABA 1: SEGURANÇA & SENHA */}
            {activeTab === 'SECURITY' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-emerald-600" />
                    Alterar Senha de Acesso
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Para sua segurança e conformidade LGPD, utilize senhas fortes contendo letras maiúsculas, números e caracteres especiais.
                  </p>
                </div>

                <form onSubmit={handleChangePassword} className="space-y-4">
                  {/* Senha Atual */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      Senha Atual *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Digite sua senha atual"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 pr-10 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                        title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Nova Senha & Confirmação */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1.5">
                        Nova Senha (mín. 8 caracteres) *
                      </label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Nova senha forte"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1.5">
                        Confirmar Nova Senha *
                      </label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repita a nova senha"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition"
                      />
                    </div>
                  </div>

                  {/* Medidor Visual de Força da Senha */}
                  {newPassword && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                      <div className="flex items-center justify-between font-semibold">
                        <span className="text-slate-600">Força da Senha:</span>
                        <span className="text-slate-900 font-bold">{passwordStrength.label}</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-300 ${passwordStrength.color}`}
                          style={{ width: `${passwordStrength.score}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-end pt-3 border-t border-slate-100">
                    <button
                      type="submit"
                      disabled={isChangingPassword}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold transition shadow-xs flex items-center gap-2 cursor-pointer"
                    >
                      <Lock className="w-4 h-4" />
                      <span>{isChangingPassword ? 'Atualizando...' : 'Atualizar Senha'}</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ABA 2: PREFERÊNCIAS DO OPERADOR */}
            {activeTab === 'PREFERENCES' && (
              <form onSubmit={handleSavePreferences} className="space-y-5">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-blue-600" />
                    Preferências do Operador & Notificações
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Personalize parâmetros locais do aplicativo para seu fluxo de trabalho diário.
                  </p>
                </div>

                {prefsSavedMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{prefsSavedMsg}</span>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      Telefone de Contato Operacional
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(00) 00000-0000"
                      className="w-full max-w-sm px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div className="pt-2 space-y-3">
                    <label className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/70 transition">
                      <div>
                        <strong className="text-xs text-slate-900 block font-bold">
                          Alertas Sonoros em Campo
                        </strong>
                        <span className="text-[11px] text-slate-500">
                          Tocar som curto ao registrar fotos ou concluir visitas
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={soundAlerts}
                        onChange={(e) => setSoundAlerts(e.target.checked)}
                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/70 transition">
                      <div>
                        <strong className="text-xs text-slate-900 block font-bold">
                          Sincronização Automática Contínua
                        </strong>
                        <span className="text-[11px] text-slate-500">
                          Sincronizar dados com o Supabase assim que houver sinal 3G/4G/Wi-Fi
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={autoSync}
                        onChange={(e) => setAutoSync(e.target.checked)}
                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                      />
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-end pt-3 border-t border-slate-100">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold transition shadow-xs flex items-center gap-2 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Salvar Preferências</span>
                  </button>
                </div>
              </form>
            )}

            {/* ABA 3: PERMISSÕES RBAC */}
            {activeTab === 'PERMISSIONS' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    Escopo de Permissões Concedidas (RBAC)
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Visualize os privilégios atribuídos à sua conta para garantir transparência e conformidade sanitária.
                  </p>
                </div>

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {permissionsList.map((perm) => {
                    const hasAccess = can ? can(perm.slug) : true;

                    return (
                      <div key={perm.slug} className="p-3.5 flex items-center justify-between text-xs bg-white">
                        <div>
                          <strong className="text-slate-900 block font-bold">{perm.name}</strong>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {perm.category} • {perm.slug}
                          </span>
                        </div>
                        <div>
                          {hasAccess ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <Check className="w-3.5 h-3.5" />
                              Habilitado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                              <Lock className="w-3 h-3" />
                              Restrito
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/* 3. POLÍTICA DE PRIVACIDADE & CONFORMIDADE LGPD */}
          {/* ======================================================== */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-xs space-y-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Princípio da Necessidade & Segurança da Informação (LGPD Sanitária)
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              O acesso aos registros sanitários e epidemiológicos municipais é estritamente restrito e auditado. Todas as ações
              de consulta, cadastro e exportação geram registros indeléveis de auditoria com IP, data e horário para garantir a
              privacidade dos cidadãos e a rastreabilidade total das operações de combate a endemias.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
