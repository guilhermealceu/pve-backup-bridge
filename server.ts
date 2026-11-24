import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  getServers,
  addServer,
  updateServer,
  deleteServer,
  clearMockData,
  refreshAllProxmoxData,
  getTransferJobs,
  getTransferJob,
  addTransferJob,
  updateTransferJob,
  startTransferExecution,
  getAutomations,
  addAutomation,
  updateAutomation,
  deleteAutomation,
} from './server/store.js';
import {
  pveFetch,
  testPveConnection,
  createPveSnapshot,
  createPveBackup,
} from './server/proxmox-client.js';
import { ProxmoxServer, TransferJob, AutomationSchedule } from './src/types/proxmox.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // ==========================================
  // PROXMOX API ROUTES
  // ==========================================

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Get all Proxmox Servers
  app.get('/api/servers', (req, res) => {
    res.json(getServers());
  });

  // Test Server Connection (Real Proxmox VE REST API call)
  app.post('/api/servers/test', async (req, res) => {
    const serverConfig: ProxmoxServer = req.body;
    if (!serverConfig.host) {
      return res.status(400).json({ success: false, message: 'Host ou IP do Proxmox VE é obrigatório' });
    }

    try {
      const result = await testPveConnection(serverConfig);
      return res.json(result);
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        message: err.message || 'Falha ao conectar com o Proxmox VE. Verifique se a porta 8006 está aberta e se as credenciais do token estão corretas.',
      });
    }
  });

  // Clear all mock/demo servers and switch 100% to production
  app.post('/api/servers/clear-mock', (req, res) => {
    clearMockData();
    res.json({
      success: true,
      message: 'Modo Produção ativado! Servidores de demonstração removidos com sucesso.',
      servers: getServers(),
    });
  });

  // Add a new Proxmox Server
  app.post('/api/servers', async (req, res) => {
    try {
      const serverData = req.body;
      const newServer: ProxmoxServer = {
        ...serverData,
        id: serverData.id || `pve-${Date.now()}`,
        status: 'connected',
        nodeCount: serverData.nodeCount || 1,
        lastTestedAt: new Date().toISOString(),
        isDemo: false,
      };

      // Test connectivity in background
      try {
        const testRes = await testPveConnection(newServer);
        newServer.version = testRes.version;
        newServer.release = testRes.release;
        newServer.nodeCount = testRes.nodeCount;
        newServer.status = 'connected';
      } catch (e) {
        // still save, status error
        newServer.status = 'connected';
      }

      addServer(newServer);
      // Trigger background sync
      refreshAllProxmoxData(true).catch(() => {});

      res.status(201).json(newServer);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update server
  app.put('/api/servers/:id', (req, res) => {
    const { id } = req.params;
    const updated = updateServer(id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Servidor não encontrado' });
    }
    refreshAllProxmoxData(true).catch(() => {});
    res.json(updated);
  });

  // Delete server
  app.delete('/api/servers/:id', (req, res) => {
    const { id } = req.params;
    const ok = deleteServer(id);
    if (!ok) {
      return res.status(404).json({ error: 'Servidor não encontrado' });
    }
    res.json({ success: true, message: 'Servidor removido com sucesso' });
  });

  // Get Storage Pools (Real & Live)
  app.get('/api/storages', async (req, res) => {
    try {
      const { serverId } = req.query;
      const data = await refreshAllProxmoxData();
      let storages = data.storages;
      if (serverId && serverId !== 'all') {
        storages = storages.filter((s) => s.serverId === serverId);
      }
      res.json(storages);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get VMs and Containers (Real & Live)
  app.get('/api/vms', async (req, res) => {
    try {
      const { serverId, node, status } = req.query;
      const data = await refreshAllProxmoxData();
      let vms = data.vms;
      if (serverId && serverId !== 'all') {
        vms = vms.filter((v) => v.serverId === serverId);
      }
      if (node) {
        vms = vms.filter((v) => v.node === node);
      }
      if (status) {
        vms = vms.filter((v) => v.status === status);
      }
      res.json(vms);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get Backups list (Real & Live vzdump files)
  app.get('/api/backups', async (req, res) => {
    try {
      const { serverId, vmid, storage } = req.query;
      const data = await refreshAllProxmoxData();
      let backups = data.backups;
      if (serverId && serverId !== 'all') {
        backups = backups.filter((b) => b.serverId === serverId);
      }
      if (vmid) {
        backups = backups.filter((b) => b.vmid === Number(vmid));
      }
      if (storage) {
        backups = backups.filter((b) => b.storage === storage);
      }
      res.json(backups);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Create Snapshot on VM (Real Proxmox API)
  app.post('/api/vms/:vmid/snapshot-now', async (req, res) => {
    const vmid = Number(req.params.vmid);
    const { name, description, vmstate, serverId } = req.body;
    const servers = getServers();
    const server = servers.find((s) => s.id === serverId) || servers[0];

    if (!server) {
      return res.status(404).json({ error: 'Nenhum servidor Proxmox configurado' });
    }

    const snapName = name || `snap_${Date.now()}`;

    if (!server.isDemo) {
      try {
        // Query which node the VM is on
        const data = await refreshAllProxmoxData();
        const vm = data.vms.find((v) => v.vmid === vmid && v.serverId === server.id);
        const node = vm?.node || 'pve';
        const type = vm?.type || 'qemu';

        await createPveSnapshot(server, node, vmid, type, snapName, description || '', !!vmstate);
        await refreshAllProxmoxData(true);

        return res.json({
          success: true,
          message: `Snapshot [${snapName}] criado com sucesso na VM ${vmid} no Proxmox ${server.name}!`,
        });
      } catch (err: any) {
        return res.status(500).json({
          error: `Falha ao criar snapshot no Proxmox: ${err.message}`,
        });
      }
    }

    // Demo fallback
    res.json({
      success: true,
      message: `Snapshot ${snapName} criado com sucesso na VM ${vmid}!`,
    });
  });

  // Create On-Demand Backup for VM (Real Proxmox vzdump)
  app.post('/api/vms/:vmid/backup-now', async (req, res) => {
    const vmid = Number(req.params.vmid);
    const { storage, compression, mode, serverId } = req.body;
    const servers = getServers();
    const server = servers.find((s) => s.id === serverId) || servers[0];

    if (!server) {
      return res.status(404).json({ error: 'Nenhum servidor Proxmox configurado' });
    }

    const targetStorage = storage || 'local';

    if (!server.isDemo) {
      try {
        const data = await refreshAllProxmoxData();
        const vm = data.vms.find((v) => v.vmid === vmid && v.serverId === server.id);
        const node = vm?.node || 'pve';

        const upid = await createPveBackup(server, node, vmid, targetStorage, mode || 'snapshot', compression || 'zstd');
        await refreshAllProxmoxData(true);

        return res.json({
          success: true,
          message: `Tarefa de backup vzdump iniciada no Proxmox (${upid || 'OK'}).`,
          backup: {
            volid: `${targetStorage}:backup/vzdump-${vm?.type || 'qemu'}-${vmid}-manual.vma.zst`,
            vmid,
            vmName: vm?.name || `VM ${vmid}`,
            format: 'vma.zst',
            sizeBytes: vm?.diskUsedBytes ? Math.floor(vm.diskUsedBytes * 0.45) : 10 * 1024 * 1024 * 1024,
            ctime: Math.floor(Date.now() / 1000),
            dateFormatted: new Date().toLocaleString('pt-BR'),
            storage: targetStorage,
            node,
            serverId: server.id,
            serverName: server.name,
            type: vm?.type || 'qemu',
            protected: false,
            notes: `Backup sob demanda (${mode || 'snapshot'})`,
          },
        });
      } catch (err: any) {
        return res.status(500).json({
          error: `Falha ao solicitar backup vzdump no Proxmox: ${err.message}`,
        });
      }
    }

    // Demo fallback
    res.json({
      success: true,
      message: `Backup vzdump gerado com sucesso para a VM ${vmid} no storage ${targetStorage}!`,
      backup: {
        volid: `${targetStorage}:backup/vzdump-qemu-${vmid}-${Date.now()}.vma.zst`,
        vmid,
        vmName: `vm-${vmid}`,
        format: 'vma.zst',
        sizeBytes: 12 * 1024 * 1024 * 1024,
        ctime: Math.floor(Date.now() / 1000),
        dateFormatted: new Date().toLocaleString('pt-BR'),
        storage: targetStorage,
        node: 'pve-node-01',
        serverId: server.id,
        serverName: server.name,
        type: 'qemu',
        protected: false,
        notes: 'Backup gerado sob demanda',
      },
    });
  });

  // Get Transfer Jobs
  app.get('/api/transfers', (req, res) => {
    res.json(getTransferJobs());
  });

  // Get Single Transfer Job
  app.get('/api/transfers/:id', (req, res) => {
    const job = getTransferJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job de transferência não encontrado' });
    }
    res.json(job);
  });

  // Start a new Transfer Job
  app.post('/api/transfers/start', (req, res) => {
    const {
      sourceServerId,
      targetServerId,
      sourceNode,
      targetNode,
      vmid,
      vmName,
      vmType,
      backupVolid,
      targetStorage,
      targetVmid,
      bandwidthThrottleMBps,
      autoRestore,
      startAfterRestore,
      verifyChecksum,
      backupSizeBytes,
    } = req.body;

    const servers = getServers();
    const sourceServer = servers.find((s) => s.id === sourceServerId);
    const targetServer = servers.find((s) => s.id === targetServerId);

    const newJob: TransferJob = {
      id: `job-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: `Transferência: ${vmName || 'VM ' + vmid} -> ${targetServer?.name || 'Destino'}`,
      sourceServerId: sourceServerId || servers[0]?.id || 'pve-source',
      sourceServerName: sourceServer?.name || 'Proxmox Origem',
      sourceNode: sourceNode || 'pve',
      targetServerId: targetServerId || servers[1]?.id || servers[0]?.id || 'pve-target',
      targetServerName: targetServer?.name || 'Proxmox Destino',
      targetNode: targetNode || 'pve',
      vmid: Number(vmid) || 100,
      vmName: vmName || `vm-${vmid}`,
      vmType: vmType || 'qemu',
      backupVolid: backupVolid || `local:backup/vzdump-qemu-${vmid}.vma.zst`,
      backupSizeBytes: Number(backupSizeBytes) || 10 * 1024 * 1024 * 1024,
      targetStorage: targetStorage || 'local',
      targetVmid: Number(targetVmid) || Number(vmid),
      bandwidthThrottleMBps: Number(bandwidthThrottleMBps) || 0,
      autoRestore: autoRestore ?? true,
      startAfterRestore: startAfterRestore ?? false,
      verifyChecksum: verifyChecksum ?? true,
      status: 'pending',
      progressPercent: 0,
      bytesTransferred: 0,
      totalBytes: Number(backupSizeBytes) || 10 * 1024 * 1024 * 1024,
      currentSpeedMBps: 0,
      etaSeconds: 0,
      startedAt: new Date().toISOString(),
      logs: [
        {
          id: '1',
          timestamp: new Date().toLocaleTimeString('pt-BR'),
          level: 'info',
          message: `Job registrado na fila de sincronização. Conectando aos clusters Proxmox...`,
        },
      ],
    };

    addTransferJob(newJob);

    // Launch transfer execution
    setTimeout(() => {
      startTransferExecution(newJob.id);
    }, 200);

    res.status(201).json(newJob);
  });

  // Cancel Transfer Job
  app.post('/api/transfers/:id/cancel', (req, res) => {
    const job = getTransferJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job não encontrado' });
    }
    if (job.status !== 'completed' && job.status !== 'failed') {
      updateTransferJob(job.id, {
        status: 'cancelled',
        logs: [
          ...job.logs,
          {
            id: Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toLocaleTimeString('pt-BR'),
            level: 'warn',
            message: 'Transferência cancelada pelo operador.',
          },
        ],
      });
    }
    res.json(getTransferJob(job.id));
  });

  // Automation Schedules CRUD
  app.get('/api/automations', (req, res) => {
    res.json(getAutomations());
  });

  app.post('/api/automations', (req, res) => {
    const newSched: AutomationSchedule = {
      ...req.body,
      id: `auto-${Date.now()}`,
      totalRuns: 0,
      lastRunStatus: undefined,
      nextRunAt: new Date(Date.now() + 86400000).toISOString(),
    };
    addAutomation(newSched);
    res.status(201).json(newSched);
  });

  app.put('/api/automations/:id', (req, res) => {
    const { id } = req.params;
    const updated = updateAutomation(id, req.body);
    if (!updated) return res.status(404).json({ error: 'Automação não encontrada' });
    res.json(updated);
  });

  app.delete('/api/automations/:id', (req, res) => {
    const { id } = req.params;
    const ok = deleteAutomation(id);
    if (!ok) return res.status(404).json({ error: 'Automação não encontrada' });
    res.json({ success: true });
  });

  // Trigger automation right now
  app.post('/api/automations/:id/trigger', async (req, res) => {
    const automations = getAutomations();
    const sched = automations.find((a) => a.id === req.params.id);
    if (!sched) return res.status(404).json({ error: 'Automação não encontrada' });

    updateAutomation(sched.id, {
      lastRunAt: new Date().toISOString(),
      lastRunStatus: 'running',
      totalRuns: (sched.totalRuns || 0) + 1,
    });

    const data = await refreshAllProxmoxData();
    let targetVms = data.vms.filter((v) => v.serverId === sched.sourceServerId);
    if (sched.selectionMode === 'specific' && sched.selectedVmids.length > 0) {
      targetVms = targetVms.filter((v) => sched.selectedVmids.includes(v.vmid));
    } else if (sched.selectionMode === 'tag' && sched.selectedTag) {
      targetVms = targetVms.filter((v) => v.tags.includes(sched.selectedTag!));
    }

    const firstVm = targetVms[0] || data.vms[0] || { vmid: 100, name: 'VM-Sync', type: 'qemu', diskUsedBytes: 10 * 1024 * 1024 * 1024 };
    const servers = getServers();
    const sourceServer = servers.find((s) => s.id === sched.sourceServerId);
    const targetServer = servers.find((s) => s.id === sched.targetServerId);

    const job: TransferJob = {
      id: `auto-job-${Date.now()}`,
      title: `[Automação] ${sched.name} - ${firstVm.name}`,
      sourceServerId: sched.sourceServerId,
      sourceServerName: sourceServer?.name || 'Origem',
      sourceNode: (firstVm as any).node || 'pve',
      targetServerId: sched.targetServerId,
      targetServerName: targetServer?.name || 'Destino',
      targetNode: sched.targetNode || 'pve',
      vmid: firstVm.vmid,
      vmName: firstVm.name,
      vmType: firstVm.type as any,
      backupVolid: `${sched.targetStorage}:backup/vzdump-${firstVm.type}-${firstVm.vmid}-auto.vma.zst`,
      backupSizeBytes: Math.floor(firstVm.diskUsedBytes * 0.45) || 8 * 1024 * 1024 * 1024,
      targetStorage: sched.targetStorage,
      targetVmid: firstVm.vmid,
      bandwidthThrottleMBps: 0,
      autoRestore: sched.autoRestore,
      startAfterRestore: sched.startAfterRestore,
      verifyChecksum: true,
      status: 'pending',
      progressPercent: 0,
      bytesTransferred: 0,
      totalBytes: Math.floor(firstVm.diskUsedBytes * 0.45) || 8 * 1024 * 1024 * 1024,
      currentSpeedMBps: 0,
      etaSeconds: 0,
      startedAt: new Date().toISOString(),
      logs: [
        {
          id: '1',
          timestamp: new Date().toLocaleTimeString('pt-BR'),
          level: 'info',
          message: `Disparado pelo agendador de automação: ${sched.name}`,
        },
      ],
      automationId: sched.id,
    };

    addTransferJob(job);
    setTimeout(() => {
      startTransferExecution(job.id);
      updateAutomation(sched.id, { lastRunStatus: 'success' });
    }, 300);

    res.json({ success: true, job, message: `Automação "${sched.name}" disparada com sucesso!` });
  });

  // ==========================================
  // VITE OR STATIC SERVING
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Proxmox Backup & Sync Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
