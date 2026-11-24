import React, { useState } from 'react';
import {
  Server,
  X,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Zap,
  Key,
  Flame,
  Info,
  Layers,
  Sparkles,
} from 'lucide-react';
import { ProxmoxServer } from '../types/proxmox.js';
import { testServerConnection } from '../services/api.js';

interface ServerManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  servers: ProxmoxServer[];
  onSaveServer: (server: Partial<ProxmoxServer>) => Promise<void>;
  onDeleteServer: (id: string) => Promise<void>;
  onClearMockData?: () => Promise<void>;
}

export const ServerManagerModal: React.FC<ServerManagerModalProps> = ({
  isOpen,
  onClose,
  servers,
  onSaveServer,
  onDeleteServer,
  onClearMockData,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showTokenGuide, setShowTokenGuide] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(8006);
  const [authType, setAuthType] = useState<'token' | 'ticket'>('token');

  // Token Auth
  const [tokenUser, setTokenUser] = useState('root@pam');
  const [tokenId, setTokenId] = useState('pve-backup');
  const [tokenSecret, setTokenSecret] = useState('');

  // Ticket Auth
  const [username, setUsername] = useState('root');
  const [password, setPassword] = useState('');
  const [realm, setRealm] = useState('pam');

  const [sslStrict, setSslStrict] = useState(false);

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    version?: string;
    release?: string;
    nodeCount?: number;
    message: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isClearingMock, setIsClearingMock] = useState(false);

  if (!isOpen) return null;

  const handleTest = async () => {
    if (!host) {
      setTestResult({ success: false, message: 'Preencha o Host ou IP do seu servidor Proxmox VE.' });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testServerConnection({
        host,
        port,
        authType,
        tokenUser,
        tokenId,
        tokenSecret,
        username,
        password,
        realm,
        sslStrict,
      });
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Falha na conexão com a API do Proxmox VE.' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSaveServer({
        name: name || `Proxmox (${host})`,
        host,
        port,
        authType,
        tokenUser,
        tokenId,
        tokenSecret,
        username,
        password,
        realm,
        sslStrict,
        status: 'connected',
        nodeCount: testResult?.nodeCount || 1,
        isDemo: false,
      });
      setShowAddForm(false);
      setName('');
      setHost('');
      setTokenSecret('');
      setPassword('');
      setTestResult(null);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Erro ao salvar servidor' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearMock = async () => {
    if (onClearMockData) {
      setIsClearingMock(true);
      try {
        await onClearMockData();
        setTestResult({
          success: true,
          message: 'Modo 100% Produção Real Ativado! Dados de teste removidos.',
        });
      } finally {
        setIsClearingMock(false);
      }
    }
  };

  const hasDemoServers = servers.some((s) => s.isDemo);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Servidores & Clusters Proxmox VE
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                  Produção Real
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Conecte seus nós Proxmox VE via API REST para gerenciar backups, snapshots e migrações
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

        {/* Content */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 text-xs text-slate-200 space-y-4">
          {/* Top Actions & Production Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
            <div>
              <span className="text-xs font-semibold text-slate-200">
                {servers.length} Servidor(es) Configurado(s)
              </span>
              <p className="text-[11px] text-slate-400">
                Comunicação direta com endpoint <code className="text-orange-400 font-mono">/api2/json</code> do Proxmox
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {hasDemoServers && (
                <button
                  onClick={handleClearMock}
                  disabled={isClearingMock}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-semibold text-xs border border-rose-500/40 transition flex items-center gap-1.5 cursor-pointer"
                  title="Remove os dados de teste para usar somente seus servidores reais"
                >
                  <Flame className="w-3.5 h-3.5 text-rose-400" />
                  <span>{isClearingMock ? 'Removendo...' : 'Remover Servidores Mockup'}</span>
                </button>
              )}

              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="px-3.5 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-lg shadow-orange-500/20 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar Proxmox Real</span>
              </button>
            </div>
          </div>

          {/* Quick API Token Instructions Toggle */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-300 font-medium">
                <Info className="w-4 h-4 text-orange-400" />
                <span>Como criar o Token de API no Proxmox VE:</span>
              </div>
              <button
                onClick={() => setShowTokenGuide(!showTokenGuide)}
                className="text-orange-400 hover:text-orange-300 text-xs font-semibold underline cursor-pointer"
              >
                {showTokenGuide ? 'Ocultar instruções' : 'Ver passo a passo'}
              </button>
            </div>

            {showTokenGuide && (
              <div className="mt-3 text-slate-300 space-y-1.5 text-[11px] leading-relaxed border-t border-slate-700/60 pt-2.5">
                <p>1. No painel do seu Proxmox VE, acesse: <strong className="text-white">Datacenter &gt; Permissions &gt; API Tokens</strong>.</p>
                <p>2. Clique em <strong className="text-white">Add</strong>, selecione o usuário (ex: <code className="text-amber-300">root@pam</code>) e defina um Token ID (ex: <code className="text-amber-300">pve-backup</code>).</p>
                <p>3. <em>Desmarque</em> a opção "Privilege Separation" (ou garanta que o token herde permissões de VM.Backup, Datastore.AllocateSpace, Sys.Audit).</p>
                <p>4. Copie o <strong className="text-white">Secret (UUID)</strong> gerado e cole no formulário abaixo.</p>
              </div>
            )}
          </div>

          {/* Add Server Form */}
          {showAddForm && (
            <form
              onSubmit={handleSave}
              className="p-4 sm:p-5 rounded-xl border border-orange-500/40 bg-slate-950/90 space-y-4 animate-fadeIn"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  <span>Cadastrar Conexão Proxmox VE</span>
                </h4>
              </div>

              {testResult && (
                <div
                  className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                    testResult.success
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <div>
                    <span className="font-semibold">{testResult.message}</span>
                    {testResult.version && (
                      <span className="block text-[11px] opacity-80 mt-0.5">
                        Versão detectada: {testResult.version} | Kernel: {testResult.release} | Nós: {testResult.nodeCount}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-slate-400 mb-1 font-medium">Nome Amigável do Servidor:</label>
                  <input
                    type="text"
                    required
                    placeholder="ex: Proxmox DC1 Datacenter"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Porta Proxmox:</label>
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Host / IP / FQDN:</label>
                <input
                  type="text"
                  required
                  placeholder="ex: 192.168.1.100 ou pve.minhaempresa.com.br"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* Auth Method Selector */}
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Método de Autenticação:</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="authMethod"
                      checked={authType === 'token'}
                      onChange={() => setAuthType('token')}
                      className="text-orange-500"
                    />
                    <span className="font-semibold text-white">API Token (PVEAPIToken)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="authMethod"
                      checked={authType === 'ticket'}
                      onChange={() => setAuthType('ticket')}
                      className="text-orange-500"
                    />
                    <span>Usuário & Senha (Ticket Auth)</span>
                  </label>
                </div>
              </div>

              {/* Token Fields */}
              {authType === 'token' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-900/80 rounded-lg border border-slate-800">
                  <div>
                    <label className="block text-slate-400 mb-1 text-[11px]">User@Realm:</label>
                    <input
                      type="text"
                      placeholder="root@pam"
                      value={tokenUser}
                      onChange={(e) => setTokenUser(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 text-[11px]">Token ID:</label>
                    <input
                      type="text"
                      placeholder="pve-backup"
                      value={tokenId}
                      onChange={(e) => setTokenId(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 text-[11px]">Secret UUID:</label>
                    <input
                      type="password"
                      placeholder="UUID Secret"
                      value={tokenSecret}
                      onChange={(e) => setTokenSecret(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Ticket Fields */}
              {authType === 'ticket' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-900/80 rounded-lg border border-slate-800">
                  <div>
                    <label className="block text-slate-400 mb-1 text-[11px]">Usuário:</label>
                    <input
                      type="text"
                      placeholder="root"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 text-[11px]">Senha:</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 text-[11px]">Realm:</label>
                    <select
                      value={realm}
                      onChange={(e) => setRealm(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white cursor-pointer"
                    >
                      <option value="pam">pam (Linux PAM Standard)</option>
                      <option value="pve">pve (Proxmox VE Auth)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* SSL Toggle */}
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={!sslStrict}
                  onChange={(e) => setSslStrict(!e.target.checked)}
                  className="text-orange-500 rounded bg-slate-950"
                />
                <span>Aceitar certificado SSL autoassinado (Padrão para Proxmox VE)</span>
              </label>

              {/* Form Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={isTesting}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Zap className={`w-3.5 h-3.5 text-orange-400 ${isTesting ? 'animate-spin' : ''}`} />
                  <span>{isTesting ? 'Testando Conexão...' : 'Testar Conexão'}</span>
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold disabled:opacity-50 shadow-md"
                  >
                    {isSaving ? 'Salvando...' : 'Salvar Servidor'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* List of Connected Servers */}
          <div className="space-y-3">
            {servers.length === 0 && (
              <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-8 text-center text-slate-400">
                <Layers className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                <h4 className="text-sm font-semibold text-slate-200">Nenhum servidor conectado</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Clique em "Adicionar Proxmox Real" acima para cadastrar o IP e API Token do seu ambiente.
                </p>
              </div>
            )}

            {servers.map((srv) => (
              <div
                key={srv.id}
                className="p-4 rounded-xl border border-slate-700/80 bg-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 shrink-0">
                    <Server className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white tracking-tight">{srv.name}</h4>
                      {srv.isDemo ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold border border-amber-500/30">
                          Mockup / Demo
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          {srv.version || 'Proxmox VE Real'}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      Endpoint: https://{srv.host}:{srv.port} | Auth: {srv.authType.toUpperCase()} | Nós: {srv.nodeCount}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    onClick={() => onDeleteServer(srv.id)}
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-700 transition cursor-pointer"
                    title="Remover Servidor"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
