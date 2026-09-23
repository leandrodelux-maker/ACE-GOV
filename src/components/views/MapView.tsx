import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Layers,
  MapPin,
  Flame,
  Crosshair,
  AlertCircle,
  Activity,
  Filter,
  Eye,
  EyeOff,
  Navigation,
  Info,
  Maximize2,
  RefreshCw,
  Building2,
  AlertTriangle,
  Repeat,
  CheckCircle2,
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { supabaseService } from '../../services/supabaseService';
import { systemSettingsService } from '../../services/systemSettingsService';
import { Neighborhood } from '../../types';
import { PageHeader } from '../ui';
import { useAuth, useMunicipalityId } from '../../contexts/AuthContext';
import { PENDING_STATUSES, RECURRENCE_MIN_FOCI, fetchFociByProperty } from '../../services/schemaHelpers';

/** Visão do Brasil: usada só enquanto o município não configurou o centro do mapa. */
const BRAZIL_VIEW = { lat: -14.235, lng: -51.925, zoom: 4 };

const toNum = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

/** Configuração do mapa; `configured` = o município definiu o centro em Configurações > Mapas. */
const parseMapConfig = (raw: any) => {
  const lat = toNum(raw?.centerLatitude);
  const lng = toNum(raw?.centerLongitude);
  const configured = lat !== null && lng !== null;
  return {
    centerLatitude: configured ? (lat as number) : BRAZIL_VIEW.lat,
    centerLongitude: configured ? (lng as number) : BRAZIL_VIEW.lng,
    defaultZoom: configured ? toNum(raw?.defaultZoom) ?? 14 : BRAZIL_VIEW.zoom,
    defaultLayer: raw?.defaultLayer || 'RISK_HEATMAP',
    configured,
  };
};

const getInitialMapConfig = () => {
  try {
    const cached = localStorage.getItem('endemias_settings_MAPA');
    if (cached) return parseMapConfig(JSON.parse(cached));
  } catch {
    /* sem cache */
  }
  return parseMapConfig(null);
};

