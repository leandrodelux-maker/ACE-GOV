import React, { useMemo } from 'react';
import { HeartPulse, Database, AlertTriangle, ShieldCheck } from 'lucide-react';
import { TabSwitcher, TabSwitcherItem } from '../ui';
import { useAuth } from '../../contexts/AuthContext';
import { useHubTab } from '../../hooks/useHubTab';
import { accessibleTabs } from '../../config/routes';
import { SystemHealthView } from '../views/SystemHealthView';
import { DatabaseHealthView } from './DatabaseHealthView';
import { ErrorLogsView } from './ErrorLogsView';
import { DataQualityView } from './DataQualityView';

export type SystemHealthHubTab = 'saude' | 'integridade' | 'qualidade' | 'erros';

interface SystemHealthHubViewProps {
  initialTab?: SystemHealthHubTab;
  onTabChange?: (tab: SystemHealthHubTab) => void;
}

const TAB_DEFS: Record<SystemHealthHubTab, TabSwitcherItem> = {
  saude: { id: 'saude', label: 'Saúde da Infraestrutura', icon: HeartPulse },
  qualidade: { id: 'qualidade', label: 'Qualidade dos Dados', icon: ShieldCheck },
  integridade: { id: 'integridade', label: 'Integridade do Sistema', icon: Database, badge: 'Banco' },
  erros: { id: 'erros', label: 'Logs de Erros', icon: AlertTriangle },
};

/**
 * Hub de Saúde do Sistema — une as 4 telas que monitoravam a saúde técnica da
 * plataforma. Cada aba usa a mesma regra de acesso da sua rota (config/routes),
 * então a fusão não afrouxa nenhuma restrição.
 */
export const SystemHealthHubView: React.FC<SystemHealthHubViewProps> = ({ initialTab = 'saude', onTabChange }) => {
  const { can, hasRole } = useAuth();
  const allowed = useMemo(() => accessibleTabs('systemHealth', { can, hasRole }), [can, hasRole]);
  const [activeTab, setActiveTab] = useHubTab<SystemHealthHubTab>(initialTab as SystemHealthHubTab, onTabChange);

  const tabs = (['saude', 'qualidade', 'integridade', 'erros'] as SystemHealthHubTab[])
    .filter((t) => allowed.includes(t))
    .map((t) => TAB_DEFS[t]);

  const isAllowed = (t: SystemHealthHubTab) => allowed.includes(t);

  return (
    <div className="space-y-4">
      <TabSwitcher tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as SystemHealthHubTab)} />
      {activeTab === 'saude' && isAllowed('saude') && <SystemHealthView />}
      {activeTab === 'qualidade' && isAllowed('qualidade') && <DataQualityView />}
      {activeTab === 'integridade' && isAllowed('integridade') && <DatabaseHealthView />}
      {activeTab === 'erros' && isAllowed('erros') && <ErrorLogsView />}
    </div>
  );
};
