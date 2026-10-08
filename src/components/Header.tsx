import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  ChevronDown,
  Download,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { User, UserRole } from '../types';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { GlobalSearchModal } from './GlobalSearchModal';
import { NotificationsDrawer } from './NotificationsDrawer';

interface HeaderProps {
  currentUser: User;
  realRole?: UserRole | null;
  isImpersonating?: boolean;
  onImpersonateRole: (role: UserRole) => void;
  onStopImpersonation?: () => void;
  pendingSyncCount: number;
  onOpenPendingSync: () => void;
  onToggleSidebar: () => void;
  unreadAlertsCount: number;
  municipalityName: string;
  municipalityLogoUrl?: string;
  onLogout?: () => void;
  onNavigate?: (module: string) => void;
  onOpenQuickCreate?: () => void;
}

const ROLES: { role: UserRole; label: string }[] = [
  { role: 'ENDEMIAS_COORDINATOR', label: 'Coordenação de endemias' },
  { role: 'ACE', label: 'Agente de campo' },
  { role: 'HEALTH_SECRETARY', label: 'Secretaria de Saúde' },
  { role: 'FIELD_SUPERVISOR', label: 'Supervisão de campo' },
  { role: 'EPIDEMIOLOGY_AGENT', label: 'Vigilância epidemiológica' },
  { role: 'SANITARY_AGENT', label: 'Vigilância sanitária' },
  { role: 'MUNICIPAL_ADMIN', label: 'Administração municipal' },
  { role: 'PRIMARY_CARE_ACS', label: 'Atenção primária' },
  { role: 'AUDITOR_VIEWER', label: 'Consulta e auditoria' },
  { role: 'LAB_TECHNICIAN', label: 'Laboratório entomológico' },
  { role: 'ZOONOSES_VACCINATOR', label: 'Vacinação antirrábica' },
  { role: 'STOCK_MANAGER', label: 'Gestão de estoque' },
  { role: 'SUPER_ADMIN', label: 'Administração da plataforma' },
];

