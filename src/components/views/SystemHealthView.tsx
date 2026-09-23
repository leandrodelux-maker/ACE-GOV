import React, { useCallback, useEffect, useState } from 'react';
import { HeartPulse, Database, Cloud, Shield, Clock, AlertTriangle, CheckCircle2, RefreshCw, HardDrive, Cpu } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useMunicipalityId } from '../../contexts/AuthContext';
import { PageHeader } from '../ui';

interface IntegrityCheck {
  label: string;
  count: number | null; // null = não foi possível verificar
  severity: 'erro' | 'aviso';
}

/**
 * Saúde da infraestrutura — apenas o que o navegador consegue medir:
 * resposta do banco, latência desta consulta, último registro de visita
 * recebido, erros registrados em 24h e checagens de integridade por contagem.
 * Backups não são visíveis pelo navegador (ver painel do Supabase).
 */
export const SystemHealthView: React.FC = () => {
  const municipalityId = useMunicipalityId();
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [apiLatencyMs, setApiLatencyMs] = useState<number | null>(null);
  const [lastVisitAt, setLastVisitAt] = useState<string | null>(null);
  const [errorsLast24h, setErrorsLast24h] = useState<number | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isVerifyingIntegrity, setIsVerifyingIntegrity] = useState(false);
  const [integrity, setIntegrity] = useState<IntegrityCheck[] | null>(null);

  const checkHealth = useCallback(async () => {
    setIsChecking(true);
    const start = performance.now();
    try {
      const { error } = await supabase.from('municipalities').select('id').eq('id', municipalityId).limit(1);
      setApiLatencyMs(Math.round(performance.now() - start));
      setDbConnected(!error);

      const since = new Date(Date.now() - 24 * 3600000).toISOString();
      const [errorsRes, lastVisitRes] = await Promise.all([
        supabase
          .from('system_error_logs')
          .select('id', { count: 'exact', head: true })
          .eq('municipality_id', municipalityId)
          .gte('created_at', since),
        supabase
          .from('visits')
          .select('created_at')
          .eq('municipality_id', municipalityId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      setErrorsLast24h(errorsRes.error ? null : errorsRes.count ?? 0);
      setLastVisitAt(lastVisitRes.data?.created_at ?? null);
    } catch {
      setDbConnected(false);
    } finally {
      setIsChecking(false);
    }
  }, [municipalityId]);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  const handleRunIntegrityScan = async () => {
    setIsVerifyingIntegrity(true);
    const count = async (q: PromiseLike<{ count: number | null; error: unknown }>) => {
      const { count: c, error } = await q;
      return error ? null : c ?? 0;
    };
    const [visitsNoProperty, propsNoNeighborhood, propsNoCoords, ovitrapsNoNeighborhood] = await Promise.all([
      count(supabase.from('visits').select('id', { count: 'exact', head: true }).eq('municipality_id', municipalityId).is('property_id', null)),
      count(
        supabase
          .from('properties')
          .select('id', { count: 'exact', head: true })
          .eq('municipality_id', municipalityId)
          .is('deleted_at', null)
          .is('neighborhood_id', null)
      ),
      count(
        supabase
          .from('properties')
          .select('id', { count: 'exact', head: true })
          .eq('municipality_id', municipalityId)
          .is('deleted_at', null)
          .is('latitude', null)
      ),
      count(supabase.from('ovitraps').select('id', { count: 'exact', head: true }).eq('municipality_id', municipalityId).is('neighborhood_id', null)),
    ]);
    setIntegrity([
      { label: 'Visitas sem imóvel vinculado', count: visitsNoProperty, severity: 'erro' },
      { label: 'Imóveis sem bairro', count: propsNoNeighborhood, severity: 'erro' },
      { label: 'Ovitrampas sem bairro', count: ovitrapsNoNeighborhood, severity: 'erro' },
      { label: 'Imóveis sem coordenadas (não aparecem no mapa)', count: propsNoCoords, severity: 'aviso' },
    ]);
    setIsVerifyingIntegrity(false);
  };

  const card = 'bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3';
  const problems = (integrity || []).filter((c) => c.count !== null && c.count > 0);
  const unchecked = (integrity || []).filter((c) => c.count === null);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={HeartPulse}
        title="Saúde da Infraestrutura"
        subtitle="Conectividade com o banco, latência, erros registrados e integridade dos cadastros do município"
        actions={
          <button
            onClick={checkHealth}
            disabled={isChecking}
            className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isChecking ? 'animate-spin' : ''}`} />
            <span>Verificar Conexão</span>
          </button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className={card}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Banco de Dados</span>
            <Database className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-center gap-2" role="status">
            <span
              className={`w-3 h-3 rounded-full ${dbConnected === null ? 'bg-slate-300' : dbConnected ? 'bg-emerald-500' : 'bg-rose-500'}`}
            />
            <span className="text-lg font-black text-slate-900">
              {dbConnected === null ? 'Verificando...' : dbConnected ? 'Respondendo' : 'Sem resposta'}
            </span>
          </div>
          <p className="text-xs text-slate-500">Consulta ao cadastro do município pela sessão atual (RLS aplicada)</p>
        </div>

        <div className={card}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Latência</span>
            <Cloud className="w-4 h-4 text-blue-600" />
          </div>
          <span className="text-2xl font-black text-blue-600">{apiLatencyMs === null ? '—' : `${apiLatencyMs} ms`}</span>
          <p className="text-xs text-slate-500">Tempo da última verificação feita por este navegador</p>
        </div>

        <div className={card}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Backups</span>
            <HardDrive className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-sm font-bold text-slate-900">Não visível pelo sistema</div>
          <p className="text-xs text-slate-500">Consulte o painel do Supabase (Database › Backups) para data e retenção.</p>
        </div>

        <div className={card}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Última Visita Recebida</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-base font-black text-slate-900">
            {lastVisitAt ? new Date(lastVisitAt).toLocaleString('pt-BR') : 'Sem visitas registradas'}
          </div>
          <p className="text-xs text-slate-500">Registro mais recente gravado no banco (PWA ou tela de visitas)</p>
        </div>

        <div className={card}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Erros (24h)</span>
            <AlertTriangle className="w-4 h-4 text-slate-700" />
          </div>
          <div className="text-2xl font-black text-slate-900">{errorsLast24h === null ? '—' : errorsLast24h}</div>
          <p className="text-xs text-slate-500">
            {errorsLast24h === null ? 'Não foi possível consultar os logs de erro.' : 'Erros registrados pela aplicação no município.'}
          </p>
        </div>

        <div className={card}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Ambiente</span>
            <Cpu className="w-4 h-4 text-slate-700" />
          </div>
          <div className="text-base font-black text-slate-900">{import.meta.env.MODE === 'production' ? 'Produção' : import.meta.env.MODE}</div>
          <p className="text-xs text-slate-500">Modo de compilação desta versão do frontend</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-600" />
              <span>Verificação de Integridade dos Cadastros</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Contagens no banco de registros sem vínculo obrigatório ou sem localização</p>
          </div>
          <button
            onClick={handleRunIntegrityScan}
            disabled={isVerifyingIntegrity}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2 self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isVerifyingIntegrity ? 'animate-spin' : ''}`} />
            <span>{isVerifyingIntegrity ? 'Verificando...' : 'Executar Verificação'}</span>
          </button>
        </div>

        {integrity && (
          <div className="space-y-2 text-xs" role="status">
            {problems.length === 0 && unchecked.length === 0 && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Nenhuma inconsistência encontrada nas verificações executadas.
              </div>
            )}
            {integrity.map((c) => (
              <div key={c.label} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-700">{c.label}</span>
                <span
                  className={`font-bold ${
                    c.count === null ? 'text-slate-400' : c.count === 0 ? 'text-emerald-700' : c.severity === 'erro' ? 'text-rose-700' : 'text-amber-700'
                  }`}
                >
                  {c.count === null ? 'não verificado' : c.count}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
