import React from 'react';
import { Target, Flame } from 'lucide-react';
import { TabSwitcher } from '../ui';
import { useHubTab } from '../../hooks/useHubTab';
import { VectorControlView } from './VectorControlView';
import { ChemicalOperationsView } from './ChemicalOperationsView';

export type VectorControlTab = 'operacoes' | 'quimicas';

interface VectorControlHubViewProps {
  initialTab?: VectorControlTab;
  onTabChange?: (tab: VectorControlTab) => void;
}

/**
 * Hub de Controle Vetorial — as operações químicas/UBV são uma modalidade do
 * controle vetorial; as duas telas passam a viver num único item de menu.
 */
export const VectorControlHubView: React.FC<VectorControlHubViewProps> = ({ initialTab = 'operacoes', onTabChange }) => {
  const [activeTab, setActiveTab] = useHubTab<VectorControlTab>(initialTab as VectorControlTab, onTabChange);

  return (
    <div className="space-y-4">
      <TabSwitcher
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as VectorControlTab)}
        tabs={[
          { id: 'operacoes', label: 'Controle Vetorial', icon: Target },
          { id: 'quimicas', label: 'Operações Químicas & UBV', icon: Flame },
        ]}
      />
      {activeTab === 'operacoes' ? <VectorControlView /> : <ChemicalOperationsView />}
    </div>
  );
};
