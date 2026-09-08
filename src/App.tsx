import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar, ViewModule } from './components/Sidebar';
import { db } from './services/storage';
import { User, UserRole } from './types';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Shield } from 'lucide-react';

// Telas Oficiais de Autenticação
import { LoginPage } from './components/auth/LoginPage';
import { ForgotPasswordPage } from './components/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './components/auth/ResetPasswordPage';
import { FirstAccessPage } from './components/auth/FirstAccessPage';
import { AccessDeniedPage } from './components/auth/AccessDeniedPage';

// Telas Administrativas RBAC
import { RolesPermissionsView } from './components/admin/RolesPermissionsView';
import { UsersManagementView } from './components/admin/UsersManagementView';
import { AuditLogsAdminView } from './components/admin/AuditLogsAdminView';
import { DataImportView } from './components/admin/DataImportView';
import { DataQualityView } from './components/admin/DataQualityView';
import { SystemSettingsView } from './components/admin/SystemSettingsView';
import { ErrorLogsView } from './components/admin/ErrorLogsView';

// Views Internas do Sistema
import { DashboardView } from './components/views/DashboardView';
import { AcePwaView } from './components/views/AcePwaView';
import { MapView } from './components/views/MapView';
import { TerritoryView } from './components/views/TerritoryView';
import { PropertiesView } from './components/views/PropertiesView';
import { VisitsView } from './components/views/VisitsView';
import { PlanningView } from './components/views/PlanningView';
import { RoutesView } from './components/views/RoutesView';
import { OvitrapsView } from './components/views/OvitrapsView';
import { StrategicPointsView } from './components/views/StrategicPointsView';
import { SpecialPropertiesView } from './components/views/SpecialPropertiesView';
import { FociAndRecurrenceView } from './components/views/FociAndRecurrenceView';
import { EpidemiologyView } from './components/views/EpidemiologyView';
import { CitizenPortalView } from './components/views/CitizenPortalView';
import { TeamsView } from './components/views/TeamsView';
import { SuppliesView } from './components/views/SuppliesView';
import { EquipmentView } from './components/views/EquipmentView';
import { RiskEngineView } from './components/views/RiskEngineView';
import { ExecutiveDashboardView } from './components/views/ExecutiveDashboardView';
import { OperationsRoomView } from './components/views/OperationsRoomView';
import { AlertsView } from './components/views/AlertsView';
import { ReportsView } from './components/views/ReportsView';
import { CyclesView } from './components/views/CyclesView';
import { AiAssistantView } from './components/views/AiAssistantView';
import { TransparencyPortalView } from './components/views/TransparencyPortalView';
import { ReferralsView } from './components/views/ReferralsView';
import { AuditLogsView } from './components/views/AuditLogsView';
import { AdministrationView } from './components/views/AdministrationView';
import { SystemHealthView } from './components/views/SystemHealthView';
import { LiraaView } from './components/views/LiraaView';
import { StockView } from './components/views/StockView';
import { VectorControlView } from './components/views/VectorControlView';
import { AgentProductivityView } from './components/views/AgentProductivityView';
import { EntomologyLabView } from './components/views/EntomologyLabView';
import { LabelGeneratorView } from './components/views/LabelGeneratorView';
import { WorkOrdersView } from './components/views/WorkOrdersView';
import { SupervisorMobileView } from './components/views/SupervisorMobileView';
import { DocumentsCenterView } from './components/views/DocumentsCenterView';
import { IntegrationsView } from './components/views/IntegrationsView';
import { CommandCenterView } from './components/views/CommandCenterView';
import { CommunicationAdminView } from './components/views/CommunicationAdminView';
import { TrainingsView } from './components/views/TrainingsView';
import { MultiDiseaseSettingsView } from './components/views/MultiDiseaseSettingsView';
import { PublicPortalView } from './components/public/PublicPortalView';
import { PublicComplaintFormView } from './components/public/PublicComplaintFormView';
import { PublicComplaintTrackingView } from './components/public/PublicComplaintTrackingView';
import { HistoricalAnalysisView } from './components/views/HistoricalAnalysisView';
import { ManagementTargetsView } from './components/views/ManagementTargetsView';
import { DailyBriefingView } from './components/views/DailyBriefingView';

// Rotas públicas que não necessitam de autenticação prévia
const PUBLIC_ROUTES = [
  '/login',
  '/esqueci-senha',
  '/redefinir-senha',
  '/primeiro-acesso',
  '/acesso-negado',
  '/publico',
  '/publico/denuncia',
  '/publico/denuncia/acompanhar'
];

