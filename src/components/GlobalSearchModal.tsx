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

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearchTerm('');
      setResults([]);
    }
  }, [isOpen]);

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

      // 0. Módulos e Atalhos do Sistema
      const SYSTEM_MODULES = [
        { name: 'Central de Território', desc: 'Bairros, Setores, Quadras e Microáreas', module: 'territory', icon: MapPin },
        { name: 'Cadastro de Imóveis', desc: 'Gestão completa de imóveis e cadastros', module: 'properties', icon: Home },
        { name: 'Sala de Situação', desc: 'Dashboard e monitoramento de indicadores', module: 'dashboard', icon: Activity },
        { name: 'PWA do Agente (ACE)', desc: 'Modo de campo para agentes e supervisores', module: 'ace_pwa', icon: Users },
        { name: 'Visitas Domiciliares', desc: 'Registro e histórico de inspeções', module: 'visits', icon: Home },
        { name: 'Pendências de Campo', desc: 'Imóveis fechados, desabitados e recusas', module: 'field_pendencies', icon: AlertTriangle },
        { name: 'Mapa Municipal', desc: 'Visualização geográfica de imóveis e focos', module: 'map', icon: MapPin },
        { name: 'Ovitrampas (Ovos)', desc: 'Rede sentinela de armadilhas', module: 'ovitraps', icon: Flame },
        { name: 'LIRAa / LIA', desc: 'Levantamento Rápido de Índices de Infestação', module: 'liraa', icon: Activity },
        { name: 'Central de Configurações', desc: 'Parâmetros municipais, mapas e alertas', module: 'system_settings', icon: Shield },
        { name: 'Central de Relatórios', desc: 'Boletins epidemiológicos oficiais SUS', module: 'reports', icon: FileText },
        { name: 'Usuários e Permissões', desc: 'Controle de acessos e perfis', module: 'admin_users', icon: Users },
      ];

      SYSTEM_MODULES.forEach(m => {
        if (m.name.toLowerCase().includes(term) || m.desc.toLowerCase().includes(term) || m.module.includes(term)) {
          found.push({
            category: 'NAVEGAÇÃO / MÓDULO',
            title: m.name,
            subtitle: m.desc,
            module: m.module,
            icon: m.icon,
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
              subtitle: `${n.totalProperties} imóveis • Cobertura: ${n.coveragePercentage}% • Focos: ${n.fociCount}`,
              module: 'territory',
              itemId: n.id,
              icon: MapPin,
            });
          }
        });
      } catch {}

      // 3. Agentes ACE & Usuários
      try {
        const users = db.getUsers();
        users.forEach(u => {
          if (
            u.name.toLowerCase().includes(term) ||
            u.email.toLowerCase().includes(term) ||
            (u.registrationNumber && u.registrationNumber.toLowerCase().includes(term))
          ) {
            found.push({
              category: 'AGENTES & USUÁRIOS',
              title: u.name,
              subtitle: `Perfil: ${u.role} • Matrícula: ${u.registrationNumber || 'N/A'} • ${u.email}`,
              module: u.role === 'ACE' ? 'teams' : 'users',
              itemId: u.id,
              icon: Users,
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
              module: 'citizen_portal',
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
              subtitle: `${b.targetNeighborhood} • Raio: ${b.radiusMeters}m • Status: ${b.status}`,
              module: 'blocks',
              itemId: b.id,
              icon: Activity,
            });
          }
        });
      } catch {}

      setResults(found.slice(0, 20));
      setIsSearching(false);
    }, 250);

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
            placeholder="Pesquise por Imóvel, Endereço, Bairro, ACE, Denúncia, Ovitrampa ou Bloqueio..."
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
            className="text-xs font-semibold px-2 py-1 rounded bg-slate-200 text-slate-700 hover:bg-slate-300"
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
                <div
                  key={`${item.category}-${item.title}-${idx}`}
                  onClick={() => {
                    onSelectResult(item.module, item.itemId);
                    onClose();
                  }}
                  className="p-3.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between group transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-slate-100 text-slate-700 group-hover:bg-blue-50 group-hover:text-blue-700 transition">
                      <Icon className="w-4 h-4 flex-shrink-0" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {item.category}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900 truncate">
                          {item.title}
                        </h4>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition flex-shrink-0 ml-2" />
                </div>
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
