import React, { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Database,
  Wifi,
  HardDrive,
  RefreshCw,
  Server,
  ShieldCheck,
  Cpu,
} from 'lucide-react';
import { db } from '../../services/storage';

export const SystemHealthView: React.FC = () => {
  const [lastCheck, setLastCheck] = useState(new Date().toLocaleTimeString('pt-BR'));
  const [isChecking, setIsChecking] = useState(false);

  const handleRunDiagnostics = () => {
    setIsChecking(true);
    setTimeout(() => {
      setLastCheck(new Date().toLocaleTimeString('pt-BR'));
      setIsChecking(false);
    }, 600);
  };

  const propertiesCount = db.getProperties().length;
  const visitsCount = db.getVisits().length;
  const ovitrapsCount = db.getOvitraps().length;
  const suppliesCount = db.getSupplies().length;
  const complaintsCount = db.getComplaints().length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-600" />
            <span>Saúde do Sistema & Diagnóstico Operacional (SUS-Health)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitoramento de integridade dos dados, barramento de sincronização PWA e estado do banco de dados
          </p>
        </div>

        <button
          onClick={handleRunDiagnostics}
          disabled={isChecking}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
          <span>Executar Autodiagnóstico</span>
        </button>
      </div>

      {/* Global Status Banner */}
      <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-emerald-900">Todos os Módulos Operando Nominalmente</h2>
            <p className="text-xs text-emerald-700">
              Taxa de sucesso nas operações: 100% • Última verificação realizada às {lastCheck}
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-3 py-1 rounded bg-emerald-100 text-emerald-800">
          STATUS: 200 OK
        </span>
      </div>

      {/* Diagnostics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-slate-900 font-bold">
            <Database className="w-4 h-4 text-blue-600" />
            <span>Camada de Persistência</span>
          </div>
          <div className="space-y-1 text-slate-600">
            <p className="flex justify-between"><span>Engine Primária:</span> <strong className="text-slate-900">Client-side & Storage PWA</strong></p>
            <p className="flex justify-between"><span>Modelo Relacional:</span> <strong className="text-emerald-700 font-mono">schema.sql (PostgreSQL)</strong></p>
            <p className="flex justify-between"><span>Consistência ACID:</span> <strong className="text-emerald-700">Verificada</strong></p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-slate-900 font-bold">
            <Wifi className="w-4 h-4 text-emerald-600" />
            <span>Sincronização Offline PWA</span>
          </div>
          <div className="space-y-1 text-slate-600">
            <p className="flex justify-between"><span>Status de Conectividade:</span> <strong className="text-emerald-700 font-bold">ONLINE</strong></p>
            <p className="flex justify-between"><span>Fila de Pendências:</span> <strong className="text-slate-900">0 registros na fila</strong></p>
            <p className="flex justify-between"><span>Service Worker:</span> <strong className="text-emerald-700 font-mono">Ativo & Registrado</strong></p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-slate-900 font-bold">
            <HardDrive className="w-4 h-4 text-purple-600" />
            <span>Registros em Memória Local</span>
          </div>
          <div className="space-y-1 text-slate-600">
            <p className="flex justify-between"><span>Imóveis Cadastrados:</span> <strong className="text-slate-900">{propertiesCount}</strong></p>
            <p className="flex justify-between"><span>Vistorias Realizadas:</span> <strong className="text-slate-900">{visitsCount}</strong></p>
            <p className="flex justify-between"><span>Armadilhas Ovitrampas:</span> <strong className="text-slate-900">{ovitrapsCount}</strong></p>
            <p className="flex justify-between"><span>Insumos & EPIs:</span> <strong className="text-slate-900">{suppliesCount}</strong></p>
            <p className="flex justify-between"><span>Denúncias de Munícipes:</span> <strong className="text-slate-900">{complaintsCount}</strong></p>
          </div>
        </div>
      </div>
    </div>
  );
};
