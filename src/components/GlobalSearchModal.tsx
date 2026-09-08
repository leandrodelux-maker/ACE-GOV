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
} from 'lucide-react';
import { db } from '../services/storage';

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

  const properties = db.getProperties();
  const neighborhoods = db.getNeighborhoods();
  const cases = db.getEpidemiologyBlocks();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearchTerm('');
      setResults([]);
    }
  }, [isOpen]);

  // Busca com debounce de 300ms
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

      // 1. Imóveis
      properties.forEach(p => {
        if (
          p.code.toLowerCase().includes(term) ||
          p.address.toLowerCase().includes(term) ||
          p.neighborhood.toLowerCase().includes(term)
        ) {
          found.push({
            category: 'IMÓVEIS',
            title: `${p.address}, ${p.number}`,
            subtitle: `${p.code} • ${p.neighborhood} • ${p.type}`,
            module: 'properties',
            itemId: p.id,
            icon: Home,
          });
        }
      });

      // 2. Bairros
      neighborhoods.forEach(n => {
        if (n.name.toLowerCase().includes(term)) {
          found.push({
            category: 'TERRITÓRIO & BAIRROS',
            title: `Bairro ${n.name}`,
            subtitle: `${n.totalProperties} imóveis • Cobertura: ${n.coveragePercentage}% • Risco: ${n.riskScore}/100`,
            module: 'territory',
            itemId: n.id,
            icon: MapPin,
          });
        }
      });

      // 3. Agentes ACE & Equipes
      const agents = [
        { name: 'Carlos Eduardo Oliveira', code: 'ACE-104', team: 'Equipe Alpha' },
        { name: 'Mariana Souza Santos', code: 'ACE-108', team: 'Equipe Alpha' },
        { name: 'Lucas Ferreira Lima', code: 'ACE-112', team: 'Equipe Beta' },
        { name: 'Juliana Mendes Rocha', code: 'ACE-115', team: 'Equipe Beta' },
      ];
      agents.forEach(a => {
        if (a.name.toLowerCase().includes(term) || a.code.toLowerCase().includes(term) || a.team.toLowerCase().includes(term)) {
          found.push({
            category: 'AGENTES (ACE)',
            title: a.name,
            subtitle: `${a.code} • ${a.team}`,
            module: 'productivity',
            icon: Users,
          });
        }
      });

      // 4. Denúncias
      const complaints = [
        { protocol: 'DEN-2026-0012', address: 'Rua Marechal Deodoro, 1450', neighborhood: 'Vila Nova' },
        { protocol: 'DEN-2026-0015', address: 'Av. Independência, 320', neighborhood: 'Centro' },
      ];
      complaints.forEach(c => {
        if (c.protocol.toLowerCase().includes(term) || c.address.toLowerCase().includes(term)) {
          found.push({
            category: 'DENÚNCIAS',
            title: c.protocol,
            subtitle: `${c.address} (${c.neighborhood})`,
            module: 'complaints',
            icon: AlertTriangle,
          });
        }
      });

      // 5. Pontos Estratégicos
      const pes = [
        { name: 'Borracharia Central', type: 'Borracharia', address: 'Rua Deodoro, 1020' },
        { name: 'Ferro Velho Rodoviário', type: 'Ferro Velho', address: 'Av. Presidente Vargas, 500' },
      ];
      pes.forEach(pe => {
        if (pe.name.toLowerCase().includes(term) || pe.address.toLowerCase().includes(term)) {
          found.push({
            category: 'PONTOS ESTRATÉGICOS (PE)',
            title: pe.name,
            subtitle: `${pe.type} • ${pe.address}`,
            module: 'strategic_points',
            icon: Crosshair,
          });
        }
      });

      // 6. Casos Epidemiológicos
      const epiCases = [
        { number: 'SINAN-2026-00124', disease: 'Dengue', location: 'Vila Nova' },
        { number: 'SINAN-2026-00125', disease: 'Zika', location: 'Centro' },
      ];
      epiCases.forEach(ec => {
        if (ec.number.toLowerCase().includes(term) || ec.disease.toLowerCase().includes(term)) {
          found.push({
            category: 'EPIDEMIOLOGIA',
            title: `${ec.disease} — ${ec.number}`,
            subtitle: `Notificação confirmada em ${ec.location}`,
            module: 'epidemiology',
            icon: Activity,
          });
        }
      });

      setResults(found.slice(0, 15));
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchTerm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/50 backdrop-blur-xs">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-slate-900">
        {/* Input de Busca */}
        <div className="p-4 border-b border-slate-200 flex items-center gap-3 bg-slate-50">
          <Search className="w-5 h-5 text-slate-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Pesquise por Imóvel, Logradouro, Bairro, ACE, Denúncia, PE, Ovitrampa ou Caso Sinan..."
            className="w-full bg-transparent text-sm font-medium focus:outline-none placeholder:text-slate-400"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="p-1 text-slate-400 hover:text-slate-600 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 px-2 py-1 bg-slate-200 rounded-md"
          >
            ESC
          </button>
        </div>

        {/* Resultados Agrupados */}
        <div className="max-h-96 overflow-y-auto p-2 divide-y divide-slate-100">
          {results.map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={idx}
                onClick={() => {
                  onSelectResult(item.module, item.itemId);
                  onClose();
                }}
                className="w-full p-3 hover:bg-slate-50 rounded-xl transition flex items-center justify-between text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase text-indigo-700 block tracking-wider">
                      {item.category}
                    </span>
                    <h4 className="font-bold text-xs text-slate-900 leading-tight group-hover:text-indigo-600 transition">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 leading-tight">{item.subtitle}</p>
                  </div>
                </div>

                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition" />
              </button>
            );
          })}

          {searchTerm && results.length === 0 && !isSearching && (
            <div className="text-center py-10 text-xs text-slate-400">
              Nenhum registro encontrado para <strong>"{searchTerm}"</strong> neste município.
            </div>
          )}

          {!searchTerm && (
            <div className="p-4 text-center text-xs text-slate-400 space-y-1">
              <p>Digite para buscar instantaneamente em toda a base municipal.</p>
              <p className="text-[11px] text-slate-300">Respeita permissões de acesso e filtros por município.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
