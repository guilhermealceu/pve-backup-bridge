import React, { useState } from 'react';
import {
  Clock,
  Plus,
  Play,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Edit2,
  Calendar,
  Server,
  HardDrive,
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { AutomationSchedule, ProxmoxServer, VMResource, StoragePool } from '../types/proxmox.js';
import { formatDate } from '../lib/formatters.js';

interface AutomationManagerProps {
  automations: AutomationSchedule[];
  servers: ProxmoxServer[];
  vms: VMResource[];
  storages: StoragePool[];
  onSaveAutomation: (auto: Partial<AutomationSchedule>) => Promise<void>;
  onDeleteAutomation: (id: string) => Promise<void>;
  onTriggerAutomation: (id: string) => Promise<void>;
  onOpenTransferWizard: () => void;
}

export const AutomationManager: React.FC<AutomationManagerProps> = ({
  automations,
  servers,
  vms,
  storages,
  onSaveAutomation,
  onDeleteAutomation,
  onTriggerAutomation,
  onOpenTransferWizard,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [sourceServerId, setSourceServerId] = useState('');
  const [targetServerId, setTargetServerId] = useState('');
  const [targetNode, setTargetNode] = useState('dr-node-01');
  const [targetStorage, setTargetStorage] = useState('backup-dr-nfs');
  const [selectionMode, setSelectionMode] = useState<'all' | 'specific' | 'tag'>('specific');
  const [selectedVmids, setSelectedVmids] = useState<number[]>([]);
  const [selectedTag, setSelectedTag] = useState('');
  const [frequency, setFrequency] = useState<'hourly' | 'daily' | 'weekly' | 'custom'>('daily');
  const [scheduleTime, setScheduleTime] = useState('03:00');
  const [keepLastNBackups, setKeepLastNBackups] = useState(7);
  const [autoRestore, setAutoRestore] = useState(true);
  const [startAfterRestore, setStartAfterRestore] = useState(false);
  const [takeSnapshotFirst, setTakeSnapshotFirst] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);

  const openNewModal = () => {
    setEditingId(null);
    setName('Rotina Diária de Sincronização Proxmox');
    setEnabled(true);
    const srcId = servers[0]?.id || '';
    const tgtId = servers[1]?.id || servers[0]?.id || '';
    setSourceServerId(srcId);
    setTargetServerId(tgtId);
    setSelectionMode('specific');
    const firstVm = vms.find((v) => v.serverId === srcId);
    setSelectedVmids(firstVm ? [firstVm.vmid] : []);
    setFrequency('daily');
    setScheduleTime('03:00');
    setKeepLastNBackups(7);
    setAutoRestore(true);
    setStartAfterRestore(false);
    setTakeSnapshotFirst(true);
    setIsModalOpen(true);
  };

  const handleEdit = (auto: AutomationSchedule) => {
    setEditingId(auto.id);
    setName(auto.name);
    setEnabled(auto.enabled);
    setSourceServerId(auto.sourceServerId);
    setTargetServerId(auto.targetServerId);
    setTargetNode(auto.targetNode);
    setTargetStorage(auto.targetStorage);
    setSelectionMode(auto.selectionMode);
    setSelectedVmids(auto.selectedVmids || []);
    setSelectedTag(auto.selectedTag || '');
    setFrequency(auto.frequency);
    setScheduleTime(auto.scheduleTime);
    setKeepLastNBackups(auto.keepLastNBackups);
    setAutoRestore(auto.autoRestore);
    setStartAfterRestore(auto.startAfterRestore);
    setTakeSnapshotFirst(auto.takeSnapshotFirst);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSaveAutomation({
        id: editingId || undefined,
        name,
        enabled,
        sourceServerId,
        targetServerId,
        targetNode,
        targetStorage,
        selectionMode,
        selectedVmids,
        selectedTag,
        frequency,
        scheduleTime,
        cronExpression: frequency === 'daily' ? `0 ${scheduleTime.split(':')[0]} * * *` : '0 3 * * *',
        keepLastNBackups,
        autoRestore,
        startAfterRestore,
        takeSnapshotFirst,
      });
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTrigger = async (id: string) => {
    setTriggeringId(id);
    try {
      await onTriggerAutomation(id);
    } finally {
      setTimeout(() => setTriggeringId(null), 1500);
    }
  };

  const sourceServerVMs = vms.filter((v) => v.serverId === sourceServerId);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-400" />
            Automação de Backup & Replicação Contínua
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Programe rotinas automáticas de transferência entre servidores Proxmox (Disaster Recovery / DR).
          </p>
        </div>

        <button
          onClick={openNewModal}
          className="px-4 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-lg shadow-orange-500/20 transition flex items-center gap-2 cursor-pointer w-fit"
        >
          <Plus className="w-4 h-4" />
          <span>Criar Nova Automação</span>
        </button>
      </div>

      {/* Schedules List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {automations.map((auto) => {
          const sourceSrv = servers.find((s) => s.id === auto.sourceServerId);
          const targetSrv = servers.find((s) => s.id === auto.targetServerId);
          const isTriggering = triggeringId === auto.id;

          return (
            <div
              key={auto.id}
              className={`bg-slate-800/90 border rounded-xl p-5 shadow-sm flex flex-col justify-between transition ${
                auto.enabled ? 'border-slate-700/80 hover:border-slate-600' : 'border-slate-800 opacity-60'
              }`}
            >
              <div>
                {/* Card Header: Status Toggle & Title */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border ${
                      auto.enabled
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-slate-700/50 text-slate-400 border-slate-700'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${auto.enabled ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                    {auto.enabled ? 'Ativo' : 'Pausado'}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(auto)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
                      title="Editar Regra"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteAutomation(auto.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-700 transition cursor-pointer"
                      title="Excluir Regra"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h4 className="text-sm font-bold text-white tracking-tight mb-2">{auto.name}</h4>

                {/* Server Route Flow */}
                <div className="bg-slate-900/90 border border-slate-700/60 rounded-lg p-2.5 mb-3 text-xs space-y-1.5 font-mono">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Origem:</span>
                    <span className="text-orange-400 font-semibold truncate max-w-[170px]">
                      {sourceSrv?.name || auto.sourceServerId}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Destino:</span>
                    <span className="text-emerald-400 font-semibold truncate max-w-[170px]">
                      {targetSrv?.name || auto.targetServerId}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                    <span>Storage Alvo:</span>
                    <span className="text-slate-200">{auto.targetStorage}</span>
                  </div>
                </div>

                {/* Scope & Schedule Info */}
                <div className="space-y-1.5 text-xs text-slate-300 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                      Frequência:
                    </span>
                    <span className="font-semibold text-white capitalize">
                      {auto.frequency} às {auto.scheduleTime}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-indigo-400" />
                      Escopo:
                    </span>
                    <span className="font-semibold text-white">
                      {auto.selectionMode === 'all'
                        ? 'Todas as VMs'
                        : auto.selectionMode === 'tag'
                        ? `Tag: #${auto.selectedTag}`
                        : `${auto.selectedVmids?.length || 0} VM(s)`}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                      Retenção:
                    </span>
                    <span className="text-slate-200">Manter últimos {auto.keepLastNBackups} bkps</span>
                  </div>
                </div>

                {/* Last Run Info */}
                <div className="text-[11px] text-slate-400 bg-slate-900/50 rounded-lg p-2 mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <span>Última Execução:</span>
                    <span className="text-slate-200 font-mono">
                      {auto.lastRunAt ? formatDate(auto.lastRunAt) : 'Pendente'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Execuções Totais:</span>
                    <span className="font-bold text-orange-400 font-mono">{auto.totalRuns}</span>
                  </div>
                </div>
              </div>

              {/* Action Button: Trigger Now */}
              <button
                onClick={() => handleTrigger(auto.id)}
                disabled={isTriggering}
                className="w-full py-2 px-3 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 hover:border-orange-500/50 text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <Zap className={`w-3.5 h-3.5 ${isTriggering ? 'animate-bounce text-orange-400' : ''}`} />
                <span>{isTriggering ? 'Disparando Rotina...' : 'Executar Agora'}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* MODAL: CREATE / EDIT AUTOMATION */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <h3 className="text-base font-bold text-white tracking-tight">
                {editingId ? 'Editar Regra de Automação' : 'Criar Nova Regra de Sincronização'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs text-slate-200 flex-1">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Nome da Regra:</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Proxmox de Origem:</label>
                  <select
                    value={sourceServerId}
                    onChange={(e) => setSourceServerId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-orange-500 cursor-pointer"
                  >
                    {servers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">Proxmox de Destino:</label>
                  <select
                    value={targetServerId}
                    onChange={(e) => setTargetServerId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-orange-500 cursor-pointer"
                  >
                    {servers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Selection Mode */}
              <div>
                <label className="block text-slate-400 font-medium mb-1">Escopo de VMs a Sincronizar:</label>
                <div className="flex gap-4 mb-2">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="selMode"
                      checked={selectionMode === 'specific'}
                      onChange={() => setSelectionMode('specific')}
                      className="text-orange-500 bg-slate-950"
                    />
                    <span>VMs Específicas</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="selMode"
                      checked={selectionMode === 'all'}
                      onChange={() => setSelectionMode('all')}
                      className="text-orange-500 bg-slate-950"
                    />
                    <span>Todas as Instâncias</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="selMode"
                      checked={selectionMode === 'tag'}
                      onChange={() => setSelectionMode('tag')}
                      className="text-orange-500 bg-slate-950"
                    />
                    <span>Por Tag (ex: #production)</span>
                  </label>
                </div>

                {selectionMode === 'specific' && (
                  <div className="max-h-36 overflow-y-auto border border-slate-700 rounded-lg p-2 bg-slate-950 space-y-1">
                    {sourceServerVMs.map((vm) => (
                      <label key={vm.vmid} className="flex items-center gap-2 p-1 hover:bg-slate-800 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedVmids.includes(vm.vmid)}
                          onChange={() =>
                            setSelectedVmids((prev) =>
                              prev.includes(vm.vmid) ? prev.filter((id) => id !== vm.vmid) : [...prev, vm.vmid]
                            )
                          }
                          className="text-orange-500 bg-slate-900 rounded"
                        />
                        <span className="font-mono text-orange-400">[{vm.vmid}]</span>
                        <span className="text-white">{vm.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Schedule Timing & Retention */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Frequência:</label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                  >
                    <option value="hourly">A cada hora</option>
                    <option value="daily">Diariamente</option>
                    <option value="weekly">Semanalmente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">Horário de Execução:</label>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">Retenção (últimos bkps):</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={keepLastNBackups}
                    onChange={(e) => setKeepLastNBackups(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={takeSnapshotFirst}
                    onChange={(e) => setTakeSnapshotFirst(e.target.checked)}
                    className="text-orange-500 rounded"
                  />
                  <span>Criar snapshot de segurança antes de gerar backup</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoRestore}
                    onChange={(e) => setAutoRestore(e.target.checked)}
                    className="text-orange-500 rounded"
                  />
                  <span>Restaurar automaticamente no Proxmox de destino</span>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold"
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar Automação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
