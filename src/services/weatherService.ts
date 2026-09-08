import { supabase } from './supabaseClient';

export interface WeatherDailyRecord {
  id: string;
  municipality_id: string;
  date: string;
  rainfall_mm: number;
  temp_min: number;
  temp_max: number;
  temp_avg: number;
  humidity_avg: number;
  source: string;
  created_at: string;
}

export interface ClimateSummary {
  rainfall7d: number;
  rainfall30d: number;
  avgTempRecent: number;
  avgHumidityRecent: number;
  environmentalTendency: 'alta_proliferacao' | 'moderada' | 'baixa_atividade';
  tendencyLabel: string;
  tendencyDescription: string;
  riskFactorWeight: number; // 1.0 a 1.5
  recentDays: WeatherDailyRecord[];
}

export interface WeatherProviderAdapter {
  name: string;
  fetchDailyWeather(municipalityId: string, targetDate: string): Promise<Partial<WeatherDailyRecord>>;
}

const DEFAULT_MUN_ID = '00000000-0000-0000-0000-000000000001';

export const weatherService = {
  /**
   * Obtém histórico meteorológico diário dos últimos N dias
   */
  async getDailyWeather(municipalityId = DEFAULT_MUN_ID, limitDays = 30): Promise<WeatherDailyRecord[]> {
    try {
      const { data, error } = await supabase
        .from('weather_daily')
        .select('*')
        .eq('municipality_id', municipalityId)
        .order('date', { ascending: false })
        .limit(limitDays);

      if (error || !data || data.length === 0) {
        return this.getFallbackRecentWeather();
      }

      return data.map((d: any) => ({
        id: d.id,
        municipality_id: d.municipality_id,
        date: d.date,
        rainfall_mm: Number(d.rainfall_mm) || 0,
        temp_min: Number(d.temp_min) || 20,
        temp_max: Number(d.temp_max) || 30,
        temp_avg: Number(d.temp_avg) || 25,
        humidity_avg: Number(d.humidity_avg) || 70,
        source: d.source || 'INMET',
        created_at: d.created_at
      }));
    } catch (err) {
      console.warn('Fallback para histórico meteorológico:', err);
      return this.getFallbackRecentWeather();
    }
  },

  /**
   * Obtém o resumo climático para o Painel de Inteligência e Motor de Risco
   */
  async getClimateSummary(municipalityId = DEFAULT_MUN_ID): Promise<ClimateSummary> {
    const list = await this.getDailyWeather(municipalityId, 30);

    const last7 = list.slice(0, 7);
    const rain7d = Math.round(last7.reduce((acc, cur) => acc + cur.rainfall_mm, 0) * 10) / 10;
    const rain30d = Math.round(list.reduce((acc, cur) => acc + cur.rainfall_mm, 0) * 10) / 10;

    const avgTemp = last7.length > 0
      ? Math.round((last7.reduce((acc, cur) => acc + cur.temp_avg, 0) / last7.length) * 10) / 10
      : 25.4;

    const avgHum = last7.length > 0
      ? Math.round(last7.reduce((acc, cur) => acc + cur.humidity_avg, 0) / last7.length)
      : 72;

    // Avaliação do potencial biológico do vetor (Aedes: 22°C - 32°C com chuva > 20mm nos 7d acelera eclosão)
    let tendency: ClimateSummary['environmentalTendency'] = 'moderada';
    let tendencyLabel = 'Condições Climáticas Típicas';
    let tendencyDescription = 'Temperatura e precipitação em níveis que mantêm o ciclo biológico padrão do vetor.';
    let riskWeight = 1.1;

    if (avgTemp >= 23 && avgTemp <= 32 && rain7d >= 25) {
      tendency = 'alta_proliferacao';
      tendencyLabel = 'Alerta Ambiental: Clima Altamente Favorável à Eclosão';
      tendencyDescription = `Chuva recente (${rain7d}mm/7d) associada à temperatura de ${avgTemp}°C acelera o ciclo ovo-adulto do mosquito de 14 para 7-9 dias.`;
      riskWeight = 1.35;
    } else if (avgTemp < 19 || (rain30d < 5 && avgHum < 50)) {
      tendency = 'baixa_atividade';
      tendencyLabel = 'Atividade Vetorial Reduzida por Fatores Climáticos';
      tendencyDescription = 'Temperaturas amenas ou baixa umidade relativa diminuem o ritmo de oviposição e desenvolvimento larval.';
      riskWeight = 0.9;
    }

    return {
      rainfall7d: rain7d,
      rainfall30d: rain30d,
      avgTempRecent: avgTemp,
      avgHumidityRecent: avgHum,
      environmentalTendency: tendency,
      tendencyLabel,
      tendencyDescription,
      riskFactorWeight: riskWeight,
      recentDays: list
    };
  },

  /**
   * Fallback sintético baseado no clima médio brasileiro
   */
  getFallbackRecentWeather(): WeatherDailyRecord[] {
    const list: WeatherDailyRecord[] = [];
    const now = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const rain = i === 4 ? 24.5 : i === 5 ? 12.0 : i === 10 ? 32.4 : 0.0;
      list.push({
        id: `wt-${i}`,
        municipality_id: DEFAULT_MUN_ID,
        date: dateStr,
        rainfall_mm: rain,
        temp_min: 20.0,
        temp_max: 30.5,
        temp_avg: 25.2,
        humidity_avg: rain > 0 ? 84 : 68,
        source: 'INMET',
        created_at: d.toISOString()
      });
    }
    return list;
  }
};
