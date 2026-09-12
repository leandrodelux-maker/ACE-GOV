import React, { useState } from 'react';
import { Users, TrendingUp } from 'lucide-react';
import { TabSwitcher } from '../ui';
import { TeamsView } from './TeamsView';
import { AgentProductivityView } from './AgentProductivityView';

export type TeamsProductivityTab = 'equipes' | 'produtividade';

interface TeamsProductivityHubViewProps {
  initialTab?: TeamsProductivityTab;
}

/**
 * Hub de Equipes & Produtividade — roster de equipe e desempenho do ACE são a
 * mesma unidade de análise; unificar evita alternar de tela para ver quem está
 * sobrecarregado e o quanto produziu.
 */
export const TeamsProductivityHubView: React.FC<TeamsProductivityHubViewProps> = ({ initialTab = 'equipes' }) => {
  const [activeTab, setActiveTab] = useState<TeamsProductivityTab>(initialTab);

  return (
    <div className="space-y-4">
      <TabSwitcher
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as TeamsProductivityTab)}
        tabs={[
          { id: 'equipes', label: 'Equipes & Carga ACE', icon: Users },
          { id: 'produtividade', label: 'Produtividade ACE', icon: TrendingUp },
        ]}
      />
      {activeTab === 'equipes' ? <TeamsView /> : <AgentProductivityView />}
    </div>
  );
};
