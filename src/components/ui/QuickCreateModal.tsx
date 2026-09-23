import React, { useState } from 'react';
import {
  X,
  Plus,
  Home,
  MapPin,
  Map,
  Boxes,
  Users,
  UserCheck,
  CheckSquare,
  Layers,
  Crosshair,
  Building2,
  ArrowRight,
  Save,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useMunicipalityId } from '../../contexts/AuthContext';

export type QuickCreateEntity =
  | 'property'
  | 'neighborhood'
  | 'sector'
  | 'block'
  | 'agent'
  | 'team'
  | 'visit'
  | 'ovitrap'
  | 'strategic_point'
  | 'special_property';

interface QuickCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (module: string, action?: string) => void;
  municipalityId?: string;
  onSuccess?: (entity: QuickCreateEntity, data?: any) => void;
}

const ENTITIES_MENU: {
  id: QuickCreateEntity;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  targetModule: string;
}[] = [
  {
    id: 'property',
    title: 'Novo Imóvel',
    subtitle: 'Cadastrar residência, comércio ou terreno na quadra',
    icon: Home,
    color: 'bg-blue-50 text-blue-700 border-blue-200 hover:border-blue-400',
    targetModule: 'properties',
  },
  {
    id: 'neighborhood',
    title: 'Novo Bairro',
    subtitle: 'Cadastrar novo território sanitário municipal',
    icon: MapPin,
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-400',
    targetModule: 'territory',
  },
  {
    id: 'sector',
    title: 'Novo Setor',
    subtitle: 'Vincular setor censitário ao bairro',
    icon: Map,
    color: 'bg-amber-50 text-amber-700 border-amber-200 hover:border-amber-400',
    targetModule: 'territory',
  },
  {
    id: 'block',
    title: 'Nova Quadra',
    subtitle: 'Cadastrar quadra vinculada ao setor',
    icon: Boxes,
    color: 'bg-purple-50 text-purple-700 border-purple-200 hover:border-purple-400',
    targetModule: 'territory',
  },
  {
    id: 'agent',
    title: 'Novo Agente (ACE)',
    subtitle: 'Cadastrar profissional e vincular equipe de campo',
    icon: UserCheck,
    color: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:border-indigo-400',
    targetModule: 'teams',
  },
  {
    id: 'team',
    title: 'Nova Equipe',
    subtitle: 'Criar equipe de supervisão e agentes',
    icon: Users,
    color: 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:border-cyan-400',
    targetModule: 'teams',
  },
  {
    id: 'visit',
    title: 'Registrar Visita',
    subtitle: 'Lançar boletim de inspeção domiciliar',
    icon: CheckSquare,
    color: 'bg-teal-50 text-teal-700 border-teal-200 hover:border-teal-400',
    targetModule: 'visits',
  },
  {
    id: 'ovitrap',
    title: 'Nova Ovitrampa',
    subtitle: 'Instalar armadilha sentinela em imóvel',
    icon: Layers,
    color: 'bg-sky-50 text-sky-700 border-sky-200 hover:border-sky-400',
    targetModule: 'ovitraps',
  },
  {
    id: 'strategic_point',
    title: 'Ponto Estratégico (PE)',
    subtitle: 'Cadastrar ferro-velho, cemitério, borracharia',
    icon: Crosshair,
    color: 'bg-orange-50 text-orange-700 border-orange-200 hover:border-orange-400',
    targetModule: 'strategic_points',
  },
  {
    id: 'special_property',
    title: 'Imóvel Especial (IE)',
    subtitle: 'Cadastrar hospital, escola ou grande gerador',
    icon: Building2,
    color: 'bg-rose-50 text-rose-700 border-rose-200 hover:border-rose-400',
    targetModule: 'special_properties',
  },
];

