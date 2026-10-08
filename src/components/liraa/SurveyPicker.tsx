import React, { useEffect, useState } from 'react';
import { LiraaSurvey, STATUS_LABELS, SurveyStatus } from '../../services/liraa/liraaModuleService';
import { SelectInput, StatusPill, Tone } from '../ui/ModuleKit';

const SELECTED_KEY = 'endemias_liraa_levantamento_sel';

export const STATUS_TONE: Record<SurveyStatus, Tone> = {
  planejamento: 'info',
  execucao: 'warning',
  conferencia: 'warning',
  encerrado: 'success',
  cancelado: 'neutral',
};

export const SurveyStatusPill: React.FC<{ status: SurveyStatus }> = ({ status }) => (
  <StatusPill tone={STATUS_TONE[status]}>{STATUS_LABELS[status]}</StatusPill>
);

/** Levantamento selecionado, lembrado no aparelho entre as abas do módulo. */
export function useSelectedSurvey(surveys: LiraaSurvey[] | null, prefer?: (s: LiraaSurvey) => boolean): [string | null, (id: string) => void] {
  const [selected, setSelected] = useState<string | null>(() => {
    try {
      return localStorage.getItem(SELECTED_KEY);
    } catch {
      return null;
    }
  });
  useEffect(() => {
    if (!surveys) return;
    if (selected && surveys.some((s) => s.id === selected)) return;
    const fallback = (prefer && surveys.find(prefer)) || surveys.find((s) => s.status !== 'cancelado') || surveys[0];
    setSelected(fallback?.id ?? null);
  }, [surveys, selected, prefer]);
  const choose = (id: string) => {
    setSelected(id);
    try {
      localStorage.setItem(SELECTED_KEY, id);
    } catch {
      /* conveniência */
    }
  };
  return [selected, choose];
}

export const SurveyPicker: React.FC<{ surveys: LiraaSurvey[]; value: string | null; onChange: (id: string) => void }> = ({ surveys, value, onChange }) => (
  <label className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-md">
    <span className="text-xs font-semibold text-slate-700">Levantamento</span>
    <SelectInput value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      {surveys.map((s) => (
        <option key={s.id} value={s.id}>
          {s.type} {s.cycle_number}/{s.year} — {s.name} ({STATUS_LABELS[s.status]})
        </option>
      ))}
    </SelectInput>
  </label>
);
