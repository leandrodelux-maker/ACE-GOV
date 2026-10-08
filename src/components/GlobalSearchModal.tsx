import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  MapPin,
  Home,
  Users,
  AlertTriangle,
  Flame,
  Shield,
  X,
  ArrowRight,
  Crosshair,
  Layers,
  Activity,
  FileText,
} from 'lucide-react';
import { db } from '../services/storage';
import { useAuth } from '../contexts/AuthContext';
import { ROUTES, canAccessView, isViewModule } from '../config/routes';
import { NAV_GROUPS, UTILITY_NAV_ITEMS } from '../config/navigation';

const MVP_SEARCHABLE_VIEWS = new Set([
  ...NAV_GROUPS.flatMap((group) => group.items.map((item) => item.view)),
  ...UTILITY_NAV_ITEMS.map((item) => item.view),
]);

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectResult: (module: string, itemId?: string) => void;
}

export interface SearchResultItem {
  category: string;
  title: string;
  subtitle: string;
  module: string;
  itemId?: string;
  icon: React.ElementType;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectResult,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { can, hasRole } = useAuth();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearchTerm('');
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Busca com debounce de 250ms conectada a todas as entidades reais
  useEffect(() => {
    if (!searchTerm.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const handler = setTimeout(() => {
      const term = searchTerm.toLowerCase();
      const found: SearchResultItem[] = [];

      // 0. Telas do sistema (mapa central de rotas)
      ROUTES.filter((r) => r.searchable && MVP_SEARCHABLE_VIEWS.has(r.view)).forEach((r) => {
        if (r.title.toLowerCase().includes(term) || r.path.toLowerCase().includes(term)) {
          found.push({
            category: 'NAVEGAÇÃO / MÓDULO',
            title: r.title,
            subtitle: r.path,
            module: r.view,
            icon: ArrowRight,
          });
        }
      });

      // 1. Imóveis
      try {
        const properties = db.getProperties();
        properties.forEach(p => {
          if (
            p.code.toLowerCase().includes(term) ||
            p.address.toLowerCase().includes(term) ||
            p.neighborhood.toLowerCase().includes(term)
          ) {
            found.push({
              category: 'IMÓVEIS',
              title: `${p.address}, ${p.number}`,
              subtitle: `${p.code} • ${p.neighborhood} • Tipo: ${p.type} • Status: ${p.status}`,
              module: 'properties',
              itemId: p.id,
              icon: Home,
            });
          }
        });
      } catch {}

      // 2. Bairros & Território
      try {
        const neighborhoods = db.getNeighborhoods();
        neighborhoods.forEach(n => {
          if (n.name.toLowerCase().includes(term)) {
            found.push({
              category: 'TERRITÓRIO & BAIRROS',
              title: `Bairro ${n.name}`,
              subtitle: `${n.totalProperties ?? 'Sem dados de'} imóveis • Focos: ${n.fociCount ?? 'sem dados'}`,
              module: 'territory',
              itemId: n.id,
              icon: MapPin,
            });
          }
        });
      } catch {}

      // 4. Denúncias Comunitárias
      try {
        const complaints = db.getComplaints();
        complaints.forEach(c => {
          if (
            c.protocol.toLowerCase().includes(term) ||
            (c.address && c.address.toLowerCase().includes(term)) ||
            (c.description && c.description.toLowerCase().includes(term))
          ) {
            found.push({
              category: 'DENÚNCIAS & OUVIDORIA',
              title: `Protocolo ${c.protocol}`,
              subtitle: `${c.address} • Status: ${c.status} • Prioridade: ${c.priority || 'MÉDIA'}`,
              module: 'complaints',
              itemId: c.id,
              icon: AlertTriangle,
            });
          }
        });
      } catch {}

      // 5. Ovitrampas
      try {
        const ovitraps = db.getOvitraps();
        ovitraps.forEach(ovi => {
          if (
            ovi.code.toLowerCase().includes(term) ||
            ovi.neighborhood.toLowerCase().includes(term) ||
            ovi.address.toLowerCase().includes(term)
          ) {
            found.push({
              category: 'REDE DE OVITRAMPAS',
              title: `Armadilha ${ovi.code}`,
              subtitle: `${ovi.address} (${ovi.neighborhood}) • Status: ${ovi.status}`,
              module: 'ovitraps',
              itemId: ovi.id,
              icon: Flame,
            });
          }
        });
      } catch {}

      // 6. Pontos Estratégicos (PE)
      try {
        const pes = db.getStrategicPoints();
        pes.forEach(pe => {
          if (
            pe.name.toLowerCase().includes(term) ||
            pe.address.toLowerCase().includes(term) ||
            pe.type.toLowerCase().includes(term)
          ) {
            found.push({
              category: 'PONTOS ESTRATÉGICOS (PE)',
              title: pe.name,
              subtitle: `${pe.type} • ${pe.address} • Próxima Vistoria: ${pe.nextInspectionDate}`,
              module: 'strategic_points',
              itemId: pe.id,
              icon: Crosshair,
            });
          }
        });
      } catch {}

      // 7. Bloqueios e Casos Epidemiológicos
      try {
        const blocks = db.getEpidemiologyBlocks();
        blocks.forEach(b => {
          if (
            b.code.toLowerCase().includes(term) ||
            b.disease.toLowerCase().includes(term) ||
            b.targetNeighborhood.toLowerCase().includes(term)
          ) {
            found.push({
              category: 'BLOQUEIOS EPIDEMIOLÓGICOS',
              title: `Bloqueio ${b.code} (${b.disease})`,
              subtitle: `${b.targetNeighborhood} • Status: ${b.status}`,
              module: 'epidemiology',
              itemId: b.id,
              icon: Activity,
            });
          }
        });
      } catch {}

      // Só oferece destinos que existem e que o perfil pode abrir (mesma regra das rotas)
      const access = { can, hasRole };
      setResults(found.filter((r) => isViewModule(r.module) && canAccessView(r.module, access)).slice(0, 20));
      setIsSearching(false);
    }, 250);

    return () => clearTimeout(handler);
  }, [searchTerm, can, hasRole]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-16 sm:pt-24" role="dialog" aria-modal="true" aria-label="Busca global">
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-2xl">
        {/* Input de Busca */}
        <div className="p-4 border-b border-slate-200 flex items-center gap-3 bg-slate-50">
          <Search className="w-5 h-5 text-slate-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            name="global-search"
            aria-label="Buscar no sistema"
            autoComplete="off"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Pesquise por Imóvel, Endereço, Bairro, ACE, Denúncia, Ovitrampa ou Bloqueio..."
            className="w-full bg-transparent text-sm font-medium focus:outline-none placeholder:text-slate-400"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Limpar busca"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="min-h-10 rounded-lg bg-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-300"
            aria-label="Fechar busca"
          >
            ESC
          </button>
        </div>

        {/* Resultados */}
        <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
          {isSearching ? (
            <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span>Buscando registros integrados...</span>
            </div>
          ) : results.length > 0 ? (
            results.map((item, idx) => {
              const Icon = item.icon;
              return (
                <button
                  type="button"
                  key={`${item.category}-${item.title}-${idx}`}
                  onClick={() => {
                    onSelectResult(item.module, item.itemId);
                    onClose();
                  }}
                  className="group flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-slate-100 text-slate-700 group-hover:bg-blue-50 group-hover:text-blue-700 transition">
                      <Icon className="w-4 h-4 flex-shrink-0" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-600">
                          {item.category}
                        </span>
                        <span className="truncate text-sm font-bold text-slate-900">
                          {item.title}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition flex-shrink-0 ml-2" />
                </button>
              );
            })
          ) : searchTerm ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Nenhum registro encontrado para "{searchTerm}". Verifique o termo e tente novamente.
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-400">
              Digite ao menos uma palavra para buscar em tempo real por imóveis, agentes, denúncias, ovitrampas e bloqueios.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
