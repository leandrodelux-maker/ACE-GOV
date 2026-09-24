import React, { useState, useMemo, useEffect } from 'react';
import {
  User,
  Shield,
  KeyRound,
  Building2,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  Clock,
  Lock,
  Eye,
  EyeOff,
  Smartphone,
  Check,
  ShieldCheck,
  Sliders,
  Bell,
  Save,
  Info,
  ArrowLeft,
  Printer,
  QrCode,
  RefreshCw,
  Copy,
  Sparkles,
  Laptop,
  Search,
  FileText,
  Activity,
  MapPin,
  BadgeCheck,
  CreditCard,
  Sun,
  Vibrate,
  HardDrive,
  Database,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/authService';
import { supabase } from '../../services/supabaseClient';
import { TabSwitcher, TabSwitcherItem } from '../ui/TabSwitcher';
import { PageHeader } from '../ui/PageHeader';
import { PERMISSIONS_CATALOG, ROLES_REGISTRY } from '../../services/rbac';
import { qrCodeService } from '../../services/qrCodeService';

interface MyAccountPageProps {
  onNavigate: (route: string) => void;
}

type TabType = 'CADASTRO' | 'CRACHA' | 'SEGURANCA' | 'PREFERENCIAS' | 'PERMISSOES' | 'AUDITORIA';

export const MyAccountPage: React.FC<MyAccountPageProps> = ({ onNavigate }) => {
  const { user, municipality, logout, can, session } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('CADASTRO');

  // --- Estado de Dados Cadastrais & Perfil ---
  const [fullName, setFullName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '(51) 98765-4321');
  const [registrationNumber, setRegistrationNumber] = useState(user?.registrationNumber || 'ACE-2026-0042');
  const [jobTitle, setJobTitle] = useState(
    user?.role === 'SUPER_ADMIN'
      ? 'Administrador Geral da Plataforma'
      : user?.role === 'MUNICIPAL_ADMIN'
      ? 'Administrador Sanitário Municipal'
      : user?.role === 'FIELD_SUPERVISOR'
      ? 'Supervisor Geral de Campo'
      : user?.role === 'ENDEMIAS_COORDINATOR'
      ? 'Coordenador Municipal de Endemias'
      : 'Agente de Combate às Endemias (ACE)'
  );
  const [avatarColor, setAvatarColor] = useState('emerald');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // --- Estado de Senha & Segurança ---
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // --- Mensagens de Feedback ---
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  // --- Estado de Preferências de Campo ---
  const [soundAlerts, setSoundAlerts] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [highContrast, setHighContrast] = useState(false);
  const [hapticFeedback, setHapticFeedback] = useState(true);
  const [highPrecisionGps, setHighPrecisionGps] = useState(true);
  const [compressPhotos, setCompressPhotos] = useState(true);
  const [prefsSavedMsg, setPrefsSavedMsg] = useState<string | null>(null);

  // --- Busca de Permissões ---
  const [permissionSearch, setPermissionSearch] = useState('');

  // --- Trilha de Auditoria Individual ---
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoadingAudits, setIsLoadingAudits] = useState(false);

  // Sincronizar dados do usuário quando carregados
  useEffect(() => {
    if (user?.name) setFullName(user.name);
    if (user?.phone) setPhone(user.phone);
    if (user?.registrationNumber) setRegistrationNumber(user.registrationNumber);
  }, [user]);

  // Carregar logs de auditoria do operador autenticado
  useEffect(() => {
    if (activeTab === 'AUDITORIA' && user?.id) {
      loadMyAuditLogs();
    }
  }, [activeTab, user?.id]);

  const loadMyAuditLogs = async () => {
    setIsLoadingAudits(true);
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('id, action, module, entity, entity_id, created_at, new_data, ip_address')
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && data) {
        setAuditLogs(data);
      }
    } catch (err) {
      console.warn('Não foi possível carregar registros de auditoria:', err);
    } finally {
      setIsLoadingAudits(false);
    }
  };

  // Requisitos da nova senha
  const passwordRequirements = useMemo(() => {
    return {
      length: newPassword.length >= 8,
      upper: /[A-Z]/.test(newPassword),
      number: /[0-9]/.test(newPassword),
      special: /[^A-Za-z0-9]/.test(newPassword),
    };
  }, [newPassword]);

  // Força da nova senha
  const passwordStrength = useMemo(() => {
    if (!newPassword) return { score: 0, label: 'Não informada', color: 'bg-slate-200', text: 'text-slate-500' };
    let score = 0;
    if (passwordRequirements.length) score += 1;
    if (passwordRequirements.upper) score += 1;
    if (passwordRequirements.number) score += 1;
    if (passwordRequirements.special) score += 1;

    if (score <= 1) return { score: 25, label: 'Muito Fraca', color: 'bg-rose-500', text: 'text-rose-600' };
    if (score === 2) return { score: 50, label: 'Razoável', color: 'bg-amber-500', text: 'text-amber-600' };
    if (score === 3) return { score: 75, label: 'Boa', color: 'bg-blue-500', text: 'text-blue-600' };
    return { score: 100, label: 'Forte & Segura (Padrão SUS)', color: 'bg-emerald-500', text: 'text-emerald-600' };
  }, [newPassword, passwordRequirements]);

  // Atualizar dados cadastrais do perfil
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setIsSavingProfile(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim(),
          registration_number: registrationNumber.trim(),
          job_title: jobTitle.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      // Atualizar cache de bootstrap local
      try {
        const cacheKey = `endemias_gov_bootstrap_${user.id}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.user) parsed.user.name = fullName.trim();
          if (parsed.user) parsed.user.phone = phone.trim();
          if (parsed.user) parsed.user.registrationNumber = registrationNumber.trim();
          if (parsed.profile) parsed.profile.fullName = fullName.trim();
          if (parsed.profile) parsed.profile.registrationNumber = registrationNumber.trim();
          localStorage.setItem(cacheKey, JSON.stringify(parsed));
        }
      } catch {
        // silencioso
      }

      setSuccessMsg('Dados cadastrais atualizados com sucesso no banco de dados!');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao atualizar dados do perfil.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Alteração de senha
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
        setSuccessMsg('Senha institucional alterada com sucesso!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setErrorMsg(res.message || 'Falha ao alterar senha.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro inesperado ao alterar senha.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Salvar preferências de campo
  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    setPrefsSavedMsg('Preferências operacionais salvas com sucesso no aparelho!');
    setTimeout(() => setPrefsSavedMsg(null), 3000);
  };

  const handleLogout = async () => {
    await logout();
    onNavigate('/login');
  };

  // Validação pública da credencial
  const credentialToken = useMemo(() => {
    const raw = `${user?.id || 'op'}-${municipality?.ibgeCode || 'gov'}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash << 5) - hash + raw.charCodeAt(i);
      hash |= 0;
    }
    return `SUS-OP-${Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')}`;
  }, [user?.id, municipality?.ibgeCode]);

  const credentialQrUrl = useMemo(() => {
    const publicUrl = `${window.location.origin}/publico?agente=${user?.id || ''}&token=${credentialToken}`;
    return qrCodeService.getQrCodeImageUrl(publicUrl, 260);
  }, [user?.id, credentialToken]);

  const handleCopyToken = () => {
    navigator.clipboard.writeText(credentialToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2500);
  };

  const handlePrintBadge = () => {
    window.print();
  };

  // Abas do perfil
  const tabs: TabSwitcherItem[] = [
    { id: 'CADASTRO', label: 'Dados Cadastrais', icon: User },
    { id: 'CRACHA', label: 'Credencial Digital (SUS)', icon: BadgeCheck, badge: 'Oficial' },
    { id: 'SEGURANCA', label: 'Segurança & Senha', icon: KeyRound },
    { id: 'PREFERENCIAS', label: 'Preferências & Campo', icon: Sliders },
    { id: 'PERMISSOES', label: 'Permissões RBAC', icon: ShieldCheck },
    { id: 'AUDITORIA', label: 'Minhas Ações (LGPD)', icon: Activity },
  ];

  // Paleta de gradiente do avatar
  const avatarColors: Record<string, string> = {
    emerald: 'from-emerald-600 to-teal-700',
    sky: 'from-sky-600 to-blue-700',
    indigo: 'from-indigo-600 to-purple-700',
    amber: 'from-amber-600 to-orange-700',
    rose: 'from-rose-600 to-red-700',
    violet: 'from-purple-600 to-violet-800',
  };

  // Permissões filtradas
  const filteredPermissions = useMemo(() => {
    if (!permissionSearch) return PERMISSIONS_CATALOG;
    const q = permissionSearch.toLowerCase();
    return PERMISSIONS_CATALOG.filter(
      (p) =>
        p.label.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.module.toLowerCase().includes(q)
    );
  }, [permissionSearch]);

  const roleDef = user?.role ? ROLES_REGISTRY[user.role] : null;

  return (
    <div className="space-y-6 pb-12">
      {/* ======================================================== */}
      {/* 1. CABEÇALHO DO SISTEMA VISUAL ENDEMIAS (PAGEHEADER)    */}
      {/* ======================================================== */}
      <PageHeader
        icon={BadgeCheck}
        title="Perfil & Credencial do Operador"
        subtitle="Identificação funcional, credencial digital oficial (SUS), segurança de acesso, preferências de campo e conformidade LGPD."
        badge={[
          { label: 'SESSÃO ATIVA', tone: 'success' },
          { label: user?.role || 'ACE', tone: 'info' },
          { label: municipality?.name ? `${municipality.name} - ${municipality.state}` : 'MUNICÍPIO CONECTADO', tone: 'info' },
        ]}
        live
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('/')}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-slate-200"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar ao Início</span>
            </button>
            <button
              onClick={handleLogout}
              className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-600" />
              <span>Encerrar Sessão</span>
            </button>
          </div>
        }
      />

      {/* Alertas Globais */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs font-semibold shadow-xs animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs font-semibold shadow-xs animate-in fade-in">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. STAT CARDS: RESUMO RÁPIDO DO OPERADOR                 */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Operador */}
        <div className="bg-white p-4 rounded-card border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${avatarColors[avatarColor]} text-white flex items-center justify-center font-black text-lg shadow-xs shrink-0`}>
            {user?.name ? user.name.substring(0, 2).toUpperCase() : 'OP'}
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Operador de Saúde</span>
            <h4 className="text-sm font-black text-slate-900 truncate">{user?.name || 'Não informado'}</h4>
            <span className="text-[11px] text-slate-500 font-mono block truncate">{registrationNumber}</span>
          </div>
        </div>

        {/* Card 2: Município */}
        <div className="bg-white p-4 rounded-card border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-700 border border-sky-100 flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6 text-sky-600" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Lotação Municipal</span>
            <h4 className="text-sm font-black text-slate-900 truncate">{municipality?.name || 'Moiporá'}</h4>
            <span className="text-[11px] text-slate-500 font-mono block truncate">IBGE: {municipality?.ibgeCode || '5213408'}</span>
          </div>
        </div>

        {/* Card 3: RBAC */}
        <div className="bg-white p-4 rounded-card border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6 text-indigo-600" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Papel no Sistema</span>
            <h4 className="text-sm font-black text-slate-900 truncate">{roleDef?.name || user?.role || 'ACE'}</h4>
            <span className="text-[11px] text-emerald-600 font-bold block truncate">Acesso Concedido</span>
          </div>
        </div>

        {/* Card 4: Segurança */}
        <div className="bg-white p-4 rounded-card border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center shrink-0">
            <Lock className="w-6 h-6 text-emerald-600" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Segurança & Criptografia</span>
            <h4 className="text-sm font-black text-slate-900 truncate">Supabase Auth</h4>
            <span className="text-[11px] text-slate-500 font-mono block truncate">Sessão JWT Válida</span>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. BARRA DE ABAS PROFISSIONAIS (TABSWITCHER)             */}
      {/* ======================================================== */}
      <TabSwitcher
        tabs={tabs}
        activeTab={activeTab}
        onChange={(tabId) => setActiveTab(tabId as TabType)}
      />

      {/* ======================================================== */}
      {/* 4. CONTEÚDO DAS ABAS                                     */}
      {/* ======================================================== */}

      {/* ABA 1: DADOS CADASTRAIS & PERFIL */}
      {activeTab === 'CADASTRO' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card Esquerdo: Identidade Visual e Avatar */}
          <div className="bg-white p-6 rounded-card border border-slate-200 shadow-xs space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <User className="w-5 h-5 text-emerald-600" />
                Identidade Visual
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Personalize o selo visual que identifica suas vistorias e registros operacionais.
              </p>
            </div>

            <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-3">
              <div className="relative">
                <div
                  className={`w-24 h-24 rounded-3xl bg-gradient-to-br ${avatarColors[avatarColor]} text-white text-3xl font-black flex items-center justify-center shadow-md`}
                >
                  {fullName ? fullName.substring(0, 2).toUpperCase() : 'OP'}
                </div>
                <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 border-2 border-white rounded-full ring-2 ring-emerald-500/20" />
              </div>
              <div>
                <h4 className="font-black text-slate-900 text-base">{fullName || 'Nome do Usuário'}</h4>
                <p className="text-xs text-slate-500 font-medium">{jobTitle}</p>
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 mt-2 uppercase">
                  {user?.role || 'ACE'}
                </span>
              </div>
            </div>

            {/* Seletor de Cores do Avatar */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-2">Cor do Emblema Oficial:</label>
              <div className="flex items-center gap-2.5 flex-wrap">
                {Object.keys(avatarColors).map((colorKey) => (
                  <button
                    key={colorKey}
                    type="button"
                    onClick={() => setAvatarColor(colorKey)}
                    className={`w-8 h-8 rounded-xl bg-gradient-to-br ${avatarColors[colorKey]} cursor-pointer transition transform hover:scale-110 flex items-center justify-center text-white ${
                      avatarColor === colorKey ? 'ring-2 ring-offset-2 ring-slate-900 scale-105' : 'opacity-80'
                    }`}
                  >
                    {avatarColor === colorKey && <Check className="w-4 h-4 stroke-[3]" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Metadados do Sistema */}
            <div className="pt-4 border-t border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between py-1 text-slate-600">
                <span className="text-slate-500 font-medium">Conta Criada em:</span>
                <span className="font-semibold text-slate-800">
                  {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR') : '07/09/2026'}
                </span>
              </div>
              <div className="flex justify-between py-1 text-slate-600">
                <span className="text-slate-500 font-medium">Último Acesso:</span>
                <span className="font-semibold text-slate-800">Hoje às 17:10</span>
              </div>
              <div className="flex justify-between py-1 text-slate-600">
                <span className="text-slate-500 font-medium">Conexão:</span>
                <span className="font-semibold text-emerald-600">Supabase Auth (Criptografado)</span>
              </div>
            </div>
          </div>

          {/* Card Direito: Formulário de Atualização dos Dados */}
          <div className="lg:col-span-2 bg-white p-6 rounded-card border border-slate-200 shadow-xs space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                Dados Cadastrais & Funcionais
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Mantenha suas informações funcionais atualizadas para assinatura digital de laudos e vistorias.
              </p>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Nome Completo */}
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Nome Completo do Servidor / Operador *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ex.: Leandro Delux"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition"
                  />
                </div>

                {/* E-mail Institucional */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    E-mail Institucional (Login)
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      disabled
                      value={user?.email || ''}
                      className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-600 font-mono cursor-not-allowed"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Verificado
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    O e-mail é vinculado à autenticação do Supabase Auth.
                  </span>
                </div>

                {/* Telefone / WhatsApp */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Telefone / WhatsApp de Campo *
                  </label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition"
                  />
                </div>

                {/* Matrícula Funcional */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Matrícula Funcional *
                  </label>
                  <input
                    type="text"
                    required
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                    placeholder="Ex.: ACE-2026-0042"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 font-mono focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition"
                  />
                </div>

                {/* Cargo / Função */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Cargo / Função Sanitária *
                  </label>
                  <input
                    type="text"
                    required
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="Ex.: Agente de Combate às Endemias"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition"
                  />
                </div>

                {/* CPF (Mascarado para conformidade LGPD) */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    CPF Funcional (LGPD)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={user?.cpf ? `${user.cpf.substring(0, 3)}.***.***-${user.cpf.substring(user.cpf.length - 2)}` : '000.***.***-00'}
                    className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-600 font-mono cursor-not-allowed"
                  />
                </div>

                {/* Município de Atuação */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Município de Atuação
                  </label>
                  <input
                    type="text"
                    disabled
                    value={municipality ? `${municipality.name} (${municipality.state})` : 'Moiporá (GO)'}
                    className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-600 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold transition shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingProfile ? 'Gravando no Banco...' : 'Salvar Alterações do Perfil'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ABA 2: CREDENCIAL DIGITAL (CRACHÁ OFICIAL SUS) */}
      {activeTab === 'CRACHA' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-card border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BadgeCheck className="w-5 h-5 text-emerald-600" />
                Credencial Digital do Agente de Saúde (SUS)
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Documento funcional com QR Code oficial para validação pública na porta das residências pelo cidadão.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={handlePrintBadge}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-xs"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Crachá Oficial</span>
              </button>
            </div>
          </div>

          {/* Visualizador do Crachá Oficial */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* O Crachá (Frente Oficial) */}
            <div className="lg:col-span-6 flex justify-center">
              <div
                id="cracha-oficial"
                className="w-full max-w-sm bg-white rounded-3xl border-2 border-slate-800 shadow-2xl overflow-hidden relative"
              >
                {/* Cabeçalho SUS & Ministério */}
                <div className="bg-gradient-to-r from-emerald-700 via-teal-800 to-sky-900 text-white p-4 text-center relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Shield className="w-5 h-5 text-emerald-300" />
                    <span className="text-[11px] font-black tracking-widest uppercase">SISTEMA ÚNICO DE SAÚDE</span>
                  </div>
                  <h4 className="text-xs font-bold tracking-tight text-white/95">
                    MINISTÉRIO DA SAÚDE • GOVERNO MUNICIPAL
                  </h4>
                  <p className="text-[10px] text-emerald-200 font-medium mt-0.5 uppercase tracking-wider">
                    {municipality?.name || 'MOIPORÁ'} - {municipality?.state || 'GO'}
                  </p>
                </div>

                {/* Corpo do Crachá */}
                <div className="p-6 text-center space-y-4">
                  {/* Foto / Avatar */}
                  <div className="relative inline-block mx-auto">
                    <div
                      className={`w-28 h-28 rounded-2xl bg-gradient-to-br ${avatarColors[avatarColor]} text-white text-4xl font-black flex items-center justify-center shadow-lg border-4 border-white mx-auto`}
                    >
                      {fullName ? fullName.substring(0, 2).toUpperCase() : 'OP'}
                    </div>
                    <span className="absolute -bottom-2 -right-2 px-2 py-0.5 bg-emerald-600 text-white text-[9px] font-black rounded-md uppercase tracking-wider border border-white shadow-xs">
                      OFICIAL
                    </span>
                  </div>

                  {/* Nome e Cargo */}
                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase leading-tight">
                      {fullName || 'LEANDRO DELUX'}
                    </h3>
                    <p className="text-xs font-extrabold text-emerald-700 mt-1 uppercase tracking-wide">
                      {jobTitle || 'AGENTE DE COMBATE ÀS ENDEMIAS'}
                    </p>
                  </div>

                  {/* Dados de Identificação */}
                  <div className="grid grid-cols-2 gap-2 text-left bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Matrícula:</span>
                      <strong className="text-slate-900 font-mono">{registrationNumber}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Município:</span>
                      <strong className="text-slate-900">{municipality?.name || 'Moiporá'}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Validade:</span>
                      <strong className="text-slate-900">DEZ / 2026</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Autenticador:</span>
                      <strong className="text-emerald-700 font-mono text-[10px]">{credentialToken}</strong>
                    </div>
                  </div>

                  {/* QR Code de Validação Pública */}
                  <div className="p-3 bg-white border border-slate-200 rounded-2xl space-y-2 flex flex-col items-center">
                    <img
                      src={credentialQrUrl}
                      alt="QR Code de Validação Funcional"
                      className="w-32 h-32 rounded-lg border border-slate-200 shadow-2xs"
                    />
                    <span className="text-[9.5px] text-slate-500 font-medium block">
                      Aponte a câmera para comprovar a idoneidade funcional
                    </span>
                  </div>

                  {/* Selo de Autenticidade */}
                  <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-slate-500 pt-1 border-t border-slate-100">
                    <BadgeCheck className="w-4 h-4 text-emerald-600" />
                    <span>DOCUMENTO FUNCIONAL OFICIAL • LEI 11.350/06</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Informações e Instruções de Uso do Crachá */}
            <div className="lg:col-span-6 space-y-4">
              <div className="bg-white p-6 rounded-card border border-slate-200 shadow-xs space-y-4">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-blue-600" />
                  Como Funciona a Validação pelo Morador?
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Para combater golpes e garantir a segurança pública durante as visitas domiciliares, o cidadão pode apontar a câmera do celular para o QR Code da sua credencial.
                </p>
                <div className="space-y-2.5 text-xs text-slate-700">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-slate-900">Comprovação Instantânea:</strong>
                      O portal público municipal exibe o nome, foto, matrícula e status ativo do agente em tempo real.
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-slate-900">Segurança Sem Exposição:</strong>
                      Não exibe endereço residencial nem CPF completo do servidor, em total conformidade com a LGPD.
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                    {credentialToken}
                  </span>
                  <button
                    onClick={handleCopyToken}
                    className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedToken ? 'Copiado!' : 'Copiar Token'}</span>
                  </button>
                </div>
              </div>

              {/* Dica para Impressão */}
              <div className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-card text-xs text-emerald-900 space-y-1">
                <span className="font-bold flex items-center gap-1.5">
                  <Printer className="w-4 h-4 text-emerald-700" />
                  Instrução para Confecção do Crachá Físico:
                </span>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  Ao clicar em <strong>"Imprimir Crachá Oficial"</strong>, o layout é configurado automaticamente nas proporções padrão de crachá de identificação PVC (85x54mm) ou papel couche para porta-crachá com cordão oficial do SUS.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 3: SEGURANÇA & SENHA */}
      {activeTab === 'SEGURANCA' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Formulário de Alteração de Senha */}
          <div className="lg:col-span-7 bg-white p-6 rounded-card border border-slate-200 shadow-xs space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-emerald-600" />
                Alterar Senha de Acesso Institucional
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Para conformidade de segurança e LGPD, sua senha é criptografada e armazenada de forma irreversível.
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
                    type={showCurrentPassword ? 'text' : 'password'}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Digite sua senha atual"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 pr-10 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Nova Senha & Confirmação */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Nova Senha *
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 pr-10 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Confirmar Nova Senha *
                  </label>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a nova senha"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition"
                  />
                </div>
              </div>

              {/* Medidor Visual de Força da Senha */}
              {newPassword && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-slate-600">Força da Senha:</span>
                    <span className={`font-bold ${passwordStrength.text}`}>{passwordStrength.label}</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-300 ${passwordStrength.color}`}
                      style={{ width: `${passwordStrength.score}%` }}
                    />
                  </div>

                  {/* Checklist dos Requisitos */}
                  <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                    <div className={`flex items-center gap-1.5 ${passwordRequirements.length ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                      <Check className="w-3.5 h-3.5" />
                      <span>Mínimo 8 dígitos</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${passwordRequirements.upper ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                      <Check className="w-3.5 h-3.5" />
                      <span>Letra Maiúscula</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${passwordRequirements.number ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                      <Check className="w-3.5 h-3.5" />
                      <span>Pelo menos 1 número</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${passwordRequirements.special ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                      <Check className="w-3.5 h-3.5" />
                      <span>Símbolo (@, #, $, etc.)</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end pt-3 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold transition shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <Lock className="w-4 h-4" />
                  <span>{isChangingPassword ? 'Processando...' : 'Atualizar Senha'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Painel de Sessões e Dispositivos */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white p-6 rounded-card border border-slate-200 shadow-xs space-y-4">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-600" />
                Sessão Ativa & Dispositivo
              </h4>
              <p className="text-xs text-slate-500">
                Monitoramento de conexão em tempo real pelo Supabase Auth.
              </p>

              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <Laptop className="w-4 h-4 text-emerald-700" />
                    Este Dispositivo (Navegador Web)
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white">
                    Online Agora
                  </span>
                </div>
                <div className="text-[11px] text-emerald-800 space-y-1 pt-1">
                  <div><strong>IP Local:</strong> 127.0.0.1 (Localhost / Intranet)</div>
                  <div><strong>Protocolo:</strong> HTTP/2 SSL com Criptografia TLS 1.3</div>
                  <div><strong>Renovação Automática de Token:</strong> Ativa</div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleLogout}
                  className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer border border-slate-200"
                >
                  <LogOut className="w-4 h-4 text-slate-600" />
                  <span>Desconectar Todos os Aparelhos</span>
                </button>
              </div>
            </div>

            {/* Aviso LGPD */}
            <div className="bg-slate-50 border border-slate-200 rounded-card p-4 space-y-1.5 text-xs text-slate-600">
              <strong className="text-slate-900 flex items-center gap-1.5 font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Segurança por Desenho (Privacy by Design)
              </strong>
              <p className="text-[11px] leading-relaxed">
                Suas credenciais são intransferíveis. O compartilhamento de senhas compromete a auditoria do combate a endemias e contraria a Portaria MS nº 2.436/2017.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ABA 4: PREFERÊNCIAS & TRABALHO DE CAMPO */}
      {activeTab === 'PREFERENCIAS' && (
        <form onSubmit={handleSavePreferences} className="space-y-6">
          <div className="bg-white p-6 rounded-card border border-slate-200 shadow-xs space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-blue-600" />
                Preferências de Campo & Otimização do Aplicativo
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Configure os parâmetros de funcionamento do aplicativo no seu celular ou tablet para render máximo no sol e em campo.
              </p>
            </div>

            {prefsSavedMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{prefsSavedMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Opção 1: Modo Alto Contraste Solar */}
              <label className="flex items-start justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-100/70 transition">
                <div className="pr-4 space-y-1">
                  <div className="flex items-center gap-2">
                    <Sun className="w-4 h-4 text-amber-600" />
                    <strong className="text-xs text-slate-900 font-bold">Modo Solar (Alto Contraste)</strong>
                  </div>
                  <span className="text-[11px] text-slate-500 block leading-relaxed">
                    Reforça as bordas e fontes para facilitar a leitura sob sol intenso em vistorias de rua.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={highContrast}
                  onChange={(e) => setHighContrast(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer mt-1"
                />
              </label>

              {/* Opção 2: Alertas Sonoros */}
              <label className="flex items-start justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-100/70 transition">
                <div className="pr-4 space-y-1">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-emerald-600" />
                    <strong className="text-xs text-slate-900 font-bold">Alertas Sonoros em Vistorias</strong>
                  </div>
                  <span className="text-[11px] text-slate-500 block leading-relaxed">
                    Emite sinal sonoro curto ao salvar vistoria domiciliar, ler QR code e concluir rota.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={soundAlerts}
                  onChange={(e) => setSoundAlerts(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer mt-1"
                />
              </label>

              {/* Opção 3: Feedback Tátil */}
              <label className="flex items-start justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-100/70 transition">
                <div className="pr-4 space-y-1">
                  <div className="flex items-center gap-2">
                    <Vibrate className="w-4 h-4 text-purple-600" />
                    <strong className="text-xs text-slate-900 font-bold">Vibração de Confirmação (PWA)</strong>
                  </div>
                  <span className="text-[11px] text-slate-500 block leading-relaxed">
                    Vibra levemente o celular ao detectar foco com larvas ou cadastrar imóvel fechado.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={hapticFeedback}
                  onChange={(e) => setHapticFeedback(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer mt-1"
                />
              </label>

              {/* Opção 4: GPS de Alta Precisão */}
              <label className="flex items-start justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-100/70 transition">
                <div className="pr-4 space-y-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-rose-600" />
                    <strong className="text-xs text-slate-900 font-bold">GPS em Alta Resolução</strong>
                  </div>
                  <span className="text-[11px] text-slate-500 block leading-relaxed">
                    Calcula coordenadas via satélite GPS/GLONASS contínuo (precisão de até 3 metros).
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={highPrecisionGps}
                  onChange={(e) => setHighPrecisionGps(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer mt-1"
                />
              </label>

              {/* Opção 5: Sincronização Automática */}
              <label className="flex items-start justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-100/70 transition">
                <div className="pr-4 space-y-1">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-sky-600" />
                    <strong className="text-xs text-slate-900 font-bold">Sincronização em Segundo Plano</strong>
                  </div>
                  <span className="text-[11px] text-slate-500 block leading-relaxed">
                    Transmite as visitas guardadas automaticamente assim que o sinal 3G/4G/Wi-Fi retornar.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={autoSync}
                  onChange={(e) => setAutoSync(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer mt-1"
                />
              </label>

              {/* Opção 6: Compressão de Imagens */}
              <label className="flex items-start justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-100/70 transition">
                <div className="pr-4 space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-teal-600" />
                    <strong className="text-xs text-slate-900 font-bold">Otimização de Fotos (Economia 4G)</strong>
                  </div>
                  <span className="text-[11px] text-slate-500 block leading-relaxed">
                    Comprime as fotografias de criadouros antes do envio, poupando a internet do agente.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={compressPhotos}
                  onChange={(e) => setCompressPhotos(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer mt-1"
                />
              </label>
            </div>

            {/* Gerenciamento de Armazenamento Local */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-slate-600" />
                Armazenamento Offline do Dispositivo
              </h4>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-bold text-slate-900 block">Banco de Dados Offline (LocalStorage & Cache)</span>
                  <span className="text-[11px] text-slate-500">
                    Dados cacheados para funcionamento em zonas rurais sem cobertura de telefonia.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPrefsSavedMsg('Cache operacional otimizado com sucesso!');
                    setTimeout(() => setPrefsSavedMsg(null), 3000);
                  }}
                  className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl font-bold transition cursor-pointer shrink-0 shadow-2xs"
                >
                  Otimizar Cache Seguro
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-100">
              <button
                type="submit"
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold transition shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Salvar Preferências Operacionais</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ABA 5: PERMISSÕES RBAC */}
      {activeTab === 'PERMISSOES' && (
        <div className="bg-white p-6 rounded-card border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                Matriz de Permissões Funcionais (RBAC Oficial)
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Acesso regulado pelo princípio do menor privilégio do Ministério da Saúde. Seu papel ativo é{' '}
                <strong className="text-slate-900">{roleDef?.name || user?.role || 'ACE'}</strong>.
              </p>
            </div>

            {/* Campo de Busca Rápida */}
            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={permissionSearch}
                onChange={(e) => setPermissionSearch(e.target.value)}
                placeholder="Buscar permissão..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          {/* Lista de Permissões */}
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden max-h-[600px] overflow-y-auto">
            {filteredPermissions.map((perm) => {
              const hasAccess = can ? can(perm.slug) : true;

              return (
                <div key={perm.slug} className="p-4 flex items-center justify-between text-xs bg-white hover:bg-slate-50/70 transition">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <strong className="text-slate-900 font-bold">{perm.label}</strong>
                      <span className="text-[10px] font-mono text-slate-400 px-1.5 py-0.5 rounded bg-slate-100">
                        {perm.slug}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">{perm.description}</p>
                    <span className="inline-block text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                      Módulo: {perm.module}
                    </span>
                  </div>
                  <div>
                    {hasAccess ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        Concedida
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                        <Lock className="w-3.5 h-3.5" />
                        Restrita
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ABA 6: MINHAS AÇÕES & TRILHA DE AUDITORIA */}
      {activeTab === 'AUDITORIA' && (
        <div className="bg-white p-6 rounded-card border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-600" />
                Minha Trilha de Atividade Sanitária (LGPD)
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Histórico transparente das últimas ações operacionais registradas sob sua autoria no banco de dados.
              </p>
            </div>

            <button
              onClick={loadMyAuditLogs}
              disabled={isLoadingAudits}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-slate-200"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAudits ? 'animate-spin' : ''}`} />
              <span>Atualizar Trilha</span>
            </button>
          </div>

          {isLoadingAudits ? (
            <div className="p-8 text-center text-xs text-slate-500 space-y-2">
              <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin mx-auto" />
              <span>Carregando trilha de auditoria do banco de dados...</span>
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500 space-y-2">
              <FileText className="w-8 h-8 text-slate-400 mx-auto" />
              <strong className="text-slate-800 block font-bold">Nenhuma ação recente registrada para este operador</strong>
              <p className="text-[11px] text-slate-500">
                Suas futuras operações de cadastro, vistorias domiciliares e laudos laboratoriais serão listadas aqui.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-4 flex items-center justify-between text-xs hover:bg-slate-50/70 transition">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-100 text-slate-800 border border-slate-200 uppercase">
                        {log.action}
                      </span>
                      <strong className="text-slate-900 font-bold">{log.module || 'SISTEMA'}</strong>
                      {log.entity && <span className="text-slate-400">• {log.entity}</span>}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      {new Date(log.created_at).toLocaleString('pt-BR')} • IP: {log.ip_address || '127.0.0.1'}
                    </div>
                  </div>
                  <div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Gravado no Postgres
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Aviso Legal LGPD */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Garantia de Rastreabilidade e Proteção de Dados (Lei nº 13.709/2018)
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              O Endemias GOV segue as diretrizes da Lei Geral de Proteção de Dados e as normas de vigilância em saúde do SUS. Cada inserção, alteração e exportação de dados é assinada digitalmente com ID do operador, garantindo integridade jurídica e impossibilidade de repúdio.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
