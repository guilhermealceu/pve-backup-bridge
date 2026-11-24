import React from 'react';
import {
  Server,
  Cpu,
  Database,
  HardDrive,
  ShieldCheck,
  AlertTriangle,
  Camera,
  Layers,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import { VMResource, StoragePool, ProxmoxServer } from '../types/proxmox.js';
import { formatBytes } from '../lib/formatters.js';

interface ClusterOverviewCardsProps {
  vms: VMResource[];
  storages: StoragePool[];
  servers: ProxmoxServer[];
  selectedServerId: string;
}

export const ClusterOverviewCards: React.FC<ClusterOverviewCardsProps> = ({
  vms,
  storages,
  servers,
  selectedServerId,
}) => {
  const filteredVMs = selectedServerId === 'all' ? vms : vms.filter((v) => v.serverId === selectedServerId);
  const filteredStorages =
    selectedServerId === 'all' ? storages : storages.filter((s) => s.serverId === selectedServerId);

  const totalVMs = filteredVMs.length;
  const runningVMs = filteredVMs.filter((v) => v.status === 'running').length;
  const stoppedVMs = totalVMs - runningVMs;

  const totalCPUCores = filteredVMs.reduce((acc, v) => acc + (v.cpus || 0), 0);
  const avgCPU =
    totalVMs > 0
      ? (filteredVMs.reduce((acc, v) => acc + (v.status === 'running' ? v.cpuUsagePercent : 0), 0) / (runningVMs || 1)).toFixed(1)
      : '0';

  const totalMemUsed = filteredVMs.reduce((acc, v) => acc + (v.memUsedBytes || 0), 0);
  const totalMemMax = filteredVMs.reduce((acc, v) => acc + (v.memMaxBytes || 0), 0);
  const memPercent = totalMemMax > 0 ? Math.round((totalMemUsed / totalMemMax) * 100) : 0;

  const totalDiskUsed = filteredStorages.reduce((acc, s) => acc + (s.usedBytes || 0), 0);
  const totalDiskMax = filteredStorages.reduce((acc, s) => acc + (s.totalBytes || 0), 0);
  const diskPercent = totalDiskMax > 0 ? Math.round((totalDiskUsed / totalDiskMax) * 100) : 0;

  const vmsWithBackup = filteredVMs.filter((v) => v.backupCount > 0).length;
  const backupPercent = totalVMs > 0 ? Math.round((vmsWithBackup / totalVMs) * 100) : 0;

  const totalSnapshots = filteredVMs.reduce((acc, v) => acc + (v.snapshotsCount || 0), 0);
  const vmsWithoutBackup = filteredVMs.filter((v) => v.backupCount === 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Total VMs & LXCs Card */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-4 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Instâncias Proxmox</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-white tracking-tight">{totalVMs}</span>
              <span className="text-xs text-slate-400">ativos/registrados</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>{runningVMs} em execução</span>
          </div>
          {stoppedVMs > 0 && (
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-slate-500"></span>
              <span>{stoppedVMs} desligados</span>
            </div>
          )}
        </div>

        <div className="w-full bg-slate-700/50 rounded-full h-1.5 mt-3 overflow-hidden">
          <div
            className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${totalVMs > 0 ? (runningVMs / totalVMs) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* CPU & Mem Allocation Card */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-4 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Memória & vCPU</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-white tracking-tight">{formatBytes(totalMemUsed, 1)}</span>
              <span className="text-xs text-slate-400">/ {formatBytes(totalMemMax, 0)}</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Cpu className="w-5 h-5" />
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between text-xs text-slate-300">
          <span>Uso de RAM: {memPercent}%</span>
          <span className="text-slate-400">{totalCPUCores} vCPUs ({avgCPU}% carga)</span>
        </div>

        <div className="w-full bg-slate-700/50 rounded-full h-1.5 mt-2 overflow-hidden">
          <div
            className={`h-1.5 rounded-full transition-all duration-500 ${
              memPercent > 85 ? 'bg-rose-500' : memPercent > 65 ? 'bg-amber-500' : 'bg-cyan-500'
            }`}
            style={{ width: `${Math.min(100, memPercent)}%` }}
          />
        </div>
      </div>

      {/* Storage Pools Usage Card */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-4 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pools de Armazenamento</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-white tracking-tight">{formatBytes(totalDiskUsed, 1)}</span>
              <span className="text-xs text-slate-400">/ {formatBytes(totalDiskMax, 0)}</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <HardDrive className="w-5 h-5" />
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between text-xs text-slate-300">
          <span>Ocupação Global: {diskPercent}%</span>
          <span className="text-slate-400">{filteredStorages.length} storages</span>
        </div>

        <div className="w-full bg-slate-700/50 rounded-full h-1.5 mt-2 overflow-hidden">
          <div
            className={`h-1.5 rounded-full transition-all duration-500 ${
              diskPercent > 85 ? 'bg-rose-500' : diskPercent > 70 ? 'bg-amber-500' : 'bg-indigo-500'
            }`}
            style={{ width: `${Math.min(100, diskPercent)}%` }}
          />
        </div>
      </div>

      {/* Backup Coverage & Snapshots Card */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-4 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Proteção de Backups</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-white tracking-tight">{backupPercent}%</span>
              <span className="text-xs text-slate-400">({vmsWithBackup}/{totalVMs} VMs)</span>
            </div>
          </div>
          <div
            className={`w-10 h-10 rounded-lg border flex items-center justify-center ${
              vmsWithoutBackup.length > 0
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}
          >
            {vmsWithoutBackup.length > 0 ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <ShieldCheck className="w-5 h-5" />
            )}
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-slate-300 flex items-center gap-1">
            <Camera className="w-3.5 h-3.5 text-purple-400" />
            {totalSnapshots} snapshots ativos
          </span>
          {vmsWithoutBackup.length > 0 ? (
            <span className="text-amber-400 font-medium">⚠️ {vmsWithoutBackup.length} sem bkp!</span>
          ) : (
            <span className="text-emerald-400 font-medium">100% Protegido</span>
          )}
        </div>

        <div className="w-full bg-slate-700/50 rounded-full h-1.5 mt-2 overflow-hidden">
          <div
            className={`h-1.5 rounded-full transition-all duration-500 ${
              backupPercent >= 80 ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
            style={{ width: `${backupPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
};
