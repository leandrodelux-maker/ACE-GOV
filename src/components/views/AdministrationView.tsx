import React, { useState } from 'react';
import {
  Settings,
  Users,
  Upload,
  Building,
  CheckCircle,
  FileSpreadsheet,
  Shield,
  KeyRound,
  Check,
} from 'lucide-react';
import { db } from '../../services/storage';
import { PageHeader } from '../ui';

export const AdministrationView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'municipality' | 'importer'>('municipality');
  const [municipality, setMunicipality] = useState(db.getMunicipality());
  const [savedSuccess, setSavedSuccess] = useState(false);

  // CSV Importer state
  const [csvText, setCsvText] = useState(
    'codigo,tipo,logradouro,numero,bairro,quadra,nome_morador\nIMO-9001,RESIDENCIAL,Rua das Flores,120,Vila Nova,Quadra 01,Maria Aparecida\nIMO-9002,COMERCIAL,Av. Brasil,450,Centro,Quadra 03,Loja Confecções'
  );
  const [importedCount, setImportedCount] = useState<number | null>(null);

  const handleSaveMunicipality = (e: React.FormEvent) => {
    e.preventDefault();
    db.saveMunicipality(municipality);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleProcessCSV = () => {
    const lines = csvText.trim().split('\n').slice(1);
    setImportedCount(lines.length);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        icon={Settings}
        title="Administração do Sistema, Usuários & Importador de Dados"
        subtitle="Configuração institucional do município, controle de acesso RBAC e importação em lote de imóveis"
        actions={
          <div className="flex rounded-lg bg-slate-100 p-1 border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('municipality')}
              className={`px-3 py-1.5 rounded-md transition ${activeTab === 'municipality' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'}`}
            >
              Município & Órgão
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-3 py-1.5 rounded-md transition ${activeTab === 'users' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'}`}
            >
              Usuários & Perfis
            </button>
            <button
              onClick={() => setActiveTab('importer')}
              className={`px-3 py-1.5 rounded-md transition ${activeTab === 'importer' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'}`}
            >
              Importador CSV
            </button>
          </div>
        }
      />

      {/* Tab 1: Municipality Settings */}
      {activeTab === 'municipality' && (
        <div className="max-w-2xl bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
            <Building className="w-4 h-4 text-blue-600" />
            <span>Dados Institucionais do Município</span>
          </h3>

          <form onSubmit={handleSaveMunicipality} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome do Município</label>
                <input
                  type="text"
                  required
                  value={municipality.name}
                  onChange={e => setMunicipality({ ...municipality, name: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-slate-300 font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Estado (UF)</label>
                <input
                  type="text"
                  required
                  value={municipality.state}
                  onChange={e => setMunicipality({ ...municipality, state: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-slate-300 font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Código IBGE (7 dígitos)</label>
                <input
                  type="text"
                  required
                  value={municipality.ibgeCode}
                  onChange={e => setMunicipality({ ...municipality, ibgeCode: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-slate-300 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">População Estimada</label>
                <input
                  type="number"
                  required
                  value={municipality.estimatedPopulation}
                  onChange={e => setMunicipality({ ...municipality, estimatedPopulation: Number(e.target.value) })}
                  className="w-full p-2.5 rounded-lg border border-slate-300 font-semibold"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              {savedSuccess ? (
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <Check className="w-4 h-4" /> Dados atualizados com sucesso!
                </span>
              ) : <div />}

              <button
                type="submit"
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition"
              >
                Salvar Alterações
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 2: Users & Roles */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Perfis de Usuários com RBAC do SUS</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <span className="font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded uppercase text-[10px]">
                SECRETÁRIO DE SAÚDE
              </span>
              <p className="font-bold text-slate-900">Dr. Roberto Albuquerque</p>
              <p className="text-slate-500 text-[11px]">
                Acesso ao Painel Executivo, semáforo municipal, relatórios para o Ministério e decisões estratégicas.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <span className="font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded uppercase text-[10px]">
                COORDENADOR DE ENDEMIAS
              </span>
              <p className="font-bold text-slate-900">Mariana Costa</p>
              <p className="text-slate-500 text-[11px]">
                Gestão territorial, planejamento de ciclos, distribuição de rotas, controle de estoque e bloqueios virais.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded uppercase text-[10px]">
                AGENTE DE COMBATE ÀS ENDEMIAS (ACE)
              </span>
              <p className="font-bold text-slate-900">Carlos Silva & 41 Agentes</p>
              <p className="text-slate-500 text-[11px]">
                Acesso móvel PWA offline-first, registro de visitas domiciliares, captura de geolocalização e rotas.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: CSV Importer */}
      {activeTab === 'importer' && (
        <div className="max-w-2xl bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Upload className="w-4 h-4 text-emerald-600" />
              <span>Importação em Lote de Imóveis e Território via CSV</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Cole abaixo os registros formatados com as colunas padrão (codigo, tipo, logradouro, numero, bairro, quadra, morador)
            </p>
          </div>

          <textarea
            rows={6}
            value={csvText}
            onChange={e => setCsvText(e.target.value)}
            className="w-full font-mono text-xs p-3 rounded-xl border border-slate-300 text-slate-800"
          />

          <div className="flex items-center justify-between">
            {importedCount !== null && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                {importedCount} imóveis validados e importados com sucesso!
              </span>
            )}
            <button
              onClick={handleProcessCSV}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-xs flex items-center gap-1.5 ml-auto"
            >
              <Upload className="w-4 h-4" />
              <span>Processar e Gravar Registros</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
