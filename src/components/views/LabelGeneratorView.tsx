import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Printer,
  FileText,
  Search,
  CheckCircle2,
  Building,
  Shield,
  Layers,
  Wrench,
  FlaskConical,
  Eye,
  Camera,
  Download,
  AlertTriangle,
  Play,
  RotateCw,
} from 'lucide-react';
import { qrCodeService, QrEntityType } from '../../services/qrCodeService';
import { supabase } from '../../services/supabaseClient';
import { PageHeader } from '../ui';

interface LabelGeneratorViewProps {
  municipalityId?: string;
}

interface PrintableItem {
  id: string;
  code: string;
  title: string;
  subtitle?: string;
  category?: string;
  date?: string;
  type: QrEntityType;
}

export const LabelGeneratorView: React.FC<LabelGeneratorViewProps> = ({ municipalityId }) => {
  const [selectedType, setSelectedType] = useState<QrEntityType>('property');
  const [items, setItems] = useState<PrintableItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Configurações de impressão
  const [municipalityName, setMunicipalityName] = useState('Município Modelo');
  const [printFormat, setPrintFormat] = useState<'individual' | 'folha_a4' | 'rolo_termico'>('folha_a4');
  const [includeDate, setIncludeDate] = useState(true);

  // Scanner / Resolução
  const [scannerOpen, setScannerOpen] = useState(false);
  const [simulatedToken, setSimulatedToken] = useState('');
  const [resolvedEntity, setResolvedEntity] = useState<any>(null);

  // Carregar dados da entidade selecionada
  useEffect(() => {
    const fetchEntities = async () => {
      setLoading(true);
      try {
        let loadedItems: PrintableItem[] = [];

        switch (selectedType) {
          case 'property': {
            const { data } = await supabase
              .from('properties')
              .select('id, address, number, type, neighborhoods(name)')
              .limit(50);
            loadedItems = (data || []).map((p: any) => ({
              id: p.id,
              code: `IMO-${p.id.substring(0, 6).toUpperCase()}`,
              title: `${p.address}, ${p.number || 'S/N'}`,
              subtitle: p.neighborhoods?.name || 'Zona Urbana',
              category: p.type || 'Residencial',
              type: 'property',
            }));
            break;
          }

          case 'ovitrap': {
            const { data } = await supabase
              .from('ovitraps')
              .select('id, code, location_description, status, installation_date')
              .limit(50);
            loadedItems = (data || []).map((o: any) => ({
              id: o.id,
              code: o.code || `OVI-${o.id.substring(0, 4)}`,
              title: `Ovitrampa ${o.code}`,
              subtitle: o.location_description || 'Área Peridomiciliar',
              category: o.status || 'Ativa',
              date: o.installation_date,
              type: 'ovitrap',
            }));
            break;
          }

          case 'strategic_point': {
            const { data } = await supabase
              .from('strategic_points')
              .select('id, code, name, type, address')
              .limit(50);
            loadedItems = (data || []).map((pe: any) => ({
              id: pe.id,
              code: pe.code || `PE-${pe.id.substring(0, 4)}`,
              title: pe.name,
              subtitle: pe.address,
              category: pe.type,
              type: 'strategic_point',
            }));
            break;
          }

          case 'special_property': {
            const { data } = await supabase
              .from('special_properties')
              .select('id, code, name, category, address')
              .limit(50);
            loadedItems = (data || []).map((ie: any) => ({
              id: ie.id,
              code: ie.code || `IE-${ie.id.substring(0, 4)}`,
              title: ie.name,
              subtitle: ie.address,
              category: ie.category,
              type: 'special_property',
            }));
            break;
          }

          case 'sample': {
            const { data } = await supabase
              .from('entomological_samples')
              .select('id, sample_code, collection_type, collection_date, properties(address)')
              .limit(50);
            loadedItems = (data || []).map((s: any) => ({
              id: s.id,
              code: s.sample_code,
              title: `Amostra ${s.sample_code}`,
              subtitle: s.properties?.address || 'Ponto de Coleta',
              category: s.collection_type,
              date: s.collection_date,
              type: 'sample',
            }));
            break;
          }

          case 'equipment': {
            const { data } = await supabase
              .from('equipment')
              .select('id, code, name, category, type, serial_number')
              .limit(50);
            loadedItems = (data || []).map((eq: any) => ({
              id: eq.id,
              code: eq.code,
              title: eq.name,
              subtitle: eq.serial_number ? `S/N: ${eq.serial_number}` : 'Equipamento Municipal',
              category: eq.category || eq.type,
              type: 'equipment',
            }));
            break;
          }
        }

        setItems(loadedItems);
        setSelectedIds([]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchEntities();
  }, [selectedType, municipalityId]);

  const handleSelectAll = () => {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map(i => i.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handlePrint = async () => {
    if (selectedItems.length === 0) {
      alert('Selecione pelo menos um item para gerar as etiquetas.');
      return;
    }

    await qrCodeService.logLabelGeneration({
      municipalityId,
      entityType: selectedType,
      quantity: selectedItems.length,
      format: printFormat,
      userName: 'Administrador Municipal',
    });

    window.print();
  };

  const handleResolveScan = async () => {
    if (!simulatedToken) return;
    const parsed = qrCodeService.parseQrPayload(simulatedToken);
    if (parsed) {
      const res = await qrCodeService.resolveScannedEntity(parsed.type, parsed.id);
      setResolvedEntity(res);
    } else {
      // Tentar resolver com ID direto do primeiro item selecionado
      if (items.length > 0) {
        const first = items[0];
        const res = await qrCodeService.resolveScannedEntity(first.type, first.id);
        setResolvedEntity(res);
      } else {
        alert('Código de QR Code inválido ou não reconhecido.');
      }
    }
  };

  const selectedItems = items.filter(i => selectedIds.includes(i.id));

  return (
    <div className="space-y-6">
      {/* Header com estilo institucional */}
      <div className="print:hidden">
        <PageHeader
          icon={QrCode}
          title="Central de QR Code & Gerador de Etiquetas"
          subtitle="Identificação segura e sem exposição de dados pessoais para imóveis, armadilhas, equipamentos e amostras"
          actions={
            <>
              <button
                onClick={() => setScannerOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-sm font-medium transition-colors"
              >
                <Camera className="w-4 h-4" />
                Escanear / Testar QR
              </button>

              <button
                onClick={handlePrint}
                disabled={selectedItems.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
              >
                <Printer className="w-4 h-4" />
                Imprimir ({selectedItems.length})
              </button>
            </>
          }
        />
      </div>

      {/* Seletor de Categoria e Opções de Formato */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
            Tipo de Entidade
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { type: 'property', label: 'Imóveis', icon: Building },
              { type: 'ovitrap', label: 'Ovitrampas', icon: Layers },
              { type: 'strategic_point', label: 'Pontos Estratégicos', icon: Shield },
              { type: 'special_property', label: 'Imóveis Especiais', icon: Building },
              { type: 'sample', label: 'Amostras Lab', icon: FlaskConical },
              { type: 'equipment', label: 'Equipamentos', icon: Wrench },
            ].map(tab => {
              const Icon = tab.icon;
              const isSelected = selectedType === tab.type;
              return (
                <button
                  key={tab.type}
                  onClick={() => setSelectedType(tab.type as QrEntityType)}
                  className={`flex items-center gap-2 p-2.5 rounded-lg text-xs font-medium border transition-colors ${
                    isSelected
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
            Formato da Impressão
          </label>
          <div className="space-y-2">
            {[
              { id: 'folha_a4', name: 'Folha A4 (Pimaco / Adesivos)' },
              { id: 'rolo_termico', name: 'Rolo Térmico (Zebra / Elgin)' },
              { id: 'individual', name: 'Etiqueta Individual / Cartão' },
            ].map(f => (
              <label
                key={f.id}
                className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                <input
                  type="radio"
                  name="printFormat"
                  value={f.id}
                  checked={printFormat === f.id}
                  onChange={() => setPrintFormat(f.id as any)}
                  className="text-indigo-600"
                />
                {f.name}
              </label>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
            Parâmetros do Cabeçalho
          </label>
          <div className="space-y-3">
            <div>
              <span className="text-xs text-slate-500">Município na Etiqueta:</span>
              <input
                type="text"
                value={municipalityName}
                onChange={e => setMunicipalityName(e.target.value)}
                className="w-full mt-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              <input
                type="checkbox"
                checked={includeDate}
                onChange={e => setIncludeDate(e.target.checked)}
                className="rounded text-indigo-600"
              />
              Exibir data de emissão na etiqueta
            </label>
          </div>
        </div>
      </div>

      {/* Lista de Seleção */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden print:hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={handleSelectAll}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-200 transition-colors"
            >
              {selectedIds.length === items.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
            </button>
            <span className="text-xs text-slate-500">
              {selectedIds.length} de {items.length} itens selecionados
            </span>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filtrar por código ou nome..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none"
            />
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50">
          {loading ? (
            <div className="p-6 text-center text-xs text-slate-500">Carregando registros...</div>
          ) : items.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">Nenhum registro encontrado nesta categoria.</div>
          ) : (
            items
              .filter(i =>
                searchTerm
                  ? i.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    i.title.toLowerCase().includes(searchTerm.toLowerCase())
                  : true
              )
              .map(item => {
                const isSelected = selectedIds.includes(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleSelect(item.id)}
                    className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/30'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded text-indigo-600 pointer-events-none"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-indigo-700 dark:text-indigo-400">
                            {item.code}
                          </span>
                          <span className="text-xs font-semibold text-slate-900 dark:text-white">
                            {item.title}
                          </span>
                        </div>
                        {item.subtitle && (
                          <p className="text-xs text-slate-500 dark:text-slate-400">{item.subtitle}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {item.category && (
                        <span className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded">
                          {item.category}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </div>

      {/* ÁREA DE IMPRESSÃO / PRÉ-VISUALIZAÇÃO DAS ETIQUETAS */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2 print:hidden">
          <Printer className="w-4 h-4 text-indigo-600" />
          Prévia das Etiquetas Geradas ({selectedItems.length} selecionadas)
        </h3>

        {selectedItems.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs border border-dashed rounded-lg">
            Nenhuma etiqueta selecionada para impressão. Selecione itens acima.
          </div>
        ) : (
          <div
            className={`grid gap-4 ${
              printFormat === 'rolo_termico'
                ? 'grid-cols-1 max-w-xs mx-auto'
                : printFormat === 'individual'
                ? 'grid-cols-1 sm:grid-cols-2 max-w-xl mx-auto'
                : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
            }`}
          >
            {selectedItems.map(item => {
              const qrUrl = qrCodeService.generateQrUrl(item.type, item.id, item.code);
              const qrImg = qrCodeService.getQrCodeImageUrl(qrUrl, 160);

              return (
                <div
                  key={item.id}
                  className="p-3.5 bg-white border-2 border-slate-800 rounded-lg text-slate-900 flex flex-col justify-between shadow-sm page-break-inside-avoid"
                >
                  {/* Cabeçalho da Etiqueta */}
                  <div className="border-b border-slate-800 pb-1.5 mb-2 text-center">
                    <span className="block text-[10px] font-black uppercase tracking-wider text-slate-700">
                      {municipalityName}
                    </span>
                    <span className="block text-[9px] font-bold text-slate-600">
                      ENDEMIAS GOV • VIGILÂNCIA EM SAÚDE
                    </span>
                  </div>

                  {/* Miolo com QR Code e Dados */}
                  <div className="flex items-center gap-3">
                    <img
                      src={qrImg}
                      alt="QR Code"
                      className="w-20 h-20 border border-slate-300 rounded p-1 bg-white"
                    />

                    <div className="flex-1 min-w-0">
                      <span className="block text-xs font-black font-mono text-slate-900">
                        {item.code}
                      </span>
                      <p className="text-[11px] font-bold text-slate-800 line-clamp-1">
                        {item.title}
                      </p>
                      {item.subtitle && (
                        <p className="text-[9px] text-slate-600 line-clamp-1">{item.subtitle}</p>
                      )}
                      {item.category && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 text-[8px] font-bold bg-slate-200 text-slate-800 rounded">
                          {item.category.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Rodapé Seguro LGPD */}
                  <div className="mt-2 pt-1.5 border-t border-slate-300 flex justify-between items-center text-[8px] text-slate-500 font-mono">
                    <span>TOKEN SEGURO SUS</span>
                    {includeDate && <span>{new Date().toLocaleDateString('pt-BR')}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Leitor / Teste de QR Code */}
      {scannerOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-700 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <Camera className="w-5 h-5 text-indigo-600" />
              Simulação de Leitura de QR Code
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Ao escanear a etiqueta de campo, o sistema resolve o token opaco sem expor dados pessoais do munícipe.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Conteúdo Lido pelo Scanner / URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Cole a URL ou token lido..."
                    value={simulatedToken}
                    onChange={e => setSimulatedToken(e.target.value)}
                    className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-xs text-slate-900 dark:text-white font-mono"
                  />
                  <button
                    onClick={handleResolveScan}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
                  >
                    Resolver
                  </button>
                </div>
              </div>

              {resolvedEntity && (
                <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-lg space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-2">
                    <span className="text-xs font-bold uppercase text-indigo-600 dark:text-indigo-400">
                      Entidade Identificada: {resolvedEntity.type}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                      {resolvedEntity.data.code}
                    </span>
                  </div>

                  <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1">
                    {resolvedEntity.type === 'property' && (
                      <>
                        <p><strong>Endereço:</strong> {resolvedEntity.data.address}, {resolvedEntity.data.number || 'S/N'}</p>
                        <p><strong>Bairro:</strong> {resolvedEntity.data.neighborhood}</p>
                        <p><strong>Tipo:</strong> {resolvedEntity.data.type}</p>
                        <div className="pt-2">
                          <button
                            onClick={() => alert('Iniciando visita domiciliar para este imóvel!')}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-semibold"
                          >
                            <Play className="w-3 h-3" />
                            Iniciar Visita de Campo
                          </button>
                        </div>
                      </>
                    )}

                    {resolvedEntity.type === 'ovitrap' && (
                      <>
                        <p><strong>Local:</strong> {resolvedEntity.data.location}</p>
                        <p><strong>Última Coleta:</strong> {resolvedEntity.data.lastCollectionDate || 'Pendente'}</p>
                        <p><strong>Ovos Contados:</strong> {resolvedEntity.data.lastEggs || 0}</p>
                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={() => alert('Registrando instalação da armadilha')}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-semibold"
                          >
                            Registrar Instalação
                          </button>
                          <button
                            onClick={() => alert('Registrando coleta de palheta')}
                            className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-semibold"
                          >
                            Registrar Coleta
                          </button>
                        </div>
                      </>
                    )}

                    {resolvedEntity.type === 'sample' && (
                      <>
                        <p><strong>Código Amostra:</strong> {resolvedEntity.data.sampleCode}</p>
                        <p><strong>Tipo Coleta:</strong> {resolvedEntity.data.collectionType}</p>
                        <p><strong>Status:</strong> {resolvedEntity.data.status}</p>
                        <p><strong>Endereço Origem:</strong> {resolvedEntity.data.address}</p>
                      </>
                    )}

                    {resolvedEntity.type === 'equipment' && (
                      <>
                        <p><strong>Nome:</strong> {resolvedEntity.data.name}</p>
                        <p><strong>Categoria:</strong> {resolvedEntity.data.category}</p>
                        <p><strong>Responsável Atual:</strong> {resolvedEntity.data.assignedAgent}</p>
                        <p><strong>Próxima Manutenção:</strong> {resolvedEntity.data.nextMaintenance || 'Não agendada'}</p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setScannerOpen(false);
                  setResolvedEntity(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-lg text-xs font-medium"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
