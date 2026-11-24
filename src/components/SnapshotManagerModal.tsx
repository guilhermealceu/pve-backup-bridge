import React, { useState } from 'react';
import {
  Camera,
  X,
  Plus,
  Clock,
  Database,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  Trash2,
  Layers,
} from 'lucide-react';
import { VMResource, SnapshotItem } from '../types/proxmox.js';
import { formatDate } from '../lib/formatters.js';

interface SnapshotManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  vm: VMResource | null;
  onCreateSnapshot: (
    vmid: number,
    payload: { name: string; description: string; vmstate: boolean; serverId: string }
  ) => Promise<void>;
  onSelectVMForTransfer: (vm: VMResource) => void;
}

export const SnapshotManagerModal: React.FC<SnapshotManagerModalProps> = ({
  isOpen,
  onClose,
  vm,
  onCreateSnapshot,
  onSelectVMForTransfer,
}) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [snapName, setSnapName] = useState('');
  const [description, setDescription] = useState('');
  const [vmstate, setVmstate] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen || !vm) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccessMsg(null);
    try {
      const generatedName = snapName.trim() || `snap_${new Date().toISOString().replace(/[-:T]/g, '_').substring(0, 19)}`;
      await onCreateSnapshot(vm.vmid, {
        name: generatedName,
        description: description || 'Snapshot criado via Proxmox Backup Web Manager',
        vmstate,
        serverId: vm.serverId,
      });
      setSuccessMsg(`Snapshot "${generatedName}" criado com sucesso!`);
      setShowCreateForm(false);
      setSnapName('');
      setDescription('');
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-orange-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                  {vm.vmid}
                </span>
                <h3 className="text-base font-bold text-white tracking-tight">{vm.name}</h3>
              </div>
              <p className="text-xs text-slate-400">
                Gerenciador de Snapshots & Pontos de Restauração em Memória (RAM)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 text-xs text-slate-200 space-y-4">
          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Action Bar */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Snapshots Existentes ({vm.snapshots.length})
            </span>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="px-3 py-1.5 rounded-lg bg-purple-500 hover:bg-purple-600 text-white font-semibold text-xs shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo Snapshot</span>
            </button>
          </div>

          {/* Form Create Snapshot */}
          {showCreateForm && (
            <form
              onSubmit={handleCreate}
              className="p-4 rounded-xl border border-purple-500/40 bg-purple-950/20 space-y-3 animate-fadeIn"
            >
              <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wider">
                Criar Novo Snapshot da VM
              </h4>

              <div>
                <label className="block text-slate-400 mb-1">Nome do Snapshot:</label>
                <input
                  type="text"
                  placeholder="ex: snap_pre_upgrade_2026"
                  value={snapName}
                  onChange={(e) => setSnapName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Descrição / Motivo:</label>
                <input
                  type="text"
                  placeholder="ex: Antes de atualizar pacotes do sistema e particionamento"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={vmstate}
                  onChange={(e) => setVmstate(e.target.checked)}
                  className="text-purple-500 rounded bg-slate-900"
                />
                <span>Incluir estado da Memória RAM (vmstate / live snapshot)</span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-purple-500 hover:bg-purple-600 text-white font-bold disabled:opacity-50"
                >
                  {isSubmitting ? 'Gerando...' : 'Criar Snapshot'}
                </button>
              </div>
            </form>
          )}

          {/* Snapshots Tree / Timeline */}
          {vm.snapshots.length === 0 ? (
            <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800 text-slate-500">
              <Camera className="w-8 h-8 mx-auto text-slate-700 mb-2" />
              <p className="font-semibold text-slate-400">Nenhum snapshot ativo nesta VM</p>
              <p className="text-[11px] mt-1">Crie um snapshot antes de realizar upgrades ou manutenções.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {vm.snapshots.map((snap, idx) => (
                <div
                  key={`${snap.name}-${snap.snaptime || idx}`}
                  className="p-3.5 rounded-xl border border-slate-700/80 bg-slate-800/60 hover:bg-slate-800 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-500/30">
                        {snap.name}
                      </span>
                      {snap.vmstate && (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30 font-medium">
                          + RAM State
                        </span>
                      )}
                      {snap.isCurrent && (
                        <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded font-bold">
                          Atual
                        </span>
                      )}
                    </div>
                    <p className="text-slate-300">{snap.description}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-1">
                      Data: {formatDate(snap.snaptime)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      onClick={() => {
                        onClose();
                        onSelectVMForTransfer(vm);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/40 text-[11px] font-semibold transition"
                      title="Migrar VM com base neste snapshot para outro Proxmox"
                    >
                      Migrar PVE
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
