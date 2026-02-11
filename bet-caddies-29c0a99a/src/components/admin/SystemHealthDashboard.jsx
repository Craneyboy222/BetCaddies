import React from 'react';
import { api } from '@/api/client';
import { useQuery } from '@tanstack/react-query';
import { HeartPulse, Clock, Database, Zap, AlertTriangle, Activity } from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

function MetricCard({ icon: Icon, label, value, unit, color = 'text-white' }) {
  return (
    <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${color}`}>
        {value !== null && value !== undefined ? value : '—'}
        {unit && <span className="text-sm font-normal text-slate-500 ml-1">{unit}</span>}
      </div>
    </div>
  );
}

function formatUptime(seconds) {
  if (!seconds) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function SystemHealthDashboard() {
  const { data: health, isLoading } = useQuery({
    queryKey: ['adminSystemHealth'],
    queryFn: async () => { const r = await api.client.get('/api/admin/system-health'); return r.data || r; },
    refetchInterval: 30 * 1000,
  });

  if (isLoading) return <LoadingSpinner text="Loading system health..." />;

  const uptimeColor = health?.uptimeSeconds > 86400 ? 'text-emerald-400' : 'text-amber-400';
  const errorColor = (health?.errorCountLast24h || 0) === 0 ? 'text-emerald-400' : 'text-red-400';
  const responseColor = (health?.avgApiResponseTimeMs || 0) < 500 ? 'text-emerald-400' : (health?.avgApiResponseTimeMs || 0) < 1000 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">System Health</h2>
        <p className="text-sm text-slate-400 mt-1">Real-time system monitoring and diagnostics</p>
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={Clock} label="Uptime" value={formatUptime(health?.uptimeSeconds)} color={uptimeColor} />
        <MetricCard icon={Database} label="Database Size" value={health?.dbSizeMb} unit="MB" color="text-blue-400" />
        <MetricCard icon={AlertTriangle} label="Errors (24h)" value={health?.errorCountLast24h ?? 0} color={errorColor} />
        <MetricCard icon={Zap} label="Avg Response Time" value={health?.avgApiResponseTimeMs ? `${health.avgApiResponseTimeMs}` : null} unit="ms" color={responseColor} />
      </div>

      {/* Pipeline Status */}
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-emerald-400" />
          <h3 className="text-lg font-semibold text-white">Pipeline Status</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-slate-500 mb-1">Last Pipeline Duration</div>
            <div className="text-lg font-semibold text-white">
              {health?.lastPipelineRunDurationMs ? `${(health.lastPipelineRunDurationMs / 1000).toFixed(1)}s` : '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Last Pipeline Run</div>
            <div className="text-lg font-semibold text-white">
              {health?.lastPipelineRunAt ? new Date(health.lastPipelineRunAt).toLocaleString() : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Metrics */}
      {health?.recentMetrics?.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Recent Metrics (24h)</h3>
          <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="text-left px-4 py-2 text-slate-500">Metric</th>
                  <th className="text-left px-3 py-2 text-slate-500">Value</th>
                  <th className="text-left px-3 py-2 text-slate-500">Unit</th>
                  <th className="text-left px-3 py-2 text-slate-500">Endpoint</th>
                  <th className="text-right px-4 py-2 text-slate-500">Recorded</th>
                </tr>
              </thead>
              <tbody>
                {health.recentMetrics.map(m => (
                  <tr key={m.id} className="border-b border-slate-700/20">
                    <td className="px-4 py-2 text-white font-medium">{m.metric}</td>
                    <td className="px-3 py-2 text-slate-300">{typeof m.value === 'number' ? m.value.toFixed(2) : m.value}</td>
                    <td className="px-3 py-2 text-slate-500">{m.unit}</td>
                    <td className="px-3 py-2 text-slate-500">{m.endpoint || '—'}</td>
                    <td className="px-4 py-2 text-right text-slate-500">{new Date(m.recordedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(!health?.recentMetrics || health.recentMetrics.length === 0) && (
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-8 text-center">
          <HeartPulse className="w-8 h-8 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400">No recent health metrics recorded.</p>
          <p className="text-xs text-slate-500 mt-1">Metrics are collected automatically during API requests and pipeline runs.</p>
        </div>
      )}
    </div>
  );
}
