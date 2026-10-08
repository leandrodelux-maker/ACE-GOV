import React, { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  /** categoria da legenda */
  category: string;
  /** texto do popup (sem dados pessoais) */
  label: string;
}

/**
 * Mapa de pontos por categoria (Leaflet carregado sob demanda). Só desenha pontos
 * com coordenada registrada; a legenda informa quantos ficaram sem coordenada.
 */
export const PointsMap: React.FC<{
  points: MapPoint[];
  colors: Record<string, string>;
  withoutCoordinates?: number;
  height?: number;
  ariaLabel: string;
}> = ({ points, colors, withoutCoordinates = 0, height = 320, ariaLabel }) => {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const layer = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    import('leaflet').then((L) => {
      if (cancelled || !el.current) return;
      if (!map.current) {
        map.current = L.map(el.current, { zoomControl: true, attributionControl: true }).setView([-15.8, -47.9], 4);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; colaboradores do OpenStreetMap',
        }).addTo(map.current);
      }
      layer.current?.remove();
      layer.current = L.layerGroup().addTo(map.current);
      const valid = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && !(p.lat === 0 && p.lng === 0));
      for (const p of valid) {
        L.circleMarker([p.lat, p.lng], {
          radius: 6,
          color: '#ffffff',
          weight: 2,
          fillColor: colors[p.category] || '#64748b',
          fillOpacity: 0.95,
        })
          .bindPopup(`<strong>${escapeHtml(p.category)}</strong><br/>${escapeHtml(p.label)}`)
          .addTo(layer.current);
      }
      if (valid.length) map.current.fitBounds(L.latLngBounds(valid.map((p) => [p.lat, p.lng] as [number, number])).pad(0.15), { maxZoom: 17 });
    });
    return () => {
      cancelled = true;
    };
  }, [points, colors]);

  useEffect(() => () => {
    map.current?.remove();
    map.current = null;
  }, []);

  const counts = Object.keys(colors).map((c) => ({ c, n: points.filter((p) => p.category === c).length }));
  return (
    <div className="space-y-2">
      <div ref={el} style={{ height }} className="z-0 w-full overflow-hidden rounded-xl border border-slate-200" role="region" aria-label={ariaLabel} />
      <div className="flex flex-wrap gap-3 text-xs text-slate-700">
        {counts.map(({ c, n }) => (
          <span key={c} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors[c] }} aria-hidden="true" /> {c} ({n})
          </span>
        ))}
        {withoutCoordinates > 0 && <span className="text-slate-500">{withoutCoordinates} sem coordenada (não aparecem no mapa)</span>}
      </div>
    </div>
  );
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
