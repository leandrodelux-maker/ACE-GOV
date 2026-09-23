import React from 'react';
import { Boxes, Package } from 'lucide-react';
import { TabSwitcher } from '../ui';
import { useHubTab } from '../../hooks/useHubTab';
import { StockView } from './StockView';
import { SuppliesView } from './SuppliesView';

export type StockSuppliesTab = 'estoque' | 'quimicos';

interface StockSuppliesHubViewProps {
  initialTab?: StockSuppliesTab;
  onTabChange?: (tab: StockSuppliesTab) => void;
}

/**
 * Hub de Estoque & Insumos — une StockView (estoque geral, critério FEFO) e
 * SuppliesView (insumos químicos, larvicidas e EPIs), que cobriam o mesmo
 * processo de controle de lote/validade/distribuição em duas páginas separadas.
 */
export const StockSuppliesHubView: React.FC<StockSuppliesHubViewProps> = ({ initialTab = 'estoque', onTabChange }) => {
  const [activeTab, setActiveTab] = useHubTab<StockSuppliesTab>(initialTab as StockSuppliesTab, onTabChange);

  return (
    <div className="space-y-4">
      <TabSwitcher
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as StockSuppliesTab)}
        tabs={[
          { id: 'estoque', label: 'Estoque Geral (FEFO)', icon: Boxes },
          { id: 'quimicos', label: 'Insumos Químicos & EPIs', icon: Package },
        ]}
      />
      {activeTab === 'estoque' ? <StockView /> : <SuppliesView />}
    </div>
  );
};
