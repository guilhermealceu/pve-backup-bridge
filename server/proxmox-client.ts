import https from 'https';
import { ProxmoxServer, VMResource, BackupItem, StoragePool } from '../src/types/proxmox.js';

// HTTPS agent that allows self-signed SSL certs commonly used in Proxmox homelabs/datacenters
export const insecureAgent = new https.Agent({
  rejectUnauthorized: false,
});

/**
 * Low-level Proxmox VE API fetcher
 */
export async function pveFetch(server: ProxmoxServer, endpoint: string, options: any = {}) {
  const protocol = 'https';
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
  const url = `${protocol}://${server.host}:${server.port}/api2/json${cleanEndpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (server.authType === 'token' && server.tokenUser && server.tokenId && server.tokenSecret) {
    headers['Authorization'] = `PVEAPIToken=${server.tokenUser}!${server.tokenId}=${server.tokenSecret}`;
  } else if (server.authType === 'ticket' && (server as any).ticket) {
    headers['Cookie'] = `PVEAuthCookie=${(server as any).ticket}`;
    if ((server as any).csrfToken) {
      headers['CSRFPreventionToken'] = (server as any).csrfToken;
    }
  }

  // Node 18+ global fetch TLS bypass for self-signed Proxmox certificates
  if (!server.sslStrict) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  const controller = new AbortController();
  const timeoutMs = options.timeout || 15000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const fetchOptions: RequestInit = {
      ...options,
      headers,
      signal: controller.signal,
    };

    const response = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      let parsedError = errorText;
      try {
        const json = JSON.parse(errorText);
        parsedError = json.message || (json.errors ? JSON.stringify(json.errors) : errorText);
      } catch (e) {
        // use raw text
      }
      throw new Error(`HTTP ${response.status}: ${parsedError}`);
    }

    const data = await response.json();
    return data.data;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Timeout ao conectar a ${server.host}:${server.port} (${timeoutMs / 1000}s)`);
    }
    throw new Error(err.message || 'Falha ao comunicar com Proxmox API');
  }
}

/**
 * Authenticate via Ticket (username / password / realm)
 */
