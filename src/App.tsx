import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { db } from './services/storage';
import { OFFLINE_QUEUE_EVENT, OFFLINE_QUEUE_KEY, readQueue } from './services/offlineVisitQueue';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Shield, SearchX, Building2, LogOut } from 'lucide-react';
import {
  AccessChecker,
  HubId,
  HubTab,
  ViewModule,
  canAccessRoute,
  getHomeView,
  pathForView,
  RouteResolution,
  resolvePath,
  normalizePath,
  tabForView,
  toPath,
  viewForTab,
} from './config/routes';

// Telas Oficiais de Autenticação
import { LoginPage } from './components/auth/LoginPage';
import { ForgotPasswordPage } from './components/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './components/auth/ResetPasswordPage';
import { FirstAccessPage } from './components/auth/FirstAccessPage';
import { AccessDeniedPage } from './components/auth/AccessDeniedPage';
import { MyAccountPage } from './components/auth/MyAccountPage';

// Telas Administrativas RBAC
import { RolesPermissionsView } from './components/admin/RolesPermissionsView';
import { UsersManagementView } from './components/admin/UsersManagementView';
import { AuditLogsAdminView } from './components/admin/AuditLogsAdminView';
import { DataImportView } from './components/admin/DataImportView';
import { SystemSettingsView } from './components/admin/SystemSettingsView';
import { SystemHealthHubView } from './components/admin/SystemHealthHubView';

// Views Internas do Sistema
import { DashboardView } from './components/views/DashboardView';
import { AcePwaView } from './components/views/AcePwaView';
import { MapView } from './components/views/MapView';
import { TerritoryHubView, TerritoryHubTab } from './components/views/TerritoryHubView';
import { PropertiesView } from './components/views/PropertiesView';
import { VisitsView } from './components/views/VisitsView';
import { QuickCreateModal } from './components/ui';
import { PlanningView } from './components/views/PlanningView';
import { RoutesView } from './components/views/RoutesView';
import { OvitrapsLabHubView } from './components/views/OvitrapsLabHubView';
import { FociAndRecurrenceView } from './components/views/FociAndRecurrenceView';
import { EpidemiologyView } from './components/views/EpidemiologyView';
import { TeamsProductivityHubView } from './components/views/TeamsProductivityHubView';
import { StockSuppliesHubView } from './components/views/StockSuppliesHubView';
import { ComplaintsReferralsHubView } from './components/views/ComplaintsReferralsHubView';
import { EquipmentView } from './components/views/EquipmentView';
import { RiskEngineView } from './components/views/RiskEngineView';
import { ExecutiveDashboardView } from './components/views/ExecutiveDashboardView';
import { AlertsView } from './components/views/AlertsView';
import { CyclesView } from './components/views/CyclesView';
import { TransparencyPortalView } from './components/views/TransparencyPortalView';
import { LiraaView } from './components/views/LiraaView';
import { VectorControlHubView } from './components/views/VectorControlHubView';
import { LabelGeneratorView } from './components/views/LabelGeneratorView';
import { WorkOrdersView } from './components/views/WorkOrdersView';
import { SupervisorMobileView } from './components/views/SupervisorMobileView';
import { DocumentsReportsHubView } from './components/views/DocumentsReportsHubView';
import { IntegrationsView } from './components/views/IntegrationsView';
import { CommandCenterView } from './components/views/CommandCenterView';
import { CommunicationAdminView } from './components/views/CommunicationAdminView';
import { PublicPortalView } from './components/public/PublicPortalView';
import { PublicComplaintFormView } from './components/public/PublicComplaintFormView';
import { PublicComplaintTrackingView } from './components/public/PublicComplaintTrackingView';
import { HistoricalAnalysisView } from './components/views/HistoricalAnalysisView';
import { GeographicReconnaissanceView } from './components/views/GeographicReconnaissanceView';
import { FieldPendenciesView } from './components/views/FieldPendenciesView';

/** Visitas guardadas no aparelho aguardando envio (mesma fila usada pelo PWA). */
function readPendingOfflineCount(): number {
  return readQueue().length;
}

const FullScreenMessage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white text-center">
    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-sky-600 flex items-center justify-center shadow-xl shadow-sky-600/30 mb-4">
      <Shield className="w-8 h-8 text-white" />
    </div>
    {children}
  </div>
);

