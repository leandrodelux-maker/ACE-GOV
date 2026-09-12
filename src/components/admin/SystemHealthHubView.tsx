import React, { useMemo, useState } from 'react';
import { HeartPulse, Database, AlertTriangle, ShieldCheck } from 'lucide-react';
import { TabSwitcher, TabSwitcherItem } from '../ui';
import { useAuth } from '../../contexts/AuthContext';
import { SystemHealthView } from '../views/SystemHealthView';
import { DatabaseHealthView } from './DatabaseHealthView';
import { ErrorLogsView } from './ErrorLogsView';
import { DataQualityView } from './DataQualityView';

export type SystemHealthHubTab = 'saude' | 'integridade' | 'qualidade' | 'erros';

interface SystemHealthHubViewProps {
  initialTab?: SystemHealthHubTab;
}

/**
 * Hub de Saúde do Sistema — une as 4 telas que monitoravam a saúde técnica da
 * plataforma em recortes separados (infraestrutura, integridade de dados,
 * qualidade de dados, logs de erro). Cada aba mantém a mesma checagem de
 * papel que tinha como rota própria — a fusão não afrouxa nenhuma restrição.
 */
export const SystemHealthHubView: React.FC<SystemHealthHubViewProps> = ({ initialTab = 'saude' }) => {
  const { hasRole } = useAuth();
  const canSeeIntegrity = hasRole('SUPER_ADMIN') || hasRole('MUNICIPAL_ADMIN');
  const canSeeErrors = hasRole('SUPER_ADMIN');

  const [activeTab, setActiveTab] = useState<SystemHealthHubTab>(
    (initialTab === 'integridade' && !canSeeIntegrity) || (initialTab === 'erros' && !canSeeErrors)
      ? 'saude'
      : initialTab
  );

  const tabs: TabSwitcherItem[] = useMemo(() => {
    const base: TabSwitcherItem[] = [
      { id: 'saude', label: 'Saúde da Infraestrutura', icon: HeartPulse },
      { id: 'qualidade', label: 'Qualidade dos Dados', icon: ShieldCheck },
    ];
    if (canSeeIntegrity) base.push({ id: 'integridade', label: 'Integridade do Sistema', icon: Database, badge: 'Banco' });
    if (canSeeErrors) base.push({ id: 'erros', label: 'Logs de Erros', icon: AlertTriangle });
    return base;
  }, [canSeeIntegrity, canSeeErrors]);

  return (
    <div className="space-y-4">
      <TabSwitcher tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as SystemHealthHubTab)} />
      {activeTab === 'saude' && <SystemHealthView />}
      {activeTab === 'qualidade' && <DataQualityView />}
      {activeTab === 'integridade' && canSeeIntegrity && <DatabaseHealthView />}
      {activeTab === 'erros' && canSeeErrors && <ErrorLogsView />}
    </div>
  );
};
