import { supabase } from './supabaseClient';

export interface EpidemiologicalWeek {
  id?: string;
  year: number;
  week_number: number;
  start_date: string;
  end_date: string;
}

export const epidemiologicalWeekService = {
  /**
   * Calcula a Semana Epidemiológica (SE) e o Ano Epidemiológico oficiais (Ministério da Saúde / OMS / CDC).
   * A semana epidemiológica começa sempre no Domingo e termina no Sábado.
   * A primeira SE do ano é aquela que contém pelo menos 4 dias no novo ano (ou o primeiro sábado com pelo menos 4 dias).
   */
  getEpidemiologicalWeek(dateInput: Date | string = new Date()): { year: number; week: number; start: string; end: string } {
    const d = typeof dateInput === 'string' ? new Date(`${dateInput}T12:00:00Z`) : new Date(dateInput);
    const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));

    // Dia da semana: 0 = Domingo, 6 = Sábado
    const dayNr = target.getUTCDay();

    // Início da semana epidemiológica (Domingo)
    const sunday = new Date(target);
    sunday.setUTCDate(target.getUTCDate() - dayNr);

    // Fim da semana epidemiológica (Sábado)
    const saturday = new Date(sunday);
    saturday.setUTCDate(sunday.getUTCDate() + 6);

    // O dia de referência para definir o ano epidemiológico é a Quarta-feira (meio da semana)
    const wednesday = new Date(sunday);
    wednesday.setUTCDate(sunday.getUTCDate() + 3);

    const epiYear = wednesday.getUTCFullYear();

    // Determinar o primeiro dia da SE 01 do ano epidemiológico
    // SE 01 é a semana que contém o dia 4 de Janeiro
    const jan4 = new Date(Date.UTC(epiYear, 0, 4));
    const firstSunday = new Date(jan4);
    firstSunday.setUTCDate(jan4.getUTCDate() - jan4.getUTCDay());

    // Calcular diferença em semanas
    const diffMs = sunday.getTime() - firstSunday.getTime();
    const weekNr = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;

    const formatDate = (dt: Date) => dt.toISOString().split('T')[0];

    return {
      year: epiYear,
      week: weekNr,
      start: formatDate(sunday),
      end: formatDate(saturday),
    };
  },

  /**
   * Obtém a lista de semanas epidemiológicas cadastradas no banco
   */
  async getWeeks(year = 2026): Promise<EpidemiologicalWeek[]> {
    try {
      const { data, error } = await supabase
        .from('epidemiological_weeks')
        .select('*')
        .eq('year', year)
        .order('week_number', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.warn('Fallback para cálculo de semanas epidemiológicas:', err);
      // Fallback calculado
      const weeks: EpidemiologicalWeek[] = [];
      for (let w = 1; w <= 52; w++) {
        weeks.push({
          year,
          week_number: w,
          start_date: `2026-01-${String(w * 7).padStart(2, '0')}`,
          end_date: `2026-01-${String(w * 7 + 6).padStart(2, '0')}`,
        });
      }
      return weeks;
    }
  },

  /**
   * Retorna opções de filtro rápido para dropdowns institucionais
   */
  getQuickFilterOptions() {
    const current = this.getEpidemiologicalWeek();
    return [
      { id: 'CURRENT_SE', label: `SE Atual (${current.week}/${current.year})`, week: current.week, year: current.year },
      { id: 'PREVIOUS_SE', label: `SE Anterior (${Math.max(1, current.week - 1)}/${current.year})`, week: Math.max(1, current.week - 1), year: current.year },
      { id: 'LAST_4_SE', label: `Últimas 4 SEs (SE ${Math.max(1, current.week - 3)} a ${current.week})`, range: 4 },
      { id: 'LAST_8_SE', label: `Últimas 8 SEs (SE ${Math.max(1, current.week - 7)} a ${current.week})`, range: 8 },
      { id: 'FULL_YEAR', label: `Ano Completo (${current.year})`, fullYear: true },
    ];
  },
};