function AppContent() {
  const {
    user,
    municipality: authMunicipality,
    isAuthenticated,
    isLoading,
    logout,
    impersonateRole,
    stopImpersonation,
    isImpersonating,
    realRole,
    can,
    hasRole,
  } = useAuth();

  const access: AccessChecker = useMemo(() => ({ can, hasRole }), [can, hasRole]);

  // A URL é a única fonte de verdade da tela atual.
  const [currentPath, setCurrentPath] = useState<string>(() => normalizePath(window.location.pathname || '/'));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(() => readPendingOfflineCount());
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);

  /**
   * Navega para um id de tela (ex.: 'visits') ou URL (ex.: '/visitas').
   * `replace` troca a entrada atual do histórico (usado em redirecionamentos).
   */
  const navigate = useCallback((target: string, options?: { replace?: boolean }) => {
    const path = toPath(target);
    const current = normalizePath(window.location.pathname);
    if (options?.replace) {
      window.history.replaceState({}, '', path);
    } else if (path !== current) {
      window.history.pushState({}, '', path);
    }
    setCurrentPath(path);
  }, []);

  // Botões voltar/avançar do navegador
  useEffect(() => {
    const handlePopState = () => setCurrentPath(normalizePath(window.location.pathname || '/'));
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const resolution: RouteResolution = useMemo(() => resolvePath(currentPath), [currentPath]);
  const homeView: ViewModule | null = useMemo(() => (user ? getHomeView(user.role, access) : null), [user, access]);
  const currentView: ViewModule | null = resolution.kind === 'view' ? resolution.route.view : null;

  // Redirecionamentos: aliases -> URL canônica, URLs legadas, início do perfil e /login autenticado
  useEffect(() => {
    if (resolution.kind === 'redirect') {
      navigate(resolution.to, { replace: true });
      return;
    }
    if (resolution.kind === 'view' && !resolution.isCanonical) {
      navigate(resolution.route.path, { replace: true });
      return;
    }
    if (!isAuthenticated || !user) return;
    const goingHome = resolution.kind === 'home' || (resolution.kind === 'public' && resolution.path === '/login');
    if (goingHome && homeView) {
      navigate(pathForView(homeView), { replace: true });
    }
  }, [resolution, isAuthenticated, user, homeView, navigate]);

  // Contagem de visitas offline pendentes (atualiza ao navegar e quando outra aba altera o armazenamento)
  useEffect(() => {
    setPendingSyncCount(readPendingOfflineCount());
  }, [currentPath]);
  useEffect(() => {
    const refresh = () => setPendingSyncCount(readPendingOfflineCount());
    const onStorage = (e: StorageEvent) => {
      if (e.key === OFFLINE_QUEUE_KEY) refresh();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(OFFLINE_QUEUE_EVENT, refresh);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(OFFLINE_QUEUE_EVENT, refresh);
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  /** Handler de troca de aba de um hub: atualiza a URL para a rota da aba. */
  const tabNavigator = useCallback(
    <H extends HubId>(hub: H) =>
      (tab: HubTab<H>) =>
        navigate(viewForTab(hub, tab)),
    [navigate]
  );

  // 1. Carregamento da sessão
  if (isLoading) {
    return (
      <FullScreenMessage>
        <h2 className="text-lg font-bold tracking-tight">Endemias GOV</h2>
        <p className="text-xs text-sky-400 mt-1" role="status">
          Carregando credenciais e configurações municipais...
        </p>
      </FullScreenMessage>
    );
  }

  // 2. Rotas públicas (autenticação e Portal do Cidadão)
  if (resolution.kind === 'public') {
    switch (resolution.path) {
      case '/login':
        if (isAuthenticated) {
          return (
            <FullScreenMessage>
              <p className="text-sm" role="status">Redirecionando para o painel de trabalho...</p>
            </FullScreenMessage>
          );
        }
        return <LoginPage onNavigate={navigate} />;
      case '/esqueci-senha':
        return <ForgotPasswordPage onNavigate={navigate} />;
      case '/redefinir-senha':
        return <ResetPasswordPage onNavigate={navigate} />;
      case '/primeiro-acesso':
        return <FirstAccessPage onNavigate={navigate} />;
      case '/acesso-negado':
        return <AccessDeniedPage onNavigate={navigate} />;
      case '/publico':
        return (
          <PublicPortalView
            onNavigateToComplaint={() => navigate('/publico/denuncia')}
            onNavigateToTracking={() => navigate('/publico/denuncia/acompanhar')}
          />
        );
      case '/publico/denuncia':
        return (
          <PublicComplaintFormView
            onBackToPortal={() => navigate('/publico')}
            onNavigateToTracking={() => navigate('/publico/denuncia/acompanhar')}
          />
        );
      case '/publico/denuncia/acompanhar':
        return (
          <PublicComplaintTrackingView
            onBackToPortal={() => navigate('/publico')}
            onNavigateToForm={() => navigate('/publico/denuncia')}
          />
        );
    }
  }

  // 3. Tudo abaixo exige sessão: sem sessão => login (com retorno à URL pedida)
  if (!isAuthenticated || !user) {
    const redirectTo = resolution.kind === 'view' ? resolution.route.path : undefined;
    return <LoginPage onNavigate={navigate} redirectTo={redirectTo} />;
  }

  // Sessão sem município vinculado: bloqueia (nunca usa município de exemplo)
  if (!authMunicipality?.id) {
    return (
      <FullScreenMessage>
        <Building2 className="w-6 h-6 text-amber-400 mb-2" />
        <h2 className="text-lg font-bold">Perfil sem município vinculado</h2>
        <p className="text-xs text-slate-300 mt-1 max-w-sm">
          Seu usuário não está associado a um município ativo. Solicite ao administrador municipal a vinculação do seu perfil.
        </p>
        <button
          onClick={handleLogout}
          className="mt-5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 flex items-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </FullScreenMessage>
    );
  }

  if (resolution.kind === 'account') {
    return <MyAccountPage onNavigate={navigate} />;
  }

  const municipality = authMunicipality;
  const municipalityId = municipality.id;
  const unreadAlertsCount = db.getAlerts().filter((a) => !a.resolved).length;

  const renderView = () => {
    if (resolution.kind === 'not_found') {
      return (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3" role="alert">
          <SearchX className="w-8 h-8 text-slate-400 mx-auto" />
          <h1 className="text-base font-bold text-slate-900">Página não encontrada</h1>
          <p className="text-xs text-slate-500">
            O endereço <code className="font-mono">{resolution.path}</code> não corresponde a nenhuma tela do sistema.
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold"
          >
            Ir para a tela inicial
          </button>
        </div>
      );
    }

    if (resolution.kind !== 'view') {
      if (resolution.kind === 'home' && !homeView) return <AccessDeniedPage onNavigate={navigate} />;
      return (
        <p className="text-xs text-slate-500" role="status">
          Abrindo...
        </p>
      );
    }

    const { route } = resolution;
    // Guarda única (fail-closed): acesso direto por URL respeita as mesmas permissões do menu.
    if (!canAccessRoute(route, access)) return <AccessDeniedPage onNavigate={navigate} />;

    switch (route.view) {
      // Início
      case 'dashboard':
        return <DashboardView onNavigate={navigate} municipalityId={municipalityId} />;

      // Campo ACE
      case 'ace_pwa':
        return <AcePwaView onNavigate={navigate} />;
      case 'visits':
        return <VisitsView />;
      case 'routes':
        return <RoutesView onNavigate={navigate} />;
      case 'planning':
        return <PlanningView />;
      case 'field_pendencies':
        return <FieldPendenciesView />;
      case 'supervisor_mobile':
        return <SupervisorMobileView municipalityId={municipalityId} />;

      // Território
      case 'properties':
        return <PropertiesView />;
      case 'map':
        return <MapView />;
      case 'territory':
      case 'territory_neighborhoods':
      case 'territory_sectors':
      case 'territory_blocks':
      case 'territory_microareas':
      case 'strategic_points':
      case 'special_properties':
        return (
          <TerritoryHubView
            initialTab={(tabForView('territory', route.view) ?? 'overview') as TerritoryHubTab}
            onTabChange={tabNavigator('territory')}
            onNavigate={navigate}
          />
        );
      case 'geographic_reconnaissance':
        return <GeographicReconnaissanceView />;

      // Vigilância
      case 'vector_control':
      case 'chemical_operations':
        return (
          <VectorControlHubView
            initialTab={tabForView('vectorControl', route.view) ?? 'operacoes'}
            onTabChange={tabNavigator('vectorControl')}
          />
        );
      case 'liraa':
        return <LiraaView />;
      case 'cycles':
        return <CyclesView />;
      case 'ovitraps':
      case 'entomology_lab':
        return (
          <OvitrapsLabHubView
            initialTab={tabForView('ovitraps', route.view) ?? 'ovos'}
            onTabChange={tabNavigator('ovitraps')}
            onNavigate={navigate}
            municipalityId={municipalityId}
          />
        );
      case 'epidemiology':
        return <EpidemiologyView />;
      case 'foci_recurrence':
        return <FociAndRecurrenceView />;

      // Gestão Operacional
      case 'teams':
      case 'productivity':
        return (
          <TeamsProductivityHubView
            initialTab={tabForView('teams', route.view) ?? 'equipes'}
            onTabChange={tabNavigator('teams')}
          />
        );
      case 'complaints':
      case 'referrals':
        return (
          <ComplaintsReferralsHubView
            initialTab={tabForView('complaints', route.view) ?? 'denuncias'}
            onTabChange={tabNavigator('complaints')}
          />
        );
      case 'stock':
      case 'supplies':
        return (
          <StockSuppliesHubView initialTab={tabForView('stock', route.view) ?? 'estoque'} onTabChange={tabNavigator('stock')} />
        );
      case 'equipments':
        return <EquipmentView />;
      case 'work_orders':
        return <WorkOrdersView municipalityId={municipalityId} />;

      // Relatórios
      case 'reports':
      case 'documents':
        return (
          <DocumentsReportsHubView
            initialTab={tabForView('reports', route.view) ?? 'relatorios'}
            onTabChange={tabNavigator('reports')}
            municipalityId={municipalityId}
          />
        );

      // Administração
      case 'admin_users':
        return <UsersManagementView />;
      case 'admin_roles':
        return <RolesPermissionsView />;
      case 'admin_audit':
        return <AuditLogsAdminView />;
      case 'system_settings':
        return <SystemSettingsView onNavigate={navigate} />;
      case 'multi_disease':
        return <SystemSettingsView initialTab="MULTI_DISEASE" onNavigate={navigate} />;
      case 'integrations':
        return <IntegrationsView municipalityId={municipalityId} />;
      case 'system_health':
      case 'data_quality':
      case 'database_health':
      case 'system_errors':
        return (
          <SystemHealthHubView
            initialTab={tabForView('systemHealth', route.view) ?? 'saude'}
            onTabChange={tabNavigator('systemHealth')}
          />
        );
      case 'labels':
        return <LabelGeneratorView municipalityId={municipalityId} />;
      case 'data_import':
        return <DataImportView />;
      case 'communication':
        return <CommunicationAdminView />;

      // Mantidas fora do menu principal
      case 'command_center':
        return <CommandCenterView />;
      case 'executive':
        return <ExecutiveDashboardView />;
      case 'risk_engine':
        return <RiskEngineView />;
      case 'historical_analysis':
        return <HistoricalAnalysisView />;
      case 'alerts':
        return <AlertsView />;
      case 'transparency':
        return <TransparencyPortalView />;

      default: {
        // Garante em tempo de compilação que toda rota registrada tem renderização.
        const unreachable: never = route.view;
        return unreachable;
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800 antialiased selection:bg-blue-600 selection:text-white">
      <Header
        currentUser={user}
        realRole={realRole}
        isImpersonating={isImpersonating}
        onImpersonateRole={impersonateRole}
        onStopImpersonation={stopImpersonation}
        pendingSyncCount={pendingSyncCount}
        onOpenPendingSync={() => navigate('ace_pwa')}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        unreadAlertsCount={unreadAlertsCount}
        municipalityName={municipality.name}
        onLogout={handleLogout}
        onNavigate={navigate}
        onOpenQuickCreate={() => setIsQuickCreateOpen(true)}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          currentView={currentView}
          onSelectView={(v) => {
            navigate(v);
            setSidebarOpen(false);
          }}
          userRole={user.role}
          access={access}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          pendingSyncCount={pendingSyncCount}
        />

        <main id="conteudo-principal" className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">{renderView()}</div>
        </main>
      </div>

      <QuickCreateModal
        isOpen={isQuickCreateOpen}
        onClose={() => setIsQuickCreateOpen(false)}
        municipalityId={municipalityId}
        onNavigate={(view) => navigate(view)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
