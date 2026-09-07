import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { db } from '../../services/storage';
import { Property, Ovitrap, StrategicPoint, CitizenComplaint, EpidemiologicalBlock } from '../../types';

export const MapView: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);

  // Layer toggles
  const [showProperties, setShowProperties] = useState(true);
  const [showFoci, setShowFoci] = useState(true);
  const [showOvitraps, setShowOvitraps] = useState(true);
  const [showStrategicPoints, setShowStrategicPoints] = useState(true);
  const [showComplaints, setShowComplaints] = useState(true);
  const [showBlocks, setShowBlocks] = useState(true);

  // Selected item modal / info drawer
  const [selectedItem, setSelectedItem] = useState<{
    type: 'PROPERTY' | 'OVITRAP' | 'PE' | 'COMPLAINT' | 'BLOCK';
    data: any;
  } | null>(null);

  const municipality = db.getMunicipality();
  const properties = db.getProperties();
  const ovitraps = db.getOvitraps();
  const strategicPoints = db.getStrategicPoints();
  const complaints = db.getComplaints();
  const blocks = db.getEpidemiologyBlocks();

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Check if L is available on window or dynamic import
    import('leaflet').then(L => {
      // Base map center at Santa Cruz do Sul (-29.7180, -52.4280)
      const map = L.map(mapContainerRef.current!, {
        center: [-29.7180, -52.4280],
        zoom: 14,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Endemias GOV',
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

  // Update map markers when filters change
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;
    import('leaflet').then(L => {
      renderLayers(L, mapInstanceRef.current, markersLayerRef.current);
    });
  }, [showProperties, showFoci, showOvitraps, showStrategicPoints, showComplaints, showBlocks]);

  const renderLayers = (L: any, map: any, layerGroup: any) => {
    layerGroup.clearLayers();

    // 1. Blocks circles (Raio de Bloqueio 150m - 300m)
    if (showBlocks) {
      blocks.forEach(blk => {
        const circle = L.circle([-29.7125, -52.4290], {
          radius: blk.radiusMeters || 150,
          color: '#ef4444',
          fillColor: '#f87171',
          fillOpacity: 0.25,
          weight: 2,
          dashArray: '5, 5',
        });
        circle.bindTooltip(`Bloqueio: ${blk.code} (${blk.disease}) - Raio ${blk.radiusMeters}m`);
        circle.on('click', () => setSelectedItem({ type: 'BLOCK', data: blk }));
        circle.addTo(layerGroup);
      });
    }

    // 2. Properties & Foci
    if (showProperties) {
      properties.forEach(prop => {
        const isFoci = prop.status === 'FOCO';
        const isRecurrent = prop.isRecurrent;
        if (isFoci && !showFoci) return;

        const color = isFoci ? '#ef4444' : isRecurrent ? '#a855f7' : prop.status === 'FECHADO' ? '#f59e0b' : '#3b82f6';
        const marker = L.circleMarker([prop.latitude, prop.longitude], {
          radius: isFoci ? 9 : 6,
          fillColor: color,
          color: '#ffffff',
          weight: 1.5,
          opacity: 1,
          fillOpacity: 0.85,
        });

        marker.bindTooltip(`<b>${prop.code}</b>: ${prop.address}, ${prop.number}<br/>Status: ${prop.status}`);
        marker.on('click', () => setSelectedItem({ type: 'PROPERTY', data: prop }));
        marker.addTo(layerGroup);
      });
    }

    // 3. Ovitraps
    if (showOvitraps) {
      ovitraps.forEach(ovi => {
        const iconHtml = `<div style="background-color: ${ovi.growthAlert ? '#dc2626' : '#0284c7'}; width: 22px; height: 22px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">🥚</div>`;
        const customIcon = L.divIcon({
          className: 'custom-ovitrap-icon',
          html: iconHtml,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });

        const marker = L.marker([ovi.latitude, ovi.longitude], { icon: customIcon });
        marker.bindTooltip(`<b>Ovitrampa ${ovi.code}</b><br/>Última leitura: ${ovi.lastEggCount ?? 0} ovos`);
        marker.on('click', () => setSelectedItem({ type: 'OVITRAP', data: ovi }));
        marker.addTo(layerGroup);
      });
    }

    // 4. Strategic Points (PE)
    if (showStrategicPoints) {
      strategicPoints.forEach(pe => {
        const iconHtml = `<div style="background-color: ${pe.isInspectionOverdue ? '#e11d48' : '#d97706'}; width: 24px; height: 24px; border-radius: 6px; border: 2px solid white; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">⚠️</div>`;
        const customIcon = L.divIcon({
          className: 'custom-pe-icon',
          html: iconHtml,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const marker = L.marker([pe.latitude, pe.longitude], { icon: customIcon });
        marker.bindTooltip(`<b>PE: ${pe.name}</b><br/>Tipo: ${pe.type} (${pe.isInspectionOverdue ? 'VENCIDA' : 'Em dia'})`);
        marker.on('click', () => setSelectedItem({ type: 'PE', data: pe }));
        marker.addTo(layerGroup);
      });
    }

    // 5. Complaints
    if (showComplaints) {
      complaints.forEach(comp => {
        if (!comp.latitude || !comp.longitude) return;
        const iconHtml = `<div style="background-color: #f97316; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">📢</div>`;
        const customIcon = L.divIcon({
          className: 'custom-complaint-icon',
          html: iconHtml,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });

        const marker = L.marker([comp.latitude, comp.longitude], { icon: customIcon });
        marker.bindTooltip(`<b>Denúncia: ${comp.protocol}</b><br/>${comp.type}`);
        marker.on('click', () => setSelectedItem({ type: 'COMPLAINT', data: comp }));
        marker.addTo(layerGroup);
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Controls & Layer Selector */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            <span>Mapa Municipal de Endemias</span>
          </h1>
          <p className="text-xs text-slate-500">
            Camadas territoriais, focos, ovitrampas, pontos estratégicos e bloqueios georreferenciados
          </p>
        </div>

        {/* Camadas Toggles */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <button
            onClick={() => setShowProperties(!showProperties)}
            className={`px-2.5 py-1.5 rounded-lg border transition flex items-center gap-1.5 ${
              showProperties ? 'bg-blue-50 border-blue-300 text-blue-800' : 'bg-slate-50 text-slate-400 border-slate-200'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span>Imóveis ({properties.length})</span>
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
            onClick={() => setShowOvitraps(!showOvitraps)}
            className={`px-2.5 py-1.5 rounded-lg border transition flex items-center gap-1.5 ${
              showOvitraps ? 'bg-sky-50 border-sky-300 text-sky-800' : 'bg-slate-50 text-slate-400 border-slate-200'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-sky-600" />
            <span>Ovitrampas ({ovitraps.length})</span>
          </button>

          <button
            onClick={() => setShowStrategicPoints(!showStrategicPoints)}
            className={`px-2.5 py-1.5 rounded-lg border transition flex items-center gap-1.5 ${
              showStrategicPoints ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-slate-50 text-slate-400 border-slate-200'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>Pontos Estratégicos ({strategicPoints.length})</span>
          </button>

          <button
            onClick={() => setShowComplaints(!showComplaints)}
            className={`px-2.5 py-1.5 rounded-lg border transition flex items-center gap-1.5 ${
              showComplaints ? 'bg-orange-50 border-orange-300 text-orange-800' : 'bg-slate-50 text-slate-400 border-slate-200'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
            <span>Denúncias ({complaints.length})</span>
          </button>

          <button
            onClick={() => setShowBlocks(!showBlocks)}
            className={`px-2.5 py-1.5 rounded-lg border transition flex items-center gap-1.5 ${
              showBlocks ? 'bg-red-50 border-red-300 text-red-800' : 'bg-slate-50 text-slate-400 border-slate-200'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
            <span>Bloqueios ({blocks.length})</span>
          </button>
        </div>
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
                {selectedItem.type === 'COMPLAINT' && 'Denúncia Cidadã'}
                {selectedItem.type === 'BLOCK' && 'Operação de Bloqueio'}
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
                  <p className="font-extrabold text-sm text-slate-900">{selectedItem.data.address}, {selectedItem.data.number}</p>
                  <p className="text-slate-500">{selectedItem.data.neighborhood} • {selectedItem.data.block}</p>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-700">
                      Código: {selectedItem.data.code}
                    </span>
                    <span className={`px-2 py-0.5 rounded font-bold ${
                      selectedItem.data.status === 'FOCO' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {selectedItem.data.status}
                    </span>
                  </div>
                  {selectedItem.data.notes && (
                    <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded mt-2">
                      {selectedItem.data.notes}
                    </p>
                  )}
                </>
              )}

              {selectedItem.type === 'OVITRAP' && (
                <>
                  <p className="font-extrabold text-sm text-slate-900">Ovitrampa {selectedItem.data.code}</p>
                  <p className="text-slate-500">{selectedItem.data.address} ({selectedItem.data.neighborhood})</p>
                  <p className="font-bold text-sky-700 pt-1">Última Leitura: {selectedItem.data.lastEggCount} ovos de Aedes</p>
                  {selectedItem.data.growthAlert && (
                    <p className="text-rose-700 font-bold bg-rose-50 p-1.5 rounded text-[10px]">
                      ⚠️ Alerta: Crescimento consecutivo de ovos registrado!
                    </p>
                  )}
                </>
              )}

              {selectedItem.type === 'PE' && (
                <>
                  <p className="font-extrabold text-sm text-slate-900">{selectedItem.data.name}</p>
                  <p className="text-slate-500">{selectedItem.data.address}</p>
                  <p className="text-[11px] text-slate-700 font-semibold pt-1">Tipo: {selectedItem.data.type} • Risco: {selectedItem.data.riskLevel}</p>
                  <p className={`font-bold ${selectedItem.data.isInspectionOverdue ? 'text-rose-600' : 'text-emerald-700'}`}>
                    {selectedItem.data.isInspectionOverdue ? 'Inspeção Quinzenal VENCIDA' : 'Inspeção em dia'}
                  </p>
                </>
              )}

              {selectedItem.type === 'COMPLAINT' && (
                <>
                  <p className="font-extrabold text-sm text-slate-900">{selectedItem.data.protocol}</p>
                  <p className="text-slate-500">{selectedItem.data.address}</p>
                  <p className="text-slate-700 font-semibold">{selectedItem.data.type}</p>
                  <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded">{selectedItem.data.description}</p>
                </>
              )}

              {selectedItem.type === 'BLOCK' && (
                <>
                  <p className="font-extrabold text-sm text-rose-700">{selectedItem.data.code} — {selectedItem.data.disease}</p>
                  <p className="text-slate-500">Área: {selectedItem.data.targetNeighborhood} ({selectedItem.data.targetSector})</p>
                  <p className="font-bold text-slate-800">Raio de bloqueio peridomiciliar: {selectedItem.data.radiusMeters}m</p>
                  <p className="font-semibold text-emerald-700">Cobertura: {selectedItem.data.coveragePercentage}% ({selectedItem.data.propertiesVisited} / {selectedItem.data.propertiesForecast} imóveis)</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
