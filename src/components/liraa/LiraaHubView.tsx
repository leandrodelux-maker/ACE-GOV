import React, { lazy, Suspense } from 'react';
import { BarChart3, ClipboardList, FlaskConical, FileText, Smartphone } from 'lucide-react';
import { TabSwitcher } from '../ui';
import { useHubTab } from '../../hooks/useHubTab';
import { useAuth } from '../../contexts/AuthContext';

const LiraaDashboardView = lazy(() => import('./LiraaDashboardView').then((m) => ({ default: m.LiraaDashboardView })));
const LiraaSurveysView = lazy(() => import('./LiraaSurveysView').then((m) => ({ default: m.LiraaSurveysView })));
const LiraaFieldView = lazy(() => import('./LiraaFieldView').then((m) => ({ default: m.LiraaFieldView })));
const LiraaLabView = lazy(() => import('./LiraaLabView').then((m) => ({ default: m.LiraaLabView })));
const LiraaReportsView = lazy(() => import('./LiraaReportsView').then((m) => ({ default: m.LiraaReportsView })));

export type LiraaTab = 'painel' | 'levantamentos' | 'campo' | 'laboratorio' | 'relatorios';

/**
 * Vigilância Entomológica — LIRAa/LIA: planejamento, amostragem auditável,
 * coleta de campo (offline), laboratório, indicadores e relatórios.
 */
export const LiraaHubView: React.FC<{ initialTab?: LiraaTab; onTabChange?: (tab: LiraaTab) => void }> = ({ initialTab = 'painel', onTabChange }) => {
  const [activeTab, setActiveTab] = useHubTab<LiraaTab>(initialTab, onTabChange);
  const { can } = useAuth();
  const tabs = [
    { id: 'painel', label: 'Painel', icon: BarChart3, show: can('liraa.view') },
    { id: 'levantamentos', label: 'Levantamentos', icon: ClipboardList, show: can('liraa.view') },
    { id: 'campo', label: 'Coleta de campo', icon: Smartphone, show: can('liraa.coletar') },
    { id: 'laboratorio', label: 'Laboratório', icon: FlaskConical, show: can('liraa.laboratorio') },
    { id: 'relatorios', label: 'Relatórios', icon: FileText, show: can('liraa.view') },
  ].filter((t) => t.show);

  return (
    <div className="space-y-4">
      <TabSwitcher activeTab={activeTab} onChange={(id) => setActiveTab(id as LiraaTab)} tabs={tabs} />
      <Suspense fallback={<p className="text-xs text-slate-500" role="status">Carregando…</p>}>
        {activeTab === 'painel' && <LiraaDashboardView />}
        {activeTab === 'levantamentos' && <LiraaSurveysView />}
        {activeTab === 'campo' && <LiraaFieldView />}
        {activeTab === 'laboratorio' && <LiraaLabView />}
        {activeTab === 'relatorios' && <LiraaReportsView />}
      </Suspense>
    </div>
  );
};
