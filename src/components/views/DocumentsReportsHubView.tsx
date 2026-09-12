import React, { useState } from 'react';
import { FileText, ClipboardList } from 'lucide-react';
import { TabSwitcher } from '../ui';
import { DocumentsCenterView } from './DocumentsCenterView';
import { ReportsView } from './ReportsView';

export type DocumentsReportsTab = 'relatorios' | 'documentos';

interface DocumentsReportsHubViewProps {
  initialTab?: DocumentsReportsTab;
  municipalityId?: string;
}

/**
 * Hub de Documentos & Relatórios — um relatório exportado normalmente vira um
 * documento arquivado; as duas "centrais" de conteúdo gerado passam a viver
 * num único item de menu com abas "Gerar" / "Arquivo".
 */
export const DocumentsReportsHubView: React.FC<DocumentsReportsHubViewProps> = ({ initialTab = 'relatorios', municipalityId }) => {
  const [activeTab, setActiveTab] = useState<DocumentsReportsTab>(initialTab);

  return (
    <div className="space-y-4">
      <TabSwitcher
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as DocumentsReportsTab)}
        tabs={[
          { id: 'relatorios', label: 'Central de Relatórios', icon: ClipboardList },
          { id: 'documentos', label: 'Central de Documentos', icon: FileText },
        ]}
      />
      {activeTab === 'relatorios' ? <ReportsView /> : <DocumentsCenterView municipalityId={municipalityId} />}
    </div>
  );
};