export const MapView: React.FC = () => {
  const { municipality: sessionMunicipality } = useAuth();
  const municipalityId = useMunicipalityId();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);

  // Configurações dinâmicas de centro e zoom carregadas da Central de Configurações
  const [mapConfig, setMapConfig] = useState(getInitialMapConfig);
  const autoFittedRef = useRef(false);

  // Layer toggles
  const [showProperties, setShowProperties] = useState(true);
  const [showVisits, setShowVisits] = useState(false);
  const [showPendencies, setShowPendencies] = useState(true);
  const [showFoci, setShowFoci] = useState(true);
  const [showRecurrences, setShowRecurrences] = useState(true);
  const [showOvitraps, setShowOvitraps] = useState(true);
  const [showStrategicPoints, setShowStrategicPoints] = useState(true);
  const [showSpecialProperties, setShowSpecialProperties] = useState(true);
  const [showComplaints, setShowComplaints] = useState(true);
  const [showBlocks, setShowBlocks] = useState(true);
  const [showTerritoryRisk, setShowTerritoryRisk] = useState(true);
  const [showLiraa, setShowLiraa] = useState(true);

  // Filtros
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>('ALL');
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<string>('ALL');
  const [neighborhoodsList, setNeighborhoodsList] = useState<Neighborhood[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Dados reais carregados do Supabase
  const [mapData, setMapData] = useState<{
    properties: any[];
    visits: any[];
    pendencies: any[];
    ovitraps: any[];
    strategicPoints: any[];
    specialProperties: any[];
    complaints: any[];
    blocks: any[];
    liraaSamples: any[];
  }>({
    properties: [],
    visits: [],
    pendencies: [],
    ovitraps: [],
    strategicPoints: [],
    specialProperties: [],
    complaints: [],
    blocks: [],
    liraaSamples: [],
  });

  // Selected item modal / info drawer
  const [selectedItem, setSelectedItem] = useState<{
    type: 'PROPERTY' | 'VISIT' | 'OVITRAP' | 'PE' | 'IE' | 'COMPLAINT' | 'BLOCK' | 'RISK';
    data: any;
  } | null>(null);

  // Carregar lista de bairros
  useEffect(() => {
    const loadNeighs = async () => {
      const muni = sessionMunicipality;
      if (muni) {
        const list = await supabaseService.getNeighborhoods(muni.id);
        if (list) setNeighborhoodsList(list);
      }
    };
    loadNeighs();
  }, []);

  // Carregar configurações de mapa do banco PostgreSQL
  useEffect(() => {
    const loadMapSettings = async () => {
      try {
        const muni = sessionMunicipality;
        const cfg = await systemSettingsService.getCategorySettings('MAPA', muni?.id);
        if (cfg) {
          const next = parseMapConfig(cfg);
          setMapConfig(next);
          // Reposiciona apenas quando há centro configurado (senão o ajuste é pelos dados)
          if (mapInstanceRef.current && next.configured) {
            mapInstanceRef.current.setView([next.centerLatitude, next.centerLongitude], next.defaultZoom);
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar parâmetros de mapa:', err);
      }
    };
    loadMapSettings();
  }, []);

  // Centralizar mapa nas coordenadas configuradas da prefeitura
  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(
        [mapConfig.centerLatitude, mapConfig.centerLongitude],
        mapConfig.defaultZoom
      );
    }
  };

  // Se trocar o bairro filtrado, centraliza no bairro selecionado
  useEffect(() => {
    if (selectedNeighborhood !== 'ALL' && mapInstanceRef.current) {
      const neigh = neighborhoodsList.find(n => n.id === selectedNeighborhood);
      if (neigh?.latitude && neigh?.longitude) {
        mapInstanceRef.current.setView([neigh.latitude, neigh.longitude], 15);
      }
    }
  }, [selectedNeighborhood, neighborhoodsList]);

  // Carregar dados reais do Supabase
  const loadMapData = useCallback(async () => {
    setIsLoading(true);
    try {
      const muni = sessionMunicipality;
      const muniId = municipalityId;

      let propQuery = supabase
        .from('properties')
        .select('*, neighborhoods(name)')
        .eq('municipality_id', muniId)
        .is('deleted_at', null)
        .limit(200);

      if (selectedNeighborhood !== 'ALL') {
        propQuery = propQuery.eq('neighborhood_id', selectedNeighborhood);
      }

      const [
        propsRes,
        visitsRes,
        pendingRes,
        ovitrapsRes,
        peRes,
        ieRes,
        complaintsRes,
        blocksRes,
        liraaRes,
      ] = await Promise.all([
        propQuery,
        supabase.from('visits').select('*, properties(street, number, neighborhood_id)').eq('municipality_id', muniId).limit(100),
        // pending_visits e liraa_samples não têm municipality_id: filtra pelo município do imóvel
        supabase
          .from('pending_visits')
          .select('*, properties!inner(*)')
          .in('status', PENDING_STATUSES)
          .eq('properties.municipality_id', muniId)
          .limit(100),
        supabase.from('ovitraps').select('*, neighborhoods(name)').eq('municipality_id', muniId).is('deleted_at', null),
        supabase
          .from('strategic_points')
          .select('*, properties(street, number, latitude, longitude, neighborhoods(name))')
          .eq('municipality_id', muniId)
          .is('deleted_at', null),
        supabase
          .from('special_properties')
          .select('*, properties(street, number, latitude, longitude, neighborhoods(name))')
          .eq('municipality_id', muniId)
          .is('deleted_at', null),
        supabase.from('complaints').select('*').eq('municipality_id', muniId).not('status', 'in', '(RESOLVIDA,ARQUIVADA)'),
        supabase.from('blockade_operations').select('*').eq('municipality_id', muniId).is('deleted_at', null).is('ended_at', null),
        supabase
          .from('liraa_samples')
          .select('*, properties!inner(street, number, latitude, longitude, municipality_id)')
          .eq('properties.municipality_id', muniId)
          .limit(150),
      ]);
      // PE e IE não têm coordenadas próprias: usam as do imóvel vinculado
      const withPropertyCoords = (rows: any[] | null) =>
        (rows || []).map((r: any) => ({ ...r, type: r.category, latitude: r.properties?.latitude ?? null, longitude: r.properties?.longitude ?? null }));
      const fociByProperty = await fetchFociByProperty(muniId).catch(() => new Map<string, number>());

      setMapData({
        properties: (propsRes.data || []).map((p: any) => ({ ...p, fociLast12m: fociByProperty.get(p.id) || 0 })),
        visits: visitsRes.data || [],
        pendencies: pendingRes.data || [],
        ovitraps: ovitrapsRes.data || [],
        strategicPoints: withPropertyCoords(peRes.data),
        specialProperties: withPropertyCoords(ieRes.data),
        complaints: complaintsRes.data || [],
        blocks: blocksRes.data || [],
        liraaSamples: liraaRes.data || [],
      });
    } catch (err) {
      console.error('Erro ao carregar dados do mapa:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedNeighborhood]);

  useEffect(() => {
    loadMapData();
  }, [loadMapData]);

  // Inicializar Leaflet map com as coordenadas da Central de Configurações
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    import('leaflet').then(L => {
      const map = L.map(mapContainerRef.current!, {
        center: [mapConfig.centerLatitude, mapConfig.centerLongitude],
        zoom: mapConfig.defaultZoom,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors | Endemias GOV SUS',
        maxZoom: 19,
      }).addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      markersLayerRef.current = markersGroup;
      mapInstanceRef.current = map;

      renderLayers(L, map, markersGroup);
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Re-renderizar layers quando filtros, dados ou coordenadas mudarem
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;
    import('leaflet').then(L => {
      renderLayers(L, mapInstanceRef.current, markersLayerRef.current);
    });
  }, [
    mapData,
    mapConfig,
    showProperties,
    showVisits,
    showPendencies,
    showFoci,
    showRecurrences,
    showOvitraps,
    showStrategicPoints,
    showSpecialProperties,
    showComplaints,
    showBlocks,
    showTerritoryRisk,
    selectedRiskLevel,
  ]);

  const renderLayers = (L: any, map: any, layerGroup: any) => {
    layerGroup.clearLayers();
    // Só desenha o que tem coordenada registrada: nunca posiciona itens no centro
    // do mapa ou em posição aleatória (isso criaria pontos falsos no território).
    const hasCoords = (o: any) =>
      o && o.latitude !== null && o.latitude !== undefined && o.longitude !== null && o.longitude !== undefined &&
      !Number.isNaN(Number(o.latitude)) && !Number.isNaN(Number(o.longitude));

    // 1. Círculos de Risco Territorial por Bairro
    if (showTerritoryRisk) {
      neighborhoodsList.forEach(n => {
        if (!hasCoords(n)) return;
        if (selectedRiskLevel !== 'ALL' && n.riskLevel !== selectedRiskLevel) return;
        const color = n.riskLevel === 'CRITICO' ? '#ef4444' : n.riskLevel === 'ALTO' ? '#f97316' : '#10b981';
        const circle = L.circle([n.latitude, n.longitude], {
          radius: 500,
          color: color,
          fillColor: color,
          fillOpacity: 0.12,
          weight: 1.5,
        });
        circle.bindTooltip(`<b>Bairro ${n.name}</b><br/>Nível de Risco: ${n.riskLevel} (${n.riskScore}/100)`);
        circle.on('click', () => setSelectedItem({ type: 'RISK', data: n }));
        circle.addTo(layerGroup);
      });
    }

    // 2. Raios de Bloqueio Epidemiológico (150m a 300m)
    if (showBlocks) {
      mapData.blocks.forEach(blk => {
        if (!hasCoords(blk)) return;
        const circle = L.circle([blk.latitude, blk.longitude], {
          radius: 150,
          color: '#ef4444',
          fillColor: '#f87171',
          fillOpacity: 0.25,
          weight: 2,
          dashArray: '5, 5',
        });
        circle.bindTooltip(`Bloqueio: ${blk.code || 'sem código'} (${blk.disease || 'doença não informada'})`);
        circle.on('click', () => setSelectedItem({ type: 'BLOCK', data: blk }));
        circle.addTo(layerGroup);
      });
    }

    // 3. Imóveis, Focos e Reincidências
    if (showProperties) {
      mapData.properties.forEach(prop => {
        if (!hasCoords(prop)) return;
        const isFoci = prop.status === 'FOCO';
        const isRecurrent = (prop.fociLast12m || 0) >= RECURRENCE_MIN_FOCI;
        const isClosed = prop.status === 'FECHADO';

        if (isFoci && !showFoci) return;
        if (isRecurrent && !showRecurrences) return;

        const color = isFoci ? '#ef4444' : isRecurrent ? '#9333ea' : isClosed ? '#f59e0b' : '#3b82f6';
        const marker = L.circleMarker([prop.latitude, prop.longitude], {
          radius: isFoci ? 8 : isRecurrent ? 7 : 5,
          fillColor: color,
          color: '#ffffff',
          weight: 1.5,
          opacity: 1,
          fillOpacity: 0.85,
        });

        marker.bindTooltip(`<b>${prop.property_code}</b>: ${prop.street}, ${prop.number}<br/>Situação: ${prop.status}`);
        marker.on('click', () => setSelectedItem({ type: 'PROPERTY', data: prop }));
        marker.addTo(layerGroup);
      });
    }

    // 4. Ovitrampas
    if (showOvitraps) {
      mapData.ovitraps.forEach(ovi => {
        if (!hasCoords(ovi)) return;
        const hasEggs = (ovi.last_eggs_count || 0) > 0 || ovi.is_positive === true;
        const iconHtml = `<div style="background-color: ${hasEggs ? '#dc2626' : '#0284c7'}; width: 22px; height: 22px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">🥚</div>`;
        const customIcon = L.divIcon({
          className: 'custom-ovitrap-icon',
          html: iconHtml,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });

        const marker = L.marker([ovi.latitude, ovi.longitude], { icon: customIcon });
        marker.bindTooltip(`<b>Ovitrampa ${ovi.code}</b><br/>Ovos (última leitura): ${ovi.last_eggs_count ?? 'sem leitura'}`);
        marker.on('click', () => setSelectedItem({ type: 'OVITRAP', data: ovi }));
        marker.addTo(layerGroup);
      });
    }

    // 5. Pontos Estratégicos (PE)
    if (showStrategicPoints) {
      mapData.strategicPoints.forEach(pe => {
        if (!hasCoords(pe)) return;
        const iconHtml = `<div style="background-color: #d97706; width: 24px; height: 24px; border-radius: 6px; border: 2px solid white; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">⚠️</div>`;
        const customIcon = L.divIcon({
          className: 'custom-pe-icon',
          html: iconHtml,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const marker = L.marker([pe.latitude, pe.longitude], { icon: customIcon });
        marker.bindTooltip(`<b>PE: ${pe.name}</b><br/>Tipo: ${pe.type}`);
        marker.on('click', () => setSelectedItem({ type: 'PE', data: pe }));
        marker.addTo(layerGroup);
      });
    }

    // 6. Imóveis Especiais (IE)
    if (showSpecialProperties) {
      mapData.specialProperties.forEach(ie => {
        if (!hasCoords(ie)) return;
        const iconHtml = `<div style="background-color: #4f46e5; width: 22px; height: 22px; border-radius: 6px; border: 2px solid white; display: flex; align-items: center; justify-content: center; color: white; font-size: 11px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">🏢</div>`;
        const customIcon = L.divIcon({
          className: 'custom-ie-icon',
          html: iconHtml,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });

        const marker = L.marker([ie.latitude, ie.longitude], { icon: customIcon });
        marker.bindTooltip(`<b>IE: ${ie.name}</b><br/>Tipo: ${ie.type}`);
        marker.on('click', () => setSelectedItem({ type: 'IE', data: ie }));
        marker.addTo(layerGroup);
      });
    }

    // 7. Denúncias da Comunidade
    if (showComplaints) {
      mapData.complaints.forEach(comp => {
        if (!comp.latitude || !comp.longitude) return;
        const iconHtml = `<div style="background-color: #f97316; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">📢</div>`;
        const customIcon = L.divIcon({
          className: 'custom-complaint-icon',
          html: iconHtml,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });

        const marker = L.marker([comp.latitude, comp.longitude], { icon: customIcon });
        marker.bindTooltip(`<b>Denúncia: ${comp.protocol}</b>`);
        marker.on('click', () => setSelectedItem({ type: 'COMPLAINT', data: comp }));
        marker.addTo(layerGroup);
      });
    }

    // 8. Amostras e Estratos do LIRAa / LIA
    if (showLiraa) {
      mapData.liraaSamples.forEach(sample => {
        const prop = sample.properties;
        if (!hasCoords(prop)) return;
        const lat = prop.latitude;
        const lng = prop.longitude;

        const isPositive = sample.positive || sample.larvae_found;
        const color = isPositive ? '#dc2626' : sample.status === 'visitado' ? '#16a34a' : '#d97706';

        const circle = L.circleMarker([lat, lng], {
          radius: isPositive ? 7 : 5,
          color: '#ffffff',
          weight: 2,
          fillColor: color,
          fillOpacity: 0.9,
        });

        circle.bindTooltip(`<b>Amostra LIRAa</b><br/>${prop?.street || 'Imóvel'}, ${prop?.number || 'S/N'}<br/>Status: ${sample.status.toUpperCase()}<br/>${isPositive ? '⚠️ FOCO POSITIVO' : 'Negativo'}`);
        circle.on('click', () => setSelectedItem({ type: 'PROPERTY', data: prop }));
        circle.addTo(layerGroup);
      });
    }

    // Sem centro configurado: enquadra uma vez os pontos reais do município
    if (!mapConfig.configured && !autoFittedRef.current && layerGroup.getLayers().length > 0) {
      try {
        const bounds = L.featureGroup(layerGroup.getLayers()).getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
          autoFittedRef.current = true;
        }
      } catch {
        /* camadas sem limites calculáveis */
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Controls & Layer Selector */}
      <PageHeader
        icon={Layers}
        title="Mapa Municipal de Endemias & Vigilância Espacial"
        subtitle="Camadas territoriais conectadas ao PostgreSQL, geolocalização e raio de bloqueio peridomiciliar"
        actions={
          <>
            <button
              onClick={handleRecenter}
              className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs"
              title={`Centralizar em (${mapConfig.centerLatitude.toFixed(4)}, ${mapConfig.centerLongitude.toFixed(4)})`}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Centralizar Município</span>
            </button>
            <select
              value={selectedNeighborhood}
              onChange={e => setSelectedNeighborhood(e.target.value)}
              className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 font-medium text-slate-700 outline-none cursor-pointer text-xs"
            >
              <option value="ALL">Todos os Bairros</option>
              {neighborhoodsList.map(n => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>

            <select
              value={selectedRiskLevel}
              onChange={e => setSelectedRiskLevel(e.target.value)}
              className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 font-medium text-slate-700 outline-none cursor-pointer text-xs"
            >
              <option value="ALL">Todos os Níveis de Risco</option>
              <option value="CRITICO">Risco Crítico</option>
              <option value="ALTO">Risco Alto</option>
              <option value="ATENCAO">Atenção</option>
              <option value="BAIXO">Baixo Risco</option>
            </select>

            <button
              onClick={loadMapData}
              disabled={isLoading}
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition"
              title="Atualizar dados do mapa"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </>
        }
      />

      {/* Camadas Ativáveis */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-2 text-xs font-semibold">
        <button
          onClick={() => setShowProperties(!showProperties)}
          className={`px-2.5 py-1.5 rounded-lg border transition flex items-center gap-1.5 ${
            showProperties ? 'bg-blue-50 border-blue-300 text-blue-800' : 'bg-slate-50 text-slate-400 border-slate-200'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          <span>Imóveis ({mapData.properties.length})</span>
        </button>

        <button
          onClick={() => setShowFoci(!showFoci)}
          className={`px-2.5 py-1.5 rounded-lg border transition flex items-center gap-1.5 ${
            showFoci ? 'bg-rose-50 border-rose-300 text-rose-800' : 'bg-slate-50 text-slate-400 border-slate-200'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
          <span>Focos Ativos</span>
        </button>

        <button
          onClick={() => setShowRecurrences(!showRecurrences)}
          className={`px-2.5 py-1.5 rounded-lg border transition flex items-center gap-1.5 ${
            showRecurrences ? 'bg-purple-50 border-purple-300 text-purple-800' : 'bg-slate-50 text-slate-400 border-slate-200'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
          <span>Reincidências</span>
        </button>

        <button
          onClick={() => setShowOvitraps(!showOvitraps)}
          className={`px-2.5 py-1.5 rounded-lg border transition flex items-center gap-1.5 ${
            showOvitraps ? 'bg-sky-50 border-sky-300 text-sky-800' : 'bg-slate-50 text-slate-400 border-slate-200'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-sky-600" />
          <span>Ovitrampas ({mapData.ovitraps.length})</span>
        </button>

        <button
          onClick={() => setShowStrategicPoints(!showStrategicPoints)}
          className={`px-2.5 py-1.5 rounded-lg border transition flex items-center gap-1.5 ${
            showStrategicPoints ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-slate-50 text-slate-400 border-slate-200'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span>PE Quinzenal ({mapData.strategicPoints.length})</span>
        </button>

        <button
          onClick={() => setShowSpecialProperties(!showSpecialProperties)}
          className={`px-2.5 py-1.5 rounded-lg border transition flex items-center gap-1.5 ${
            showSpecialProperties ? 'bg-indigo-50 border-indigo-300 text-indigo-800' : 'bg-slate-50 text-slate-400 border-slate-200'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
          <span>Imóveis Especiais ({mapData.specialProperties.length})</span>
        </button>

        <button
          onClick={() => setShowBlocks(!showBlocks)}
          className={`px-2.5 py-1.5 rounded-lg border transition flex items-center gap-1.5 ${
            showBlocks ? 'bg-red-50 border-red-300 text-red-800' : 'bg-slate-50 text-slate-400 border-slate-200'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
          <span>Bloqueios ({mapData.blocks.length})</span>
        </button>

        <button
          onClick={() => setShowLiraa(!showLiraa)}
          className={`px-2.5 py-1.5 rounded-lg border transition flex items-center gap-1.5 ${
            showLiraa ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-slate-50 text-slate-400 border-slate-200'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span>LIRAa ({mapData.liraaSamples.length})</span>
        </button>

        <button
          onClick={() => setShowTerritoryRisk(!showTerritoryRisk)}
          className={`px-2.5 py-1.5 rounded-lg border transition flex items-center gap-1.5 ${
            showTerritoryRisk ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-slate-50 text-slate-400 border-slate-200'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span>Risco Territorial</span>
        </button>
      </div>

      {/* Map Container */}
      <div className="relative w-full h-[640px] rounded-2xl overflow-hidden border border-slate-200 shadow-md">
        <div ref={mapContainerRef} className="w-full h-full z-10" />

        {/* Floating Details Drawer when item clicked */}
        {selectedItem && (
          <div className="absolute bottom-4 right-4 z-20 w-80 bg-white/95 backdrop-blur-sm p-4 rounded-xl shadow-2xl border border-slate-200 text-xs text-slate-800 animate-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="font-extrabold uppercase text-[10px] text-blue-700 tracking-wider">
                {selectedItem.type === 'PROPERTY' && 'Ficha Rápida do Imóvel'}
                {selectedItem.type === 'OVITRAP' && 'Vigilância Entomológica - Ovitrampa'}
                {selectedItem.type === 'PE' && 'Ponto Estratégico (PE)'}
                {selectedItem.type === 'IE' && 'Imóvel Especial (IE)'}
                {selectedItem.type === 'COMPLAINT' && 'Denúncia Cidadã'}
                {selectedItem.type === 'BLOCK' && 'Operação de Bloqueio'}
                {selectedItem.type === 'RISK' && 'Risco Territorial'}
              </span>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="mt-2.5 space-y-1.5">
              {selectedItem.type === 'PROPERTY' && (
                <>
                  <p className="font-extrabold text-sm text-slate-900">
                    {selectedItem.data.street}, {selectedItem.data.number}
                  </p>
                  <p className="text-slate-500">
                    Código: <strong>{selectedItem.data.property_code}</strong>
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <span className={`px-2 py-0.5 rounded font-bold ${
                      selectedItem.data.status === 'FOCO' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {selectedItem.data.status}
                    </span>
                    <span className="text-[10px] text-slate-500">Tipo: {selectedItem.data.property_type}</span>
                  </div>
                </>
              )}

              {selectedItem.type === 'OVITRAP' && (
                <>
                  <p className="font-extrabold text-sm text-slate-900">Ovitrampa {selectedItem.data.code}</p>
                  <p className="text-slate-500">{selectedItem.data.address}</p>
                  <p className="font-bold text-sky-700 pt-1">Última Leitura: {selectedItem.data.eggs_count || 0} ovos de Aedes</p>
                </>
              )}

              {selectedItem.type === 'PE' && (
                <>
                  <p className="font-extrabold text-sm text-slate-900">{selectedItem.data.name}</p>
                  <p className="text-slate-500">{selectedItem.data.address}</p>
                  <p className="text-[11px] text-slate-700 font-semibold pt-1">Tipo: {selectedItem.data.type}</p>
                </>
              )}

              {selectedItem.type === 'IE' && (
                <>
                  <p className="font-extrabold text-sm text-slate-900">{selectedItem.data.name}</p>
                  <p className="text-slate-500">{selectedItem.data.address}</p>
                  <p className="text-indigo-700 font-semibold">Tipo: {selectedItem.data.type}</p>
                </>
              )}

              {selectedItem.type === 'BLOCK' && (
                <>
                  <p className="font-extrabold text-sm text-rose-700">
                    {selectedItem.data.code || 'BLQ'} — {selectedItem.data.disease || 'Dengue'}
                  </p>
                  <p className="text-slate-500">Raio de bloqueio peridomiciliar: {selectedItem.data.radius_meters || 150}m</p>
                </>
              )}

              {selectedItem.type === 'RISK' && (
                <>
                  <p className="font-extrabold text-sm text-slate-900">Bairro {selectedItem.data.name}</p>
                  <p className="font-bold text-amber-600">Risco: {selectedItem.data.riskLevel} ({selectedItem.data.riskScore}/100)</p>
                  <p className="text-slate-500 text-[11px]">População: {selectedItem.data.estimatedPopulation?.toLocaleString('pt-BR')} hab.</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
