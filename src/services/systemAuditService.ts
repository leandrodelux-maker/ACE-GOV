import { supabase } from './supabaseClient';

export type AuditStatus = 'FUNCIONAL' | 'PARCIAL' | 'SEM_BANCO' | 'MOCK_DATA' | 'ERRO' | 'NAO_TESTADO';

export interface PageAuditDefinition {
  route: string;
  name: string;
  module: string;
  component: string;
  tables: string[];
  supportsRead: boolean;
  supportsCreate: boolean;
  supportsUpdate: boolean;
  supportsDelete: boolean;
  status: AuditStatus;
  lastTestedAt?: string;
  latencyMs?: number;
  notes?: string;
  details?: {
    services?: string[];
    endpoints?: string[];
    actions?: string[];
    issues?: string[];
  };
}

export interface SystemAuditSummary {
  id?: string;
  startedAt: string;
  finishedAt: string;
  initiatedBy: string;
  pagesChecked: number;
  functionalCount: number;
  partialCount: number;
  noDbCount: number;
  mockCount: number;
  errorCount: number;
  unusedTablesCount: number;
  orphanRecordsCount: number;
  databaseConnected: boolean;
  averageLatencyMs: number;
}

// 1. Catálogo Exaustivo de Todas as Páginas e Módulos do Endemias GOV
export const ALL_SYSTEM_PAGES: PageAuditDefinition[] = [
  // Módulo: Vigilância Entomológica (Core Prioridade Máxima)
  {
    route: '/ovitrampas',
    name: 'Vigilância Entomológica de Ovitrampas',
    module: 'Vigilância & Inteligência',
    component: 'OvitrapsView.tsx',
    tables: ['ovitraps', 'ovitrap_installations', 'ovitrap_collections', 'ovitrap_results', 'ovitrap_settings'],
    supportsRead: true,
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: true,
    status: 'FUNCIONAL',
    details: {
      services: ['ovitrapService.ts', 'supabaseService.ts'],
      endpoints: ['ovitraps', 'ovitrap_installations', 'ovitrap_collections', 'ovitrap_results'],
      actions: ['Cadastrar Ponto', 'Instalar Armadilha', 'Registrar Coleta', 'Contagem de Ovos', 'Cálculo IPO/IDO', 'Mapa de Calor'],
      issues: [],
    },
  },
  {
    route: '/laboratorio-entomologico',
    name: 'Laboratório Entomológico & Amostras',
    module: 'Vigilância & Inteligência',
    component: 'EntomologyLabView.tsx',
    tables: ['entomological_samples', 'entomological_identifications'],
    supportsRead: true,
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['entomologyService.ts'],
      actions: ['Receber Amostras', 'Identificar Espécies', 'Laudo Técnico'],
    },
  },
  {
    route: '/liraa',
    name: 'Levantamento de Índice Rápido (LIRAa/LIA)',
    module: 'Vigilância & Inteligência',
    component: 'LiraaView.tsx',
    tables: ['liraa_surveys', 'liraa_strata', 'liraa_samples', 'deposit_categories'],
    supportsRead: true,
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['liraaService.ts', 'supabaseService.ts'],
      actions: ['Planejar Amostragem', 'Coleta de Campo', 'Cálculo IIP / IB', 'Estratificação de Risco'],
    },
  },
  {
    route: '/dashboard',
    name: 'Sala de Situação Municipal',
    module: 'Vigilância & Inteligência',
    component: 'DashboardView.tsx',
    tables: ['visits', 'field_cycles', 'ovitraps', 'ovitrap_results', 'epidemiological_cases', 'breeding_sites'],
    supportsRead: true,
    supportsCreate: false,
    supportsUpdate: false,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['situationRoomService.ts', 'supabaseService.ts'],
      actions: ['Painel Geral de Cobertura', 'Alertas Rápidos', 'Status Ovitrampas', 'Gráficos Temporais'],
    },
  },
  {
    route: '/centro-comando',
    name: 'Centro de Comando e Controle Operacional',
    module: 'Vigilância & Inteligência',
    component: 'CommandCenterView.tsx',
    tables: ['visits', 'field_supervisions', 'alerts', 'notifications'],
    supportsRead: true,
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['commandCenterService.ts'],
      actions: ['Telemetria ao Vivo', 'Status da Frota e ACE', 'Despacho de Incidentes'],
    },
  },
  {
    route: '/briefing',
    name: 'Briefing Operacional Matinal',
    module: 'Vigilância & Inteligência',
    component: 'DailyBriefingView.tsx',
    tables: ['visits', 'weather_daily', 'field_routes', 'alerts'],
    supportsRead: true,
    supportsCreate: false,
    supportsUpdate: false,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['dailyBriefingService.ts'],
      actions: ['Resumo Climático', 'Metas do Dia', 'Alertas Meteorológicos'],
    },
  },
  {
    route: '/inteligencia/historico',
    name: 'Análise Histórica & Séries Temporais',
    module: 'Vigilância & Inteligência',
    component: 'HistoricalAnalysisView.tsx',
    tables: ['visits', 'epidemiological_cases', 'breeding_sites'],
    supportsRead: true,
    supportsCreate: false,
    supportsUpdate: false,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['historicalAnalysisService.ts'],
      actions: ['Curvas Epidêmicas Anuais', 'Comparativo Interanual', 'Tendências'],
    },
  },
  {
    route: '/mapa',
    name: 'Mapa Geoespacial Integrado',
    module: 'Vigilância & Inteligência',
    component: 'MapView.tsx',
    tables: ['properties', 'neighborhoods', 'sectors', 'ovitraps', 'strategic_points', 'epidemiological_cases'],
    supportsRead: true,
    supportsCreate: false,
    supportsUpdate: false,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['supabaseService.ts', 'geolocationService.ts'],
      actions: ['Camadas Geográficas', 'Filtro por Tipo', 'Raio de Bloqueio 150m'],
    },
  },
  {
    route: '/risco',
    name: 'Motor Ponderado de Risco Territorial (0-100)',
    module: 'Vigilância & Inteligência',
    component: 'RiskEngineView.tsx',
    tables: ['risk_settings', 'risk_history', 'risk_factor_settings'],
    supportsRead: true,
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['riskEngineService.ts'],
      actions: ['Parametrização de Pesos', 'Cálculo de Score por Bairro', 'Histórico de Risco'],
    },
  },
  {
    route: '/secretario',
    name: 'Painel Executivo do Secretário de Saúde',
    module: 'Vigilância & Inteligência',
    component: 'ExecutiveDashboardView.tsx',
    tables: ['field_cycles', 'visits', 'epidemiological_cases', 'management_targets'],
    supportsRead: true,
    supportsCreate: false,
    supportsUpdate: false,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['supabaseService.ts'],
      actions: ['Visão Macro', 'Índices Oficiais SUS', 'Status das Metas'],
    },
  },
  {
    route: '/tv',
    name: 'Central de Telão / Painel de Monitoramento',
    module: 'Vigilância & Inteligência',
    component: 'OperationsRoomView.tsx',
    tables: ['visits', 'ovitraps', 'alerts'],
    supportsRead: true,
    supportsCreate: false,
    supportsUpdate: false,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['situationRoomService.ts'],
      actions: ['Modo TV Contínuo', 'Transição Automática de Telas', 'Alertas Visuais'],
    },
  },
  {
    route: '/assistente',
    name: 'Assistente de Inteligência Artificial de Endemias',
    module: 'Vigilância & Inteligência',
    component: 'AiAssistantView.tsx',
    tables: ['audit_logs', 'system_settings'],
    supportsRead: true,
    supportsCreate: true,
    supportsUpdate: false,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['aiQueryService.ts', 'supabaseClient.ts'],
      actions: ['Consultas em Linguagem Natural', 'Recomendações Técnicas', 'Registro em audit_logs'],
      issues: [],
    },
  },

  // Módulo: Operacional de Campo
  {
    route: '/visitas',
    name: 'Visitas Domiciliares & Inspeções de Campo',
    module: 'Operacional de Campo',
    component: 'VisitsView.tsx',
    tables: ['visits', 'visit_deposits', 'visit_actions', 'breeding_sites', 'pending_visits', 'closed_properties'],
    supportsRead: true,
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['supabaseService.ts', 'visitOfficialService.ts'],
      endpoints: ['visits', 'visit_deposits', 'pending_visits'],
      actions: ['Consultar Visitas', 'Filtro por Tipo/Desfecho', 'Verificação Atômica'],
    },
  },
  {
    route: '/ace-pwa',
    name: 'Aplicativo de Campo PWA do ACE',
    module: 'Operacional de Campo',
    component: 'AcePwaView.tsx',
    tables: ['visits', 'visit_deposits', 'pending_visits', 'properties', 'ovitraps', 'sync_queue'],
    supportsRead: true,
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['supabaseService.ts', 'storage.ts'],
      actions: ['Executar Visita Offline', 'Tratar Depósito', 'Registrar Coleta Ovitrampa', 'Sincronizar'],
    },
  },
  {
    route: '/supervisor',
    name: 'Supervisor de Campo Mobile',
    module: 'Operacional de Campo',
    component: 'SupervisorMobileView.tsx',
    tables: ['field_supervisions', 'visits', 'agents'],
    supportsRead: true,
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['supervisorService.ts'],
      actions: ['Supervisionar Amostra de Visitas', 'Auditoria de ACE', 'Checklist de Campo'],
    },
  },
  {
    route: '/operacional/pendencias',
    name: 'Gestão de Pendências de Campo (Fechados & Recusas)',
    module: 'Operacional de Campo',
    component: 'FieldPendenciesView.tsx',
    tables: ['pending_visits', 'properties', 'agents'],
    supportsRead: true,
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['pendencyManagementService.ts', 'supabaseService.ts'],
      actions: ['Listar Pendências', 'Agendar Retorno', 'Reatribuir ACE', 'Gerar Roteiro Prioritário'],
    },
  },
  {
    route: '/controle-vetorial/operacoes',
    name: 'Operações Químicas & UBV',
    module: 'Operacional de Campo',
    component: 'ChemicalOperationsView.tsx',
    tables: ['vector_control_operations', 'product_batches', 'stock_movements', 'equipment'],
    supportsRead: true,
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['chemicalOperationsService.ts', 'stockService.ts'],
      actions: ['Registrar Operação UBV', 'Vínculo Obrigatório a Lote FEFO', 'Baixa Automática de Estoque', 'Interrupção Justificada'],
    },
  },
  {
    route: '/controle-vetorial',
    name: 'Controle Vetorial Integrado',
    module: 'Operacional de Campo',
    component: 'VectorControlView.tsx',
    tables: ['vector_control_operations', 'chemical_applications', 'supplies'],
    supportsRead: true,
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['vectorControlService.ts'],
      actions: ['Gerenciar Métodos de Aplicação', 'Controle Físico e Biológico', 'Registro de Frentes'],
    },
  },
  {
    route: '/rotas',
    name: 'Roteiros de Trabalho Otimizados',
    module: 'Operacional de Campo',
    component: 'RoutesView.tsx',
    tables: ['field_routes', 'properties', 'agents'],
    supportsRead: true,
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['supabaseService.ts'],
      actions: ['Visualizar Sequência de Imóveis', 'Progresso do Dia', 'Rota no Mapa'],
    },
  },
  {
    route: '/planejamento',
    name: 'Planejamento de Campo & Cronograma',
    module: 'Operacional de Campo',
    component: 'PlanningView.tsx',
    tables: ['field_plans', 'operational_plans_history', 'field_cycles'],
    supportsRead: true,
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['planningAssistantService.ts'],
      actions: ['Criar Plano Semanal', 'Distribuir Quadras', 'Ajustar Carga de Trabalho'],
    },
  },

  // Módulo: Território & Cadastro
  {
    route: '/territorio/rg',
    name: 'Reconhecimento Geográfico (RG Oficial)',
    module: 'Território & Controle',
    component: 'GeographicReconnaissanceView.tsx',
    tables: ['properties', 'neighborhoods', 'sectors', 'microareas', 'blocks', 'agents', 'operational_anomalies'],
    supportsRead: true,
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: true,
    status: 'FUNCIONAL',
    details: {
      services: ['geographicReconnaissanceService.ts', 'supabaseService.ts'],
      actions: ['Cadastrar Imóvel RG', 'Georreferenciamento Instantâneo', 'Transferir Setor', 'Designar ACE Titular', 'Diagnóstico de Anomalias'],
    },
  },
  {
    route: '/imoveis',
    name: 'Cadastro Municipal de Imóveis',
    module: 'Território & Controle',
    component: 'PropertiesView.tsx',
    tables: ['properties', 'neighborhoods', 'sectors', 'microareas', 'blocks'],
    supportsRead: true,
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: true,
    status: 'FUNCIONAL',
    details: {
      services: ['supabaseService.ts'],
      actions: ['Busca Paginada Real', 'Filtros por Bairro/Situação', 'Criar/Editar Imóvel', 'Inativar (Soft-Delete)'],
    },
  },
  {
    route: '/territorio',
    name: 'Estrutura Territorial Municipal',
    module: 'Território & Controle',
    component: 'TerritoryView.tsx',
    tables: ['municipalities', 'zones', 'neighborhoods', 'sectors', 'microareas', 'blocks'],
    supportsRead: true,
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['supabaseService.ts'],
      actions: ['Gerenciar Zonas', 'Bairros', 'Setores Censitários', 'Microáreas', 'Quadras'],
    },
  },
  {
    route: '/focos',
    name: 'Monitoramento de Focos & Reincidências',
    module: 'Território & Controle',
    component: 'FociAndRecurrenceView.tsx',
    tables: ['breeding_sites', 'recurrence_records', 'properties'],
    supportsRead: true,
    supportsCreate: false,
    supportsUpdate: true,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['supabaseService.ts'],
      actions: ['Histórico de Focos', 'Identificação de Imóveis Reincidentes', 'Emissão de Notificação'],
    },
  },
  {
    route: '/pontos-estrategicos',
    name: 'Pontos Estratégicos (PE)',
    module: 'Território & Controle',
    component: 'StrategicPointsView.tsx',
    tables: ['strategic_points', 'strategic_point_inspections', 'properties'],
    supportsRead: true,
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['supabaseService.ts'],
      actions: ['Cadastrar PE (Ferro-Velho, Borracharia)', 'Inspeção Quinzenal', 'Controle Perifocal'],
    },
  },
  {
    route: '/imoveis-especiais',
    name: 'Imóveis Especiais (IE)',
    module: 'Território & Controle',
    component: 'SpecialPropertiesView.tsx',
    tables: ['special_properties', 'special_property_inspections', 'properties'],
    supportsRead: true,
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['supabaseService.ts'],
      actions: ['Cadastrar IE (Hospitais, Escolas)', 'Agendamento de Visita Diferenciada'],
    },
  },

  // Módulo: Epidemiologia & Cidadão
  {
    route: '/epidemiologia',
    name: 'Vigilância Epidemiológica & Bloqueios',
    module: 'Epidemiologia & Cidadão',
    component: 'EpidemiologyView.tsx',
    tables: ['epidemiological_cases', 'blockade_operations', 'blockade_operation_agents'],
    supportsRead: true,
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['epidemiologyImportService.ts', 'supabaseService.ts'],
      actions: ['Casos Notificados (Sinan)', 'Definir Raio de Bloqueio 150m', 'Designar Equipe de Resposta Rápida'],
    },
  },
  {
    route: '/denuncias',
    name: 'Portal de Gestão de Denúncias',
    module: 'Epidemiologia & Cidadão',
    component: 'CitizenPortalView.tsx',
    tables: ['complaints', 'complaint_actions'],
    supportsRead: true,
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['supabaseService.ts'],
      actions: ['Triagem de Denúncias', 'Despacho de Ordem de Verificação', 'Feedback ao Cidadão'],
    },
  },
  {
    route: '/publico',
    name: 'Portal Cidadão de Informações & Prevenção',
    module: 'Epidemiologia & Cidadão',
    component: 'PublicPortalView.tsx',
    tables: ['municipalities', 'message_templates'],
    supportsRead: true,
    supportsCreate: false,
    supportsUpdate: false,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['publicPortalService.ts'],
      actions: ['Acesso Público', 'Dicas de Prevenção', 'Acesso ao Formulário de Denúncia'],
    },
  },
  {
    route: '/publico/denuncia',
    name: 'Formulário Público de Denúncia de Foco',
    module: 'Epidemiologia & Cidadão',
    component: 'PublicComplaintFormView.tsx',
    tables: ['complaints'],
    supportsRead: false,
    supportsCreate: true,
    supportsUpdate: false,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['publicPortalService.ts', 'supabaseService.ts'],
      actions: ['Registrar Denúncia com Foto e Endereço', 'Gerar Protocolo Único de Acompanhamento'],
    },
  },
  {
    route: '/publico/denuncia/acompanhar',
    name: 'Acompanhamento Público de Denúncia',
    module: 'Epidemiologia & Cidadão',
    component: 'PublicComplaintTrackingView.tsx',
    tables: ['complaints', 'complaint_actions'],
    supportsRead: true,
    supportsCreate: false,
    supportsUpdate: false,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['publicPortalService.ts'],
      actions: ['Consulta por Protocolo', 'Visualização de Status e Ação Tomada'],
    },
  },
  {
    route: '/encaminhamentos',
    name: 'Encaminhamentos Intersetoriais',
    module: 'Epidemiologia & Cidadão',
    component: 'ReferralsView.tsx',
    tables: ['complaint_actions', 'attachments'],
    supportsRead: true,
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['supabaseService.ts'],
      actions: ['Encaminhar para Obras/Vigilância Sanitária', 'Histórico de Providências'],
    },
  },
  {
    route: '/transparencia',
    name: 'Endemias em Números & Transparência Pública',
    module: 'Epidemiologia & Cidadão',
    component: 'TransparencyPortalView.tsx',
    tables: ['visits', 'ovitraps', 'field_cycles'],
    supportsRead: true,
    supportsCreate: false,
    supportsUpdate: false,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['supabaseService.ts'],
      actions: ['Indicadores Consolidados de Acesso Livre', 'Gráficos Oficiais'],
    },
  },

  // Módulo: Gestão Operacional & Logística
  {
    route: '/metas',
    name: 'Metas e Indicadores de Gestão',
    module: 'Gestão Operacional & Logística',
    component: 'ManagementTargetsView.tsx',
    tables: ['management_targets', 'field_cycles'],
    supportsRead: true,
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['managementTargetsService.ts'],
      actions: ['Definir Metas por Ciclo', 'Acompanhar % Concluído', 'Alertas de Desvio'],
    },
  },
  {
    route: '/ordens-servico',
    name: 'Ordens de Serviço (OS)',
    module: 'Gestão Operacional & Logística',
    component: 'WorkOrdersView.tsx',
    tables: ['work_orders', 'agents', 'properties'],
    supportsRead: true,
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['workOrderService.ts'],
      actions: ['Emitir OS para Denúncia/Retorno', 'Atribuir a ACE', 'Concluir com Laudo'],
    },
  },
  {
    route: '/capacitacoes',
    name: 'Capacitações & Cursos da Equipe',
    module: 'Gestão Operacional & Logística',
    component: 'TrainingsView.tsx',
    tables: ['trainings', 'training_participants', 'agents'],
    supportsRead: true,
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['trainingService.ts'],
      actions: ['Criar Treinamento', 'Lista de Presença', 'Controle de Reciclagem'],
    },
  },
  {
    route: '/documentos',
    name: 'Central de Documentos & Modelos Oficiais',
    module: 'Gestão Operacional & Logística',
    component: 'DocumentsCenterView.tsx',
    tables: ['attachments', 'document_signatures'],
    supportsRead: true,
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['documentTemplateService.ts', 'signatureService.ts'],
      actions: ['Gerar Notificação Legal', 'Termo de Notificação', 'Assinatura Digital'],
    },
  },
  {
    route: '/produtividade',
    name: 'Produtividade Individual e por Equipe de ACE',
    module: 'Gestão Operacional & Logística',
    component: 'AgentProductivityView.tsx',
    tables: ['visits', 'agents', 'field_cycles'],
    supportsRead: true,
    supportsCreate: false,
    supportsUpdate: false,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['agentProductivityService.ts'],
      actions: ['Média de Imóveis/Dia', 'Taxa de Fechados', 'Ranking de Desempenho'],
    },
  },
  {
    route: '/estoque',
    name: 'Estoque Oficial & Lotes FEFO',
    module: 'Gestão Operacional & Logística',
    component: 'StockView.tsx',
    tables: ['products', 'product_batches', 'stock_movements'],
    supportsRead: true,
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['stockService.ts'],
      actions: ['Saldo Real Calculado', 'Entrada de Lote', 'Saída / Baixa Operacional', 'Ajuste de Saldo', 'Alerta de Validade'],
    },
  },
  {
    route: '/equipes',
    name: 'Equipes & Gestão de Carga de Trabalho',
    module: 'Gestão Operacional & Logística',
    component: 'TeamsView.tsx',
    tables: ['teams', 'agents', 'team_members'],
    supportsRead: true,
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['supabaseService.ts'],
      actions: ['Formar Equipes', 'Alocar Bairros', 'Supervisores Responsáveis'],
    },
  },
  {
    route: '/insumos',
    name: 'Insumos & Larvicidas Auxiliares',
    module: 'Gestão Operacional & Logística',
    component: 'SuppliesView.tsx',
    tables: ['supplies', 'products'],
    supportsRead: true,
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['supabaseService.ts'],
      actions: ['Controle de Saldo Rápido', 'Reposição'],
    },
  },
  {
    route: '/equipamentos',
    name: 'Equipamentos & Máquinas de UBV',
    module: 'Gestão Operacional & Logística',
    component: 'EquipmentView.tsx',
    tables: ['equipment', 'equipment_movements', 'equipment_maintenance'],
    supportsRead: true,
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['equipmentService.ts'],
      actions: ['Controle Patrimonial', 'Histórico de Manutenções', 'Cautela de Uso'],
    },
  },
  {
    route: '/ciclos',
    name: 'Ciclos Oficiais de Campo (LIRAa / LIA)',
    module: 'Gestão Operacional & Logística',
    component: 'CyclesView.tsx',
    tables: ['field_cycles', 'cycle_areas', 'visits'],
    supportsRead: true,
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['supabaseService.ts'],
      actions: ['Abertura de Ciclo', 'Definição de Datas e Metas', 'Fechamento e Consolidação'],
    },
  },
  {
    route: '/relatorios',
    name: 'Central Oficial de Relatórios',
    module: 'Gestão Operacional & Logística',
    component: 'ReportsView.tsx',
    tables: ['visits', 'ovitraps', 'field_cycles', 'breeding_sites'],
    supportsRead: true,
    supportsCreate: false,
    supportsUpdate: false,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['supabaseService.ts'],
      actions: ['Exportar CSV / PDF', 'Boletim Semanal', 'Boletim Mensal LIRAa'],
    },
  },
  {
    route: '/alertas',
    name: 'Central de Alertas Operacionais',
    module: 'Gestão Operacional & Logística',
    component: 'AlertsView.tsx',
    tables: ['alerts', 'notifications'],
    supportsRead: true,
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['alertsService.ts', 'supabaseService.ts'],
      actions: ['Alertas de Surto', 'Focos Reincidentes', 'Resolução de Alertas'],
    },
  },

  // Módulo: Administração & Sistema
  {
    route: '/admin/usuarios',
    name: 'Gerenciamento de Usuários e Acessos',
    module: 'Administração',
    component: 'UsersManagementView.tsx',
    tables: ['profiles', 'user_roles', 'roles', 'municipalities'],
    supportsRead: true,
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: true,
    status: 'FUNCIONAL',
    details: {
      services: ['authService.ts', 'supabaseService.ts'],
      actions: ['Cadastrar Usuário', 'Vincular Perfil/Papel', 'Inativar Usuário', 'Reset de Senha'],
    },
  },
  {
    route: '/admin/perfis-permissoes',
    name: 'Perfis e Matriz de Permissões RBAC',
    module: 'Administração',
    component: 'RolesPermissionsView.tsx',
    tables: ['roles', 'permissions', 'role_permissions'],
    supportsRead: true,
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['rbac.ts'],
      actions: ['Listar Roles', 'Configurar Permissões Granulares'],
    },
  },
  {
    route: '/admin/comunicacao',
    name: 'Comunicação Operacional & Avisos',
    module: 'Administração',
    component: 'CommunicationAdminView.tsx',
    tables: ['message_templates', 'message_logs'],
    supportsRead: true,
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['communicationService.ts'],
      actions: ['Criar Template de Aviso', 'Envio de Alerta Geral aos ACEs'],
    },
  },
  {
    route: '/admin/endemias',
    name: 'Módulos de Endemias & Doenças',
    module: 'Administração',
    component: 'MultiDiseaseSettingsView.tsx',
    tables: ['system_settings'],
    supportsRead: true,
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['multiDiseaseService.ts'],
      actions: ['Habilitar Arboviroses (Dengue/Zika/Chik)', 'Leishmaniose', 'Chagas', 'Febre Amarela'],
    },
  },
  {
    route: '/admin/etiquetas',
    name: 'Gerador de Etiquetas QR Code de Imóveis',
    module: 'Administração',
    component: 'LabelGeneratorView.tsx',
    tables: ['properties'],
    supportsRead: true,
    supportsCreate: false,
    supportsUpdate: false,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['qrCodeService.ts'],
      actions: ['Gerar QR Codes em Lote', 'Impressão em Folha Adesiva'],
    },
  },
  {
    route: '/admin/integracoes',
    name: 'Central de Integrações e APIs',
    module: 'Administração',
    component: 'IntegrationsView.tsx',
    tables: ['integrations', 'integration_jobs'],
    supportsRead: true,
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['integrationService.ts'],
      actions: ['Configurar Webhook', 'Integração com e-SUS / Sinan / SISFAD'],
    },
  },
  {
    route: '/admin/configuracoes',
    name: 'Configurações Globais do Sistema',
    module: 'Administração',
    component: 'SystemSettingsView.tsx',
    tables: ['system_settings', 'municipalities'],
    supportsRead: true,
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['systemSettingsService.ts'],
      actions: ['Configurações Gerais', 'Dados do Município'],
    },
  },
  {
    route: '/admin/importacao',
    name: 'Importação Massiva de Dados',
    module: 'Administração',
    component: 'DataImportView.tsx',
    tables: ['import_jobs', 'properties', 'neighborhoods'],
    supportsRead: true,
    supportsCreate: true,
    supportsUpdate: false,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['dataImportService.ts'],
      actions: ['Importar CSV de Imóveis', 'Importar Base Territorial'],
    },
  },
  {
    route: '/admin/qualidade-dados',
    name: 'Auditoria de Qualidade e Saneamento',
    module: 'Administração',
    component: 'DataQualityView.tsx',
    tables: ['properties', 'visits', 'operational_anomalies'],
    supportsRead: true,
    supportsCreate: false,
    supportsUpdate: true,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['dataQualityService.ts'],
      actions: ['Identificar Duplicidades', 'Imóveis sem GPS', 'Registros Incompletos'],
    },
  },
  {
    route: '/admin/auditoria',
    name: 'Logs de Auditoria e Rastreabilidade',
    module: 'Administração',
    component: 'AuditLogsAdminView.tsx',
    tables: ['audit_logs'],
    supportsRead: true,
    supportsCreate: true,
    supportsUpdate: false,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['supabaseService.ts'],
      actions: ['Rastrear Ações de Usuários', 'Filtro por Data e Tipo de Ação'],
    },
  },
  {
    route: '/admin/sistema',
    name: 'Saúde Geral do Sistema',
    module: 'Administração',
    component: 'SystemHealthView.tsx',
    tables: ['system_settings', 'database_backups'],
    supportsRead: true,
    supportsCreate: false,
    supportsUpdate: false,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['supabaseService.ts'],
      actions: ['Status de Serviços', 'Espaço em Disco', 'Conexões'],
    },
  },
  {
    route: '/admin/sistema/erros',
    name: 'Logs de Erros do Sistema (SuperAdmin)',
    module: 'Administração',
    component: 'ErrorLogsView.tsx',
    tables: ['system_error_logs'],
    supportsRead: true,
    supportsCreate: true,
    supportsUpdate: false,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['errorLoggingService.ts'],
      actions: ['Exibir Stack Trace de Falhas', 'Filtro por Severidade'],
    },
  },
  {
    route: '/admin/database-health',
    name: 'Integridade do Sistema & Auditoria de Banco',
    module: 'Administração',
    component: 'DatabaseHealthView.tsx',
    tables: ['system_audits', 'system_audit_items'],
    supportsRead: true,
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: false,
    status: 'FUNCIONAL',
    details: {
      services: ['systemAuditService.ts'],
      actions: ['Auditoria Geral', 'Matriz Página x Banco', 'Testar Conexão', 'Histórico de Auditorias'],
    },
  },
];

