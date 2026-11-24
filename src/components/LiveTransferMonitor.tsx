import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowRightLeft,
  Terminal,
  Activity,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  Zap,
  HardDrive,
  Server,
  StopCircle,
  RefreshCw,
  Copy,
  Check,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { TransferJob, TransferLog } from '../types/proxmox.js';
import { formatBytes, formatSpeed, formatDuration } from '../lib/formatters.js';

interface LiveTransferMonitorProps {
  jobs: TransferJob[];
  selectedJobId?: string | null;
  onSelectJob: (id: string) => void;
  onCancelJob: (id: string) => void;
  onOpenTransferWizard: () => void;
}

export const LiveTransferMonitor: React.FC<LiveTransferMonitorProps> = ({
  jobs,
  selectedJobId,
  onSelectJob,
  onCancelJob,
  onOpenTransferWizard,
}) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed' | 'failed'>('all');
  const [copiedLog, setCopiedLog] = useState(false);
  const logTerminalRef = useRef<HTMLDivElement>(null);

  // Auto-select active job or first job if none selected
  const activeJob = jobs.find((j) => j.id === selectedJobId) || jobs[0];

  // Auto-scroll logs to bottom as they arrive
  useEffect(() => {
    if (logTerminalRef.current) {
      logTerminalRef.current.scrollTop = logTerminalRef.current.scrollHeight;
    }
  }, [activeJob?.logs?.length]);

  const filteredJobs = jobs.filter((job) => {
    if (filterStatus === 'active') {
      return job.status === 'transferring' || job.status === 'connecting' || job.status === 'verifying' || job.status === 'restoring';
    }
    if (filterStatus === 'completed') return job.status === 'completed';
    if (filterStatus === 'failed') return job.status === 'failed' || job.status === 'cancelled';
    return true;
  });

  const activeCount = jobs.filter(
    (j) => j.status === 'transferring' || j.status === 'connecting' || j.status === 'verifying' || j.status === 'restoring'
  ).length;

  const totalTransferredBytes = jobs.reduce((acc, j) => acc + (j.bytesTransferred || 0), 0);
  const currentGlobalSpeed = jobs
    .filter((j) => j.status === 'transferring')
    .reduce((acc, j) => acc + (j.currentSpeedMBps || 0), 0);

  const handleCopyLogs = () => {
    if (!activeJob) return;
    const logText = activeJob.logs.map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(logText);
    setCopiedLog(true);
    setTimeout(() => setCopiedLog(false), 2000);
  };

  const getStatusBadge = (status: TransferJob['status']) => {
    switch (status) {
      case 'transferring':
        return (
          <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[11px] font-bold flex items-center gap-1.5 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
            Transferindo Stream
          </span>
        );
      case 'restoring':
        return (
          <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[11px] font-bold flex items-center gap-1.5 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
            Restaurando QEMU/LXC
          </span>
        );
      case 'verifying':
        return (
          <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 text-[11px] font-bold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
            Verificando SHA-256
          </span>
        );
      case 'connecting':
        return (
          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[11px] font-bold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            Conectando PVE API
          </span>
        );
      case 'completed':
        return (
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Concluído com Sucesso
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-400 border border-slate-500/30 text-[11px] font-bold flex items-center gap-1.5">
            <StopCircle className="w-3 h-3 text-slate-400" />
            Cancelado
          </span>
        );
      case 'failed':
      default:
        return (
          <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[11px] font-bold flex items-center gap-1.5">
            <XCircle className="w-3 h-3 text-rose-400" />
            Falha na Operação
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Global Transfer Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Transferências Ativas</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-white tracking-tight">{activeCount}</span>
              <span className="text-xs text-slate-400">em andamento</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
            <ArrowRightLeft className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Taxa de Transferência Total</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-white tracking-tight">{formatSpeed(currentGlobalSpeed)}</span>
              <span className="text-xs text-slate-400">largura agregada</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Zap className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Volume Total Sincronizado</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-white tracking-tight">{formatBytes(totalTransferredBytes, 1)}</span>
              <span className="text-xs text-slate-400">payload processado</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <HardDrive className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Dual-Pane: Left Jobs List / Right Live Log & Progress Streamer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Jobs Queue & History (4 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer font-medium ${
                  filterStatus === 'all' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Todos ({jobs.length})
              </button>
              <button
                onClick={() => setFilterStatus('active')}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer font-medium ${
                  filterStatus === 'active' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Ativos ({activeCount})
              </button>
              <button
                onClick={() => setFilterStatus('completed')}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer font-medium ${
                  filterStatus === 'completed' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Concluídos
              </button>
            </div>

            <button
              onClick={onOpenTransferWizard}
              className="px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold shadow transition cursor-pointer"
            >
              + Novo
            </button>
          </div>

          <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
            {filteredJobs.map((job) => {
              const isSelected = activeJob?.id === job.id;
              const isRunning =
                job.status === 'transferring' || job.status === 'connecting' || job.status === 'verifying' || job.status === 'restoring';

              return (
                <div
                  key={job.id}
                  onClick={() => onSelectJob(job.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-orange-500 bg-slate-800/90 shadow-md ring-1 ring-orange-500/40'
                      : 'border-slate-700/80 bg-slate-800/50 hover:bg-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-mono text-xs font-bold text-orange-400 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700">
                        {job.vmid}
                      </span>
                      <span className="text-xs font-bold text-white truncate" title={job.vmName}>
                        {job.vmName}
                      </span>
                    </div>
                    {getStatusBadge(job.status)}
                  </div>

                  {/* Flow Route */}
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-2 font-mono truncate">
                    <span className="text-slate-300 truncate">{job.sourceServerName}</span>
                    <ChevronRight className="w-3 h-3 text-orange-400 shrink-0" />
                    <span className="text-slate-300 truncate">{job.targetServerName}</span>
                  </div>

                  {/* Progress Bar & Stats */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-slate-400 font-mono">
                        {formatBytes(job.bytesTransferred, 1)} / {formatBytes(job.totalBytes, 1)}
                      </span>
                      <span className="font-bold text-slate-200">{job.progressPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          job.status === 'completed'
                            ? 'bg-emerald-500'
                            : job.status === 'failed'
                            ? 'bg-rose-500'
                            : 'bg-gradient-to-r from-amber-500 to-orange-500'
                        }`}
                        style={{ width: `${job.progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Speed & ETA */}
                  {isRunning && (
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 pt-2 border-t border-slate-700/60 font-mono">
                      <span className="text-cyan-400 font-semibold">{formatSpeed(job.currentSpeedMBps)}</span>
                      <span>ETA: {formatDuration(job.etaSeconds)}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Active Job Detailed Monitor & Real-Time Terminal (7 cols) */}
        <div className="lg:col-span-7">
          {activeJob ? (
            <div className="bg-slate-900 border border-slate-700/80 rounded-xl overflow-hidden shadow-xl flex flex-col h-full min-h-[550px]">
              {/* Header Info */}
              <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-orange-400 px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                      ID: {activeJob.vmid}
                    </span>
                    <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                      {activeJob.title}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 font-mono">
                    Storage Alvo: <span className="text-slate-200">{activeJob.targetStorage}</span> (Nó:{' '}
                    <span className="text-slate-200">{activeJob.targetNode}</span>)
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {getStatusBadge(activeJob.status)}

                  {(activeJob.status === 'transferring' || activeJob.status === 'connecting') && (
                    <button
                      onClick={() => onCancelJob(activeJob.id)}
                      className="px-3 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold transition cursor-pointer"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>

              {/* Progress & Speed Dashboard */}
              <div className="p-4 bg-slate-950/60 border-b border-slate-800">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3 text-xs">
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <p className="text-[10px] text-slate-400 uppercase font-semibold">Progresso</p>
                    <p className="text-lg font-bold text-orange-400 font-mono">{activeJob.progressPercent}%</p>
                  </div>

                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <p className="text-[10px] text-slate-400 uppercase font-semibold">Velocidade</p>
                    <p className="text-lg font-bold text-cyan-400 font-mono">
                      {formatSpeed(activeJob.currentSpeedMBps)}
                    </p>
                  </div>

                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <p className="text-[10px] text-slate-400 uppercase font-semibold">Transferido</p>
                    <p className="text-lg font-bold text-slate-200 font-mono">
                      {formatBytes(activeJob.bytesTransferred, 1)}
                    </p>
                  </div>

                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <p className="text-[10px] text-slate-400 uppercase font-semibold">Tempo Estimado</p>
                    <p className="text-lg font-bold text-amber-400 font-mono">
                      {activeJob.etaSeconds > 0 ? formatDuration(activeJob.etaSeconds) : 'Concluído'}
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-800">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-300 ${
                      activeJob.status === 'completed'
                        ? 'bg-emerald-500'
                        : activeJob.status === 'failed'
                        ? 'bg-rose-500'
                        : 'bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-500'
                    }`}
                    style={{ width: `${activeJob.progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Terminal Logs View */}
              <div className="flex-1 flex flex-col bg-black/80 font-mono text-xs">
                {/* Terminal Toolbar */}
                <div className="px-4 py-2 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-slate-400 text-[11px]">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5 text-orange-400" />
                    <span>Logs de Execução em Tempo Real (PVE API Stream)</span>
                  </div>

                  <button
                    onClick={handleCopyLogs}
                    className="flex items-center gap-1 text-slate-400 hover:text-white transition cursor-pointer"
                  >
                    {copiedLog ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedLog ? 'Copiado!' : 'Copiar Logs'}</span>
                  </button>
                </div>

                {/* Terminal Output */}
                <div
                  ref={logTerminalRef}
                  className="flex-1 p-4 overflow-y-auto space-y-1.5 text-slate-300 max-h-[350px] scrollbar-thin scrollbar-thumb-slate-800"
                >
                  {activeJob.logs.map((log) => {
                    let levelColor = 'text-slate-400';
                    if (log.level === 'success') levelColor = 'text-emerald-400 font-semibold';
                    if (log.level === 'warn') levelColor = 'text-amber-400';
                    if (log.level === 'error') levelColor = 'text-rose-400 font-bold';

                    return (
                      <div key={log.id} className="leading-relaxed flex items-start gap-2">
                        <span className="text-slate-600 select-none">[{log.timestamp}]</span>
                        <span className={levelColor}>[{log.level.toUpperCase()}]</span>
                        <span className="text-slate-200">{log.message}</span>
                      </div>
                    );
                  })}

                  {activeJob.status === 'transferring' && (
                    <div className="flex items-center gap-2 text-orange-400 animate-pulse pt-1">
                      <span>▸</span>
                      <span>Recebendo stream de blocos vzdump via API Proxmox...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-700/80 rounded-xl p-12 text-center text-slate-400 flex flex-col items-center justify-center min-h-[500px]">
              <ArrowRightLeft className="w-12 h-12 text-slate-600 mb-3" />
              <h4 className="text-base font-bold text-white">Nenhuma transferência selecionada</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Selecione uma tarefa na lista à esquerda ou inicie uma nova migração de backup.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
