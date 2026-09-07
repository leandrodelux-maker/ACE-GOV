import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar, ViewModule } from './components/Sidebar';
import { db } from './services/storage';
import { User, UserRole } from './types';

// Views
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

export default function App() {
  const [currentView, setCurrentView] = useState<ViewModule>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User>(db.getCurrentUser());
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);

  const municipality = db.getMunicipality();
  const alerts = db.getAlerts();
  const unreadAlertsCount = alerts.filter(a => !a.resolved).length;

  useEffect(() => {
    // Check pending offline visits
    const offlineVisits = JSON.parse(localStorage.getItem('endemias_offline_visits') || '[]');
    setPendingSyncCount(offlineVisits.length);
  }, [currentView]);

  const handleSwitchRole = (newRole: UserRole) => {
    const updatedUser: User = { ...currentUser, role: newRole };
    setCurrentUser(updatedUser);
    localStorage.setItem('endemias_current_user', JSON.stringify(updatedUser));
  };

  const handleSync = () => {
    const offlineVisits = JSON.parse(localStorage.getItem('endemias_offline_visits') || '[]');
    if (offlineVisits.length > 0) {
      offlineVisits.forEach((v: any) => db.addVisit(v));
      localStorage.setItem('endemias_offline_visits', JSON.stringify([]));
      setPendingSyncCount(0);
      alert(`${offlineVisits.length} visita(s) sincronizada(s) com sucesso com a base municipal!`);
    }
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView onNavigate={(view) => setCurrentView(view as ViewModule)} />;
      case 'ace_pwa':
        return <AcePwaView />;
      case 'routes':
        return <RoutesView />;
      case 'visits':
        return <VisitsView />;
      case 'planning':
        return <PlanningView />;
      case 'map':
        return <MapView />;
      case 'territory':
        return <TerritoryView />;
      case 'properties':
        return <PropertiesView />;
      case 'ovitraps':
        return <OvitrapsView />;
      case 'strategic_points':
        return <StrategicPointsView />;
      case 'special_properties':
        return <SpecialPropertiesView />;
      case 'foci_recurrence':
        return <FociAndRecurrenceView />;
      case 'epidemiology':
        return <EpidemiologyView />;
      case 'complaints':
        return <CitizenPortalView />;
      case 'teams':
        return <TeamsView />;
      case 'supplies':
        return <SuppliesView />;
      case 'equipments':
        return <EquipmentView />;
      case 'risk_engine':
        return <RiskEngineView />;
      case 'executive':
        return <ExecutiveDashboardView />;
      case 'tv_mode':
        return <OperationsRoomView />;
      case 'alerts':
        return <AlertsView />;
      case 'reports':
        return <ReportsView />;
      case 'cycles':
        return <CyclesView />;
      case 'ai_assistant':
        return <AiAssistantView />;
      case 'transparency':
        return <TransparencyPortalView />;
      case 'referrals':
        return <ReferralsView />;
      case 'audit':
        return <AuditLogsView />;
      case 'admin':
        return <AdministrationView />;
      case 'system_health':
        return <SystemHealthView />;
      default:
        return <DashboardView onNavigate={(view) => setCurrentView(view as ViewModule)} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800 antialiased selection:bg-blue-600 selection:text-white">
      {/* Top Main Navigation Header */}
      <Header
        currentUser={currentUser}
        onSwitchRole={handleSwitchRole}
        pendingSyncCount={pendingSyncCount}
        onSync={handleSync}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        unreadAlertsCount={unreadAlertsCount}
        onOpenAlerts={() => setCurrentView('alerts')}
        onOpenTvMode={() => setCurrentView('tv_mode')}
        municipalityName={municipality.name}
      />

      {/* Body Layout: Sidebar + Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <Sidebar
          currentView={currentView}
          onSelectView={(v) => {
            setCurrentView(v);
            setSidebarOpen(false);
          }}
          userRole={currentUser.role}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          pendingSyncCount={pendingSyncCount}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {renderView()}
          </div>
        </main>
      </div>
    </div>
  );
}
