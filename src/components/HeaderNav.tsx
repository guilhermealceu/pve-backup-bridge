import React from 'react';
import {
  Server,
  ArrowLeftRight,
  Clock,
  HardDrive,
  Activity,
  Plus,
  RefreshCw,
  Sliders,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { ProxmoxServer, TransferJob } from '../types/proxmox.js';

interface HeaderNavProps {
  activeTab: 'vms' | 'transfers' | 'automations' | 'backups' | 'servers';
  setActiveTab: (tab: 'vms' | 'transfers' | 'automations' | 'backups' | 'servers') => void;
  servers: ProxmoxServer[];
  selectedServerId: string;
  setSelectedServerId: (id: string) => void;
  activeTransfersCount: number;
  onOpenTransferWizard: () => void;
  onOpenServerModal: () => void;
  onRefreshData: () => void;
  isRefreshing: boolean;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  activeTab,
  setActiveTab,
  servers,
  selectedServerId,
  setSelectedServerId,
  activeTransfersCount,
  onOpenTransferWizard,
  onOpenServerModal,
  onRefreshData,
  isRefreshing,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 shadow-md text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo and Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-amber-600 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20 text-white font-black text-xl tracking-wider">
              <span className="font-mono text-sm">PVE</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-white tracking-tight">Proxmox Backup & Sync</span>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Multi-Cluster API
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Migração, Monitoramento e Automação de Backups & Snapshots
              </p>
            </div>
          </div>

          {/* Quick Server Switcher & Actions */}
          <div className="flex items-center gap-3">
            {/* Cluster Selector Dropdown */}
            <div className="flex items-center bg-slate-800/90 border border-slate-700/80 rounded-lg p-1 text-xs">
              <Server className="w-3.5 h-3.5 text-orange-400 ml-2 mr-1" />
              <select
                value={selectedServerId}
                onChange={(e) => setSelectedServerId(e.target.value)}
                className="bg-transparent text-slate-200 font-medium py-1 px-2 focus:outline-none cursor-pointer text-xs"
                title="Filtrar por Servidor Proxmox"
              >
                <option value="all" className="bg-slate-900 text-slate-200">
                  🌐 Todos os Clusters ({servers.length})
                </option>
                {servers.map((srv) => (
                  <option key={srv.id} value={srv.id} className="bg-slate-900 text-slate-200">
                    {srv.name} ({srv.host})
                  </option>
                ))}
              </select>
            </div>

            {/* Refresh Button */}
            <button
              onClick={onRefreshData}
              disabled={isRefreshing}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition flex items-center justify-center text-xs"
              title="Recarregar dados do cluster"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-orange-400' : ''}`} />
            </button>

            {/* Manage Proxmox Servers Button */}
            <button
              onClick={onOpenServerModal}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition text-xs font-medium"
            >
              <Sliders className="w-3.5 h-3.5 text-slate-400" />
              <span>Servidores PVE</span>
              <span className="ml-1 px-1.5 py-0.2 bg-slate-900 text-slate-400 rounded text-[10px] border border-slate-700">
                {servers.length}
              </span>
            </button>

            {/* Main Action: New Transfer Wizard */}
            <button
              onClick={onOpenTransferWizard}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-semibold text-xs shadow-lg shadow-orange-500/25 transition active:scale-95 cursor-pointer"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Transferir Backup</span>
              <span className="xs:hidden">Transferir</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center space-x-1 border-t border-slate-800/80 pt-1 pb-1 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('vms')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap ${
              activeTab === 'vms'
                ? 'bg-orange-500/10 text-orange-400 border border-orange-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Inventário de VMs & LXCs</span>
          </button>

          <button
            onClick={() => setActiveTab('transfers')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap relative ${
              activeTab === 'transfers'
                ? 'bg-orange-500/10 text-orange-400 border border-orange-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span>Transferências & Logs</span>
            {activeTransfersCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-orange-500 text-white font-bold text-[10px] animate-pulse">
                {activeTransfersCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('automations')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap ${
              activeTab === 'automations'
                ? 'bg-orange-500/10 text-orange-400 border border-orange-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Automações & Agendamentos</span>
          </button>

          <button
            onClick={() => setActiveTab('backups')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap ${
              activeTab === 'backups'
                ? 'bg-orange-500/10 text-orange-400 border border-orange-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Repositório de Backups (Storages)</span>
          </button>

          <button
            onClick={() => setActiveTab('servers')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap sm:hidden ${
              activeTab === 'servers'
                ? 'bg-orange-500/10 text-orange-400 border border-orange-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>Servidores</span>
          </button>
        </div>
      </div>
    </header>
  );
};