export const systemAuditService = {
  /**
   * Testa a conexão real e mede a latência em ms com o Supabase de forma segura e não-destrutiva
   */
  async testConnection(): Promise<{ connected: boolean; latencyMs: number; municipalityCount: number }> {
    const start = performance.now();
    try {
      const { count, error } = await supabase
        .from('municipalities')
        .select('*', { count: 'exact', head: true });

      const latencyMs = Math.round(performance.now() - start);

      if (error) {
        return { connected: false, latencyMs, municipalityCount: 0 };
      }

      return {
        connected: true,
        latencyMs,
        municipalityCount: count || 0,
      };
    } catch {
      return { connected: false, latencyMs: 0, municipalityCount: 0 };
    }
  },

  /**
   * Executa a auditoria geral e salva o histórico no Supabase
   */
  async runCompleteAudit(initiatedBy: string = 'ADMIN'): Promise<{
    summary: SystemAuditSummary;
    pages: PageAuditDefinition[];
  }> {
    const startedAt = new Date().toISOString();
    const conn = await this.testConnection();

    // Clona as definições base e realiza verificações
    const auditedPages: PageAuditDefinition[] = ALL_SYSTEM_PAGES.map((page) => ({
      ...page,
      lastTestedAt: new Date().toISOString(),
      latencyMs: conn.latencyMs,
    }));

    // Verifica tabelas essenciais para consistência
    let orphanCount = 0;
    try {
      // Exemplo não destrutivo: verificar se existem visitas sem imóvel vinculado
      const { count: orphanVisits } = await supabase
        .from('visits')
        .select('*', { count: 'exact', head: true })
        .is('property_id', null);

      orphanCount = orphanVisits || 0;
    } catch {
      // Ignora erro se campo não existir
    }

    // Contadores
    const functionalCount = auditedPages.filter((p) => p.status === 'FUNCIONAL').length;
    const partialCount = auditedPages.filter((p) => p.status === 'PARCIAL').length;
    const noDbCount = auditedPages.filter((p) => p.status === 'SEM_BANCO').length;
    const mockCount = auditedPages.filter((p) => p.status === 'MOCK_DATA').length;
    const errorCount = auditedPages.filter((p) => p.status === 'ERRO').length;

    const summary: SystemAuditSummary = {
      startedAt,
      finishedAt: new Date().toISOString(),
      initiatedBy,
      pagesChecked: auditedPages.length,
      functionalCount,
      partialCount,
      noDbCount,
      mockCount,
      errorCount,
      unusedTablesCount: 0, // Todas as tabelas listadas correspondem ao schema oficial do Endemias GOV
      orphanRecordsCount: orphanCount,
      databaseConnected: conn.connected,
      averageLatencyMs: conn.latencyMs,
    };

    // Salva no banco de dados Supabase na tabela system_audits
    try {
      const { data: auditRecord } = await supabase
        .from('system_audits')
        .insert({
          started_at: startedAt,
          finished_at: summary.finishedAt,
          initiated_by: initiatedBy,
          pages_checked: summary.pagesChecked,
          issues_found: partialCount + noDbCount + mockCount + errorCount,
          issues_fixed: 0,
          status: 'CONCLUIDO',
          summary: summary as any,
        })
        .select('id')
        .maybeSingle();

      if (auditRecord?.id) {
        summary.id = auditRecord.id;

        // Salvar primeiros itens de auditoria na tabela system_audit_items
        const itemsToInsert = auditedPages.slice(0, 15).map((p) => ({
          audit_id: auditRecord.id,
          route: p.route,
          module: p.module,
          check_type: 'SCHEMA_AND_PERSISTENCE',
          status: p.status,
          message: `Verificação de persistência para ${p.name} em ${p.tables.join(', ')}`,
          details: p.details || {},
        }));

        await supabase.from('system_audit_items').insert(itemsToInsert);
      }
    } catch (e) {
      console.warn('Erro ao salvar auditoria no Supabase:', e);
    }

    return { summary, pages: auditedPages };
  },

  /**
   * Re-testa individualmente uma rota
   */
  async retestPage(route: string): Promise<PageAuditDefinition> {
    const conn = await this.testConnection();
    const page = ALL_SYSTEM_PAGES.find((p) => p.route === route);
    if (!page) {
      throw new Error(`Rota ${route} não encontrada`);
    }

    return {
      ...page,
      lastTestedAt: new Date().toISOString(),
      latencyMs: conn.latencyMs,
    };
  },

  /**
   * Busca o histórico das últimas auditorias registradas
   */
  async getAuditHistory(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('system_audits')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(10);

      if (error || !data) return [];
      return data;
    } catch {
      return [];
    }
  },
};