const iconButton =
  'inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-brand-primary-tint hover:text-brand-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700';

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  realRole,
  isImpersonating,
  onImpersonateRole,
  onStopImpersonation,
  pendingSyncCount,
  onOpenPendingSync,
  onToggleSidebar,
  unreadAlertsCount,
  municipalityName,
  municipalityLogoUrl,
  onLogout,
  onNavigate,
  onOpenQuickCreate,
}) => {
  const canImpersonate = realRole === 'SUPER_ADMIN' || realRole === 'MUNICIPAL_ADMIN';
  const isOnline = useOnlineStatus();
  const { isInstallable, isInstalled, install, isIOS } = usePWAInstall();
  const [profileOpen, setProfileOpen] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const roleLabel = ROLES.find((item) => item.role === currentUser.role)?.label ?? 'Usuário';

  useEffect(() => {
    const openSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') setProfileOpen(false);
    };
    window.addEventListener('keydown', openSearch);
    return () => window.removeEventListener('keydown', openSearch);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-brand-line bg-white/95 text-slate-900 shadow-[0_1px_0_rgba(6,56,75,0.03)] backdrop-blur-md">
      <div className="flex min-h-[4.25rem] items-center gap-3 px-3 sm:px-5 lg:px-6">
        <button type="button" onClick={onToggleSidebar} className={`${iconButton} lg:hidden`} aria-label="Abrir menu">
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="flex min-w-0 items-center gap-3">
          {municipalityLogoUrl ? (
            <img src={municipalityLogoUrl} alt="" className="h-10 w-10 shrink-0 object-contain" width="40" height="40" />
          ) : (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-primary text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-tight text-brand-ink sm:text-base">Endemias GOV</p>
            <p className="truncate text-xs text-slate-500">Vigilância municipal · {municipalityName}</p>
          </div>
        </div>

        <div className="mx-auto hidden min-w-0 max-w-xl flex-1 md:block">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex min-h-11 w-full items-center gap-3 rounded-lg border border-brand-line bg-[#f6f9fa] px-3 text-sm text-slate-500 transition-colors hover:border-[#adc2c8] hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-left">Buscar imóvel, bairro, agente ou protocolo</span>
            <kbd className="hidden rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-slate-500 lg:inline">Ctrl K</kbd>
          </button>
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {onOpenQuickCreate ? (
            <button
              type="button"
              onClick={onOpenQuickCreate}
              className="hidden min-h-11 items-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 sm:inline-flex"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Novo registro
            </button>
          ) : null}

          <button type="button" onClick={() => setSearchOpen(true)} className={`${iconButton} md:hidden`} aria-label="Abrir busca">
            <Search className="h-5 w-5" aria-hidden="true" />
          </button>

          {!isInstalled && isInstallable ? (
            <button type="button" onClick={install} className={iconButton} aria-label="Instalar aplicativo">
              <Download className="h-5 w-5" aria-hidden="true" />
            </button>
          ) : null}
          {!isInstalled && isIOS ? (
            <button type="button" onClick={() => setShowIosModal(true)} className={`${iconButton} hidden sm:inline-flex`} aria-label="Como instalar no iPhone">
              <Download className="h-5 w-5" aria-hidden="true" />
            </button>
          ) : null}

          {pendingSyncCount > 0 ? (
            <button
              type="button"
              onClick={onOpenPendingSync}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-amber-100 px-3 text-sm font-semibold text-amber-900 hover:bg-amber-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
              aria-label={`${pendingSyncCount} registros aguardando envio`}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              <span>{pendingSyncCount}</span>
            </button>
          ) : (
            <span className={`hidden items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold lg:flex ${isOnline ? 'text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
              {isOnline ? <Wifi className="h-4 w-4" aria-hidden="true" /> : <WifiOff className="h-4 w-4" aria-hidden="true" />}
              {isOnline ? 'Online' : 'Sem conexão'}
            </span>
          )}

          <button
            type="button"
            onClick={() => setNotificationsOpen(true)}
            className={`${iconButton} relative`}
            aria-label={unreadAlertsCount > 0 ? `${unreadAlertsCount} alertas não resolvidos` : 'Abrir alertas'}
          >
            <Bell className="h-5 w-5" aria-hidden="true" />
            {unreadAlertsCount > 0 ? (
              <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-rose-600 ring-2 ring-white" aria-hidden="true" />
            ) : null}
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen((open) => !open)}
              aria-expanded={profileOpen}
              aria-haspopup="menu"
              className={`flex min-h-11 items-center gap-2 rounded-lg border px-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                isImpersonating ? 'border-amber-300 bg-amber-50' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">
                {currentUser.name?.charAt(0).toUpperCase() || <UserRound className="h-4 w-4" aria-hidden="true" />}
              </span>
              <span className="hidden max-w-36 text-left lg:block">
                <span className="block truncate text-xs font-semibold text-slate-900">{currentUser.name}</span>
                <span className="block truncate text-xs text-slate-500">{roleLabel}</span>
              </span>
              <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" aria-hidden="true" />
            </button>

            {profileOpen ? (
              <div role="menu" className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                <div className="border-b border-slate-100 px-3 py-2">
                  <p className="truncate text-sm font-semibold text-slate-950">{currentUser.name}</p>
                  <p className="truncate text-xs text-slate-500">{currentUser.email}</p>
                  {isImpersonating ? <p className="mt-2 text-xs font-semibold text-amber-700">Visualizando como {roleLabel}</p> : null}
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setProfileOpen(false); onNavigate?.('/minha-conta'); }}
                  className="mt-1 flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-sm text-slate-700 hover:bg-slate-100"
                >
                  <UserRound className="h-4 w-4" aria-hidden="true" /> Minha conta
                </button>
                {canImpersonate ? (
                  <div className="mt-1 border-t border-slate-100 pt-2">
                    <p className="px-3 pb-1 text-xs font-semibold text-slate-500">Pré-visualizar perfil</p>
                    <div className="max-h-52 overflow-y-auto">
                      {ROLES.filter((item) => item.role !== realRole).map((item) => (
                        <button
                          type="button"
                          role="menuitem"
                          key={item.role}
                          onClick={() => { onImpersonateRole(item.role); setProfileOpen(false); }}
                          className="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm text-slate-700 hover:bg-slate-100"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                    {isImpersonating ? (
                      <button type="button" onClick={() => { onStopImpersonation?.(); setProfileOpen(false); }} className="mt-1 min-h-10 w-full rounded-lg bg-amber-50 px-3 text-left text-sm font-semibold text-amber-800 hover:bg-amber-100">
                        Voltar ao meu perfil
                      </button>
                    ) : null}
                  </div>
                ) : null}
                <button
                  type="button"
                  role="menuitem"
                  onClick={onLogout}
                  className="mt-1 flex min-h-10 w-full items-center gap-2 border-t border-slate-100 px-3 pt-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" /> Sair
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {isImpersonating ? (
        <div className="flex items-center justify-center gap-2 border-t border-amber-200 bg-amber-50 px-4 py-1.5 text-xs font-medium text-amber-900" role="status">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Pré-visualização de acesso ativa. Nenhuma permissão real foi alterada.
        </div>
      ) : null}

      {showIosModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="ios-install-title">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="ios-install-title" className="text-lg font-bold text-slate-950">Instalar no iPhone ou iPad</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">No Safari, toque em Compartilhar e escolha “Adicionar à Tela de Início”.</p>
              </div>
              <button type="button" onClick={() => setShowIosModal(false)} className={iconButton} aria-label="Fechar instruções">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <GlobalSearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectResult={(module) => onNavigate?.(module)}
      />
      <NotificationsDrawer
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        onNavigateToModule={(module) => onNavigate?.(module)}
      />
    </header>
  );
};
