import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  Radio,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Filter,
  Shield,
  Phone,
  Server,
  Key,
  HelpCircle,
  FileText
} from 'lucide-react';
import {
  communicationService,
  MessageTemplate,
  MessageLog,
  WhatsAppProviderConfig,
  OperationalEvent
} from '../../services/communicationService';

export const CommunicationAdminView: React.FC = () => {
  const municipalityId = '00000000-0000-0000-0000-000000000001';
  const [activeTab, setActiveTab] = useState<'DISPATCH' | 'TEMPLATES' | 'LOGS' | 'SETTINGS'>('DISPATCH');
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [loading, setLoading] = useState(false);

  // Configuração local de Gateway
  const [providerConfig, setProviderConfig] = useState<WhatsAppProviderConfig>(() => {
    const saved = localStorage.getItem('endemias_wpp_provider_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return {
      providerType: 'zapi',
      endpointUrl: 'https://api.z-api.io/instances/gov-instance',
      apiToken: '••••••••••••••••••••',
      instanceId: 'GOV-ENDEMIAS-01',
      active: true
    };
  });
  const [configSaved, setConfigSaved] = useState(false);

  // Form de disparo operacional
  const [recipientPhone, setRecipientPhone] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<OperationalEvent>('nova_os');
  const [targetRole, setTargetRole] = useState<'ace' | 'supervisor' | 'coordenador' | 'gestor'>('ace');
  const [customText, setCustomText] = useState('');
  const [sending, setSending] = useState(false);
  const [dispatchStatus, setDispatchStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tList, lList] = await Promise.all([
        communicationService.getTemplates(municipalityId),
        communicationService.getLogs(municipalityId)
      ]);
      setTemplates(tList);
      setLogs(lList);
      if (tList.length > 0 && !selectedEvent) {
        setSelectedEvent(tList[0].event);
      }
    } catch (err) {
      console.error('Erro ao carregar dados de comunicação:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectedTemplate = templates.find(t => t.event === selectedEvent);

  const previewMessage = customText || selectedTemplate?.text || '';

  const handleSendOperationalMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientPhone) {
      alert('Informe o número de WhatsApp com DDD do destinatário operacional.');
      return;
    }

    setSending(true);
    setDispatchStatus(null);

    try {
      const result = await communicationService.sendMessage({
        municipalityId,
        recipientPhone,
        recipientRole: targetRole,
        event: selectedEvent,
        customText: customText || undefined
      });

      setDispatchStatus({
        success: result.success,
        message: result.success
          ? `Mensagem transmitida com sucesso para o ${targetRole.toUpperCase()}! (Ref: ${result.providerRef || 'WPP-OK'})`
          : `Falha no envio da mensagem.`
      });

      // Recarregar logs
      const updatedLogs = await communicationService.getLogs(municipalityId);
      setLogs(updatedLogs);
    } catch (err: any) {
      setDispatchStatus({ success: false, message: err.message || 'Falha ao disparar mensagem.' });
    } finally {
      setSending(false);
    }
  };

  const handleToggleTemplate = async (templateId: string, currentActive: boolean) => {
    await communicationService.toggleTemplate(templateId, !currentActive);
    loadData();
  };

  const handleSaveProviderConfig = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('endemias_wpp_provider_config', JSON.stringify(providerConfig));
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 3000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Cabeçalho */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Comunicação Operacional & Notificações</h1>
            <p className="text-xs text-slate-500">
              Disparos institucionais para equipes de campo e gestores • WhatsApp Desacoplado • Conformidade LGPD
            </p>
          </div>
        </div>

        {/* Abas */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveTab('DISPATCH')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === 'DISPATCH' ? 'bg-white text-emerald-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Disparo Rápido</span>
          </button>
          <button
            onClick={() => setActiveTab('TEMPLATES')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === 'TEMPLATES' ? 'bg-white text-emerald-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Templates ({templates.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('LOGS')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === 'LOGS' ? 'bg-white text-emerald-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Histórico ({logs.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('SETTINGS')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === 'SETTINGS' ? 'bg-white text-emerald-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Provedor Gateway</span>
          </button>
        </div>
      </div>

      {/* ABA 1: DISPARO OPERACIONAL */}
      {activeTab === 'DISPATCH' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-600" />
              <span>Transmitir Alerta ou Ordem de Serviço Operacional</span>
            </h3>

            {dispatchStatus && (
              <div
                className={`mb-4 p-3 rounded-xl text-xs flex items-center gap-2 ${
                  dispatchStatus.success
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {dispatchStatus.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                <span>{dispatchStatus.message}</span>
              </div>
            )}

            <form onSubmit={handleSendOperationalMessage} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Perfil do Destinatário</label>
                  <select
                    value={targetRole}
                    onChange={e => setTargetRole(e.target.value as any)}
                    className="w-full py-2 px-3 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="ace">Agente de Combate a Endemias (ACE)</option>
                    <option value="supervisor">Supervisor de Campo</option>
                    <option value="coordenador">Coordenador Municipal</option>
                    <option value="gestor">Secretário / Gestor</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">WhatsApp com DDD</label>
                  <input
                    type="tel"
                    placeholder="Ex: 5511999998888"
                    value={recipientPhone}
                    onChange={e => setRecipientPhone(e.target.value)}
                    required
                    className="w-full py-2 px-3 rounded-lg border border-slate-200 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">Evento / Template Homologado</label>
                <select
                  value={selectedEvent}
                  onChange={e => setSelectedEvent(e.target.value as OperationalEvent)}
                  className="w-full py-2 px-3 rounded-lg border border-slate-200 bg-white"
                >
                  {templates.map(t => (
                    <option key={t.id} value={t.event}>
                      [{t.event.toUpperCase()}] {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">
                  Texto Complementar Personalizado (Opcional - Substitui o padrão)
                </label>
                <textarea
                  rows={3}
                  placeholder="Se deixado em branco, será transmitido o texto oficial padrão..."
                  value={customText}
                  onChange={e => setCustomText(e.target.value)}
                  className="w-full py-2 px-3 rounded-lg border border-slate-200 focus:ring-1 focus:ring-emerald-500"
                ></textarea>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={sending}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl font-bold shadow-xs transition flex items-center gap-2"
                >
                  {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>{sending ? 'Transmitindo...' : 'Disparar WhatsApp Operacional'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Prévia da Mensagem */}
          <div className="lg:col-span-5 bg-slate-900 text-white p-6 rounded-2xl shadow-lg border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                  <span className="font-bold text-xs tracking-wide">Prévia da Mensagem (WhatsApp)</span>
                </div>
                <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400">Oficial GOV</span>
              </div>

              <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 font-mono text-xs whitespace-pre-wrap leading-relaxed text-slate-200">
                {previewMessage || 'Selecione um evento para visualizar a mensagem padrão.'}
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-slate-800 flex items-center gap-2 text-[11px] text-slate-400">
              <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Conformidade LGPD: Nenhum dado de morador ou munícipe é incluído no disparo.</span>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: TEMPLATES */}
      {activeTab === 'TEMPLATES' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Modelos Institucionais Homologados</h3>
            <span className="text-xs text-slate-500">{templates.length} templates cadastrados</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map(t => (
              <div key={t.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">{t.name}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                      {t.event}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-slate-600 bg-white p-2.5 rounded border border-slate-200 whitespace-pre-wrap">
                    {t.text}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <span className="text-[11px] text-slate-500">
                    Status: <strong className={t.active ? 'text-emerald-700' : 'text-slate-400'}>{t.active ? 'Ativo' : 'Pausado'}</strong>
                  </span>
                  <button
                    onClick={() => handleToggleTemplate(t.id, t.active)}
                    className="text-[10px] text-blue-600 hover:underline font-bold"
                  >
                    {t.active ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ABA 3: LOGS */}
      {activeTab === 'LOGS' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Log Completo de Transmissões Operacionais</h3>
            <button
              onClick={loadData}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Atualizar</span>
            </button>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100 text-slate-600 font-semibold text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Data / Hora</th>
                  <th className="py-2.5 px-3">Destinatário</th>
                  <th className="py-2.5 px-3">Cargo</th>
                  <th className="py-2.5 px-3">Evento</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Mensagem Transmitida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">
                      Nenhuma mensagem operacional disparada ainda.
                    </td>
                  </tr>
                ) : (
                  logs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 text-slate-500 whitespace-nowrap">
                        {new Date(log.sentAt).toLocaleString('pt-BR')}
                      </td>
                      <td className="py-2 px-3 font-mono font-medium text-slate-800">{log.recipient}</td>
                      <td className="py-2 px-3 uppercase text-[10px] font-bold text-slate-600">{log.recipientRole || 'OPERACIONAL'}</td>
                      <td className="py-2 px-3 uppercase text-[10px] text-slate-500">{log.event}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.status === 'enviado' || log.status === 'entregue'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {log.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-600 max-w-xs truncate">{log.messageText}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA 4: CONFIGURAÇÃO DE GATEWAY */}
      {activeTab === 'SETTINGS' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs max-w-2xl space-y-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-600" />
            <span>Configuração do Provedor de Mensageria (Desacoplado)</span>
          </h3>

          <p className="text-xs text-slate-500">
            A arquitetura desacoplada permite alternar entre gateways oficiais e instâncias de WhatsApp sem alterar regras de negócio.
          </p>

          {configSaved && (
            <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Configurações do Gateway salvas com sucesso!</span>
            </div>
          )}

          <form onSubmit={handleSaveProviderConfig} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-600 mb-1">Provedor Ativo</label>
              <select
                value={providerConfig.providerType}
                onChange={e => setProviderConfig({ ...providerConfig, providerType: e.target.value as any })}
                className="w-full py-2 px-3 rounded-lg border border-slate-200 bg-white font-medium"
              >
                <option value="zapi">Z-API (WhatsApp Oficial / Não Oficial)</option>
                <option value="evolution">Evolution API (Open Source)</option>
                <option value="twilio">Twilio Programmable SMS / WhatsApp</option>
                <option value="gupshup">Gupshup Enterprise Gateway</option>
                <option value="webhook_custom">Custom Webhook Gateway</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-600 mb-1">API Endpoint URL</label>
              <input
                type="url"
                value={providerConfig.endpointUrl}
                onChange={e => setProviderConfig({ ...providerConfig, endpointUrl: e.target.value })}
                className="w-full py-2 px-3 rounded-lg border border-slate-200 font-mono"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Instance ID / Token de Sessão</label>
                <input
                  type="text"
                  value={providerConfig.instanceId || ''}
                  onChange={e => setProviderConfig({ ...providerConfig, instanceId: e.target.value })}
                  className="w-full py-2 px-3 rounded-lg border border-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">API Key / Token de Acesso</label>
                <input
                  type="password"
                  value={providerConfig.apiToken}
                  onChange={e => setProviderConfig({ ...providerConfig, apiToken: e.target.value })}
                  className="w-full py-2 px-3 rounded-lg border border-slate-200"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition"
              >
                Salvar Configurações do Provedor
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
