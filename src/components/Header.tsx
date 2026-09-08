import React, { useState, useEffect } from 'react';
import {
  Shield,
  Menu,
  X,
  Bell,
  Wifi,
  WifiOff,
  RefreshCw,
  Monitor,
  UserCheck,
  ChevronDown,
  Download,
  AlertTriangle,
  LogOut,
  Search,
} from 'lucide-react';
import { User, UserRole } from '../types';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { GlobalSearchModal } from './GlobalSearchModal';
import { NotificationsDrawer } from './NotificationsDrawer';

interface HeaderProps {
  currentUser: User;
  onSwitchRole: (role: UserRole) => void;
  pendingSyncCount: number;
  onSync: () => void;
  onToggleSidebar: () => void;
  unreadAlertsCount: number;
  onOpenAlerts: () => void;
  onOpenTvMode: () => void;
  municipalityName: string;
  onLogout?: () => void;
  onNavigate?: (module: string) => void;
}

const ROLES_LIST: { role: UserRole; label: string; badgeColor: string }[] = [
  { role: 'ENDEMIAS_COORDINATOR', label: 'Coordenador de Endemias', badgeColor: 'bg-blue-600 text-white' },
  { role: 'ACE', label: 'Agente de Combate às Endemias (ACE)', badgeColor: 'bg-emerald-600 text-white' },
  { role: 'HEALTH_SECRETARY', label: 'Secretário Municipal de Saúde', badgeColor: 'bg-purple-600 text-white' },
  { role: 'FIELD_SUPERVISOR', label: 'Supervisor de Campo', badgeColor: 'bg-cyan-700 text-white' },
  { role: 'EPIDEMIOLOGY_AGENT', label: 'Vigilância Epidemiológica', badgeColor: 'bg-rose-600 text-white' },
  { role: 'SANITARY_AGENT', label: 'Vigilância Sanitária', badgeColor: 'bg-amber-600 text-white' },
  { role: 'MUNICIPAL_ADMIN', label: 'Administrador Municipal', badgeColor: 'bg-indigo-600 text-white' },
  { role: 'PRIMARY_CARE_ACS', label: 'Atenção Primária / ACS', badgeColor: 'bg-teal-600 text-white' },
  { role: 'AUDITOR_VIEWER', label: 'Auditor / Visualizador SUS', badgeColor: 'bg-slate-700 text-white' },
  { role: 'SUPER_ADMIN', label: 'Super Administrador', badgeColor: 'bg-red-700 text-white' },
];

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onSwitchRole,
  pendingSyncCount,
  onSync,
  onToggleSidebar,
  unreadAlertsCount,
  onOpenAlerts,
  onOpenTvMode,
  municipalityName,
  onLogout,
  onNavigate,
}) => {
  const isOnline = useOnlineStatus();
  const { isInstallable, isInstalled, install, isIOS } = usePWAInstall();
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const currentRoleInfo = ROLES_LIST.find(r => r.role === currentUser.role) || ROLES_LIST[0];

  return (
    <header className="sticky top-0 z-30 bg-slate-900 text-white border-b border-slate-800 shadow-md">
      <div className="flex items-center justify-between px-3 sm:px-6 py-2.5">
        {/* Left: Brand & Mobile Menu Toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="p-2 -ml-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg lg:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-sky-700 flex items-center justify-center shadow-inner">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-base sm:text-lg leading-tight text-white">
                  Endemias <span className="text-sky-400 font-extrabold">GOV</span>
                </span>
                <span className="hidden md:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-950 text-sky-300 border border-sky-800">
                  SUS / MS
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-none truncate max-w-[180px] sm:max-w-[260px]">
                {municipalityName} — 1º Ciclo 2026
              </p>
            </div>
          </div>
        </div>

        {/* Center: Busca Global Instantânea */}
        <div className="hidden md:flex items-center flex-1 max-w-md mx-4">
          <button
            onClick={() => setSearchModalOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs text-slate-300 transition cursor-pointer"
          >
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <span className="flex-1 text-left truncate">Buscar imóvel, ACE, bairro, PE, denúncia...</span>
            <kbd className="text-[10px] font-mono bg-slate-900 px-1.5 py-0.5 rounded text-slate-400 border border-slate-700">Ctrl+K</kbd>
          </button>
        </div>

        {/* Right: Actions, Sync, Notifications & Role Switcher */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Botão de Busca Mobile */}
          <button
            onClick={() => setSearchModalOpen(true)}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg md:hidden transition"
            title="Buscar"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* PWA Install Button */}
          {!isInstalled && (
            <>
              {isInstallable && (
                <button
                  onClick={install}
                  className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm"
                  title="Instalar App no dispositivo"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Instalar PWA</span>
                </button>
              )}
              {isIOS && (
                <button
                  onClick={() => setShowIosModal(true)}
                  className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                >
                  <span>PWA no iOS</span>
                </button>
              )}
            </>
          )}

          {/* Online / Offline & Sync Indicator */}
          <div className="flex items-center">
            {isOnline ? (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800/80 text-emerald-400 text-xs border border-slate-700">
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline text-[11px] font-medium">Online</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-950/80 text-amber-300 text-xs border border-amber-800">
                <WifiOff className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span className="text-[11px] font-medium">Offline</span>
              </div>
            )}

            {/* Offline Pending Sync Badge */}
            {pendingSyncCount > 0 && (
              <button
                onClick={onSync}
                className="ml-2 flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-semibold shadow transition animate-pulse"
                title="Sincronizar visitas realizadas em modo offline"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{pendingSyncCount} pendente{pendingSyncCount > 1 ? 's' : ''}</span>
              </button>
            )}
          </div>

          {/* TV / Telão Operations Room */}
          <button
            onClick={onOpenTvMode}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
            title="Abrir Central de Operações em Modo TV (Telão)"
          >
            <Monitor className="w-4 h-4" />
          </button>

          {/* Alerts Bell com Abertura de Drawer Lateral */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="relative p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
            title="Central de Alertas em Tempo Real"
          >
            <Bell className="w-4 h-4" />
            {unreadAlertsCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-slate-900 animate-ping" />
            )}
            {unreadAlertsCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-slate-900" />
            )}
          </button>

          {/* Role Switcher Dropdown (Prompt 03 RBAC) */}
          <div className="relative">
            <button
              onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
              className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700 transition"
              title="Alternar Perfil / Role para testes de RBAC"
            >
              <div className="w-6 h-6 rounded-full bg-sky-600 flex items-center justify-center text-xs font-bold text-white">
                {currentUser.name.charAt(0)}
              </div>
              <div className="text-left hidden md:block">
                <p className="text-xs font-medium text-slate-200 leading-tight">{currentUser.name}</p>
                <p className="text-[10px] text-sky-400 leading-none">{currentRoleInfo.label}</p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {roleDropdownOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 z-50 text-slate-800 animate-in fade-in zoom-in-95">
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Simular Perfil / RBAC</p>
                  <p className="text-[11px] text-slate-500">Alternar permissão e visão institucional:</p>
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {ROLES_LIST.map(({ role, label, badgeColor }) => {
                    const isSelected = currentUser.role === role;
                    return (
                      <button
                        key={role}
                        onClick={() => {
                          onSwitchRole(role);
                          setRoleDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2.5 hover:bg-slate-50 transition flex items-center justify-between ${
                          isSelected ? 'bg-sky-50 font-semibold' : ''
                        }`}
                      >
                        <div>
                          <p className="text-xs text-slate-900">{label}</p>
                          <span className={`inline-block px-1.5 py-0.5 mt-0.5 rounded text-[9px] font-medium ${badgeColor}`}>
                            {role}
                          </span>
                        </div>
                        {isSelected && <UserCheck className="w-4 h-4 text-sky-600 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                {/* Botão Oficial de Logout */}
                {onLogout && (
                  <div className="p-2 border-t border-slate-100 bg-slate-50 rounded-b-xl">
                    <button
                      onClick={() => {
                        setRoleDropdownOpen(false);
                        onLogout();
                      }}
                      className="w-full py-2 px-3 rounded-lg text-xs font-semibold text-rose-700 hover:bg-rose-100/70 transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sair do Sistema / Desconectar</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* iOS PWA Installation Guide Modal */}
      {showIosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Instalar no iPhone / iPad</h3>
              <button onClick={() => setShowIosModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-3 space-y-3 text-sm text-slate-600">
              <p>1. No navegador Safari, toque no botão <strong>Compartilhar</strong> (ícone do quadrado com a seta para cima).</p>
              <p>2. Role a lista para baixo e selecione <strong>Adicionar à Tela de Início</strong>.</p>
              <p>3. Toque em <strong>Adicionar</strong> no canto superior direito.</p>
            </div>
            <button
              onClick={() => setShowIosModal(false)}
              className="mt-5 w-full rounded-xl bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Modal de Busca Global com Debounce */}
      <GlobalSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        onSelectResult={(mod) => {
          if (onNavigate) onNavigate(mod);
        }}
      />

      {/* Gaveta Lateral de Notificações com Ciência Obrigatória */}
      <NotificationsDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onNavigateToModule={(mod) => {
          if (onNavigate) onNavigate(mod);
        }}
      />
    </header>
  );
};
