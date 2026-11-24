import React, { useState, useEffect, useCallback } from 'react';
import {
  HeaderNav,
} from './components/HeaderNav.js';
import {
  ClusterOverviewCards,
} from './components/ClusterOverviewCards.js';
import {
  VMExplorer,
} from './components/VMExplorer.js';
import {
  BackupTransferWizardModal,
} from './components/BackupTransferWizardModal.js';
import {
  LiveTransferMonitor,
} from './components/LiveTransferMonitor.js';
import {
  AutomationManager,
} from './components/AutomationManager.js';
import {
  SnapshotManagerModal,
} from './components/SnapshotManagerModal.js';
import {
  CreateBackupModal,
} from './components/CreateBackupModal.js';
import {
  ServerManagerModal,
} from './components/ServerManagerModal.js';
import {
  BackupExplorerView,
} from './components/BackupExplorerView.js';
import {
  ProxmoxServer,
  VMResource,
  StoragePool,
  BackupItem,
  TransferJob,
  AutomationSchedule,
} from './types/proxmox.js';
import {
  fetchServers,
  saveServer,
  deleteServer,
  fetchVMs,
  fetchStorages,
  fetchBackups,
  fetchTransfers,
  startTransfer,
  cancelTransfer,
  fetchAutomations,
  saveAutomation,
  deleteAutomation,
  triggerAutomation,
  createSnapshotNow,
  createBackupNow,
  clearMockServers,
} from './services/api.js';

