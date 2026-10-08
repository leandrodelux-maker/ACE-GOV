import React, { lazy, Suspense, useEffect, useState } from 'react';
import { BarChart3, CalendarRange, FileText, Package, PawPrint, Search, Syringe } from 'lucide-react';
import { TabSwitcher } from '../ui';
import { useHubTab } from '../../hooks/useHubTab';
import { useAuth } from '../../contexts/AuthContext';
import { CAMPAIGN_STATUS_LABELS, Campaign } from '../../services/zoonoses/zoonosesService';
import { SelectInput } from '../ui/ModuleKit';

const ZooDashboardView = lazy(() => import('./ZooDashboardView').then((m) => ({ default: m.ZooDashboardView })));
const ZooCampaignsView = lazy(() => import('./ZooCampaignsView').then((m) => ({ default: m.ZooCampaignsView })));
const ZooVaccinationView = lazy(() => import('./ZooVaccinationView').then((m) => ({ default: m.ZooVaccinationView })));
const ZooAnimalsView = lazy(() => import('./ZooAnimalsView').then((m) => ({ default: m.ZooAnimalsView })));
const ZooStockView = lazy(() => import('./ZooStockView').then((m) => ({ default: m.ZooStockView })));
const ZooActiveSearchView = lazy(() => import('./ZooActiveSearchView').then((m) => ({ default: m.ZooActiveSearchView })));
const ZooReportsView = lazy(() => import('./ZooReportsView').then((m) => ({ default: m.ZooReportsView })));

export type ZoonosesTab = 'painel' | 'campanhas' | 'vacinacao' | 'animais' | 'estoque' | 'busca' | 'relatorios';

/** Zoonoses — Vacinação antirrábica animal (cães e gatos). */
export const ZoonosesHubView: React.FC<{ initialTab?: ZoonosesTab; onTabChange?: (tab: ZoonosesTab) => void }> = ({ initialTab = 'painel', onTabChange }) => {
  const [activeTab, setActiveTab] = useHubTab<ZoonosesTab>(initialTab, onTabChange);
  const { can } = useAuth();
  const tabs = [
    { id: 'painel', label: 'Painel', icon: BarChart3, show: can('antirrabica.view') },
    { id: 'vacinacao', label: 'Registrar vacinação', icon: Syringe, show: can('antirrabica.vacinar') },
    { id: 'campanhas', label: 'Campanhas', icon: CalendarRange, show: can('antirrabica.view') },
    { id: 'animais', label: 'Animais e tutores', icon: PawPrint, show: can('antirrabica.view') },
    { id: 'estoque', label: 'Estoque de vacinas', icon: Package, show: can('antirrabica.view') },
    { id: 'busca', label: 'Busca ativa', icon: Search, show: can('antirrabica.busca_ativa') },
    { id: 'relatorios', label: 'Relatórios', icon: FileText, show: can('antirrabica.view') },
  ].filter((t) => t.show);
  return (
    <div className="space-y-4">
      <TabSwitcher activeTab={activeTab} onChange={(id) => setActiveTab(id as ZoonosesTab)} tabs={tabs} />
      <Suspense fallback={<p className="text-xs text-slate-500" role="status">Carregando…</p>}>
        {activeTab === 'painel' && <ZooDashboardView />}
        {activeTab === 'campanhas' && <ZooCampaignsView />}
        {activeTab === 'vacinacao' && <ZooVaccinationView />}
        {activeTab === 'animais' && <ZooAnimalsView />}
        {activeTab === 'estoque' && <ZooStockView />}
        {activeTab === 'busca' && <ZooActiveSearchView />}
        {activeTab === 'relatorios' && <ZooReportsView />}
      </Suspense>
    </div>
  );
};

const CAMPAIGN_KEY = 'endemias_zoo_campanha_sel';

/** Campanha selecionada (lembrada no aparelho). `allowRoutine` inclui a opção "rotina / todas". */
export function useSelectedCampaign(campaigns: Campaign[] | null, allowAll = false): [string, (id: string) => void] {
  const [value, setValue] = useState<string>(() => {
    try {
      return localStorage.getItem(CAMPAIGN_KEY) || '';
    } catch {
      return '';
    }
  });
  useEffect(() => {
    if (!campaigns) return;
    if (value && (campaigns.some((c) => c.id === value) || (allowAll && value === 'todas'))) return;
    const fallback = campaigns.find((c) => c.status === 'em_andamento') || campaigns[0];
    setValue(fallback?.id || (allowAll ? 'todas' : ''));
  }, [campaigns, value, allowAll]);
  const choose = (id: string) => {
    setValue(id);
    try {
      localStorage.setItem(CAMPAIGN_KEY, id);
    } catch {
      /* conveniência */
    }
  };
  return [value, choose];
}

export const CampaignPicker: React.FC<{ campaigns: Campaign[]; value: string; onChange: (id: string) => void; allowAll?: boolean; label?: string }> = ({
  campaigns, value, onChange, allowAll, label = 'Campanha',
}) => (
  <label className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-md">
    <span className="text-xs font-semibold text-slate-700">{label}</span>
    <SelectInput value={value} onChange={(e) => onChange(e.target.value)}>
      {allowAll && <option value="todas">Todas as campanhas e rotina</option>}
      {campaigns.map((c) => (
        <option key={c.id} value={c.id}>{c.name} ({c.year}) — {CAMPAIGN_STATUS_LABELS[c.status]}</option>
      ))}
    </SelectInput>
  </label>
);
