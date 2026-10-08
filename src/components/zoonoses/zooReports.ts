/**
 * Relatórios da vacinação antirrábica (puro, testável). Layouts configuráveis do
 * Endemias GOV — não reproduzem boletim estadual oficial (pendente de especificação SES-GO).
 */
import { AGE_GROUP_LABELS, SEX_LABELS, SPECIES_LABELS, Species, campaignIndicators, coverage } from '../../services/zoonoses/zoonosesMetrics';
import type { BatchBalance, Campaign, VaccinationCounts } from '../../services/zoonoses/zoonosesService';
import { POST_MODALITY_LABELS } from '../../services/zoonoses/zoonosesService';
import type { ReportDocument } from '../../services/reportExport';

export type ZooReportKind =
  | 'boletim_diario'
  | 'consolidado'
  | 'especie'
  | 'sexo'
  | 'localidade'
  | 'equipe'
  | 'cobertura'
  | 'postos'
  | 'estoque'
  | 'doses_perdas'
  | 'conferencia_estadual';

export const ZOO_REPORT_LABELS: Record<ZooReportKind, string> = {
  boletim_diario: 'Boletim diário de vacinação',
  consolidado: 'Consolidado da campanha',
  especie: 'Quantitativo por espécie',
  sexo: 'Quantitativo por sexo',
  localidade: 'Relatório por localidade',
  equipe: 'Produtividade por equipe',
  cobertura: 'Cobertura vacinal estimada',
  postos: 'Distribuição por postos',
  estoque: 'Controle de estoque',
  doses_perdas: 'Doses aplicadas e perdas',
  conferencia_estadual: 'Conferência para a Vigilância estadual',
};

export const COVERAGE_NOTE =
  'Cobertura = animais vacinados / população estimada × 100. Sem estimativa populacional com fonte informada, a cobertura é indisponível. Doses aplicadas e animais vacinados são contados separadamente.';

export interface ZooReportInput {
  counts: VaccinationCounts;
  campaign: Campaign | null;
  municipalityLabel: string;
  generatedBy?: string;
  balances?: BatchBalance[];
  periodLabel?: string;
}

const speciesRows = (c: VaccinationCounts) =>
  (['canina', 'felina'] as Species[]).map((sp) => ({ especie: SPECIES_LABELS[sp], doses: c.by_species[sp]?.doses ?? 0, animais: c.by_species[sp]?.animals ?? 0 }));

