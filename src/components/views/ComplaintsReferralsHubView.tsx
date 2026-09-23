import React from 'react';
import { AlertCircle, Send } from 'lucide-react';
import { TabSwitcher } from '../ui';
import { useHubTab } from '../../hooks/useHubTab';
import { CitizenPortalView } from './CitizenPortalView';
import { ReferralsView } from './ReferralsView';

export type ComplaintsReferralsTab = 'denuncias' | 'encaminhamentos';

interface ComplaintsReferralsHubViewProps {
  initialTab?: ComplaintsReferralsTab;
  onTabChange?: (tab: ComplaintsReferralsTab) => void;
}

/**
 * Hub de Denúncias & Encaminhamentos — Encaminhamentos é a etapa seguinte do
 * mesmo fluxo de triagem de uma denúncia, então as duas telas passam a viver
 * num único item de menu.
 */
export const ComplaintsReferralsHubView: React.FC<ComplaintsReferralsHubViewProps> = ({ initialTab = 'denuncias', onTabChange }) => {
  const [activeTab, setActiveTab] = useHubTab<ComplaintsReferralsTab>(initialTab as ComplaintsReferralsTab, onTabChange);

  return (
    <div className="space-y-4">
      <TabSwitcher
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as ComplaintsReferralsTab)}
        tabs={[
          { id: 'denuncias', label: 'Portal de Denúncias', icon: AlertCircle },
          { id: 'encaminhamentos', label: 'Encaminhamentos', icon: Send },
        ]}
      />
      {activeTab === 'denuncias' ? <CitizenPortalView /> : <ReferralsView />}
    </div>
  );
};
