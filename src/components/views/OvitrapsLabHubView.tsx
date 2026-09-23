import React from 'react';
import { Layers, FlaskConical } from 'lucide-react';
import { TabSwitcher } from '../ui';
import { useHubTab } from '../../hooks/useHubTab';
import { OvitrapsView } from './OvitrapsView';
import { EntomologyLabView } from './EntomologyLabView';

export type OvitrapsLabTab = 'ovos' | 'laboratorio';

interface OvitrapsLabHubViewProps {
  initialTab?: OvitrapsLabTab;
  onTabChange?: (tab: OvitrapsLabTab) => void;
  onNavigate: (view: string) => void;
  municipalityId: string;
}

/**
 * Hub de Vigilância Entomológica — o Laboratório processa exatamente o
 * material coletado nas Ovitrampas (identificação de ovos/larvas), então as
 * duas telas passam a viver num único item de menu.
 */
export const OvitrapsLabHubView: React.FC<OvitrapsLabHubViewProps> = ({ initialTab = 'ovos', onTabChange, onNavigate, municipalityId }) => {
  const [activeTab, setActiveTab] = useHubTab<OvitrapsLabTab>(initialTab as OvitrapsLabTab, onTabChange);

  return (
    <div className="space-y-4">
      <TabSwitcher
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as OvitrapsLabTab)}
        tabs={[
          { id: 'ovos', label: 'Ovitrampas (Ovos)', icon: Layers, badge: 'Sentinela' },
          { id: 'laboratorio', label: 'Laboratório Entomológico', icon: FlaskConical },
        ]}
      />
      {activeTab === 'ovos' ? <OvitrapsView onNavigate={onNavigate} /> : <EntomologyLabView municipalityId={municipalityId} />}
    </div>
  );
};
