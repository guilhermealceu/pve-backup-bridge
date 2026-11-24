import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowRight,
  ArrowLeft,
  Server,
  HardDrive,
  ShieldCheck,
  Zap,
  CheckCircle2,
  AlertCircle,
  Play,
  Layers,
  Sliders,
  Terminal,
  Activity,
} from 'lucide-react';
import {
  ProxmoxServer,
  VMResource,
  BackupItem,
  StoragePool,
  TransferJob,
} from '../types/proxmox.js';
import { formatBytes } from '../lib/formatters.js';

interface BackupTransferWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  servers: ProxmoxServer[];
  vms: VMResource[];
  backups: BackupItem[];
  storages: StoragePool[];
  preSelectedVm?: VMResource | null;
  onStartTransfer: (payload: any) => Promise<TransferJob>;
  onTransferStarted: (job: TransferJob) => void;
}

export const BackupTransferWizardModal: React.FC<BackupTransferWizardModalProps> = ({
  isOpen,
  onClose,
  servers,
  vms,
  backups,
  storages,
  preSelectedVm,
  onStartTransfer,
  onTransferStarted,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State
  const [sourceServerId, setSourceServerId] = useState<string>('');
  const [selectedVmId, setSelectedVmId] = useState<number>(0);
  const [selectedBackupVolid, setSelectedBackupVolid] = useState<string>('');
  const [useFreshBackup, setUseFreshBackup] = useState<boolean>(false);

  const [targetServerId, setTargetServerId] = useState<string>('');
  const [targetNode, setTargetNode] = useState<string>('');
  const [targetStorage, setTargetStorage] = useState<string>('');
  const [targetVmid, setTargetVmid] = useState<number>(100);

  const [bandwidthThrottle, setBandwidthThrottle] = useState<number>(0); // 0 = unlimited
  const [autoRestore, setAutoRestore] = useState<boolean>(true);
  const [startAfterRestore, setStartAfterRestore] = useState<boolean>(false);
  const [verifyChecksum, setVerifyChecksum] = useState<boolean>(true);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize values when opened
  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setStep(1);

      const defaultSourceId = preSelectedVm?.serverId || servers[0]?.id || '';
      setSourceServerId(defaultSourceId);

      const vm = preSelectedVm || vms.find((v) => v.serverId === defaultSourceId) || vms[0];
      if (vm) {
        setSelectedVmId(vm.vmid);
        setTargetVmid(vm.vmid);

        // Find existing backup for this VM
        const vmBackups = backups.filter((b) => b.vmid === vm.vmid && b.serverId === vm.serverId);
        if (vmBackups.length > 0) {
          setSelectedBackupVolid(vmBackups[0].volid);
          setUseFreshBackup(false);
        } else {
          setSelectedBackupVolid(`nfs-backups:backup/vzdump-${vm.type}-${vm.vmid}-live.vma.zst`);
          setUseFreshBackup(true);
        }
      }

      // Default target server: Pick a different server if available
      const otherServer = servers.find((s) => s.id !== defaultSourceId) || servers[0];
      if (otherServer) {
        setTargetServerId(otherServer.id);
        const targetServerStorages = storages.filter((st) => st.serverId === otherServer.id);
        if (targetServerStorages.length > 0) {
          setTargetStorage(targetServerStorages[0].storage);
          setTargetNode(targetServerStorages[0].node || 'pve-node-01');
        }
      }
    }
  }, [isOpen, preSelectedVm, servers, vms, backups, storages]);

  // When source server changes
  const handleSourceServerChange = (newServerId: string) => {
    setSourceServerId(newServerId);
    const availableVms = vms.filter((v) => v.serverId === newServerId);
    if (availableVms.length > 0) {
      setSelectedVmId(availableVms[0].vmid);
      setTargetVmid(availableVms[0].vmid);
    }
  };

  // When target server changes
  const handleTargetServerChange = (newServerId: string) => {
    setTargetServerId(newServerId);
    const targetServerStorages = storages.filter((st) => st.serverId === newServerId);
    if (targetServerStorages.length > 0) {
      setTargetStorage(targetServerStorages[0].storage);
      setTargetNode(targetServerStorages[0].node || 'node-01');
    }
  };

  const selectedVM = vms.find((v) => v.vmid === selectedVmId && v.serverId === sourceServerId);
  const sourceServer = servers.find((s) => s.id === sourceServerId);
  const targetServer = servers.find((s) => s.id === targetServerId);
  const vmBackupsList = backups.filter((b) => b.vmid === selectedVmId && b.serverId === sourceServerId);
  const targetAvailableStorages = storages.filter((st) => st.serverId === targetServerId);

  const selectedBackupObj = vmBackupsList.find((b) => b.volid === selectedBackupVolid);
  const backupSize = selectedBackupObj
    ? selectedBackupObj.sizeBytes
    : selectedVM
    ? Math.floor(selectedVM.diskUsedBytes * 0.45)
    : 10 * 1024 * 1024 * 1024;

  const handleStart = async () => {
    if (!sourceServerId || !targetServerId || !selectedVmId) {
      setErrorMsg('Selecione os servidores e a VM de origem.');
      return;
    }
    if (sourceServerId === targetServerId && selectedVmId === targetVmid) {
      setErrorMsg('Ao transferir dentro do mesmo servidor, escolha um novo VMID de destino diferente para evitar sobreposição.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const job = await onStartTransfer({
        sourceServerId,
        targetServerId,
        sourceNode: selectedVM?.node || 'pve-node-01',
        targetNode: targetNode || 'dr-node-01',
        vmid: selectedVmId,
        vmName: selectedVM?.name || `VM-${selectedVmId}`,
        vmType: selectedVM?.type || 'qemu',
        backupVolid: selectedBackupVolid || `local:backup/vzdump-qemu-${selectedVmId}.vma.zst`,
        backupSizeBytes: backupSize,
        targetStorage: targetStorage || 'backup-dr-nfs',
        targetVmid: targetVmid,
        bandwidthThrottleMBps: bandwidthThrottle,
        autoRestore,
        startAfterRestore,
        verifyChecksum,
      });

      onTransferStarted(job);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao iniciar transferência de backup');
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Assistente de Transferência & Migração Proxmox
              </h3>
              <p className="text-xs text-slate-400">
                Sincronize backups e replique VMs entre diferentes nós e clusters PVE
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

        {/* Steps Progress Indicator */}
        <div className="bg-slate-950/60 border-b border-slate-800 px-6 py-3 flex items-center justify-between text-xs">
          {[
            { num: 1, title: '1. Origem & Backup' },
            { num: 2, title: '2. Proxmox Destino' },
            { num: 3, title: '3. Parâmetros' },
            { num: 4, title: '4. Confirmação' },
          ].map((s) => (
            <div
              key={s.num}
              onClick={() => s.num < step && setStep(s.num as any)}
              className={`flex items-center gap-2 cursor-pointer transition ${
                step === s.num
                  ? 'text-orange-400 font-bold'
                  : step > s.num
                  ? 'text-emerald-400 font-medium'
                  : 'text-slate-500'
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === s.num
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                    : step > s.num
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {step > s.num ? '✓' : s.num}
              </span>
              <span className="hidden sm:inline">{s.title}</span>
            </div>
          ))}
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 text-slate-200">
          {errorMsg && (
            <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: SOURCE SELECTION */}
          {step === 1 && (
            <div className="space-y-4 animate-fadeIn">
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-2">
                1. Selecione o Proxmox de Origem e a Instância
              </h4>

              {/* Source Server */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Cluster Proxmox de Origem:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {servers.map((srv) => (
                    <div
                      key={srv.id}
                      onClick={() => handleSourceServerChange(srv.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition flex items-center gap-3 ${
                        sourceServerId === srv.id
                          ? 'border-orange-500 bg-orange-500/10 text-white'
                          : 'border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <Server className="w-5 h-5 text-orange-400 shrink-0" />
                      <div className="truncate">
                        <p className="text-xs font-bold truncate">{srv.name}</p>
                        <p className="text-[11px] text-slate-400 font-mono">
                          {srv.host}:{srv.port} ({srv.version})
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Select VM */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Selecione a VM ou Container LXC:
                </label>
                <div className="max-h-48 overflow-y-auto space-y-2 border border-slate-700/80 rounded-xl p-2 bg-slate-950/40">
                  {vms
                    .filter((v) => v.serverId === sourceServerId)
                    .map((vm) => (
                      <div
                        key={`${vm.serverId}-${vm.vmid}`}
                        onClick={() => {
                          setSelectedVmId(vm.vmid);
                          setTargetVmid(vm.vmid);
                          const bList = backups.filter((b) => b.vmid === vm.vmid && b.serverId === vm.serverId);
                          if (bList.length > 0) {
                            setSelectedBackupVolid(bList[0].volid);
                            setUseFreshBackup(false);
                          } else {
                            setUseFreshBackup(true);
                          }
                        }}
                        className={`p-2.5 rounded-lg border cursor-pointer transition flex items-center justify-between ${
                          selectedVmId === vm.vmid
                            ? 'border-orange-500 bg-orange-500/10 text-white'
                            : 'border-slate-800 bg-slate-800/40 hover:bg-slate-800/80 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-orange-400 px-1.5 py-0.5 bg-slate-900 rounded border border-slate-700">
                            {vm.vmid}
                          </span>
                          <div>
                            <p className="text-xs font-bold text-white">{vm.name}</p>
                            <p className="text-[11px] text-slate-400 font-mono">
                              IP: {vm.ipAddresses[0] || 'Sem IP'} | RAM: {formatBytes(vm.memUsedBytes, 0)} | Nó:{' '}
                              {vm.node}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                              vm.backupCount > 0
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-amber-500/20 text-amber-400'
                            }`}
                          >
                            {vm.backupCount > 0 ? `${vm.backupCount} backups` : 'Sem backup'}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Select Backup Archive */}
              {selectedVM && (
                <div className="bg-slate-800/70 border border-slate-700 rounded-xl p-3.5 space-y-2">
                  <label className="block text-xs font-semibold text-slate-300">
                    Arquivo de Backup vzdump a ser transferido:
                  </label>

                  {vmBackupsList.length > 0 && (
                    <div className="space-y-1.5">
                      {vmBackupsList.map((bkp) => (
                        <label
                          key={`${bkp.serverId}-${bkp.storage}-${bkp.volid}`}
                          className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer text-xs ${
                            selectedBackupVolid === bkp.volid && !useFreshBackup
                              ? 'border-orange-500 bg-orange-500/10 text-white'
                              : 'border-slate-700 bg-slate-900/60 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <input
                              type="radio"
                              name="backupChoice"
                              checked={selectedBackupVolid === bkp.volid && !useFreshBackup}
                              onChange={() => {
                                setSelectedBackupVolid(bkp.volid);
                                setUseFreshBackup(false);
                              }}
                              className="text-orange-500 bg-slate-900 focus:ring-orange-500"
                            />
                            <div className="truncate">
                              <span className="font-mono text-xs font-semibold">{bkp.volid.split('/')[1] || bkp.volid}</span>
                              <p className="text-[10px] text-slate-400">
                                Storage: {bkp.storage} | Criado em: {bkp.dateFormatted}
                              </p>
                            </div>
                          </div>
                          <span className="font-bold text-orange-300 font-mono text-xs shrink-0">
                            {formatBytes(bkp.sizeBytes)}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* Fresh backup option */}
                  <label
                    className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer text-xs ${
                      useFreshBackup
                        ? 'border-orange-500 bg-orange-500/10 text-white'
                        : 'border-slate-700 bg-slate-900/60 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="backupChoice"
                        checked={useFreshBackup}
                        onChange={() => setUseFreshBackup(true)}
                        className="text-orange-500 bg-slate-900 focus:ring-orange-500"
                      />
                      <div>
                        <span className="font-bold text-orange-400">Gerar Novo Backup vzdump Agora & Transferir</span>
                        <p className="text-[10px] text-slate-400">
                          Dispara `vzdump` em modo snapshot com compressão ZSTD antes do stream
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] text-emerald-400 font-medium">Ao vivo ⚡</span>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: TARGET PROXMOX SELECTION */}
          {step === 2 && (
            <div className="space-y-4 animate-fadeIn">
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-2">
                2. Selecione o Proxmox de Destino e Storage
              </h4>

              {/* Target Server */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Cluster Proxmox de Destino:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {servers.map((srv) => (
                    <div
                      key={srv.id}
                      onClick={() => handleTargetServerChange(srv.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition flex items-center gap-3 ${
                        targetServerId === srv.id
                          ? 'border-orange-500 bg-orange-500/10 text-white'
                          : 'border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <Server className="w-5 h-5 text-orange-400 shrink-0" />
                      <div className="truncate">
                        <p className="text-xs font-bold truncate">{srv.name}</p>
                        <p className="text-[11px] text-slate-400 font-mono">
                          {srv.host}:{srv.port} ({srv.version})
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Target Storage Pool */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Pool de Armazenamento de Destino (Storage Pool):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {targetAvailableStorages.map((st) => (
                    <div
                      key={st.id}
                      onClick={() => {
                        setTargetStorage(st.storage);
                        setTargetNode(st.node);
                      }}
                      className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                        targetStorage === st.storage
                          ? 'border-orange-500 bg-orange-500/10 text-white'
                          : 'border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <HardDrive className="w-4 h-4 text-cyan-400 shrink-0" />
                        <div className="truncate">
                          <p className="text-xs font-bold">{st.storage}</p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            Tipo: {st.type} | Nó: {st.node}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-mono font-bold text-slate-200">{formatBytes(st.availBytes, 1)}</p>
                        <p className="text-[10px] text-slate-400">livres</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Target VMID Assignment */}
              <div className="bg-slate-800/70 border border-slate-700 rounded-xl p-4">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Atribuir VMID de Destino:
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={targetVmid}
                    onChange={(e) => setTargetVmid(Number(e.target.value))}
                    className="w-32 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-orange-500"
                  />
                  <p className="text-xs text-slate-400">
                    Você pode manter o ID original ({selectedVmId}) ou escolher um novo ID livre no destino.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: MIGRATION & RESTORE OPTIONS */}
          {step === 3 && (
            <div className="space-y-4 animate-fadeIn">
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-2">
                3. Opções Avançadas de Transferência & Restauração
              </h4>

              <div className="space-y-3">
                {/* Auto Restore Toggle */}
                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-700 bg-slate-800/70 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoRestore}
                    onChange={(e) => setAutoRestore(e.target.checked)}
                    className="mt-0.5 rounded border-slate-700 text-orange-500 focus:ring-orange-500 bg-slate-900 h-4 w-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-white">
                      Restauração Automática (Auto-Restore QEMU/LXC)
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Executa `qmrestore` ou `pct restore` no Proxmox destino assim que o arquivo vzdump for transferido.
                    </p>
                  </div>
                </label>

                {/* Start After Restore */}
                {autoRestore && (
                  <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-700 bg-slate-800/70 cursor-pointer ml-4">
                    <input
                      type="checkbox"
                      checked={startAfterRestore}
                      onChange={(e) => setStartAfterRestore(e.target.checked)}
                      className="mt-0.5 rounded border-slate-700 text-orange-500 focus:ring-orange-500 bg-slate-900 h-4 w-4"
                    />
                    <div>
                      <span className="text-xs font-bold text-white">
                        Ligar VM / Container Automaticamente após Restaurar
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Inicia o guest (`qm start` ou `pct start`) imediatamente após a restauração com sucesso.
                      </p>
                    </div>
                  </label>
                )}

                {/* Checksum SHA256 Verification */}
                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-700 bg-slate-800/70 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={verifyChecksum}
                    onChange={(e) => setVerifyChecksum(e.target.checked)}
                    className="mt-0.5 rounded border-slate-700 text-orange-500 focus:ring-orange-500 bg-slate-900 h-4 w-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-white">
                      Validação de Integridade Criptográfica (SHA-256)
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Calcula e compara o hash do arquivo vzdump para garantir integridade total sem corrupção de blocos.
                    </p>
                  </div>
                </label>

                {/* Bandwidth Limiter */}
                <div className="p-3.5 rounded-xl border border-slate-700 bg-slate-800/70">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-white">Limite de Largura de Banda (Throttle):</span>
                    <span className="text-xs font-mono font-bold text-orange-400">
                      {bandwidthThrottle === 0 ? 'Sem limite (Máximo link)' : `${bandwidthThrottle} MB/s`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="500"
                    step="10"
                    value={bandwidthThrottle}
                    onChange={(e) => setBandwidthThrottle(Number(e.target.value))}
                    className="w-full accent-orange-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                    <span>0 MB/s (Ilimitado)</span>
                    <span>100 MB/s</span>
                    <span>250 MB/s</span>
                    <span>500 MB/s</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: REVIEW & CONFIRM */}
          {step === 4 && (
            <div className="space-y-4 animate-fadeIn">
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-2">
                4. Confirmação do Pipeline de Transferência
              </h4>

              <div className="bg-slate-950/70 border border-slate-700/80 rounded-xl p-4 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Origem:</span>
                  <span className="text-orange-400 font-bold">
                    {sourceServer?.name} ({sourceServer?.host})
                  </span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Instância & VMID:</span>
                  <span className="text-white font-bold">
                    {selectedVM?.name} (VMID {selectedVmId} - {selectedVM?.type?.toUpperCase()})
                  </span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Tamanho Estimado:</span>
                  <span className="text-cyan-300 font-bold">{formatBytes(backupSize)}</span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Destino:</span>
                  <span className="text-emerald-400 font-bold">
                    {targetServer?.name} ({targetServer?.host})
                  </span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Storage Destino:</span>
                  <span className="text-slate-200">
                    {targetStorage} (Nó: {targetNode})
                  </span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Novo VMID no Destino:</span>
                  <span className="text-orange-400 font-bold">{targetVmid}</span>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1">
                  <span className="text-slate-400">Ações Pós-Stream:</span>
                  <span className="text-slate-300">
                    {autoRestore ? 'Auto-Restore [SIM]' : 'Armazenar Backup apenas'} |{' '}
                    {startAfterRestore ? 'Auto-Start [SIM]' : 'Manter Desligado'} |{' '}
                    {verifyChecksum ? 'SHA-256 [SIM]' : 'Sem verificação'}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>
                  Pronto para iniciar. O stream em tempo real com logs e medidor de velocidade será aberto em seguida.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <button
            onClick={() => (step > 1 ? setStep((step - 1) as any) : onClose())}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition cursor-pointer"
          >
            {step === 1 ? 'Cancelar' : 'Voltar'}
          </button>

          <div className="flex items-center gap-2">
            {step < 4 ? (
              <button
                onClick={() => setStep((step + 1) as any)}
                className="px-5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-lg shadow-orange-500/20 transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>Avançar</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleStart}
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white text-xs font-bold shadow-xl shadow-orange-500/30 transition flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{isSubmitting ? 'Iniciando Pipeline...' : 'Iniciar Transferência Agora'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