export const QuickCreateModal: React.FC<QuickCreateModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onSuccess,
}) => {
  // Sempre o município da sessão autenticada (sem município padrão)
  const municipalityId = useMunicipalityId();
  const [selectedEntity, setSelectedEntity] = useState<QuickCreateEntity | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Estados de formulários rápidos
  const [bairroNome, setBairroNome] = useState('');
  const [bairroPopulacao, setBairroPopulacao] = useState(0);

  const [setorNome, setSetorNome] = useState('');
  const [setorCodigo, setSetorCodigo] = useState('');
  const [setorBairroId, setSetorBairroId] = useState('');
  const [neighborhoodsList, setNeighborhoodsList] = useState<any[]>([]);

  const [quadraCodigo, setQuadraCodigo] = useState('');
  const [quadraSetorId, setQuadraSetorId] = useState('');
  const [sectorsList, setSectorsList] = useState<any[]>([]);

  // Carrega bairros e setores quando necessário
  React.useEffect(() => {
    if (isOpen) {
      setSelectedEntity(null);
      setFeedback(null);
      supabase.from('neighborhoods').select('id, name').eq('municipality_id', municipalityId).order('name').then(res => {
        if (res.data) setNeighborhoodsList(res.data);
      });
      supabase.from('sectors').select('id, name, code, neighborhood_id').eq('municipality_id', municipalityId).order('name').then(res => {
        if (res.data) setSectorsList(res.data);
      });
    }
  }, [isOpen, municipalityId]);

  if (!isOpen) return null;

  const handleSelectEntity = (entity: QuickCreateEntity, targetModule: string) => {
    // Para bairros, setores e quadras temos formulário expresso no modal!
    if (entity === 'neighborhood' || entity === 'sector' || entity === 'block') {
      setSelectedEntity(entity);
      setFeedback(null);
    } else {
      // Para as demais, navega diretamente para a tela correspondente abrindo o formulário
      onClose();
      onNavigate(targetModule, 'new');
    }
  };

  const handleSaveNeighborhood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bairroNome.trim()) return;
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const mId = municipalityId;
      const { data, error } = await supabase
        .from('neighborhoods')
        .insert({
          municipality_id: mId,
          name: bairroNome.trim(),
          population: bairroPopulacao,
        })
        .select()
        .single();

      if (error) throw error;

      setFeedback({ type: 'success', message: `Bairro "${bairroNome}" cadastrado com sucesso!` });
      setBairroNome('');
      if (onSuccess) onSuccess('neighborhood', data);
      setTimeout(() => {
        onClose();
        onNavigate('territory');
      }, 1200);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao cadastrar bairro.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveSector = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setorNome.trim() || !setorBairroId) return;
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const mId = municipalityId;
      const { data, error } = await supabase
        .from('sectors')
        .insert({
          municipality_id: mId,
          neighborhood_id: setorBairroId,
          name: setorNome.trim(),
          code: setorCodigo.trim() || `SET-${Date.now().toString().slice(-4)}`,
        })
        .select()
        .single();

      if (error) throw error;

      setFeedback({ type: 'success', message: `Setor "${setorNome}" cadastrado com sucesso!` });
      setSetorNome('');
      setSetorCodigo('');
      if (onSuccess) onSuccess('sector', data);
      setTimeout(() => {
        onClose();
        onNavigate('territory');
      }, 1200);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao cadastrar setor.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quadraCodigo.trim() || !quadraSetorId) return;
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const mId = municipalityId;
      const { data, error } = await supabase
        .from('blocks')
        .insert({
          municipality_id: mId,
          sector_id: quadraSetorId,
          code: quadraCodigo.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      setFeedback({ type: 'success', message: `Quadra "${quadraCodigo}" cadastrada com sucesso!` });
      setQuadraCodigo('');
      if (onSuccess) onSuccess('block', data);
      setTimeout(() => {
        onClose();
        onNavigate('territory');
      }, 1200);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao cadastrar quadra.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header do Modal */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {selectedEntity ? 'Cadastro Rápido' : 'Central de Novo Cadastro'}
              </h2>
              <p className="text-xs text-slate-500">
                {selectedEntity
                  ? 'Preencha os dados essenciais para registrar a entidade'
                  : 'Selecione qual entidade deseja cadastrar no sistema'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback visual */}
        {feedback && (
          <div
            className={`mx-6 mt-4 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <X className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Conteúdo: Lista de Opções OU Formulário Selecionado */}
        <div className="p-6 max-h-[75vh] overflow-y-auto">
          {!selectedEntity ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ENTITIES_MENU.map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectEntity(item.id, item.targetModule)}
                    className={`p-3.5 rounded-xl border text-left transition flex items-start gap-3 group ${item.color}`}
                  >
                    <div className="p-2 rounded-lg bg-white shadow-2xs shrink-0 group-hover:scale-105 transition">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                        <span>{item.title}</span>
                        <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition text-slate-500" />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{item.subtitle}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : selectedEntity === 'neighborhood' ? (
            <form onSubmit={handleSaveNeighborhood} className="space-y-4 text-xs">
              <div className="flex items-center justify-between pb-2 border-b">
                <span className="font-bold text-slate-800">Cadastrar Novo Bairro</span>
                <button
                  type="button"
                  onClick={() => setSelectedEntity(null)}
                  className="text-indigo-600 hover:underline text-[11px] font-semibold"
                >
                  ← Voltar às opções
                </button>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome do Bairro *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Centro, Jardim América, Bela Vista"
                  value={bairroNome}
                  onChange={e => setBairroNome(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">População Estimada</label>
                <input
                  type="number"
                  min={10}
                  value={bairroPopulacao}
                  onChange={e => setBairroPopulacao(Number(e.target.value))}
                  className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setSelectedEntity(null)}
                  className="px-4 py-2 border rounded-lg hover:bg-slate-50 text-slate-600 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !bairroNome.trim()}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-xs transition disabled:opacity-60"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Salvar Bairro</span>
                </button>
              </div>
            </form>
          ) : selectedEntity === 'sector' ? (
            <form onSubmit={handleSaveSector} className="space-y-4 text-xs">
              <div className="flex items-center justify-between pb-2 border-b">
                <span className="font-bold text-slate-800">Cadastrar Novo Setor</span>
                <button
                  type="button"
                  onClick={() => setSelectedEntity(null)}
                  className="text-indigo-600 hover:underline text-[11px] font-semibold"
                >
                  ← Voltar às opções
                </button>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Bairro Vinculado *</label>
                <select
                  required
                  value={setorBairroId}
                  onChange={e => setSetorBairroId(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 bg-white"
                >
                  <option value="">Selecione o Bairro...</option>
                  {neighborhoodsList.map(n => (
                    <option key={n.id} value={n.id}>{n.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nome do Setor *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Setor 01 - Sul"
                    value={setorNome}
                    onChange={e => setSetorNome(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Código Oficial</label>
                  <input
                    type="text"
                    placeholder="Ex: SET-01"
                    value={setorCodigo}
                    onChange={e => setSetorCodigo(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setSelectedEntity(null)}
                  className="px-4 py-2 border rounded-lg hover:bg-slate-50 text-slate-600 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !setorNome.trim() || !setorBairroId}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-xs transition disabled:opacity-60"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Salvar Setor</span>
                </button>
              </div>
            </form>
          ) : selectedEntity === 'block' ? (
            <form onSubmit={handleSaveBlock} className="space-y-4 text-xs">
              <div className="flex items-center justify-between pb-2 border-b">
                <span className="font-bold text-slate-800">Cadastrar Nova Quadra</span>
                <button
                  type="button"
                  onClick={() => setSelectedEntity(null)}
                  className="text-indigo-600 hover:underline text-[11px] font-semibold"
                >
                  ← Voltar às opções
                </button>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Setor Censitário *</label>
                <select
                  required
                  value={quadraSetorId}
                  onChange={e => setQuadraSetorId(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 bg-white"
                >
                  <option value="">Selecione o Setor...</option>
                  {sectorsList.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Número / Código da Quadra *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: QD-01, Quadra 12"
                  value={quadraCodigo}
                  onChange={e => setQuadraCodigo(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setSelectedEntity(null)}
                  className="px-4 py-2 border rounded-lg hover:bg-slate-50 text-slate-600 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !quadraCodigo.trim() || !quadraSetorId}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-xs transition disabled:opacity-60"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Salvar Quadra</span>
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
};