export function buildZooReport(kind: ZooReportKind, input: ZooReportInput): ReportDocument {
  const { counts: c, campaign } = input;
  const ind = campaignIndicators(c.by_species, campaign);
  const subtitle = `${input.municipalityLabel} · ${campaign ? `${campaign.name} (${campaign.year})` : 'Vacinação de rotina e todas as campanhas'}${input.periodLabel ? ` · ${input.periodLabel}` : ''}`;
  const base = { title: ZOO_REPORT_LABELS[kind], subtitle, generatedBy: input.generatedBy };
  const sourceNote = campaign?.population_source
    ? `População estimada: fonte "${campaign.population_source}"${campaign.population_reference_date ? `, referência ${campaign.population_reference_date}` : ''}${campaign.population_method ? `, método: ${campaign.population_method}` : ''}.`
    : 'Campanha sem estimativa populacional com fonte: cobertura indisponível.';

  switch (kind) {
    case 'boletim_diario': {
      const days = Array.from(new Set(c.by_day.map((d) => d.day))).sort();
      return {
        ...base,
        tables: [{
          title: 'Doses por dia',
          columns: [{ key: 'dia', label: 'Data', type: 'date' }, { key: 'caes', label: 'Cães', type: 'number' }, { key: 'gatos', label: 'Gatos', type: 'number' }, { key: 'total', label: 'Total de doses', type: 'number' }],
          rows: days.map((day) => {
            const caes = c.by_day.filter((d) => d.day === day && d.species === 'canina').reduce((a, d) => a + Number(d.doses), 0);
            const gatos = c.by_day.filter((d) => d.day === day && d.species === 'felina').reduce((a, d) => a + Number(d.doses), 0);
            return { dia: day, caes, gatos, total: caes + gatos };
          }),
        }],
      };
    }
    case 'consolidado':
    case 'conferencia_estadual':
      return {
        ...base,
        tables: [
          {
            title: 'Resumo',
            columns: [{ key: 'item', label: 'Item' }, { key: 'valor', label: 'Valor' }],
            rows: [
              { item: 'Doses aplicadas (total)', valor: c.doses_total },
              { item: 'Registros individuais', valor: c.doses_by_source.individual ?? 0 },
              { item: 'Registros de campanha rápida', valor: c.doses_by_source.campanha_rapida ?? 0 },
              { item: 'Lançamentos agregados (boletins físicos)', valor: c.doses_by_source.agregado ?? 0 },
              { item: 'Cães vacinados', valor: ind.dogsVaccinated },
              { item: 'Gatos vacinados', valor: ind.catsVaccinated },
              { item: 'Cobertura canina estimada (%)', valor: ind.dogCoverage === null ? 'Indisponível' : ind.dogCoverage.toLocaleString('pt-BR') },
              { item: 'Cobertura felina estimada (%)', valor: ind.catCoverage === null ? 'Indisponível' : ind.catCoverage.toLocaleString('pt-BR') },
              { item: 'Meta canina (%)', valor: ind.dogTarget ?? 'Não definida' },
            ],
          },
          { title: 'Por espécie', columns: [{ key: 'especie', label: 'Espécie' }, { key: 'doses', label: 'Doses', type: 'number' }, { key: 'animais', label: 'Animais vacinados', type: 'number' }], rows: speciesRows(c) },
          {
            title: 'Por sexo e faixa etária',
            columns: [{ key: 'especie', label: 'Espécie' }, { key: 'grupo', label: 'Grupo' }, { key: 'doses', label: 'Doses', type: 'number' }],
            rows: [
              ...c.by_sex.map((x) => ({ especie: SPECIES_LABELS[x.species], grupo: `Sexo: ${SEX_LABELS[x.sex] || x.sex}`, doses: Number(x.doses) })),
              ...c.by_age_group.map((x) => ({ especie: SPECIES_LABELS[x.species], grupo: `Idade: ${AGE_GROUP_LABELS[x.age_group] || x.age_group}`, doses: Number(x.doses) })),
            ],
          },
        ],
        notes: [
          COVERAGE_NOTE,
          sourceNote,
          ...(kind === 'conferencia_estadual'
            ? ['Relatório para conferência interna e apoio à prestação de informações. Não substitui o instrumento oficial exigido pela Vigilância estadual nem integra sistema oficial.']
            : []),
        ],
      };
    case 'especie':
      return { ...base, tables: [{ title: 'Por espécie', columns: [{ key: 'especie', label: 'Espécie' }, { key: 'doses', label: 'Doses', type: 'number' }, { key: 'animais', label: 'Animais vacinados', type: 'number' }], rows: speciesRows(c) }], notes: [COVERAGE_NOTE] };
    case 'sexo':
      return {
        ...base,
        tables: [{ title: 'Por sexo', columns: [{ key: 'especie', label: 'Espécie' }, { key: 'sexo', label: 'Sexo' }, { key: 'doses', label: 'Doses', type: 'number' }],
          rows: c.by_sex.map((x) => ({ especie: SPECIES_LABELS[x.species], sexo: SEX_LABELS[x.sex] || x.sex, doses: Number(x.doses) })) }],
      };
    case 'localidade':
    case 'cobertura': {
      const names = new Map<string, string>();
      c.by_neighborhood.forEach((r) => names.set(r.neighborhood_id || 'sem', r.name || 'Sem localidade'));
      c.localities.forEach((l) => names.set(l.neighborhood_id, l.name));
      const rows = Array.from(names.entries()).map(([id, name]) => {
        const dogs = c.by_neighborhood.find((r) => (r.neighborhood_id || 'sem') === id && r.species === 'canina');
        const cats = c.by_neighborhood.find((r) => (r.neighborhood_id || 'sem') === id && r.species === 'felina');
        const loc = c.localities.find((l) => l.neighborhood_id === id);
        return {
          localidade: name,
          caes: Number(dogs?.animals ?? 0),
          gatos: Number(cats?.animals ?? 0),
          doses: Number(dogs?.doses ?? 0) + Number(cats?.doses ?? 0),
          pop_caes: loc?.est_dog_population ?? null,
          cob_caes: coverage(Number(dogs?.animals ?? 0), loc?.est_dog_population),
          pop_gatos: loc?.est_cat_population ?? null,
          cob_gatos: coverage(Number(cats?.animals ?? 0), loc?.est_cat_population),
        };
      });
      const cols = [{ key: 'localidade', label: 'Localidade' }, { key: 'caes', label: 'Cães vacinados', type: 'number' as const }, { key: 'gatos', label: 'Gatos vacinados', type: 'number' as const }, { key: 'doses', label: 'Doses', type: 'number' as const }];
      return {
        ...base,
        tables: [
          ...(kind === 'cobertura' ? [{
            title: 'Município',
            columns: [{ key: 'especie', label: 'Espécie' }, { key: 'vacinados', label: 'Vacinados', type: 'number' as const }, { key: 'populacao', label: 'População estimada', type: 'number' as const }, { key: 'cobertura', label: 'Cobertura (%)', type: 'percent' as const }, { key: 'meta', label: 'Meta (%)', type: 'percent' as const }],
            rows: [
              { especie: 'Cães', vacinados: ind.dogsVaccinated, populacao: campaign?.est_dog_population ?? null, cobertura: ind.dogCoverage, meta: ind.dogTarget },
              { especie: 'Gatos', vacinados: ind.catsVaccinated, populacao: campaign?.est_cat_population ?? null, cobertura: ind.catCoverage, meta: ind.catTarget },
            ],
          }] : []),
          {
            title: 'Por localidade',
            columns: kind === 'cobertura'
              ? [...cols, { key: 'pop_caes', label: 'Pop. cães', type: 'number' as const }, { key: 'cob_caes', label: 'Cob. cães (%)', type: 'percent' as const }, { key: 'pop_gatos', label: 'Pop. gatos', type: 'number' as const }, { key: 'cob_gatos', label: 'Cob. gatos (%)', type: 'percent' as const }]
              : cols,
            rows,
          },
        ],
        notes: [COVERAGE_NOTE, sourceNote],
      };
    }
    case 'equipe':
      return { ...base, tables: [{ title: 'Por equipe', columns: [{ key: 'equipe', label: 'Equipe' }, { key: 'doses', label: 'Doses', type: 'number' }], rows: c.by_team.map((t) => ({ equipe: t.name || 'Sem equipe (almoxarifado central)', doses: Number(t.doses) })) }] };
    case 'postos':
      return { ...base, tables: [{ title: 'Por posto', columns: [{ key: 'posto', label: 'Posto' }, { key: 'modalidade', label: 'Modalidade' }, { key: 'doses', label: 'Doses', type: 'number' }],
        rows: c.by_post.map((p) => ({ posto: p.name || 'Sem posto (rotina/volante)', modalidade: p.modality ? POST_MODALITY_LABELS[p.modality] || p.modality : '—', doses: Number(p.doses) })) }] };
    case 'estoque':
    case 'doses_perdas':
      return {
        ...base,
        tables: [{
          title: 'Lotes',
          columns: [{ key: 'produto', label: 'Vacina' }, { key: 'fabricante', label: 'Fabricante' }, { key: 'lote', label: 'Lote' }, { key: 'validade', label: 'Validade', type: 'date' },
            { key: 'recebido', label: 'Recebido', type: 'number' }, { key: 'aplicado', label: 'Aplicado', type: 'number' }, { key: 'perdas', label: 'Perdas', type: 'number' },
            { key: 'central', label: 'Saldo central', type: 'number' }, { key: 'equipes', label: 'Saldo em equipes', type: 'number' }],
          rows: (input.balances || []).map((b) => ({
            produto: b.product_name, fabricante: b.manufacturer || '—', lote: b.batch_number, validade: b.expiration_date, recebido: Number(b.quantity_received),
            aplicado: Number(b.applied), perdas: Number(b.losses), central: Number(b.central_balance), equipes: b.teams.reduce((a, t) => a + Number(t.balance), 0),
          })),
        }],
        notes: ['Saldos do momento da emissão (todas as campanhas). Aplicado = doses baixadas por registros válidos; anulações estornam o saldo.'],
      };
  }
}
