import React, { useState, useEffect, useCallback } from 'react';
import { ACTIVE_FOCUS_STATUSES, ELIMINATED_FOCUS_STATUSES, RECURRENCE_MIN_FOCI } from '../../services/schemaHelpers';
import {
  Flame,
  Repeat,
  AlertTriangle,
  FileWarning,
  Send,
  CheckCircle2,
  Calendar,
  Building,
  User,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react';
import { Property } from '../../types';
import { supabase } from '../../services/supabaseClient';
import { supabaseService } from '../../services/supabaseService';
import { PageHeader } from '../ui';
import { useAuth, useMunicipalityId } from '../../contexts/AuthContext';

export const FociAndRecurrenceView: React.FC = () => {
  const { municipality: sessionMunicipality, user: sessionUser } = useAuth();
  const municipalityId = useMunicipalityId();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [eliminatedFociCount, setEliminatedFociCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [notificationSent, setNotificationSent] = useState(false);
  const [isSubmittingNotification, setIsSubmittingNotification] = useState(false);

  const loadFociData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      // Fonte: breeding_sites (criadouros gravados pela RPC oficial de visita), últimos 12 meses.
      // A RPC grava situação em minúsculas ('ativo'/'eliminado'); a tabela tem padrão 'ATIVO'.
      const since = new Date(Date.now() - 365 * 86400000).toISOString();
      const [sitesRes, eliminatedRes] = await Promise.all([
        supabase
          .from('breeding_sites')
          .select('property_id, status, identified_at, properties(id, property_code, property_type, street, number, complement, neighborhood_id, latitude, longitude, resident_name, created_at, updated_at, neighborhoods(name), blocks(code), sectors(name))')
          .eq('municipality_id', municipalityId)
          .gte('identified_at', since)
          .not('property_id', 'is', null),
        supabase
          .from('breeding_sites')
          .select('id', { count: 'exact', head: true })
          .eq('municipality_id', municipalityId)
          .in('status', ELIMINATED_FOCUS_STATUSES),
      ]);
      if (sitesRes.error) throw sitesRes.error;

      const byProperty = new Map<string, { prop: any; count: number; active: boolean }>();
      (sitesRes.data || []).forEach((s: any) => {
        if (!s.properties) return;
        const cur = byProperty.get(s.property_id) || { prop: s.properties, count: 0, active: false };
        cur.count += 1;
        if (ACTIVE_FOCUS_STATUSES.includes(s.status)) cur.active = true;
        byProperty.set(s.property_id, cur);
      });

      const mapped: Property[] = [...byProperty.values()]
        .sort((a, b) => b.count - a.count)
        .map(({ prop: p, count, active }) => ({
          id: p.id,
          municipalityId,
          neighborhoodId: p.neighborhood_id || '',
          code: p.property_code || 'Sem código',
          type: (p.property_type as any) || 'RESIDENCIAL',
          status: active ? 'FOCO' : 'NORMAL',
          address: p.street || 'Logradouro não informado',
          number: p.number || 'S/N',
          complement: p.complement || undefined,
          neighborhood: p.neighborhoods?.name || 'Bairro não informado',
          block: p.blocks?.code || 'quadra não informada',
          sector: p.sectors?.name || '',
          zone: 'URBANA',
          latitude: p.latitude,
          longitude: p.longitude,
          totalVisitsCount: 0,
          residentName: p.resident_name || undefined,
          fociHistoryCount: count,
          isRecurrent: count >= RECURRENCE_MIN_FOCI,
          notes: undefined,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
        }));
      setProperties(mapped);
      setEliminatedFociCount(eliminatedRes.count || 0);
    } catch (err: any) {
      console.warn('Falha ao carregar focos:', err);
      setProperties([]);
      setLoadError('Não foi possível carregar os focos registrados. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  }, [municipalityId]);

  useEffect(() => {
    loadFociData();
  }, [loadFociData]);

  const recurrentProperties = properties.filter(p => p.isRecurrent || (p.fociHistoryCount && p.fociHistoryCount >= 2));
  const activeFociProperties = properties.filter(p => p.status === 'FOCO');

  const handleEmitNotification = async () => {
    if (!selectedProperty) return;
    setIsSubmittingNotification(true);

    try {
      const muni = sessionMunicipality;
      const muniId = municipalityId;

      // 1. Salvar no Supabase audit_logs
      const { error: auditError } = await supabase.from('audit_logs').insert({
        municipality_id: muniId,
        user_id: sessionUser?.id ?? null,
        action: 'EMISSAO_NOTIFICACAO_SANITARIA',
        module: 'FOCOS_REINCIDENCIAS',
        entity: 'properties',
        entity_id: selectedProperty.id,
        new_data: {
          propertyCode: selectedProperty.code,
          address: `${selectedProperty.address}, ${selectedProperty.number}`,
          neighborhood: selectedProperty.neighborhood,
          fociHistory: selectedProperty.fociHistoryCount,
          deadlineHours: 48,
          status: 'EXPEDIDA',
        },
      });

      if (auditError) throw auditError;

      setNotificationSent(true);
      setTimeout(() => {
        setNotificationSent(false);
        setSelectedProperty(null);
      }, 3000);
    } catch (err) {
      console.error('Erro ao emitir notificação sanitária:', err);
    } finally {
      setIsSubmittingNotification(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        icon={Flame}
        title="Central de Focos e Imóveis Reincidentes"
        subtitle="Monitoramento sanitário rigoroso de criadouros persistentes e reincidência de Aedes aegypti"
        actions={
          <>
            <span className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200">
              Regra Municipal: ≥ 2 focos ativos
            </span>
            <button
              onClick={loadFociData}
              disabled={isLoading}
              className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition"
              title="Atualizar dados do banco"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-rose-600' : ''}`} />
            </button>
          </>
        }
      />

      {loadError && (
        <div role="alert" className="p-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-xs font-semibold">{loadError}</div>
      )}
      <p className="text-[11px] text-slate-500">Fonte: criadouros registrados nas visitas dos últimos 12 meses. Reincidente = 2 ou mais focos no mesmo imóvel.</p>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/20 shadow-xs">
          <div className="flex items-center justify-between text-rose-700">
            <span className="text-xs font-bold uppercase">Imóveis com Foco Ativo</span>
            <Flame className="w-4 h-4 animate-pulse" />
          </div>
          <p className="text-2xl font-black text-rose-700 mt-2">{activeFociProperties.length}</p>
          <span className="text-[10px] text-rose-600">Tratamento em execução</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-purple-200 bg-purple-50/20 shadow-xs">
          <div className="flex items-center justify-between text-purple-700">
            <span className="text-xs font-bold uppercase">Imóveis Reincidentes</span>
            <Repeat className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-purple-700 mt-2">{recurrentProperties.length}</p>
          <span className="text-[10px] text-purple-600">Requerem notificação sanitária</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-xs font-bold uppercase">Focos Eliminados</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-emerald-700 mt-2">{eliminatedFociCount}</p>
          <span className="text-[10px] text-emerald-700">Conduta física / larvicida</span>
        </div>
      </div>

      {/* Reincident Properties Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Imóveis com Histórico de Reincidência e Infestação Persistente
          </h3>
          <p className="text-xs text-slate-500">Acompanhamento contínuo e histórico de autuações</p>
        </div>

        <div className="divide-y divide-slate-100">
          {recurrentProperties.map(prop => (
            <div key={prop.id} className="p-4 hover:bg-slate-50 transition flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-sm">{prop.address}, {prop.number}</span>
                  <span className="px-2 py-0.5 rounded font-extrabold text-[10px] bg-purple-100 text-purple-700">
                    {prop.fociHistoryCount} Focos Registrados
                  </span>
                  {prop.status === 'FOCO' && (
                    <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-rose-100 text-rose-700 animate-pulse">
                      FOCO ATIVO
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-slate-500 text-[11px]">
                  <span>Código: {prop.code}</span>
                  <span>•</span>
                  <span>{prop.neighborhood} ({prop.block})</span>
                  <span>•</span>
                  <span>Morador: {prop.residentName || 'Não identificado'}</span>
                </div>

                <p className="text-[11px] text-slate-600 bg-purple-50/50 p-2 rounded border border-purple-100">
                  {prop.notes || 'Sem observações registradas.'}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setSelectedProperty(prop)}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1"
                >
                  <FileWarning className="w-3.5 h-3.5" />
                  <span>Emitir Notificação Sanitária</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notification Modal */}
      {selectedProperty && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-rose-700 pb-2 border-b border-slate-200">
              <FileWarning className="w-5 h-5" />
              <h3 className="text-base font-bold">Notificação Sanitária Formal — Reincidência</h3>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1">
              <p><strong>Imóvel:</strong> {selectedProperty.address}, {selectedProperty.number} ({selectedProperty.code})</p>
              <p><strong>Bairro:</strong> {selectedProperty.neighborhood} • <strong>Focos acumulados:</strong> {selectedProperty.fociHistoryCount}</p>
              <p><strong>Amparo Legal:</strong> Lei Municipal de Controle de Vetores e Código Sanitário Municipal.</p>
            </div>

            <div className="text-xs text-slate-600 space-y-2">
              <p>
                O proprietário será formalmente notificado a eliminar todos os depósitos com água parada no prazo improrrogável de <strong>48 horas</strong>, sob pena de auto de infração e multa sanitária.
              </p>
            </div>

            {notificationSent ? (
              <div className="p-3 bg-emerald-100 text-emerald-800 font-bold rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Notificação sanitária do imóvel {selectedProperty?.code} registrada na trilha de auditoria. Imprima e entregue ao responsável.</span>
              </div>
            ) : (
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedProperty(null)}
                  className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleEmitNotification}
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-xs flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Expedir Notificação com Protocolo</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
