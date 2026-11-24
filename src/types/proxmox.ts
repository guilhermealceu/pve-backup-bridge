export type AuthType = 'token' | 'ticket';

export interface ProxmoxServer {
  id: string;
  name: string;
  host: string;
  port: number;
  authType: AuthType;
  // Token auth (recommended)
  tokenUser?: string; // e.g. root@pam or backup-sync@pve
  tokenId?: string;   // e.g. synctoken
  tokenSecret?: string;
  // Ticket auth (user/pass)
  username?: string;
  password?: string;
  realm?: string; // pam, pve, etc.
  sslStrict: boolean;
  status: 'connected' | 'error' | 'untested' | 'connecting';
  version?: string; // e.g. "Proxmox VE 8.2-4"
  release?: string;
  nodeCount: number;
  uptimeSec?: number;
  lastTestedAt?: string;
  errorMessage?: string;
  isDemo?: boolean;
}

export interface NodeMetrics {
  id: string;
  name: string;
  serverId: string;
  status: 'online' | 'offline';
  cpuUsage: number; // 0 to 100
  cpuCores: number;
  memUsedBytes: number;
  memTotalBytes: number;
  diskUsedBytes: number;
  diskTotalBytes: number;
  uptimeSec: number;
  pveVersion: string;
  kernelVersion: string;
}

export interface StoragePool {
  id: string;
  serverId: string;
  node: string;
  storage: string;
  type: 'dir' | 'lvm' | 'lvmthin' | 'zfspool' | 'nfs' | 'pbs' | 'cifs';
  content: string[]; // ['backup', 'images', 'rootdir', 'iso', 'vztmpl']
  usedBytes: number;
  totalBytes: number;
  availBytes: number;
  active: boolean;
  shared: boolean;
}

export interface SnapshotItem {
  name: string;
  snaptime: number; // timestamp in seconds
  description: string;
  vmstate: boolean; // has RAM snapshot
  isCurrent?: boolean;
  parent?: string;
}

export interface VMResource {
  vmid: number;
  name: string;
  serverId: string;
  serverName: string;
  node: string;
  type: 'qemu' | 'lxc';
  status: 'running' | 'stopped' | 'paused';
  cpuUsagePercent: number;
  cpus: number;
  memUsedBytes: number;
  memMaxBytes: number;
  diskUsedBytes: number;
  diskMaxBytes: number;
  uptimeSec: number;
  ipAddresses: string[];
  macAddresses: string[];
  qemuAgentRunning: boolean;
  backupCount: number;
  lastBackupDate?: string;
  lastBackupStorage?: string;
  snapshotsCount: number;
  snapshots: SnapshotItem[];
  tags: string[];
  osType?: string;
  lock?: string;
}

export interface BackupItem {
  volid: string; // e.g. local:backup/vzdump-qemu-100-2026_08_25-03_00_00.vma.zst
  vmid: number;
  vmName: string;
  format: 'vma.zst' | 'tar.zst' | 'vma.gz' | 'vma' | 'tar.gz' | 'raw';
  sizeBytes: number;
  ctime: number; // creation timestamp
  dateFormatted: string;
  storage: string;
  node: string;
  serverId: string;
  serverName: string;
  type: 'qemu' | 'lxc';
  protected: boolean;
  notes?: string;
  checksum?: string;
}

export type TransferStatus =
  | 'pending'
  | 'connecting'
  | 'verifying'
  | 'transferring'
  | 'restoring'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface TransferLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

export interface TransferJob {
  id: string;
  title: string;
  sourceServerId: string;
  sourceServerName: string;
  sourceNode: string;
  targetServerId: string;
  targetServerName: string;
  targetNode: string;
  vmid: number;
  vmName: string;
  vmType: 'qemu' | 'lxc';
  backupVolid: string;
  backupSizeBytes: number;
  targetStorage: string;
  targetVmid: number;
  bandwidthThrottleMBps: number; // 0 = unlimited
  autoRestore: boolean;
  startAfterRestore: boolean;
  verifyChecksum: boolean;
  status: TransferStatus;
  progressPercent: number;
  bytesTransferred: number;
  totalBytes: number;
  currentSpeedMBps: number;
  etaSeconds: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
  logs: TransferLog[];
  automationId?: string;
}

export interface AutomationSchedule {
  id: string;
  name: string;
  enabled: boolean;
  sourceServerId: string;
  targetServerId: string;
  targetNode: string;
  targetStorage: string;
  selectionMode: 'all' | 'specific' | 'tag';
  selectedVmids: number[];
  selectedTag?: string;
  frequency: 'hourly' | 'daily' | 'weekly' | 'custom';
  scheduleTime: string; // e.g. "03:00"
  cronExpression: string; // e.g. "0 3 * * *"
  keepLastNBackups: number;
  autoRestore: boolean;
  startAfterRestore: boolean;
  takeSnapshotFirst: boolean;
  notifyWebhook?: string;
  lastRunAt?: string;
  lastRunStatus?: 'success' | 'failed' | 'running';
  nextRunAt?: string;
  totalRuns: number;
}
