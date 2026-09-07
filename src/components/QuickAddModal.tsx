import React, { useState } from 'react';
import { X, Home, ClipboardCheck, MessageSquare, CalendarPlus, Check, MapPin } from 'lucide-react';
import { db } from '../services/storage';
import { VisitSituation, PropertyType, ZoneType } from '../types';

type EntryType = 'visit' | 'property' | 'complaint' | 'task';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ENTRY_TYPES: { id: EntryType; label: string; icon: React.ElementType; color: string }[] = [
  { id: 'visit', label: 'Visita Domiciliar', icon: Home, color: 'text-blue-600' },
  { id: 'property', label: 'Novo Imóvel', icon: MapPin, color: 'text-emerald-600' },
  { id: 'complaint', label: 'Denúncia', icon: MessageSquare, color: 'text-amber-600' },
  { id: 'task', label: 'Tarefa', icon: CalendarPlus, color: 'text-purple-600' },
];

const inputClass = 'w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600';
const labelClass = 'block text-xs font-semibold text-slate-600 mb-1';

export const QuickAddModal: React.FC<QuickAddModalProps> = ({ isOpen, onClose }) => {
  const [activeType, setActiveType] = useState<EntryType>('visit');
  const [success, setSuccess] = useState<string | null>(null);

  // Shared data
  const properties = db.getProperties();
  const neighborhoods = db.getNeighborhoods();
  const aceAgents = db.getUsers().filter(u => u.role === 'ACE');
  const currentUser = db.getCurrentUser();
  const cycle = db.getCycle();
  const municipality = db.getMunicipality();

  // Visit form state
  const [visitForm, setVisitForm] = useState({
    propertyId: '',
    situation: 'TRABALHADO' as VisitSituation,
    fociFound: false,
    conduct: '',
  });

  // Property form state
  const [propertyForm, setPropertyForm] = useState({
    address: '',
    number: '',
    neighborhoodId: '',
    type: 'RESIDENCIA' as PropertyType,
    zone: 'URBANA' as ZoneType,
    residentName: '',
    residentPhone: '',
  });

  // Complaint form state
  const [complaintForm, setComplaintForm] = useState({
    type: 'AGUA_PARADA' as CitizenComplaintType,
    description: '',
    address: '',
    neighborhood: '',
    citizenName: '',
    citizenPhone: '',
  });

  // Task form state
  const [taskForm, setTaskForm] = useState({
    type: 'VISITA_DE_ROTINA' as TaskType,
    priority: 'NORMAL' as TaskPriority,
    neighborhood: '',
    assignedAgentId: '',
    notes: '',
  });

  type CitizenComplaintType = 'AGUA_PARADA' | 'TERRENO_BALDIO' | 'PISCINA_ABANDONADA' | 'PNEUS' | 'LIXO_SUCATA' | 'IMOVEL_ABANDONADO' | 'POSSIVEL_FOCO';
  type TaskType = 'VISITA_DE_ROTINA' | 'RETORNO_PENDENCIA' | 'BLOQUEIO_QUIMICO' | 'PONTO_ESTRATEGICO' | 'DENUNCIA' | 'OVITRAMPA' | 'MUTIRAO' | 'ACAO_EDUCATIVA';
  type TaskPriority = 'NORMAL' | 'ATENCAO' | 'ALTA' | 'URGENTE';

  if (!isOpen) return null;

  const resetForms = () => {
    setActiveType('visit');
    setVisitForm({ propertyId: '', situation: 'TRABALHADO', fociFound: false, conduct: '' });
    setPropertyForm({ address: '', number: '', neighborhoodId: '', type: 'RESIDENCIA', zone: 'URBANA', residentName: '', residentPhone: '' });
    setComplaintForm({ type: 'AGUA_PARADA', description: '', address: '', neighborhood: '', citizenName: '', citizenPhone: '' });
    setTaskForm({ type: 'VISITA_DE_ROTINA', priority: 'NORMAL', neighborhood: '', assignedAgentId: '', notes: '' });
  };

  const handleClose = () => {
    setSuccess(null);
    resetForms();
    onClose();
  };

  const handleSubmit = () => {
    try {
      if (activeType === 'visit') {
        if (!visitForm.propertyId) { alert('Selecione um imóvel.'); return; }
        const prop = properties.find(p => p.id === visitForm.propertyId);
        if (!prop) return;
        db.registerVisit({
          municipalityId: municipality.id,
          cycleId: cycle.id,
          propertyId: prop.id,
          propertyCode: prop.code,
          propertyAddress: `${prop.address}, ${prop.number}`,
          propertyType: prop.type,
          neighborhood: prop.neighborhood,
          agentId: currentUser.id,
          agentName: currentUser.name,
          date: new Date().toISOString().split('T')[0],
          time: new Date().toTimeString().split(' ')[0],
          situation: visitForm.situation,
          inspections: [],
          totalDepositsInspected: 0,
          fociFound: visitForm.fociFound,
          fociEliminated: visitForm.fociFound,
          conduct: visitForm.conduct,
          syncStatus: 'SYNCED',
        });
        setSuccess('Visita registrada com sucesso!');
      } else if (activeType === 'property') {
        if (!propertyForm.address || !propertyForm.number || !propertyForm.neighborhoodId) { alert('Preencha endereço, número e bairro.'); return; }
        const neigh = neighborhoods.find(n => n.id === propertyForm.neighborhoodId);
        if (!neigh) return;
        db.addProperty({
          municipalityId: municipality.id,
          address: propertyForm.address,
          number: propertyForm.number,
          neighborhood: neigh.name,
          neighborhoodId: neigh.id,
          sector: 'Setor 01',
          block: 'Quadra 01',
          latitude: neigh.latitude,
          longitude: neigh.longitude,
          zone: propertyForm.zone,
          type: propertyForm.type,
          status: 'NORMAL',
          responsibleAgentId: currentUser.id,
          responsibleAgentName: currentUser.name,
          residentName: propertyForm.residentName || undefined,
          residentPhone: propertyForm.residentPhone || undefined,
        });
        setSuccess('Imóvel cadastrado com sucesso!');
      } else if (activeType === 'complaint') {
        if (!complaintForm.description || !complaintForm.address || !complaintForm.neighborhood) { alert('Preencha tipo, descrição, endereço e bairro.'); return; }
        db.addComplaint({
          municipalityId: municipality.id,
          type: complaintForm.type,
          description: complaintForm.description,
          address: complaintForm.address,
          neighborhood: complaintForm.neighborhood,
          citizenName: complaintForm.citizenName || undefined,
          citizenPhone: complaintForm.citizenPhone || undefined,
        });
        setSuccess('Denúncia registrada com sucesso!');
      } else if (activeType === 'task') {
        if (!taskForm.neighborhood || !taskForm.assignedAgentId) { alert('Selecione bairro e agente.'); return; }
        const agent = aceAgents.find(a => a.id === taskForm.assignedAgentId);
        if (!agent) return;
        const supervisor = db.getUsers().find(u => u.role === 'FIELD_SUPERVISOR') || currentUser;
        db.addTask({
          municipalityId: municipality.id,
          date: new Date().toISOString().split('T')[0],
          type: taskForm.type,
          priority: taskForm.priority,
          neighborhood: taskForm.neighborhood,
          sector: 'Setor 01',
          assignedAgentId: agent.id,
          assignedAgentName: agent.name,
          supervisorId: supervisor.id,
          supervisorName: supervisor.name,
          notes: taskForm.notes || undefined,
        });
        setSuccess('Tarefa criada com sucesso!');
      }
      setTimeout(() => { setSuccess(null); resetForms(); onClose(); }, 1500);
    } catch (e) {
      alert('Erro ao salvar: ' + (e as Error).message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={handleClose}>
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h2 className="text-base font-bold text-slate-900">Cadastro Rápido</h2>
          <button onClick={handleClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
              <Check className="w-7 h-7 text-emerald-600" />
            </div>
            <p className="text-sm font-semibold text-slate-800">{success}</p>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Type Selector */}
            <div className="grid grid-cols-4 gap-2">
              {ENTRY_TYPES.map(({ id, label, icon: Icon, color }) => (
                <button
                  key={id}
                  onClick={() => setActiveType(id)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition ${
                    activeType === id
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${activeType === id ? color : 'text-slate-400'}`} />
                  <span className={`text-[10px] font-semibold text-center leading-tight ${activeType === id ? 'text-slate-900' : 'text-slate-500'}`}>
                    {label}
                  </span>
                </button>
              ))}
            </div>

            {/* ── Visit Form ── */}
            {activeType === 'visit' && (
              <div className="space-y-3">
                <div>
                  <label className={labelClass}>Imóvel *</label>
                  <select
                    className={inputClass}
                    value={visitForm.propertyId}
                    onChange={e => setVisitForm({ ...visitForm, propertyId: e.target.value })}
                  >
                    <option value="">Selecione um imóvel...</option>
                    {properties.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.code} — {p.address}, {p.number} ({p.neighborhood})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Situação da Visita *</label>
                  <select
                    className={inputClass}
                    value={visitForm.situation}
                    onChange={e => setVisitForm({ ...visitForm, situation: e.target.value as VisitSituation })}
                  >
                    <option value="TRABALHADO">Trabalhado (Inspecionado)</option>
                    <option value="FECHADO">Fechado / Ausente</option>
                    <option value="RECUSA">Recusa</option>
                    <option value="DESOCUPADO">Desocupado</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visitForm.fociFound}
                    onChange={e => setVisitForm({ ...visitForm, fociFound: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                  />
                  <span className="text-sm font-medium text-slate-700">Foco de Aedes detectado</span>
                </label>
                <div>
                  <label className={labelClass}>Conduta / Observações</label>
                  <textarea
                    className={inputClass}
                    rows={2}
                    placeholder="Ex: Larvicida aplicado, depósito eliminado, morador orientado..."
                    value={visitForm.conduct}
                    onChange={e => setVisitForm({ ...visitForm, conduct: e.target.value })}
                  />
                </div>
              </div>
            )}

            {/* ── Property Form ── */}
            {activeType === 'property' && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className={labelClass}>Logradouro *</label>
                    <input
                      className={inputClass}
                      placeholder="Ex: Rua São José"
                      value={propertyForm.address}
                      onChange={e => setPropertyForm({ ...propertyForm, address: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Número *</label>
                    <input
                      className={inputClass}
                      placeholder="Ex: 342"
                      value={propertyForm.number}
                      onChange={e => setPropertyForm({ ...propertyForm, number: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Bairro *</label>
                  <select
                    className={inputClass}
                    value={propertyForm.neighborhoodId}
                    onChange={e => setPropertyForm({ ...propertyForm, neighborhoodId: e.target.value })}
                  >
                    <option value="">Selecione...</option>
                    {neighborhoods.map(n => (
                      <option key={n.id} value={n.id}>{n.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Tipo de Imóvel</label>
                    <select
                      className={inputClass}
                      value={propertyForm.type}
                      onChange={e => setPropertyForm({ ...propertyForm, type: e.target.value as PropertyType })}
                    >
                      <option value="RESIDENCIA">Residência</option>
                      <option value="COMERCIO">Comércio</option>
                      <option value="TERRENO_BALDIO">Terreno Baldio</option>
                      <option value="IMOVEL_ABANDONADO">Imóvel Abandonado</option>
                      <option value="DEPOSITO">Depósito</option>
                      <option value="BORRACHARIA">Borracharia</option>
                      <option value="OFICINA">Oficina</option>
                      <option value="OUTROS">Outros</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Zona</label>
                    <select
                      className={inputClass}
                      value={propertyForm.zone}
                      onChange={e => setPropertyForm({ ...propertyForm, zone: e.target.value as ZoneType })}
                    >
                      <option value="URBANA">Urbana</option>
                      <option value="RURAL">Rural</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Morador (opcional)</label>
                    <input
                      className={inputClass}
                      placeholder="Nome do responsável"
                      value={propertyForm.residentName}
                      onChange={e => setPropertyForm({ ...propertyForm, residentName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Telefone (opcional)</label>
                    <input
                      className={inputClass}
                      placeholder="(51) 99999-9999"
                      value={propertyForm.residentPhone}
                      onChange={e => setPropertyForm({ ...propertyForm, residentPhone: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── Complaint Form ── */}
            {activeType === 'complaint' && (
              <div className="space-y-3">
                <div>
                  <label className={labelClass}>Tipo de Denúncia *</label>
                  <select
                    className={inputClass}
                    value={complaintForm.type}
                    onChange={e => setComplaintForm({ ...complaintForm, type: e.target.value as CitizenComplaintType })}
                  >
                    <option value="AGUA_PARADA">Água Parada</option>
                    <option value="TERRENO_BALDIO">Terreno Baldio</option>
                    <option value="PISCINA_ABANDONADA">Piscina Abandonada</option>
                    <option value="PNEUS">Pneus Acumulados</option>
                    <option value="LIXO_SUCATA">Lixo / Sucata</option>
                    <option value="IMOVEL_ABANDONADO">Imóvel Abandonado</option>
                    <option value="POSSIVEL_FOCO">Possível Foco</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Descrição *</label>
                  <textarea
                    className={inputClass}
                    rows={2}
                    placeholder="Descreva o problema encontrado..."
                    value={complaintForm.description}
                    onChange={e => setComplaintForm({ ...complaintForm, description: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass}>Endereço *</label>
                  <input
                    className={inputClass}
                    placeholder="Ex: Rua Marechal Deodoro, 450"
                    value={complaintForm.address}
                    onChange={e => setComplaintForm({ ...complaintForm, address: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass}>Bairro *</label>
                  <select
                    className={inputClass}
                    value={complaintForm.neighborhood}
                    onChange={e => setComplaintForm({ ...complaintForm, neighborhood: e.target.value })}
                  >
                    <option value="">Selecione...</option>
                    {neighborhoods.map(n => (
                      <option key={n.id} value={n.name}>{n.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Nome do Cidadão (opcional)</label>
                    <input
                      className={inputClass}
                      placeholder="Anônimo ou nome"
                      value={complaintForm.citizenName}
                      onChange={e => setComplaintForm({ ...complaintForm, citizenName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Telefone (opcional)</label>
                    <input
                      className={inputClass}
                      placeholder="(51) 99999-9999"
                      value={complaintForm.citizenPhone}
                      onChange={e => setComplaintForm({ ...complaintForm, citizenPhone: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── Task Form ── */}
            {activeType === 'task' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Tipo de Tarefa</label>
                    <select
                      className={inputClass}
                      value={taskForm.type}
                      onChange={e => setTaskForm({ ...taskForm, type: e.target.value as TaskType })}
                    >
                      <option value="VISITA_DE_ROTINA">Visita de Rotina</option>
                      <option value="RETORNO_PENDENCIA">Retorno / Pendência</option>
                      <option value="BLOQUEIO_QUIMICO">Bloqueio Químico</option>
                      <option value="PONTO_ESTRATEGICO">Ponto Estratégico</option>
                      <option value="DENUNCIA">Denúncia</option>
                      <option value="OVITRAMPA">Ovitrampa</option>
                      <option value="MUTIRAO">Mutirão</option>
                      <option value="ACAO_EDUCATIVA">Ação Educativa</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Prioridade</label>
                    <select
                      className={inputClass}
                      value={taskForm.priority}
                      onChange={e => setTaskForm({ ...taskForm, priority: e.target.value as TaskPriority })}
                    >
                      <option value="NORMAL">Normal</option>
                      <option value="ATENCAO">Atenção</option>
                      <option value="ALTA">Alta</option>
                      <option value="URGENTE">Urgente</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Bairro</label>
                  <select
                    className={inputClass}
                    value={taskForm.neighborhood}
                    onChange={e => setTaskForm({ ...taskForm, neighborhood: e.target.value })}
                  >
                    <option value="">Selecione...</option>
                    {neighborhoods.map(n => (
                      <option key={n.id} value={n.name}>{n.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Agente Responsável</label>
                  <select
                    className={inputClass}
                    value={taskForm.assignedAgentId}
                    onChange={e => setTaskForm({ ...taskForm, assignedAgentId: e.target.value })}
                  >
                    <option value="">Selecione um ACE...</option>
                    {aceAgents.map(a => (
                      <option key={a.id} value={a.id}>{a.name} — {a.registrationNumber}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Observações</label>
                  <textarea
                    className={inputClass}
                    rows={2}
                    placeholder="Instruções para o agente..."
                    value={taskForm.notes}
                    onChange={e => setTaskForm({ ...taskForm, notes: e.target.value })}
                  />
                </div>
              </div>
            )}

            {/* Submit */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-sm font-bold text-white hover:bg-blue-700 transition shadow-sm"
              >
                Salvar Registro
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