function AppContent() {
  const { user, municipality: authMunicipality, isAuthenticated, isLoading, logout, switchRole, can, hasRole } = useAuth();

  // Roteamento baseado no pathname do navegador
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.pathname || '/login';
  });

  const [currentView, setCurrentView] = useState<ViewModule>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);

  // Navegador interno e sincronização com a History API
  const navigateTo = (route: string) => {
    let target = route;
    if (!target.startsWith('/')) {
      target = `/${target}`;
    }

    window.history.pushState({}, '', target);
    setCurrentPath(target);

    // Mapeamento de rotas compostas
    if (target === '/admin/usuarios') {
      setCurrentView('admin_users');
    } else if (target === '/admin/perfis-permissoes') {
      setCurrentView('admin_roles');
    } else if (target === '/admin/auditoria') {
      setCurrentView('admin_audit');
    } else if (target === '/liraa') {
      setCurrentView('liraa');
    } else if (target === '/estoque') {
      setCurrentView('stock');
    } else if (target === '/controle-vetorial') {
      setCurrentView('vector_control');
    } else if (target === '/produtividade') {
      setCurrentView('productivity');
    } else if (target === '/epidemiologia') {
      setCurrentView('epidemiology');
    } else if (target === '/tv') {
      setCurrentView('tv_mode');
    } else if (target === '/relatorios') {
      setCurrentView('reports');
    } else if (target === '/admin/importacao') {
      setCurrentView('data_import');
    } else if (target === '/admin/configuracoes') {
      setCurrentView('system_settings');
    } else if (target === '/admin/sistema') {
      setCurrentView('system_health');
    } else if (target === '/admin/sistema/erros') {
      setCurrentView('system_errors');
    } else if (target === '/admin/qualidade-dados') {
      setCurrentView('data_quality');
    } else if (target === '/laboratorio-entomologico') {
      setCurrentView('entomology_lab');
    } else if (target === '/admin/etiquetas') {
      setCurrentView('labels');
    } else if (target === '/ordens-servico') {
      setCurrentView('work_orders');
    } else if (target === '/supervisor') {
      setCurrentView('supervisor_mobile');
    } else if (target === '/documentos') {
      setCurrentView('documents');
    } else if (target === '/admin/integracoes') {
      setCurrentView('integrations');
    } else if (target === '/equipamentos') {
      setCurrentView('equipments');
    } else if (target === '/centro-comando') {
      setCurrentView('command_center');
    } else if (target === '/capacitacoes') {
      setCurrentView('trainings');
    } else if (target === '/admin/comunicacao') {
      setCurrentView('communication');
    } else if (target === '/admin/endemias') {
      setCurrentView('multi_disease');
    } else if (target === '/publico') {
      setCurrentView('public_portal');
    } else if (target === '/inteligencia/historico') {
      setCurrentView('historical_analysis');
    } else if (target === '/metas') {
      setCurrentView('management_targets');
    } else if (target === '/briefing') {
      setCurrentView('daily_briefing');
    } else {
      const cleanName = target.replace('/', '');
      if (cleanName && cleanName !== 'login' && !PUBLIC_ROUTES.includes(target)) {
        setCurrentView(cleanName as ViewModule);
      }
    }
  };

  // Escuta de mudanças na navegação nativa (botão voltar/avançar do navegador)
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname || '/login';
      setCurrentPath(path);
      if (path === '/admin/usuarios') {
        setCurrentView('admin_users');
      } else if (path === '/admin/perfis-permissoes') {
        setCurrentView('admin_roles');
      } else if (path === '/admin/auditoria') {
        setCurrentView('admin_audit');
      } else if (path === '/liraa') {
        setCurrentView('liraa');
      } else if (path === '/estoque') {
        setCurrentView('stock');
      } else if (path === '/controle-vetorial') {
        setCurrentView('vector_control');
      } else if (path === '/produtividade') {
        setCurrentView('productivity');
      } else if (path === '/epidemiologia') {
        setCurrentView('epidemiology');
      } else if (path === '/tv') {
        setCurrentView('tv_mode');
      } else if (path === '/relatorios') {
        setCurrentView('reports');
      } else if (path === '/admin/importacao') {
        setCurrentView('data_import');
      } else if (path === '/admin/configuracoes') {
        setCurrentView('system_settings');
      } else if (path === '/admin/sistema') {
        setCurrentView('system_health');
      } else if (path === '/admin/sistema/erros') {
        setCurrentView('system_errors');
      } else if (path === '/admin/qualidade-dados') {
        setCurrentView('data_quality');
      } else if (path === '/laboratorio-entomologico') {
        setCurrentView('entomology_lab');
      } else if (path === '/admin/etiquetas') {
        setCurrentView('labels');
      } else if (path === '/ordens-servico') {
        setCurrentView('work_orders');
      } else if (path === '/supervisor') {
        setCurrentView('supervisor_mobile');
      } else if (path === '/documentos') {
        setCurrentView('documents');
      } else if (path === '/admin/integracoes') {
        setCurrentView('integrations');
      } else if (path === '/equipamentos') {
        setCurrentView('equipments');
      } else if (path === '/centro-comando') {
        setCurrentView('command_center');
      } else if (path === '/capacitacoes') {
        setCurrentView('trainings');
      } else if (path === '/admin/comunicacao') {
        setCurrentView('communication');
      } else if (path === '/admin/endemias') {
        setCurrentView('multi_disease');
      } else if (path === '/publico') {
        setCurrentView('public_portal');
      } else if (path === '/inteligencia/historico') {
        setCurrentView('historical_analysis');
      } else if (path === '/metas') {
        setCurrentView('management_targets');
      } else if (path === '/briefing') {
        setCurrentView('daily_briefing');
      } else {
        const cleanName = path.replace('/', '');
        if (cleanName && cleanName !== 'login' && !PUBLIC_ROUTES.includes(path)) {
          setCurrentView(cleanName as ViewModule);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Monitorar quantidade de visitas offline pendentes
  useEffect(() => {
    try {
      const offlineVisits = JSON.parse(localStorage.getItem('endemias_offline_visits') || '[]');
      setPendingSyncCount(offlineVisits.length);
    } catch {
      setPendingSyncCount(0);
    }
  }, [currentView, currentPath]);

  // Sincronização manual de visitas salvas em offline
  const handleSync = () => {
    const offlineVisits = JSON.parse(localStorage.getItem('endemias_offline_visits') || '[]');
    if (offlineVisits.length > 0) {
      offlineVisits.forEach((v: any) => db.addVisit(v));
      localStorage.setItem('endemias_offline_visits', JSON.stringify([]));
      setPendingSyncCount(0);
      alert(`${offlineVisits.length} visita(s) sincronizada(s) com sucesso com a base municipal!`);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigateTo('/login');
  };

  // 1. Tela de Carregamento Institucional durante checagem de sessão
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-sky-600 flex items-center justify-center shadow-xl shadow-sky-600/30 mb-4 animate-pulse">
          <Shield className="w-8 h-8 text-white" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-bold tracking-tight">Endemias GOV</h2>
          <p className="text-xs text-sky-400 mt-1">Carregando credenciais e configurações municipais...</p>
        </div>
      </div>
    );
  }

  // 2. Proteção de Rotas: Redirecionar para /login caso não esteja autenticado
  if (!isAuthenticated && !PUBLIC_ROUTES.includes(currentPath)) {
    const redirectUrl = currentPath !== '/' ? currentPath : '';
    return <LoginPage onNavigate={navigateTo} redirectTo={redirectUrl} />;
  }

  // 3. Renderização de Rotas Públicas / Específicas
  if (currentPath === '/login') {
    if (isAuthenticated) {
      // Se já autenticado, redireciona para a view principal
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
          <p className="text-sm">Redirecionando para o painel de trabalho...</p>
          {setTimeout(() => navigateTo(currentView), 50)}
        </div>
      );
    }
    return <LoginPage onNavigate={navigateTo} />;
  }

  if (currentPath === '/esqueci-senha') {
    return <ForgotPasswordPage onNavigate={navigateTo} />;
  }

  if (currentPath === '/redefinir-senha') {
    return <ResetPasswordPage onNavigate={navigateTo} />;
  }

  if (currentPath === '/primeiro-acesso') {
    return <FirstAccessPage onNavigate={navigateTo} />;
  }

  if (currentPath === '/acesso-negado') {
    return <AccessDeniedPage onNavigate={navigateTo} />;
  }

  // Rotas Públicas do Cidadão (Sem necessidade de login)
  if (currentPath === '/publico') {
    return (
      <PublicPortalView
        onNavigateToComplaint={() => navigateTo('/publico/denuncia')}
        onNavigateToTracking={() => navigateTo('/publico/denuncia/acompanhar')}
      />
    );
  }

  if (currentPath === '/publico/denuncia') {
    return (
      <PublicComplaintFormView
        onBackToPortal={() => navigateTo('/publico')}
        onNavigateToTracking={() => navigateTo('/publico/denuncia/acompanhar')}
      />
    );
  }

  if (currentPath === '/publico/denuncia/acompanhar') {
    return (
      <PublicComplaintTrackingView
        onBackToPortal={() => navigateTo('/publico')}
        onNavigateToForm={() => navigateTo('/publico/denuncia')}
      />
    );
  }

  // 4. Aplicação Interna Autenticada
  const currentUser: User = user || db.getCurrentUser();
  const municipality = authMunicipality || db.getMunicipality();
  const alerts = db.getAlerts();
  const unreadAlertsCount = alerts.filter((a) => !a.resolved).length;

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView onNavigate={(view) => { setCurrentView(view as ViewModule); navigateTo(view); }} />;
      case 'liraa':
        return <LiraaView />;
      case 'stock':
        return <StockView />;
      case 'vector_control':
        return <VectorControlView />;
      case 'productivity':
        return <AgentProductivityView />;
      case 'ace_pwa':
        return <AcePwaView onNavigate={(view) => { setCurrentView(view as ViewModule); navigateTo(view); }} />;
      case 'routes':
        return <RoutesView onNavigate={(view) => { setCurrentView(view as ViewModule); navigateTo(view); }} />;
      case 'planning':
        return <PlanningView />;
      case 'map':
        return <MapView />;
      case 'admin_users':
        if (!can('users.view')) return <AccessDeniedPage onNavigate={navigateTo} />;
        return <UsersManagementView />;
      case 'admin_roles':
        if (!can('roles.view')) return <AccessDeniedPage onNavigate={navigateTo} />;
        return <RolesPermissionsView />;
      case 'admin_audit':
        if (!can('audit.view')) return <AccessDeniedPage onNavigate={navigateTo} />;
        return <AuditLogsAdminView />;
      case 'audit':
        if (!can('audit.view')) return <AccessDeniedPage onNavigate={navigateTo} />;
        return <AuditLogsAdminView />;
      case 'admin':
        if (!can('settings.view')) return <AccessDeniedPage onNavigate={navigateTo} />;
        return <AdministrationView />;
      case 'properties':
        if (!can('properties.view')) return <AccessDeniedPage onNavigate={navigateTo} />;
        return <PropertiesView />;
      case 'visits':
        if (!can('visits.view')) return <AccessDeniedPage onNavigate={navigateTo} />;
        return <VisitsView />;
      case 'territory':
        if (!can('territory.view')) return <AccessDeniedPage onNavigate={navigateTo} />;
        return <TerritoryView />;
      case 'teams':
        if (!can('teams.view')) return <AccessDeniedPage onNavigate={navigateTo} />;
        return <TeamsView />;
      case 'cycles':
        if (!can('cycles.view')) return <AccessDeniedPage onNavigate={navigateTo} />;
        return <CyclesView />;
      case 'ovitraps':
        if (!can('ovitraps.view')) return <AccessDeniedPage onNavigate={navigateTo} />;
        return <OvitrapsView />;
      case 'strategic_points':
        if (!can('strategic_points.view')) return <AccessDeniedPage onNavigate={navigateTo} />;
        return <StrategicPointsView />;
      case 'special_properties':
        if (!can('special_properties.view')) return <AccessDeniedPage onNavigate={navigateTo} />;
        return <SpecialPropertiesView />;
      case 'complaints':
        if (!can('complaints.view')) return <AccessDeniedPage onNavigate={navigateTo} />;
        return <CitizenPortalView />;
      case 'epidemiology':
        if (!can('epidemiology.view')) return <AccessDeniedPage onNavigate={navigateTo} />;
        return <EpidemiologyView />;
      case 'foci_recurrence':
        if (!can('outbreaks.view')) return <AccessDeniedPage onNavigate={navigateTo} />;
        return <FociAndRecurrenceView />;
      case 'supplies':
        return <SuppliesView />;
      case 'equipments':
        return <EquipmentView />;
      case 'risk_engine':
        if (!can('risk_engine.view')) return <AccessDeniedPage onNavigate={navigateTo} />;
        return <RiskEngineView />;
      case 'executive':
        if (!can('reports.view')) return <AccessDeniedPage onNavigate={navigateTo} />;
        return <ExecutiveDashboardView />;
      case 'tv_mode':
        return <OperationsRoomView />;
      case 'alerts':
        return <AlertsView />;
      case 'ai_assistant':
        if (!can('ai_assistant.use')) return <AccessDeniedPage onNavigate={navigateTo} />;
        return <AiAssistantView />;
      case 'transparency':
        return <TransparencyPortalView />;
      case 'referrals':
        return <ReferralsView />;
      case 'reports':
        if (!can('reports.view')) return <AccessDeniedPage onNavigate={navigateTo} />;
        return <ReportsView />;
      case 'system_health':
        return <SystemHealthView />;
      case 'data_import':
        if (!can('settings.manage')) return <AccessDeniedPage onNavigate={navigateTo} />;
        return <DataImportView />;
      case 'data_quality':
        return <DataQualityView />;
      case 'system_settings':
        if (!can('settings.manage')) return <AccessDeniedPage onNavigate={navigateTo} />;
        return <SystemSettingsView />;
      case 'system_errors':
        if (!hasRole('SUPER_ADMIN')) return <AccessDeniedPage onNavigate={navigateTo} />;
        return <ErrorLogsView />;
      case 'entomology_lab':
        return <EntomologyLabView municipalityId={municipality?.id} />;
      case 'labels':
        return <LabelGeneratorView municipalityId={municipality?.id} />;
      case 'work_orders':
        return <WorkOrdersView municipalityId={municipality?.id} />;
      case 'supervisor_mobile':
        return <SupervisorMobileView municipalityId={municipality?.id} />;
      case 'documents':
        return <DocumentsCenterView municipalityId={municipality?.id} />;
      case 'integrations':
        if (!can('settings.manage')) return <AccessDeniedPage onNavigate={navigateTo} />;
        return <IntegrationsView municipalityId={municipality?.id} />;
      case 'command_center':
        if (!can('dashboard.view')) return <AccessDeniedPage onNavigate={navigateTo} />;
        return <CommandCenterView />;
      case 'trainings':
        if (!can('teams.view')) return <AccessDeniedPage onNavigate={navigateTo} />;
        return <TrainingsView />;
      case 'communication':
        if (!can('settings.manage')) return <AccessDeniedPage onNavigate={navigateTo} />;
        return <CommunicationAdminView />;
      case 'multi_disease':
        if (!can('settings.manage')) return <AccessDeniedPage onNavigate={navigateTo} />;
        return <MultiDiseaseSettingsView />;
      case 'public_portal':
        return (
          <PublicPortalView
            onNavigateToComplaint={() => navigateTo('/publico/denuncia')}
            onNavigateToTracking={() => navigateTo('/publico/denuncia/acompanhar')}
          />
        );
      case 'daily_briefing':
        return <DailyBriefingView />;
      case 'historical_analysis':
        if (!can('dashboard.view')) return <AccessDeniedPage onNavigate={navigateTo} />;
        return <HistoricalAnalysisView />;
      case 'management_targets':
        if (!can('reports.view')) return <AccessDeniedPage onNavigate={navigateTo} />;
        return <ManagementTargetsView />;
      default:
        return <DashboardView onNavigate={(view) => { setCurrentView(view as ViewModule); navigateTo(view); }} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800 antialiased selection:bg-blue-600 selection:text-white">
      {/* Top Main Navigation Header */}
      <Header
        currentUser={currentUser}
        onSwitchRole={switchRole}
        pendingSyncCount={pendingSyncCount}
        onSync={handleSync}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        unreadAlertsCount={unreadAlertsCount}
        onOpenAlerts={() => {
          setCurrentView('alerts');
          navigateTo('alerts');
        }}
        onOpenTvMode={() => {
          setCurrentView('tv_mode');
          navigateTo('tv_mode');
        }}
        municipalityName={municipality.name}
        onLogout={handleLogout}
        onNavigate={navigateTo}
      />

      {/* Body Layout: Sidebar + Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <Sidebar
          currentView={currentView}
          onSelectView={(v) => {
            setCurrentView(v);
            navigateTo(v);
            setSidebarOpen(false);
          }}
          userRole={currentUser.role}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          pendingSyncCount={pendingSyncCount}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">{renderView()}</div>
        </main>
      </div>
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
