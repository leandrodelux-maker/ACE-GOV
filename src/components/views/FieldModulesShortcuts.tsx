import React, { useEffect, useState } from 'react';
import { Bug, Syringe } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { OFFLINE_QUEUE_EVENT } from '../../services/offlineVisitQueue';
import { readModuleQueue } from '../../services/offlineQueue';

/**
 * Atalhos do PWA do ACE para a coleta LIRAa/LIA e a vacinação antirrábica, com o
 * número de registros guardados no aparelho aguardando envio.
 */
export const FieldModulesShortcuts: React.FC<{ onNavigate: (target: string) => void }> = ({ onNavigate }) => {
  const { can } = useAuth();
  const read = () => ({ liraa: readModuleQueue('liraa_inspection').length, vacc: readModuleQueue('vaccination').length + readModuleQueue('search_attempt').length });
  const [pending, setPending] = useState(read);
  useEffect(() => {
    const update = () => setPending(read());
    window.addEventListener(OFFLINE_QUEUE_EVENT, update);
    return () => window.removeEventListener(OFFLINE_QUEUE_EVENT, update);
  }, []);
  const items = [
    can('liraa.coletar') && { target: 'liraa_field', label: 'Coleta LIRAa/LIA', icon: Bug, pending: pending.liraa },
    can('antirrabica.vacinar') && { target: 'zoo_vaccination', label: 'Vacinação antirrábica', icon: Syringe, pending: pending.vacc },
  ].filter(Boolean) as { target: string; label: string; icon: React.ElementType; pending: number }[];
  if (!items.length) return null;
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map(({ target, label, icon: Icon, pending: n }) => (
        <button key={target} type="button" onClick={() => onNavigate(target)}
          className="flex min-h-14 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50">
          <Icon className="h-5 w-5 shrink-0 text-teal-700" aria-hidden="true" />
          <span className="min-w-0 flex-1">{label}{n > 0 && <span className="block text-[11px] font-medium text-amber-700">{n} aguardando envio</span>}</span>
        </button>
      ))}
    </div>
  );
};
