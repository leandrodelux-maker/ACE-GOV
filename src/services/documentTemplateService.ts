export interface DocumentTemplate {
  id: string;
  name: string;
  category: 'operacional' | 'vetorial' | 'vigilancia' | 'gestao';
  description: string;
  variables: string[];
  contentTemplate: string;
}

export const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  {
    id: 'rel_visita',
    name: 'Relatório de Visita Domiciliar',
    category: 'operacional',
    description: 'Laudo de inspeção predial e eliminação de criadouros em visita rotineira do ACE.',
    variables: ['municipio', 'data', 'agente', 'supervisor', 'bairro', 'imovel', 'ciclo', 'resultado', 'depósitos_eliminados', 'observacoes'],
    contentTemplate: `PREFEITURA MUNICIPAL DE {{municipio}}
SECRETARIA MUNICIPAL DE SAÚDE - VIGILÂNCIA AMBIENTAL
RELATÓRIO DE VISITA DOMICILIAR E CONTROLE DE VETORES

1. IDENTIFICAÇÃO DA ATIVIDADE
Data da Inspeção: {{data}}
Ciclo Operacional: {{ciclo}}
Agente de Combate às Endemias (ACE): {{agente}}
Supervisor Responsável: {{supervisor}}

2. LOCALIZAÇÃO DO IMÓVEL
Endereço / Identificação: {{imovel}}
Bairro / Setor: {{bairro}}

3. CONSTATAÇÃO TÉCNICA E AÇÕES
Resultado da Inspeção: {{resultado}}
Depósitos Inspecionados e Eliminados: {{depósitos_eliminados}}
Observações de Campo: {{observacoes}}

Conforme diretrizes do Programa Nacional de Controle da Dengue (PNCD/Ministério da Saúde).`,
  },
  {
    id: 'rel_bloqueio',
    name: 'Relatório de Bloqueio Vetorial Perifocal',
    category: 'vetorial',
    description: 'Certificado de operação de bloqueio químico/mecânico em raio de transmissão de arbovirose.',
    variables: ['municipio', 'data', 'agente', 'supervisor', 'bairro', 'imovel', 'caso_referencia', 'raio_metros', 'produto_utilizado', 'imoveis_trabalhados'],
    contentTemplate: `PREFEITURA MUNICIPAL DE {{municipio}}
VIGILÂNCIA EPIDEMIOLÓGICA E AMBIENTAL
RELATÓRIO DE OPERAÇÃO DE BLOQUEIO VETORIAL

Data da Operação: {{data}}
Equipe / Coordenador: {{agente}} (Supervisão: {{supervisor}})
Bairro / Localidade: {{bairro}}
Caso Notificado de Referência: {{caso_referencia}}
Raio de Bloqueio Delimitado: {{raio_metros}} metros em torno do ponto focal.

Ações Executadas:
- Total de Imóveis Trabalhados: {{imoveis_trabalhados}}
- Inseticida / Larvicida Aplicado: {{produto_utilizado}}
- Tratamento focal e peridomiciliar concluído com êxito sem reações adversas.`,
  },
  {
    id: 'rel_pe',
    name: 'Relatório de Inspeção de Ponto Estratégico (PE)',
    category: 'operacional',
    description: 'Ficha quinzenal de vistoria técnica em ferros-velhos, borracharias, cemitérios e reciclagens.',
    variables: ['municipio', 'data', 'agente', 'supervisor', 'bairro', 'ponto_estrategico', 'categoria_pe', 'criadouros_encontrados', 'tratamento_realizado'],
    contentTemplate: `PREFEITURA MUNICIPAL DE {{municipio}}
COORDENADORIA DE ENDEMIAS
INSPEÇÃO QUINZENAL DE PONTO ESTRATÉGICO (PE)

Data da Visita: {{data}}
Agente Responsável: {{agente}} | Supervisor: {{supervisor}}
Ponto Estratégico: {{ponto_estrategico}}
Tipo / Categoria do PE: {{categoria_pe}}
Endereço / Bairro: {{bairro}}

Diagnóstico e Intervenções:
- Criadouros ou Focos Identificados: {{criadouros_encontrados}}
- Medidas Corretivas e Tratamento Químico: {{tratamento_realizado}}
- Responsável pelo estabelecimento orientado sobre a Lei Municipal e PNCD.`,
  },
  {
    id: 'rel_ie',
    name: 'Relatório de Imóvel Especial (IE)',
    category: 'operacional',
    description: 'Vistoria em imóveis de grande circulação ou aglomeração de pessoas (escolas, hospitais, fábricas).',
    variables: ['municipio', 'data', 'agente', 'imovel_especial', 'bairro', 'populacao_flutuante', 'situacao_risco', 'recomendacoes'],
    contentTemplate: `PREFEITURA MUNICIPAL DE {{municipio}}
RELATÓRIO DE AVALIAÇÃO DE IMÓVEL ESPECIAL (IE)

Data da Vistoria: {{data}}
Equipe Técnica: {{agente}}
Estabelecimento: {{imovel_especial}} (Bairro: {{bairro}})
Estimativa de Circulação Diária: {{populacao_flutuante}} pessoas

Avaliação de Risco Sanitário:
- Situação do Estabelecimento: {{situacao_risco}}
- Recomendações e Plano de Ação Preventivo: {{recomendacoes}}`,
  },
  {
    id: 'rel_denuncia',
    name: 'Relatório de Atendimento a Denúncia Cidadã',
    category: 'gestao',
    description: 'Comprovante técnico de fiscalização sanitária originada de canal de ouvidoria municipal.',
    variables: ['municipio', 'data', 'agente', 'numero_protocolo', 'bairro', 'imovel', 'motivo_denuncia', 'situacao_encontrada', 'providencias'],
    contentTemplate: `PREFEITURA MUNICIPAL DE {{municipio}}
OUVIDORIA E VIGILÂNCIA SANITÁRIA AMBIENTAL
ATENDIMENTO A DENÚNCIA DO CIDADÃO

Data da Diligência: {{data}}
Protocolo da Ouvidoria: {{numero_protocolo}}
Vistoriador Oficial: {{agente}}
Local Fiscalizado: {{imovel}} - {{bairro}}

1. Fato Denunciado: {{motivo_denuncia}}
2. Constatação no Local: {{situacao_encontrada}}
3. Providências Adotadas: {{providencias}}`,
  },
  {
    id: 'rel_liraa',
    name: 'Relatório Sintético de LIRAa / LIA',
    category: 'vigilancia',
    description: 'Consolidação de índices entomológicos (IIP, IB, Breteau) por estrato municipal.',
    variables: ['municipio', 'data', 'ciclo', 'iip_geral', 'classificacao_risco', 'estratos_criticos', 'tipo_deposito_predominante'],
    contentTemplate: `PREFEITURA MUNICIPAL DE {{municipio}}
LEVANTAMENTO RÁPIDO DE ÍNDICES PARA AEDES AEGYPTI (LIRAa/LIA)
RELATÓRIO EXECUTIVO OFICIAL

Período de Execução: {{data}} | Ciclo: {{ciclo}}
Índice de Infestação Predial (IIP) Geral: {{iip_geral}}%
Classificação de Risco Epidemiológico: {{classificacao_risco}}

Estratificação e Criadouros:
- Estratos / Bairros com Maior Infestação: {{estratos_criticos}}
- Tipo de Depósito Predominante: {{tipo_deposito_predominante}}
- Recomendações: Intensificação de mutirões e fiscalização focada em reservatórios ao nível do solo.`,
  },
  {
    id: 'rel_ovitrampa',
    name: 'Relatório de Monitoramento por Ovitrampa',
    category: 'vigilancia',
    description: 'Boletim técnico de densidade vetorial e positividade de armadilhas de oviposição.',
    variables: ['municipio', 'data', 'agente', 'rede_armadilhas', 'ipo_taxa', 'ido_densidade', 'bairros_mais_afetados'],
    contentTemplate: `PREFEITURA MUNICIPAL DE {{municipio}}
PROGRAMA MUNICIPAL DE OVITRAMPAS
BOLETIM TÉCNICO DE MONITORAMENTO DE OVIPOSIÇÃO

Data da Coleta/Leitura: {{data}}
Responsável Técnico: {{agente}}
Rede de Armadilhas: {{rede_armadilhas}}
Índice de Positividade de Ovitrampas (IPO): {{ipo_taxa}}%
Índice de Densidade de Ovos (IDO): {{ido_densidade}} ovos/palheta positiva

Zonas de Alerta:
Áreas de Maior Pressão Vetorial: {{bairros_mais_afetados}}
Ações Preventivas Antecipadas Indicadas antes do surgimento de casos humanos.`,
  },
  {
    id: 'rel_supervisao',
    name: 'Relatório de Supervisão de Campo',
    category: 'gestao',
    description: 'Instrumento de acompanhamento da qualidade técnica das vistorias dos ACEs.',
    variables: ['municipio', 'data', 'supervisor', 'agente', 'atividade', 'resultado_supervisao', 'apontamentos'],
    contentTemplate: `PREFEITURA MUNICIPAL DE {{municipio}}
SUPERVISÃO OPERACIONAL DE CAMPO
AVALIAÇÃO E CONTROLE DE QUALIDADE PNCD

Data da Supervisão: {{data}}
Supervisor de Campo: {{supervisor}}
Agente Supervisionado: {{agente}}
Atividade Acompanhada: {{atividade}}

Avaliação de Desempenho e Procedimentos:
- Resultado Geral: {{resultado_supervisao}}
- Apontamentos Técnicos e Orientações Fornecidas: {{apontamentos}}`,
  },
  {
    id: 'rel_os',
    name: 'Ordem de Serviço Operacional (OS)',
    category: 'gestao',
    description: 'Documento de expedição de ordem de serviço para intervenção imediata de campo.',
    variables: ['municipio', 'data', 'numero_os', 'tipo_os', 'prioridade', 'equipe_designada', 'local_execucao', 'objetivo_acao'],
    contentTemplate: `PREFEITURA MUNICIPAL DE {{municipio}}
GESTÃO OPERACIONAL DE ENDEMIAS
ORDEM DE SERVIÇO: {{numero_os}}

Data de Emissão: {{data}}
Tipo de Serviço: {{tipo_os}}
Prioridade de Atendimento: {{prioridade}}
Equipe / Agente Designado: {{equipe_designada}}
Local de Execução: {{local_execucao}}

Finalidade e Instruções Operacionais:
{{objetivo_acao}}
Prazo regulamentar de conclusão conforme os protocolos da Secretaria Municipal de Saúde.`,
  },
  {
    id: 'rel_entomologico',
    name: 'Laudo Laboratorial Entomológico',
    category: 'vigilancia',
    description: 'Laudo conclusivo de análise taxonômica e identificação de espécimes vetores.',
    variables: ['municipio', 'data', 'codigo_amostra', 'agente_coletor', 'biologo_analista', 'origem_amostra', 'especies_identificadas', 'conclusao_laudo'],
    contentTemplate: `PREFEITURA MUNICIPAL DE {{municipio}}
LABORATÓRIO DE ENTOMOLOGIA MÉDICA
LAUDO TÉCNICO DE IDENTIFICAÇÃO VETORIAL

Código da Amostra: {{codigo_amostra}}
Data da Conclusão: {{data}}
Agente Coletor: {{agente_coletor}}
Biólogo / Responsável Técnico pela Análise: {{biologo_analista}}
Origem da Coleta: {{origem_amostra}}

Resultado da Microscopia Taxonômica:
Espécies Identificadas: {{especies_identificadas}}
Conclusão Epidemiológica: {{conclusao_laudo}}

Este laudo fundamenta medidas de intervenção química, controle de focos e cálculos de dispersão de arboviroses no município.`,
  },
];

export const documentTemplateService = {
  /**
   * Listar todos os modelos disponíveis
   */
  getTemplates(): DocumentTemplate[] {
    return DOCUMENT_TEMPLATES;
  },

  /**
   * Buscar modelo por ID
   */
  getTemplateById(id: string): DocumentTemplate | undefined {
    return DOCUMENT_TEMPLATES.find(t => t.id === id);
  },

  /**
   * Renderiza o conteúdo do documento aplicando a substituição dinâmica de variáveis
   */
  renderDocument(templateId: string, variables: Record<string, string>): string {
    const tmpl = this.getTemplateById(templateId);
    if (!tmpl) return '';

    let result = tmpl.contentTemplate;
    for (const [key, val] of Object.entries(variables)) {
      const reg = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(reg, val || '---');
    }

    // Limpar eventuais variáveis remanescentes
    result = result.replace(/{{[a-zA-Z0-9_]+}}/g, '---');
    return result;
  },
};