export async function authenticatePveTicket(server: ProxmoxServer): Promise<{ ticket: string; csrfToken: string; username: string }> {
  const url = `https://${server.host}:${server.port}/api2/json/access/ticket`;
  if (!server.sslStrict) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      username: server.username || '',
      password: server.password || '',
      realm: server.realm || 'pam',
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Login falhou (${res.status}): ${errorText}`);
  }

  const json = await res.json();
  return {
    ticket: json.data.ticket,
    csrfToken: json.data.CSRFPreventionToken,
    username: json.data.username,
  };
}

/**
 * Test Connection and fetch Proxmox VE version & nodes
 */
export async function testPveConnection(server: ProxmoxServer): Promise<{
  success: boolean;
  version: string;
  release: string;
  nodeCount: number;
  nodes: string[];
  message: string;
}> {
  try {
    if (server.authType === 'ticket' && !((server as any).ticket)) {
      const ticketData = await authenticatePveTicket(server);
      (server as any).ticket = ticketData.ticket;
      (server as any).csrfToken = ticketData.csrfToken;
    }

    // 1. Get version
    const versionData = await pveFetch(server, '/version');
    
    // 2. Get nodes
    let nodesList: string[] = [];
    try {
      const nodesData = await pveFetch(server, '/nodes');
      if (Array.isArray(nodesData)) {
        nodesList = nodesData.map((n: any) => n.node || n.name);
      }
    } catch (e) {
      nodesList = ['pve'];
    }

    const versionStr = `Proxmox VE ${versionData.version || '8.x'}-${versionData.release || '1'}`;
    const releaseStr = versionData.repoid || versionData.release || 'pve-kernel';

    return {
      success: true,
      version: versionStr,
      release: releaseStr,
      nodeCount: nodesList.length || 1,
      nodes: nodesList,
      message: `Conexão estabelecida com sucesso com ${server.name || server.host} (${versionStr})!`,
    };
  } catch (err: any) {
    throw new Error(err.message || 'Falha ao conectar com o servidor Proxmox VE.');
  }
}

/**
 * Fetch all nodes in cluster
 */
export async function fetchPveNodes(server: ProxmoxServer): Promise<any[]> {
  try {
    const nodes = await pveFetch(server, '/nodes');
    return Array.isArray(nodes) ? nodes : [];
  } catch (err) {
    console.error(`Erro ao buscar nós de ${server.name}:`, err);
    return [{ node: 'pve', status: 'online' }];
  }
}

/**
 * Fetch all VMs and LXCs for a Proxmox Server
 */
export async function fetchServerVMs(server: ProxmoxServer): Promise<VMResource[]> {
  try {
    if (server.authType === 'ticket' && !((server as any).ticket)) {
      const ticketData = await authenticatePveTicket(server);
      (server as any).ticket = ticketData.ticket;
      (server as any).csrfToken = ticketData.csrfToken;
    }

    // Attempt to use cluster resources first (fastest, 1 call)
    let resources: any[] = [];
    try {
      const clusterRes = await pveFetch(server, '/cluster/resources?type=vm');
      if (Array.isArray(clusterRes)) {
        resources = clusterRes;
      }
    } catch (e) {
      // Fallback to iterating nodes
      const nodes = await fetchPveNodes(server);
      for (const n of nodes) {
        const nodeName = n.node;
        try {
          const qemu = await pveFetch(server, `/nodes/${nodeName}/qemu`);
          if (Array.isArray(qemu)) {
            resources.push(...qemu.map((item: any) => ({ ...item, node: nodeName, type: 'qemu' })));
          }
        } catch (err) {}
        try {
          const lxc = await pveFetch(server, `/nodes/${nodeName}/lxc`);
          if (Array.isArray(lxc)) {
            resources.push(...lxc.map((item: any) => ({ ...item, node: nodeName, type: 'lxc' })));
          }
        } catch (err) {}
      }
    }

    const vms: VMResource[] = [];

    for (const res of resources) {
      const vmid = Number(res.vmid);
      const node = res.node || 'pve';
      const type: 'qemu' | 'lxc' = res.type === 'lxc' ? 'lxc' : 'qemu';
      const name = res.name || `${type}-${vmid}`;
      const status = res.status === 'running' ? 'running' : res.status === 'paused' ? 'paused' : 'stopped';
      const cpuUsagePercent = Math.round((Number(res.cpu) || 0) * 1000) / 10;
      const cpus = Number(res.maxcpu) || Number(res.cpus) || 2;
      const memUsedBytes = Number(res.mem) || 0;
      const memMaxBytes = Number(res.maxmem) || 4 * 1024 * 1024 * 1024;
      const diskUsedBytes = Number(res.disk) || 0;
      const diskMaxBytes = Number(res.maxdisk) || 32 * 1024 * 1024 * 1024;
      const uptimeSec = Number(res.uptime) || 0;
      const tags = res.tags ? String(res.tags).split(/[;, ]+/).filter(Boolean) : [];

      // Fetch snapshot list for VM
      let snapshots: any[] = [];
      try {
        const snapRes = await pveFetch(server, `/nodes/${node}/${type}/${vmid}/snapshot`);
        if (Array.isArray(snapRes)) {
          snapshots = snapRes
            .filter((s: any) => s.name !== 'current')
            .map((s: any) => ({
              name: s.name,
              snaptime: Number(s.snaptime) || Math.floor(Date.now() / 1000),
              description: s.description || '',
              vmstate: !!s.vmstate,
              isCurrent: false,
            }));
        }
      } catch (e) {
        // Snapshot call might not be permitted or empty
      }

      // Fetch IP addresses if VM is running
      let ipAddresses: string[] = [];
      let macAddresses: string[] = [];
      let qemuAgentRunning = false;

      if (status === 'running' && type === 'qemu') {
        try {
          const agentNet = await pveFetch(server, `/nodes/${node}/qemu/${vmid}/agent/network-get-interfaces`, { timeout: 3000 });
          if (agentNet && Array.isArray(agentNet.result)) {
            qemuAgentRunning = true;
            for (const iface of agentNet.result) {
              if (iface['hardware-address']) {
                macAddresses.push(iface['hardware-address'].toUpperCase());
              }
              if (Array.isArray(iface['ip-addresses'])) {
                for (const ip of iface['ip-addresses']) {
                  if (ip['ip-address-type'] === 'ipv4' && ip['ip-address'] && !ip['ip-address'].startsWith('127.')) {
                    ipAddresses.push(ip['ip-address']);
                  }
                }
              }
            }
          }
        } catch (e) {
          // Guest agent not active
        }
      } else if (status === 'running' && type === 'lxc') {
        try {
          const lxcIfaces = await pveFetch(server, `/nodes/${node}/lxc/${vmid}/interfaces`, { timeout: 3000 });
          if (Array.isArray(lxcIfaces)) {
            qemuAgentRunning = true;
            for (const iface of lxcIfaces) {
              if (iface.hwaddr) macAddresses.push(iface.hwaddr.toUpperCase());
              if (iface.inet && !iface.inet.startsWith('127.')) {
                ipAddresses.push(iface.inet.split('/')[0]);
              }
            }
          }
        } catch (e) {}
      }

      vms.push({
        vmid,
        name,
        serverId: server.id,
        serverName: server.name,
        node,
        type,
        status,
        cpuUsagePercent,
        cpus,
        memUsedBytes,
        memMaxBytes,
        diskUsedBytes,
        diskMaxBytes,
        uptimeSec,
        ipAddresses: Array.from(new Set(ipAddresses)),
        macAddresses: Array.from(new Set(macAddresses)),
        qemuAgentRunning,
        backupCount: 0, // will be enriched from backups scan
        snapshotsCount: snapshots.length,
        snapshots,
        tags,
        osType: type === 'lxc' ? 'Linux Container' : 'QEMU Virtual Machine',
      });
    }

    return vms;
  } catch (err: any) {
    console.error(`Erro ao buscar VMs do servidor ${server.name}:`, err.message);
    return [];
  }
}

/**
 * Fetch all storage pools for a Proxmox Server
 */
export async function fetchServerStorages(server: ProxmoxServer): Promise<StoragePool[]> {
  try {
    if (server.authType === 'ticket' && !((server as any).ticket)) {
      const ticketData = await authenticatePveTicket(server);
      (server as any).ticket = ticketData.ticket;
      (server as any).csrfToken = ticketData.csrfToken;
    }

    const nodes = await fetchPveNodes(server);
    const pools: StoragePool[] = [];

    for (const n of nodes) {
      const nodeName = n.node;
      try {
        const storageList = await pveFetch(server, `/nodes/${nodeName}/storage`);
        if (Array.isArray(storageList)) {
          for (const st of storageList) {
            const contentArray = st.content ? String(st.content).split(',') : ['images'];
            pools.push({
              id: `${server.id}-${nodeName}-${st.storage}`,
              serverId: server.id,
              node: nodeName,
              storage: st.storage,
              type: st.type || 'dir',
              content: contentArray,
              usedBytes: Number(st.used) || 0,
              totalBytes: Number(st.total) || 0,
              availBytes: Number(st.avail) || 0,
              active: st.active === 1 || st.active === true,
              shared: !!st.shared,
            });
          }
        }
      } catch (e) {
        console.error(`Erro ao ler storage de ${nodeName}:`, e);
      }
    }

    return pools;
  } catch (err: any) {
    console.error(`Erro ao buscar storages de ${server.name}:`, err.message);
    return [];
  }
}

/**
 * Fetch all backup files (.vma.zst, .tar.zst, etc.) across all backup storages
 */
export async function fetchServerBackups(server: ProxmoxServer, storages: StoragePool[]): Promise<BackupItem[]> {
  try {
    if (server.authType === 'ticket' && !((server as any).ticket)) {
      const ticketData = await authenticatePveTicket(server);
      (server as any).ticket = ticketData.ticket;
      (server as any).csrfToken = ticketData.csrfToken;
    }

    const backups: BackupItem[] = [];
    const backupStorages = storages.filter((s) => s.serverId === server.id && s.content.includes('backup') && s.active);

    for (const st of backupStorages) {
      try {
        const contents = await pveFetch(server, `/nodes/${st.node}/storage/${st.storage}/content?content=backup`);
        if (Array.isArray(contents)) {
          for (const item of contents) {
            if (item.content === 'backup' || item.format === 'vma.zst' || item.format === 'tar.zst' || item.volid) {
              const vmid = Number(item.vmid) || 0;
              const dateObj = item.ctime ? new Date(item.ctime * 1000) : new Date();
              const dateFormatted = dateObj.toLocaleString('pt-BR');
              const format = item.format || (item.volid.endsWith('.vma.zst') ? 'vma.zst' : item.volid.endsWith('.tar.zst') ? 'tar.zst' : 'vma.zst');
              const type = item.volid.includes('vzdump-lxc') ? 'lxc' : 'qemu';

              backups.push({
                volid: item.volid,
                vmid,
                vmName: item.notes || `VM/CT ${vmid}`,
                format,
                sizeBytes: Number(item.size) || 0,
                ctime: Number(item.ctime) || Math.floor(Date.now() / 1000),
                dateFormatted,
                storage: st.storage,
                node: st.node,
                serverId: server.id,
                serverName: server.name,
                type,
                protected: !!item.protected,
                notes: item.notes || 'Backup Proxmox VZDump',
              });
            }
          }
        }
      } catch (err) {
        console.error(`Erro ao listar backups do storage ${st.storage} em ${server.name}:`, err);
      }
    }

    return backups;
  } catch (err: any) {
    console.error(`Erro ao buscar backups de ${server.name}:`, err.message);
    return [];
  }
}

/**
 * Create Snapshot on Proxmox VE
 */
export async function createPveSnapshot(
  server: ProxmoxServer,
  node: string,
  vmid: number,
  type: 'qemu' | 'lxc',
  snapname: string,
  description: string,
  vmstate: boolean
): Promise<any> {
  const endpoint = `/nodes/${node}/${type}/${vmid}/snapshot`;
  return await pveFetch(server, endpoint, {
    method: 'POST',
    body: JSON.stringify({
      snapname,
      description: description || `Snapshot criado em ${new Date().toLocaleString('pt-BR')}`,
      vmstate: vmstate ? 1 : 0,
    }),
  });
}

/**
 * Create VZDump Backup on Proxmox VE
 */
export async function createPveBackup(
  server: ProxmoxServer,
  node: string,
  vmid: number,
  storage: string,
  mode: string = 'snapshot',
  compress: string = 'zstd'
): Promise<any> {
  const endpoint = `/nodes/${node}/vzdump`;
  return await pveFetch(server, endpoint, {
    method: 'POST',
    body: JSON.stringify({
      vmid,
      storage,
      mode: mode || 'snapshot',
      compress: compress || 'zstd',
      remove: 0,
    }),
  });
}
