import React, { useState } from 'react';
import {
  Server,
  Play,
  Square,
  Pause,
  Cpu,
  Database,
  HardDrive,
  Globe,
  Camera,
  ShieldAlert,
  ShieldCheck,
  ArrowRightLeft,
  Plus,
  Search,
  Filter,
  Copy,
  Check,
  ExternalLink,
  Layers,
  Box,
  Terminal,
  Clock,
  Zap,
} from 'lucide-react';
import { VMResource, ProxmoxServer } from '../types/proxmox.js';
import { formatBytes, formatUptime } from '../lib/formatters.js';

interface VMExplorerProps {
  vms: VMResource[];
  servers: ProxmoxServer[];
  selectedServerId: string;
  onSelectVMForTransfer: (vm: VMResource) => void;
  onOpenSnapshotModal: (vm: VMResource) => void;
  onOpenBackupModal: (vm: VMResource) => void;
  onOpenBatchTransfer?: (selectedVms: VMResource[]) => void;
}

export const VMExplorer: React.FC<VMExplorerProps> = ({
  vms,
  servers,
  selectedServerId,
  onSelectVMForTransfer,
  onOpenSnapshotModal,
  onOpenBackupModal,
  onOpenBatchTransfer,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'stopped' | 'nobackup' | 'hassnaps'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'qemu' | 'lxc'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [selectedVmIds, setSelectedVmIds] = useState<number[]>([]);
  const [copiedIp, setCopiedIp] = useState<string | null>(null);

  // Copy IP Helper
  const handleCopyIp = (ip: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(ip);
    setCopiedIp(ip);
    setTimeout(() => setCopiedIp(null), 2000);
  };

  // Filter VMs
  const filteredVMs = vms.filter((vm) => {
    if (selectedServerId !== 'all' && vm.serverId !== selectedServerId) return false;

    if (typeFilter !== 'all' && vm.type !== typeFilter) return false;

    if (statusFilter === 'running' && vm.status !== 'running') return false;
    if (statusFilter === 'stopped' && vm.status !== 'stopped') return false;
    if (statusFilter === 'nobackup' && vm.backupCount > 0) return false;
    if (statusFilter === 'hassnaps' && vm.snapshotsCount === 0) return false;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchName = vm.name.toLowerCase().includes(term);
      const matchVmid = String(vm.vmid).includes(term);
      const matchNode = vm.node.toLowerCase().includes(term);
      const matchServer = vm.serverName.toLowerCase().includes(term);
      const matchIp = vm.ipAddresses.some((ip) => ip.toLowerCase().includes(term));
      const matchTag = vm.tags.some((t) => t.toLowerCase().includes(term));
      return matchName || matchVmid || matchNode || matchServer || matchIp || matchTag;
    }

    return true;
  });

  const toggleSelectVm = (vmid: number) => {
    setSelectedVmIds((prev) =>
      prev.includes(vmid) ? prev.filter((id) => id !== vmid) : [...prev, vmid]
    );
  };

  const handleSelectAll = () => {
    if (selectedVmIds.length === filteredVMs.length) {
      setSelectedVmIds([]);
    } else {
      setSelectedVmIds(filteredVMs.map((v) => v.vmid));
    }
  };

  return (
    <div className="space-y-4">
      {/* Control Bar: Search, Filters, View toggle, Batch actions */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-3 sm:p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por Nome, VMID, IP, Host ou Tag..."
            className="w-full pl-9 pr-4 py-2 bg-slate-900/80 border border-slate-700 rounded-lg text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500 transition"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-900/80 border border-slate-700 text-slate-300 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500 cursor-pointer"
          >
            <option value="all">Status: Todos ({vms.length})</option>
            <option value="running">🟢 Em Execução</option>
            <option value="stopped">⚫ Paradas / Desligadas</option>
            <option value="nobackup">⚠️ Sem Backup Recente</option>
            <option value="hassnaps">📸 Com Snapshots</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="bg-slate-900/80 border border-slate-700 text-slate-300 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500 cursor-pointer"
          >
            <option value="all">Tipo: Todos</option>
            <option value="qemu">🖥️ VMs (QEMU / KVM)</option>
            <option value="lxc">📦 Containers (LXC)</option>
          </select>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-900/80 border border-slate-700 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                viewMode === 'grid' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Visualização em Cards"
            >
              Cards
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                viewMode === 'table' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Visualização em Tabela"
            >
              Tabela
            </button>
          </div>
        </div>
      </div>

      {/* Batch selection banner */}
      {selectedVmIds.length > 0 && (
        <div className="bg-orange-950/40 border border-orange-500/40 rounded-xl p-3 px-4 flex items-center justify-between animate-fadeIn text-xs sm:text-sm text-orange-200">
          <div className="flex items-center gap-2 font-medium">
            <Check className="w-4 h-4 text-orange-400" />
            <span>
              {selectedVmIds.length} {selectedVmIds.length === 1 ? 'instância selecionada' : 'instâncias selecionadas'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const selected = vms.filter((v) => selectedVmIds.includes(v.vmid));
                if (selected.length > 0) {
                  onSelectVMForTransfer(selected[0]);
                }
              }}
              className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg shadow transition flex items-center gap-1.5 text-xs cursor-pointer"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Transferir Selecionadas</span>
            </button>
            <button
              onClick={() => setSelectedVmIds([])}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition cursor-pointer"
            >
              Limpar
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredVMs.length === 0 && (
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-12 text-center text-slate-400">
          <Layers className="w-12 h-12 mx-auto text-slate-600 mb-3" />
          <h3 className="text-base font-semibold text-slate-200">Nenhuma VM ou Container encontrado</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Tente ajustar os termos de busca ou filtros de status/servidor para localizar as instâncias Proxmox.
          </p>
        </div>
      )}

      {/* GRID VIEW */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredVMs.map((vm) => {
            const isSelected = selectedVmIds.includes(vm.vmid);
            const cpuColor =
              vm.cpuUsagePercent > 80
                ? 'bg-rose-500'
                : vm.cpuUsagePercent > 50
                ? 'bg-amber-500'
                : 'bg-emerald-500';
            const memPercent = Math.round((vm.memUsedBytes / (vm.memMaxBytes || 1)) * 100);
            const memColor = memPercent > 85 ? 'bg-rose-500' : memPercent > 65 ? 'bg-amber-500' : 'bg-cyan-500';
            const diskPercent = Math.round((vm.diskUsedBytes / (vm.diskMaxBytes || 1)) * 100);

            return (
              <div
                key={`${vm.serverId}-${vm.vmid}`}
                className={`bg-slate-800/90 border rounded-xl p-4 shadow-sm transition-all duration-200 hover:border-slate-600 flex flex-col justify-between ${
                  isSelected ? 'border-orange-500 ring-1 ring-orange-500/50 bg-slate-800' : 'border-slate-700/80'
                }`}
              >
                {/* Card Top: VMID, Name, Status, Server Badge */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectVm(vm.vmid)}
                        className="rounded border-slate-700 text-orange-500 focus:ring-orange-500 bg-slate-900 h-4 w-4 cursor-pointer"
                      />
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-orange-400">
                        {vm.vmid}
                      </span>
                      <span
                        className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded border ${
                          vm.type === 'qemu'
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                            : 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                        }`}
                      >
                        {vm.type === 'qemu' ? 'QEMU/KVM' : 'LXC Container'}
                      </span>
                    </div>

                    {/* Status Dot */}
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          vm.status === 'running'
                            ? 'bg-emerald-400 animate-pulse'
                            : vm.status === 'paused'
                            ? 'bg-amber-400'
                            : 'bg-slate-500'
                        }`}
                      />
                      <span
                        className={`text-[11px] font-semibold capitalize ${
                          vm.status === 'running'
                            ? 'text-emerald-400'
                            : vm.status === 'paused'
                            ? 'text-amber-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {vm.status === 'running' ? 'Em Execução' : vm.status === 'paused' ? 'Pausado' : 'Parado'}
                      </span>
                    </div>
                  </div>

                  {/* VM Name & Server Node */}
                  <h4 className="text-sm font-bold text-white tracking-tight truncate" title={vm.name}>
                    {vm.name}
                  </h4>

                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 mb-3">
                    <span className="flex items-center gap-1 truncate text-slate-300">
                      <Server className="w-3 h-3 text-orange-400 shrink-0" />
                      {vm.serverName} ({vm.node})
                    </span>
                    {vm.uptimeSec > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-[11px] text-slate-400">Up {formatUptime(vm.uptimeSec)}</span>
                      </>
                    )}
                  </div>

                  {/* Network IPs & Guest Agent Section */}
                  <div className="bg-slate-900/90 border border-slate-700/60 rounded-lg p-2.5 mb-3 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                        <Globe className="w-3 h-3 text-cyan-400" />
                        Endereço IP (Guest Agent):
                      </span>
                      {vm.qemuAgentRunning ? (
                        <span className="text-[10px] text-emerald-400 font-medium">Agent Ativo ✓</span>
                      ) : (
                        <span className="text-[10px] text-slate-500">Agent Inativo</span>
                      )}
                    </div>

                    {vm.ipAddresses.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {vm.ipAddresses.map((ip) => (
                          <div
                            key={ip}
                            onClick={(e) => handleCopyIp(ip, e)}
                            className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-mono text-[11px] cursor-pointer transition"
                            title="Clique para copiar o IP"
                          >
                            <span>{ip}</span>
                            {copiedIp === ip ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3 text-slate-400 hover:text-slate-200" />
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500 italic">Nenhum IP detectado via qemu-agent</p>
                    )}
                  </div>

                  {/* Resource Usage Bars: CPU, RAM, Disk */}
                  <div className="space-y-2.5 mb-4">
                    {/* CPU Usage Bar */}
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                          <Cpu className="w-3 h-3 text-orange-400" />
                          CPU ({vm.cpus} vCPU):
                        </span>
                        <span className="font-semibold text-slate-200 text-[11px]">
                          {vm.status === 'running' ? `${vm.cpuUsagePercent.toFixed(1)}%` : '0%'}
                        </span>
                      </div>
                      <div className="w-full bg-slate-700/60 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-300 ${cpuColor}`}
                          style={{ width: `${vm.status === 'running' ? Math.min(100, vm.cpuUsagePercent) : 0}%` }}
                        />
                      </div>
                    </div>

                    {/* RAM Usage Bar */}
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                          <Database className="w-3 h-3 text-cyan-400" />
                          Memória RAM:
                        </span>
                        <span className="font-semibold text-slate-200 text-[11px]">
                          {formatBytes(vm.memUsedBytes, 1)} / {formatBytes(vm.memMaxBytes, 0)} ({memPercent}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-700/60 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-300 ${memColor}`}
                          style={{ width: `${Math.min(100, memPercent)}%` }}
                        />
                      </div>
                    </div>

                    {/* Disk Usage Bar */}
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                          <HardDrive className="w-3 h-3 text-indigo-400" />
                          Disco Alocado:
                        </span>
                        <span className="font-semibold text-slate-200 text-[11px]">
                          {formatBytes(vm.diskUsedBytes, 1)} / {formatBytes(vm.diskMaxBytes, 0)} ({diskPercent}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-700/60 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, diskPercent)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Backups & Snapshots Badges */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-700/70 text-xs mb-3">
                    {/* Backup Badge */}
                    <div className="flex items-center gap-1.5">
                      {vm.backupCount > 0 ? (
                        <div className="flex items-center gap-1 text-emerald-400 text-[11px] font-medium">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>{vm.backupCount} bkp(s)</span>
                          <span className="text-slate-400 text-[10px] hidden xs:inline">
                            ({vm.lastBackupDate?.split(' ')[0] || 'recente'})
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-amber-400 text-[11px] font-semibold">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          <span>Sem backup!</span>
                        </div>
                      )}
                    </div>

                    {/* Snapshot Badge (Clickable) */}
                    <button
                      onClick={() => onOpenSnapshotModal(vm)}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                        vm.snapshotsCount > 0
                          ? 'bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 border border-purple-500/30'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                      title="Ver ou criar snapshots"
                    >
                      <Camera className="w-3 h-3 text-purple-400" />
                      <span>{vm.snapshotsCount} snap(s)</span>
                    </button>
                  </div>
                </div>

                {/* Card Actions Bottom */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700/80">
                  {/* Backup / Snapshot Quick Actions */}
                  <button
                    onClick={() => onOpenBackupModal(vm)}
                    className="w-full py-1.5 px-2 rounded-lg bg-slate-700/80 hover:bg-slate-700 text-slate-200 text-xs font-medium transition flex items-center justify-center gap-1 cursor-pointer"
                    title="Gerar backup vzdump instantâneo"
                  >
                    <Plus className="w-3.5 h-3.5 text-orange-400" />
                    <span>Backup</span>
                  </button>

                  {/* Transfer to another Proxmox */}
                  <button
                    onClick={() => onSelectVMForTransfer(vm)}
                    className="w-full py-1.5 px-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold shadow transition flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                    title="Transferir backup para outro servidor Proxmox"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Transferir</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-200">
              <thead className="bg-slate-900/90 border-b border-slate-700 text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                <tr>
                  <th className="p-3.5 pl-4">
                    <input
                      type="checkbox"
                      checked={selectedVmIds.length === filteredVMs.length && filteredVMs.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-slate-700 text-orange-500 focus:ring-orange-500 bg-slate-900 cursor-pointer"
                    />
                  </th>
                  <th className="p-3.5">VMID / Nome</th>
                  <th className="p-3.5">Cluster & Nó</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">IP da VM</th>
                  <th className="p-3.5 min-w-[130px]">CPU & vCPU</th>
                  <th className="p-3.5 min-w-[140px]">Memória RAM</th>
                  <th className="p-3.5 min-w-[140px]">Disco</th>
                  <th className="p-3.5">Backups</th>
                  <th className="p-3.5">Snapshots</th>
                  <th className="p-3.5 text-right pr-4">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {filteredVMs.map((vm) => {
                  const isSelected = selectedVmIds.includes(vm.vmid);
                  const memPercent = Math.round((vm.memUsedBytes / (vm.memMaxBytes || 1)) * 100);
                  const diskPercent = Math.round((vm.diskUsedBytes / (vm.diskMaxBytes || 1)) * 100);

                  return (
                    <tr
                      key={`${vm.serverId}-${vm.vmid}`}
                      className={`hover:bg-slate-700/30 transition ${isSelected ? 'bg-orange-500/5' : ''}`}
                    >
                      <td className="p-3.5 pl-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectVm(vm.vmid)}
                          className="rounded border-slate-700 text-orange-500 focus:ring-orange-500 bg-slate-900 cursor-pointer"
                        />
                      </td>

                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-orange-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">
                            {vm.vmid}
                          </span>
                          <div>
                            <span className="font-bold text-white">{vm.name}</span>
                            <span className="ml-1.5 text-[10px] text-slate-400 uppercase">
                              ({vm.type === 'qemu' ? 'KVM' : 'LXC'})
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5 text-slate-300">
                        <div>{vm.serverName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{vm.node}</div>
                      </td>

                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              vm.status === 'running' ? 'bg-emerald-400' : 'bg-slate-500'
                            }`}
                          />
                          <span
                            className={
                              vm.status === 'running' ? 'text-emerald-400 font-medium' : 'text-slate-400'
                            }
                          >
                            {vm.status === 'running' ? 'Executando' : 'Parada'}
                          </span>
                        </div>
                      </td>

                      <td className="p-3.5">
                        {vm.ipAddresses.length > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <span
                              onClick={(e) => handleCopyIp(vm.ipAddresses[0], e)}
                              className="font-mono text-slate-200 hover:text-orange-400 cursor-pointer"
                              title="Clique para copiar"
                            >
                              {vm.ipAddresses[0]}
                            </span>
                            {vm.ipAddresses.length > 1 && (
                              <span className="text-[10px] text-slate-400">+{vm.ipAddresses.length - 1}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">--</span>
                        )}
                      </td>

                      {/* CPU Bar */}
                      <td className="p-3.5">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span>{vm.cpuUsagePercent.toFixed(1)}%</span>
                          <span className="text-slate-400">{vm.cpus} vCPU</span>
                        </div>
                        <div className="w-full bg-slate-700/60 rounded-full h-1.5">
                          <div
                            className="bg-orange-500 h-1.5 rounded-full"
                            style={{ width: `${Math.min(100, vm.cpuUsagePercent)}%` }}
                          />
                        </div>
                      </td>

                      {/* RAM Bar */}
                      <td className="p-3.5">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span>{formatBytes(vm.memUsedBytes, 1)}</span>
                          <span className="text-slate-400">{memPercent}%</span>
                        </div>
                        <div className="w-full bg-slate-700/60 rounded-full h-1.5">
                          <div
                            className="bg-cyan-500 h-1.5 rounded-full"
                            style={{ width: `${Math.min(100, memPercent)}%` }}
                          />
                        </div>
                      </td>

                      {/* Disk Bar */}
                      <td className="p-3.5">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span>{formatBytes(vm.diskUsedBytes, 1)}</span>
                          <span className="text-slate-400">{diskPercent}%</span>
                        </div>
                        <div className="w-full bg-slate-700/60 rounded-full h-1.5">
                          <div
                            className="bg-indigo-500 h-1.5 rounded-full"
                            style={{ width: `${Math.min(100, diskPercent)}%` }}
                          />
                        </div>
                      </td>

                      {/* Backup */}
                      <td className="p-3.5">
                        {vm.backupCount > 0 ? (
                          <span className="text-emerald-400 font-semibold">{vm.backupCount} bkp(s)</span>
                        ) : (
                          <span className="text-amber-400 font-bold">⚠️ Sem bkp</span>
                        )}
                      </td>

                      {/* Snapshots */}
                      <td className="p-3.5">
                        <button
                          onClick={() => onOpenSnapshotModal(vm)}
                          className="text-purple-400 hover:text-purple-300 font-medium cursor-pointer"
                        >
                          {vm.snapshotsCount} snap(s)
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onOpenBackupModal(vm)}
                            className="p-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition cursor-pointer"
                            title="Gerar Backup"
                          >
                            <Plus className="w-3.5 h-3.5 text-orange-400" />
                          </button>
                          <button
                            onClick={() => onSelectVMForTransfer(vm)}
                            className="px-2.5 py-1 rounded bg-orange-500 hover:bg-orange-600 text-white font-medium transition text-[11px] flex items-center gap-1 cursor-pointer"
                            title="Transferir para outro Proxmox"
                          >
                            <ArrowRightLeft className="w-3 h-3" />
                            <span>Transferir</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
