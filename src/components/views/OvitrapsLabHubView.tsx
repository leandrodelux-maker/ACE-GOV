import React, { useState } from 'react';
import { Layers, FlaskConical } from 'lucide-react';
import { TabSwitcher } from '../ui';
import { OvitrapsView } from './OvitrapsView';
import { EntomologyLabView } from './EntomologyLabView';

export type OvitrapsLabTab = 'ovos' | 'laboratorio';

interface OvitrapsLabHubViewProps {
  initialTab?: OvitrapsLabTab;
  onNavigate: (view: string) => void;
  municipalityId?: string;
}

/**
 * Hub de Vigilância Entomológica — o Laboratório processa exatamente o
 * material coletado nas Ovitrampas (identificação de ovos/larvas), então as
 * duas telas passam a viver num único item de menu.
 */
export const OvitrapsLabHubView: React.FC<OvitrapsLabHubViewProps> = ({ initialTab = 'ovos', onNavigate, municipalityId }) => {
  const [activeTab, setActiveTab] = useState<OvitrapsLabTab>(initialTab);

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
