import React, { useState } from 'react';
import {
  Plus,
  X,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  Play,
  Zap,
  ShieldCheck,
} from 'lucide-react';
import { VMResource, StoragePool } from '../types/proxmox.js';
import { formatBytes } from '../lib/formatters.js';

interface CreateBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  vm: VMResource | null;
  storages: StoragePool[];
  onCreateBackup: (
    vmid: number,
    payload: { storage?: string; compression?: string; mode?: string; serverId: string }
  ) => Promise<void>;
  onSelectVMForTransfer: (vm: VMResource) => void;
}

export const CreateBackupModal: React.FC<CreateBackupModalProps> = ({
  isOpen,
  onClose,
  vm,
  storages,
  onCreateBackup,
  onSelectVMForTransfer,
}) => {
  const [targetStorage, setTargetStorage] = useState('');
  const [mode, setMode] = useState<'snapshot' | 'suspend' | 'stop'>('snapshot');
  const [compression, setCompression] = useState<'zstd' | 'lzo' | 'gzip'>('zstd');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen || !vm) return null;

  const availableStorages = storages.filter((s) => s.serverId === vm.serverId && s.content.includes('backup'));
  const currentStorage = targetStorage || (availableStorages[0]?.storage || 'nfs-backups');

  const handleTrigger = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccessMsg(null);
    try {
      await onCreateBackup(vm.vmid, {
        storage: currentStorage,
        mode,
        compression,
        serverId: vm.serverId,
      });
      setSuccessMsg(`Backup vzdump gerado com êxito no storage ${currentStorage}!`);
      setTimeout(() => {
        setIsSubmitting(false);
      }, 1000);
    } catch (err: any) {
      console.error(err);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-orange-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                  {vm.vmid}
                </span>
                <h3 className="text-base font-bold text-white tracking-tight">{vm.name}</h3>
              </div>
              <p className="text-xs text-slate-400">Executar Backup vzdump Imediato (Snapshot Mode)</p>
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
        <form onSubmit={handleTrigger} className="p-5 sm:p-6 space-y-4 text-xs text-slate-200">
          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{successMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSelectVMForTransfer(vm);
                }}
                className="px-2.5 py-1 rounded bg-orange-500 hover:bg-orange-600 text-white font-bold text-[11px]"
              >
                Transferir Agora
              </button>
            </div>
          )}

          {/* Target Storage */}
          <div>
            <label className="block text-slate-400 font-medium mb-1">Storage de Destino do Backup:</label>
            <select
              value={currentStorage}
              onChange={(e) => setTargetStorage(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-orange-500 cursor-pointer"
            >
              {availableStorages.map((st) => (
                <option key={st.id} value={st.storage}>
                  {st.storage} ({st.type.toUpperCase()}) - {formatBytes(st.availBytes, 1)} livres
                </option>
              ))}
              {availableStorages.length === 0 && (
                <option value="nfs-backups">nfs-backups (Padrão NFS)</option>
              )}
            </select>
          </div>

          {/* Backup Mode */}
          <div>
            <label className="block text-slate-400 font-medium mb-1">Modo de Backup:</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'snapshot', label: 'Snapshot (Sem parada)', desc: 'Live backup' },
                { id: 'suspend', label: 'Suspender', desc: 'Congela RAM' },
                { id: 'stop', label: 'Parar VM', desc: 'Cold backup' },
              ].map((m) => (
                <label
                  key={m.id}
                  className={`p-2.5 rounded-lg border text-center cursor-pointer transition ${
                    mode === m.id
                      ? 'border-orange-500 bg-orange-500/10 text-white'
                      : 'border-slate-800 bg-slate-950 text-slate-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="bkpMode"
                    className="hidden"
                    checked={mode === m.id}
                    onChange={() => setMode(m.id as any)}
                  />
                  <p className="font-bold text-xs">{m.label}</p>
                  <p className="text-[10px] text-slate-500">{m.desc}</p>
                </label>
              ))}
            </div>
          </div>

          {/* Compression Algorithm */}
          <div>
            <label className="block text-slate-400 font-medium mb-1">Algoritmo de Compressão:</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'zstd', label: 'ZSTD (Rápido/Eficiente)', ext: '.vma.zst' },
                { id: 'lzo', label: 'LZO (Ultra rápido)', ext: '.vma.lzo' },
                { id: 'gzip', label: 'GZIP (Máxima comp.)', ext: '.vma.gz' },
              ].map((c) => (
                <label
                  key={c.id}
                  className={`p-2 rounded-lg border text-center cursor-pointer transition ${
                    compression === c.id
                      ? 'border-orange-500 bg-orange-500/10 text-white'
                      : 'border-slate-800 bg-slate-950 text-slate-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="bkpComp"
                    className="hidden"
                    checked={compression === c.id}
                    onChange={() => setCompression(c.id as any)}
                  />
                  <p className="font-bold text-xs">{c.label}</p>
                  <p className="text-[10px] text-slate-500 font-mono">{c.ext}</p>
                </label>
              ))}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              Fechar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold transition flex items-center gap-2 disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Gerando vzdump...' : 'Gerar Backup Agora'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