export default function App() {
  const [activeTab, setActiveTab] = useState<'vms' | 'transfers' | 'automations' | 'backups' | 'servers'>('vms');
  const [selectedServerId, setSelectedServerId] = useState<string>('all');

  // Core Data
  const [servers, setServers] = useState<ProxmoxServer[]>([]);
  const [vms, setVMs] = useState<VMResource[]>([]);
  const [storages, setStorages] = useState<StoragePool[]>([]);
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [transfers, setTransfers] = useState<TransferJob[]>([]);
  const [automations, setAutomations] = useState<AutomationSchedule[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // Modals
  const [isTransferWizardOpen, setIsTransferWizardOpen] = useState(false);
  const [preSelectedVmForTransfer, setPreSelectedVmForTransfer] = useState<VMResource | null>(null);
  const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState(false);
  const [selectedVmForSnapshot, setSelectedVmForSnapshot] = useState<VMResource | null>(null);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [selectedVmForBackup, setSelectedVmForBackup] = useState<VMResource | null>(null);
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);

  // Initial Load
  const loadAllData = useCallback(async () => {
    try {
      const [srvList, vmList, stList, bkpList, trList, autoList] = await Promise.all([
        fetchServers(),
        fetchVMs(),
        fetchStorages(),
        fetchBackups(),
        fetchTransfers(),
        fetchAutomations(),
      ]);

      setServers(srvList);
      setVMs(vmList);
      setStorages(stList);
      setBackups(bkpList);
      setTransfers(trList);
      setAutomations(autoList);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Polling for active transfers & VM state
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const [trList, vmList] = await Promise.all([fetchTransfers(), fetchVMs()]);
        setTransfers(trList);
        setVMs(vmList);
      } catch (err) {
        // quiet poll fail
      }
    }, 1200);

    return () => clearInterval(interval);
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await loadAllData();
  };

  // Open Transfer Wizard for a VM
  const handleSelectVMForTransfer = (vm: VMResource) => {
    setPreSelectedVmForTransfer(vm);
    setIsTransferWizardOpen(true);
  };

  // Open Transfer Wizard from Backup item
  const handleSelectBackupForTransfer = (backup: BackupItem) => {
    const vm = vms.find((v) => v.vmid === backup.vmid && v.serverId === backup.serverId);
    setPreSelectedVmForTransfer(vm || null);
    setIsTransferWizardOpen(true);
  };

  // Open Snapshot Modal
  const handleOpenSnapshotModal = (vm: VMResource) => {
    setSelectedVmForSnapshot(vm);
    setIsSnapshotModalOpen(true);
  };

  // Open Backup Modal
  const handleOpenBackupModal = (vm: VMResource) => {
    setSelectedVmForBackup(vm);
    setIsBackupModalOpen(true);
  };

  // Handle Transfer Started
  const handleTransferStarted = (job: TransferJob) => {
    setTransfers((prev) => [job, ...prev]);
    setSelectedJobId(job.id);
    setActiveTab('transfers');
  };

  // Handle Snapshot Creation
  const handleCreateSnapshot = async (
    vmid: number,
    payload: { name: string; description: string; vmstate: boolean; serverId: string }
  ) => {
    await createSnapshotNow(vmid, payload);
    const updatedVMs = await fetchVMs();
    setVMs(updatedVMs);
    if (selectedVmForSnapshot) {
      const updated = updatedVMs.find((v) => v.vmid === vmid && v.serverId === payload.serverId);
      if (updated) setSelectedVmForSnapshot(updated);
    }
  };

  // Handle Backup Creation
  const handleCreateBackup = async (
    vmid: number,
    payload: { storage?: string; compression?: string; mode?: string; serverId: string }
  ) => {
    await createBackupNow(vmid, payload);
    const [updatedVMs, updatedBackups] = await Promise.all([fetchVMs(), fetchBackups()]);
    setVMs(updatedVMs);
    setBackups(updatedBackups);
  };

  // Handle Save / Delete Server
  const handleSaveServer = async (serverData: Partial<ProxmoxServer>) => {
    await saveServer(serverData);
    await loadAllData();
  };

  const handleDeleteServer = async (id: string) => {
    await deleteServer(id);
    await loadAllData();
  };

  const handleClearMockData = async () => {
    await clearMockServers();
    await loadAllData();
  };

  // Handle Automation Save / Delete / Trigger
  const handleSaveAutomation = async (autoData: Partial<AutomationSchedule>) => {
    await saveAutomation(autoData);
    const updatedAutos = await fetchAutomations();
    setAutomations(updatedAutos);
  };

  const handleDeleteAutomation = async (id: string) => {
    await deleteAutomation(id);
    const updatedAutos = await fetchAutomations();
    setAutomations(updatedAutos);
  };

  const handleTriggerAutomation = async (id: string) => {
    const res = await triggerAutomation(id);
    const [updatedAutos, updatedTransfers] = await Promise.all([fetchAutomations(), fetchTransfers()]);
    setAutomations(updatedAutos);
    setTransfers(updatedTransfers);
    if (res.job) {
      setSelectedJobId(res.job.id);
      setActiveTab('transfers');
    }
  };

  // Handle Cancel Transfer
  const handleCancelTransfer = async (id: string) => {
    await cancelTransfer(id);
    const updated = await fetchTransfers();
    setTransfers(updated);
  };

  const activeTransfersCount = transfers.filter(
    (j) => j.status === 'transferring' || j.status === 'connecting' || j.status === 'verifying' || j.status === 'restoring'
  ).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col selection:bg-orange-500 selection:text-white">
      {/* Top Header & Navigation */}
      <HeaderNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        servers={servers}
        selectedServerId={selectedServerId}
        setSelectedServerId={setSelectedServerId}
        activeTransfersCount={activeTransfersCount}
        onOpenTransferWizard={() => {
          setPreSelectedVmForTransfer(null);
          setIsTransferWizardOpen(true);
        }}
        onOpenServerModal={() => setIsServerModalOpen(true)}
        onRefreshData={handleManualRefresh}
        isRefreshing={isRefreshing}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Cluster High-Level Overview Metrics */}
        <ClusterOverviewCards
          vms={vms}
          storages={storages}
          servers={servers}
          selectedServerId={selectedServerId}
        />

        {/* Tab 1: VM & Container Inventory */}
        {activeTab === 'vms' && (
          <VMExplorer
            vms={vms}
            servers={servers}
            selectedServerId={selectedServerId}
            onSelectVMForTransfer={handleSelectVMForTransfer}
            onOpenSnapshotModal={handleOpenSnapshotModal}
            onOpenBackupModal={handleOpenBackupModal}
          />
        )}

        {/* Tab 2: Live Transfer Progress & Stream Logs */}
        {activeTab === 'transfers' && (
          <LiveTransferMonitor
            jobs={transfers}
            selectedJobId={selectedJobId}
            onSelectJob={(id) => setSelectedJobId(id)}
            onCancelJob={handleCancelTransfer}
            onOpenTransferWizard={() => {
              setPreSelectedVmForTransfer(null);
              setIsTransferWizardOpen(true);
            }}
          />
        )}

        {/* Tab 3: Automation & Scheduled Replication */}
        {activeTab === 'automations' && (
          <AutomationManager
            automations={automations}
            servers={servers}
            vms={vms}
            storages={storages}
            onSaveAutomation={handleSaveAutomation}
            onDeleteAutomation={handleDeleteAutomation}
            onTriggerAutomation={handleTriggerAutomation}
            onOpenTransferWizard={() => {
              setPreSelectedVmForTransfer(null);
              setIsTransferWizardOpen(true);
            }}
          />
        )}

        {/* Tab 4: Backup Repositories (Storages) */}
        {activeTab === 'backups' && (
          <BackupExplorerView
            backups={backups}
            storages={storages}
            servers={servers}
            vms={vms}
            selectedServerId={selectedServerId}
            onSelectBackupForTransfer={handleSelectBackupForTransfer}
            onOpenTransferWizard={() => {
              setPreSelectedVmForTransfer(null);
              setIsTransferWizardOpen(true);
            }}
          />
        )}

        {/* Tab 5 (Mobile): Server Manager */}
        {activeTab === 'servers' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-base font-bold text-white mb-3">Servidores Proxmox VE Conectados</h3>
            <button
              onClick={() => setIsServerModalOpen(true)}
              className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg text-xs"
            >
              Abrir Gerenciador de Servidores PVE
            </button>
          </div>
        )}
      </main>

      {/* MODALS */}
      {/* Transfer Wizard */}
      <BackupTransferWizardModal
        isOpen={isTransferWizardOpen}
        onClose={() => setIsTransferWizardOpen(false)}
        servers={servers}
        vms={vms}
        backups={backups}
        storages={storages}
        preSelectedVm={preSelectedVmForTransfer}
        onStartTransfer={startTransfer}
        onTransferStarted={handleTransferStarted}
      />

      {/* Snapshot Manager Modal */}
      <SnapshotManagerModal
        isOpen={isSnapshotModalOpen}
        onClose={() => setIsSnapshotModalOpen(false)}
        vm={selectedVmForSnapshot}
        onCreateSnapshot={handleCreateSnapshot}
        onSelectVMForTransfer={handleSelectVMForTransfer}
      />

      {/* Create On-Demand Backup Modal */}
      <CreateBackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        vm={selectedVmForBackup}
        storages={storages}
        onCreateBackup={handleCreateBackup}
        onSelectVMForTransfer={handleSelectVMForTransfer}
      />

      {/* Server Manager Modal */}
      <ServerManagerModal
        isOpen={isServerModalOpen}
        onClose={() => setIsServerModalOpen(false)}
        servers={servers}
        onSaveServer={handleSaveServer}
        onDeleteServer={handleDeleteServer}
        onClearMockData={handleClearMockData}
      />
    </div>
  );
}
