import React, { useState } from 'react';
import {
  HardDrive,
  ArrowRightLeft,
  Search,
  Filter,
  ShieldCheck,
  Calendar,
  Layers,
  FileArchive,
  Download,
  CheckCircle2,
  Server,
  Zap,
} from 'lucide-react';
import { BackupItem, StoragePool, ProxmoxServer, VMResource } from '../types/proxmox.js';
import { formatBytes, formatDate } from '../lib/formatters.js';

interface BackupExplorerViewProps {
  backups: BackupItem[];
  storages: StoragePool[];
  servers: ProxmoxServer[];
  vms: VMResource[];
  selectedServerId: string;
  onSelectBackupForTransfer: (backup: BackupItem) => void;
  onOpenTransferWizard: () => void;
}

export const BackupExplorerView: React.FC<BackupExplorerViewProps> = ({
  backups,
  storages,
  servers,
  vms,
  selectedServerId,
  onSelectBackupForTransfer,
  onOpenTransferWizard,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [storageFilter, setStorageFilter] = useState('all');
  const [formatFilter, setFormatFilter] = useState('all');

  const filteredStorages =
    selectedServerId === 'all' ? storages : storages.filter((s) => s.serverId === selectedServerId);

  const filteredBackups = backups.filter((b) => {
    if (selectedServerId !== 'all' && b.serverId !== selectedServerId) return false;
    if (storageFilter !== 'all' && b.storage !== storageFilter) return false;
    if (formatFilter !== 'all' && b.format !== formatFilter) return false;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        b.vmName.toLowerCase().includes(term) ||
        String(b.vmid).includes(term) ||
        b.volid.toLowerCase().includes(term) ||
        b.storage.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const totalBackupSize = filteredBackups.reduce((acc, b) => acc + (b.sizeBytes || 0), 0);

  return (
    <div className="space-y-6">
      {/* Storage Pools Header Cards */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Pools de Armazenamento de Backup Conectados
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {filteredStorages
            .filter((s) => s.content.includes('backup'))
            .map((st) => {
              const usedPercent = Math.round((st.usedBytes / (st.totalBytes || 1)) * 100);

              return (
                <div
                  key={st.id}
                  className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <HardDrive className="w-4 h-4 text-orange-400" />
                        <h4 className="text-sm font-bold text-white tracking-tight">{st.storage}</h4>
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        Tipo: <span className="uppercase text-slate-300">{st.type}</span> | Nó: {st.node}
                      </p>
                    </div>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-emerald-400">
                      Ativo
                    </span>
                  </div>

                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-slate-300 mb-1">
                      <span>{formatBytes(st.usedBytes, 1)} usados</span>
                      <span className="text-slate-400">{formatBytes(st.totalBytes, 0)} total ({usedPercent}%)</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full ${
                          usedPercent > 85 ? 'bg-rose-500' : usedPercent > 70 ? 'bg-amber-500' : 'bg-orange-500'
                        }`}
                        style={{ width: `${usedPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Control Bar: Search & Filter */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filtrar por nome da VM, ID, arquivo vzdump..."
            className="w-full pl-9 pr-4 py-2 bg-slate-900/80 border border-slate-700 rounded-lg text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Storage Filter */}
          <select
            value={storageFilter}
            onChange={(e) => setStorageFilter(e.target.value)}
            className="bg-slate-900/80 border border-slate-700 text-slate-300 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500 cursor-pointer"
          >
            <option value="all">Storage: Todos</option>
            {filteredStorages.map((s) => (
              <option key={s.id} value={s.storage}>
                {s.storage} ({s.type})
              </option>
            ))}
          </select>

          {/* Format Filter */}
          <select
            value={formatFilter}
            onChange={(e) => setFormatFilter(e.target.value)}
            className="bg-slate-900/80 border border-slate-700 text-slate-300 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500 cursor-pointer"
          >
            <option value="all">Formato: Todos</option>
            <option value="vma.zst">QEMU VMA ZSTD (.vma.zst)</option>
            <option value="tar.zst">LXC Tar ZSTD (.tar.zst)</option>
          </select>

          <button
            onClick={onOpenTransferWizard}
            className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg text-xs shadow transition flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Migrar Backup</span>
          </button>
        </div>
      </div>

      {/* Backups List Table */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl overflow-hidden shadow-sm">
        <div className="p-3.5 bg-slate-900/90 border-b border-slate-700 flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-300">
            Arquivos de Backup Armazenados ({filteredBackups.length})
          </span>
          <span className="font-mono text-orange-400 font-bold">
            Espaço Ocupado: {formatBytes(totalBackupSize, 1)}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-200">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="p-3.5 pl-4">Arquivo vzdump</th>
                <th className="p-3.5">VM / Container</th>
                <th className="p-3.5">Cluster & Storage</th>
                <th className="p-3.5">Data / Criação</th>
                <th className="p-3.5">Tamanho</th>
                <th className="p-3.5">Formato</th>
                <th className="p-3.5 text-right pr-4">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60 font-mono">
              {filteredBackups.map((bkp) => {
                const fileName = bkp.volid.split('/')[1] || bkp.volid;

                return (
                  <tr key={`${bkp.serverId}-${bkp.storage}-${bkp.volid}`} className="hover:bg-slate-700/30 transition">
                    <td className="p-3.5 pl-4">
                      <div className="flex items-center gap-2 max-w-xs truncate">
                        <FileArchive className="w-4 h-4 text-orange-400 shrink-0" />
                        <span className="text-white font-bold truncate text-[11px]" title={bkp.volid}>
                          {fileName}
                        </span>
                      </div>
                    </td>

                    <td className="p-3.5">
                      <div className="flex items-center gap-1.5 font-sans">
                        <span className="font-mono text-orange-400 font-bold bg-slate-900 px-1 py-0.5 rounded border border-slate-700 text-[11px]">
                          {bkp.vmid}
                        </span>
                        <span className="text-white font-semibold text-xs">{bkp.vmName}</span>
                      </div>
                    </td>

                    <td className="p-3.5 font-sans">
                      <div className="text-slate-200 text-xs">{bkp.serverName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        Storage: <span className="text-slate-300">{bkp.storage}</span> ({bkp.node})
                      </div>
                    </td>

                    <td className="p-3.5 text-slate-300 text-xs font-sans">
                      {bkp.dateFormatted}
                    </td>

                    <td className="p-3.5 font-bold text-orange-300 text-xs">
                      {formatBytes(bkp.sizeBytes)}
                    </td>

                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-cyan-400 text-[10px] uppercase font-bold">
                        {bkp.format}
                      </span>
                    </td>

                    <td className="p-3.5 text-right pr-4">
                      <button
                        onClick={() => onSelectBackupForTransfer(bkp)}
                        className="px-3 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 font-sans font-semibold text-xs transition flex items-center gap-1.5 ml-auto cursor-pointer"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        <span>Transferir</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
