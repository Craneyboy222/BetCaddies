import React, { useState } from 'react';
import { api } from '@/api/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import LoadingSpinner from '@/components/ui/LoadingSpinner';

function AuditLogDetailsView({ entry }) {
  const before = entry.before_json ? JSON.stringify(entry.before_json, null, 2) : '';
  const after = entry.after_json ? JSON.stringify(entry.after_json, null, 2) : '';

  return (
    <div className="space-y-4 pt-2">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-slate-500">Time</div>
          <div className="text-sm text-slate-200">{entry.created_at ? new Date(entry.created_at).toLocaleString() : '\u2014'}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Actor</div>
          <div className="text-sm text-slate-200">{entry.actor_email || '\u2014'}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Action</div>
          <div className="text-sm text-slate-200">{entry.action || '\u2014'}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Entity</div>
          <div className="text-sm text-slate-200">{entry.entity_type || '\u2014'}{entry.entity_id ? ` \u2022 ${entry.entity_id}` : ''}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-sm text-slate-300 mb-2">Before</div>
          <Textarea readOnly value={before || '\u2014'} className="bg-slate-800/50 border-slate-700 text-white min-h-[220px]" />
        </div>
        <div>
          <div className="text-sm text-slate-300 mb-2">After</div>
          <Textarea readOnly value={after || '\u2014'} className="bg-slate-800/50 border-slate-700 text-white min-h-[220px]" />
        </div>
      </div>
    </div>
  );
}

export default function AuditTab() {
  const [viewingAuditLog, setViewingAuditLog] = useState(null);
  const queryClient = useQueryClient();

  const { data: auditLogs = [], isLoading: auditLogsLoading } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: () => api.entities.AuditLog.list(200)
  });

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Audit Logs</h2>
          <Button
            variant="outline"
            className="border-slate-600"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['auditLogs'] })}
          >
            Refresh
          </Button>
        </div>

        {auditLogsLoading ? (
          <LoadingSpinner />
        ) : auditLogs.length === 0 ? (
          <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-8 text-center">
            <p className="text-slate-400">No audit logs yet.</p>
          </div>
        ) : (
          <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Time</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Action</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Actor</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Entity</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-slate-400">Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((l, idx) => (
                  <tr key={l.id} className={idx !== auditLogs.length - 1 ? 'border-b border-slate-700/30' : ''}>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {l.created_at ? new Date(l.created_at).toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-white">{l.action}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {l.actor_email || '\u2014'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {l.entity_type || '\u2014'}{l.entity_id ? ` \u2022 ${l.entity_id}` : ''}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-400 hover:text-white"
                        onClick={() => setViewingAuditLog(l)}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View Audit Log Dialog */}
      <Dialog open={!!viewingAuditLog} onOpenChange={() => setViewingAuditLog(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
          </DialogHeader>
          {viewingAuditLog && (
            <AuditLogDetailsView entry={viewingAuditLog} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
