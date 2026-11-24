import {
  ProxmoxServer,
  VMResource,
  BackupItem,
  TransferJob,
  AutomationSchedule,
  StoragePool,
} from '../types/proxmox.js';

export async function fetchServers(): Promise<ProxmoxServer[]> {
  const res = await fetch('/api/servers');
  if (!res.ok) throw new Error('Falha ao carregar servidores Proxmox');
  return res.json();
}

export async function testServerConnection(server: Partial<ProxmoxServer>): Promise<{
  success: boolean;
  version?: string;
  release?: string;
  nodeCount?: number;
  message: string;
}> {
  const res = await fetch('/api/servers/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(server),
  });
  return res.json();
}

export async function saveServer(server: Partial<ProxmoxServer>): Promise<ProxmoxServer> {
  const res = await fetch('/api/servers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(server),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Falha ao salvar servidor');
  }
  return res.json();
}

export async function deleteServer(id: string): Promise<void> {
  const res = await fetch(`/api/servers/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Falha ao remover servidor');
}

export async function fetchVMs(serverId?: string, node?: string): Promise<VMResource[]> {
  const params = new URLSearchParams();
  if (serverId) params.append('serverId', serverId);
  if (node) params.append('node', node);
  const res = await fetch(`/api/vms?${params.toString()}`);
  if (!res.ok) throw new Error('Falha ao carregar VMs');
  return res.json();
}

export async function fetchStorages(serverId?: string): Promise<StoragePool[]> {
  const params = new URLSearchParams();
  if (serverId) params.append('serverId', serverId);
  const res = await fetch(`/api/storages?${params.toString()}`);
  if (!res.ok) throw new Error('Falha ao carregar pools de armazenamento');
  return res.json();
}

export async function fetchBackups(serverId?: string, vmid?: number): Promise<BackupItem[]> {
  const params = new URLSearchParams();
  if (serverId) params.append('serverId', serverId);
  if (vmid) params.append('vmid', String(vmid));
  const res = await fetch(`/api/backups?${params.toString()}`);
  if (!res.ok) throw new Error('Falha ao carregar backups');
  return res.json();
}

export async function fetchTransfers(): Promise<TransferJob[]> {
  const res = await fetch('/api/transfers');
  if (!res.ok) throw new Error('Falha ao carregar transferências');
  return res.json();
}

export async function fetchTransferById(id: string): Promise<TransferJob> {
  const res = await fetch(`/api/transfers/${id}`);
  if (!res.ok) throw new Error('Falha ao carregar dados da transferência');
  return res.json();
}

export async function startTransfer(payload: {
  sourceServerId: string;
  targetServerId: string;
  sourceNode?: string;
  targetNode?: string;
  vmid: number;
  vmName: string;
  vmType: 'qemu' | 'lxc';
  backupVolid: string;
  backupSizeBytes?: number;
  targetStorage: string;
  targetVmid?: number;
  bandwidthThrottleMBps?: number;
  autoRestore?: boolean;
  startAfterRestore?: boolean;
  verifyChecksum?: boolean;
}): Promise<TransferJob> {
  const res = await fetch('/api/transfers/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Falha ao iniciar transferência');
  }
  return res.json();
}

export async function cancelTransfer(id: string): Promise<TransferJob> {
  const res = await fetch(`/api/transfers/${id}/cancel`, { method: 'POST' });
  if (!res.ok) throw new Error('Falha ao cancelar transferência');
  return res.json();
}

export async function fetchAutomations(): Promise<AutomationSchedule[]> {
  const res = await fetch('/api/automations');
  if (!res.ok) throw new Error('Falha ao carregar automações');
  return res.json();
}

export async function saveAutomation(auto: Partial<AutomationSchedule>): Promise<AutomationSchedule> {
  const method = auto.id ? 'PUT' : 'POST';
  const url = auto.id ? `/api/automations/${auto.id}` : '/api/automations';
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(auto),
  });
  if (!res.ok) throw new Error('Falha ao salvar regra de automação');
  return res.json();
}

export async function deleteAutomation(id: string): Promise<void> {
  const res = await fetch(`/api/automations/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Falha ao remover automação');
}

export async function triggerAutomation(id: string): Promise<{ success: boolean; message: string; job: TransferJob }> {
  const res = await fetch(`/api/automations/${id}/trigger`, { method: 'POST' });
  if (!res.ok) throw new Error('Falha ao disparar automação');
  return res.json();
}

export async function createSnapshotNow(
  vmid: number,
  payload: { name: string; description: string; vmstate: boolean; serverId: string }
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`/api/vms/${vmid}/snapshot-now`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Falha ao criar snapshot');
  return res.json();
}

export async function createBackupNow(
  vmid: number,
  payload: { storage?: string; compression?: string; mode?: string; serverId: string }
): Promise<{ success: boolean; message: string; backup: BackupItem }> {
  const res = await fetch(`/api/vms/${vmid}/backup-now`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Falha ao gerar backup');
  return res.json();
}

export async function clearMockServers(): Promise<{ success: boolean; message: string; servers: ProxmoxServer[] }> {
  const res = await fetch('/api/servers/clear-mock', { method: 'POST' });
  if (!res.ok) throw new Error('Falha ao limpar dados de demonstração');
  return res.json();
}

