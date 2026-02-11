import React, { useState } from 'react';
import { api } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Plus, Edit2, Trash2, CheckCircle, Clock, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function ScheduledPublishAdmin() {
  const [editing, setEditing] = useState(null);
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['adminScheduled'],
    queryFn: async () => { const r = await api.client.get('/api/admin/scheduled'); return r.data || r; },
  });

  const createMutation = useMutation({
    mutationFn: async (data) => { const r = await api.client.post('/api/admin/scheduled', data); return r.data || r; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['adminScheduled'] }); setEditing(null); toast({ title: 'Scheduled item created' }); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => { const r = await api.client.put(`/api/admin/scheduled/${id}`, data); return r.data || r; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['adminScheduled'] }); setEditing(null); toast({ title: 'Scheduled item updated' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => { await api.client.delete(`/api/admin/scheduled/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['adminScheduled'] }); toast({ title: 'Scheduled item deleted' }); },
  });

  const openCreate = () => setEditing({
    _new: true, resourceType: 'page', resourceId: '', action: 'publish',
    scheduledFor: '', payload: ''
  });

  if (isLoading) return <LoadingSpinner text="Loading scheduled items..." />;

  const statusIcon = (status) => {
    if (status === 'executed') return <CheckCircle className="w-3 h-3 text-emerald-400" />;
    if (status === 'failed') return <XCircle className="w-3 h-3 text-red-400" />;
    return <Clock className="w-3 h-3 text-amber-400" />;
  };

  const statusColor = (status) => {
    if (status === 'executed') return 'bg-emerald-500/20 text-emerald-400';
    if (status === 'failed') return 'bg-red-500/20 text-red-400';
    return 'bg-amber-500/20 text-amber-400';
  };

  const pending = items.filter(i => i.status === 'pending');
  const completed = items.filter(i => i.status !== 'pending');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Scheduled Publishing</h2>
          <p className="text-sm text-slate-400 mt-1">Schedule content actions for future execution</p>
        </div>
        <Button onClick={openCreate} className="bg-emerald-500 hover:bg-emerald-600">
          <Plus className="w-4 h-4 mr-2" /> Schedule Action
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pending', value: pending.length, color: 'text-amber-400' },
          { label: 'Executed', value: completed.filter(i => i.status === 'executed').length, color: 'text-emerald-400' },
          { label: 'Failed', value: completed.filter(i => i.status === 'failed').length, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
            <div className="text-xs text-slate-500">{s.label}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Pending Items */}
      {pending.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Upcoming</h3>
          <div className="space-y-3">
            {pending.map(item => (
              <div key={item.id} className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <CalendarClock className="w-4 h-4 text-amber-400" />
                      <span className="font-semibold text-white capitalize">{item.action}</span>
                      <Badge className="bg-slate-700/40 text-slate-300 text-[10px]">{item.resourceType}</Badge>
                      <Badge className={statusColor(item.status)}>{item.status}</Badge>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Resource: {item.resourceId} &middot; Scheduled: {new Date(item.scheduledFor).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(item)} className="text-slate-400 hover:text-white">
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm('Delete?')) deleteMutation.mutate(item.id); }} className="text-slate-400 hover:text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {completed.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-3">History</h3>
          <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="text-left px-4 py-2 text-slate-500">Status</th>
                  <th className="text-left px-3 py-2 text-slate-500">Action</th>
                  <th className="text-left px-3 py-2 text-slate-500">Resource</th>
                  <th className="text-left px-3 py-2 text-slate-500">Scheduled</th>
                  <th className="text-right px-4 py-2 text-slate-500">Executed</th>
                </tr>
              </thead>
              <tbody>
                {completed.slice(0, 20).map(item => (
                  <tr key={item.id} className="border-b border-slate-700/20">
                    <td className="px-4 py-2">{statusIcon(item.status)}</td>
                    <td className="px-3 py-2 text-white capitalize">{item.action}</td>
                    <td className="px-3 py-2 text-slate-300">{item.resourceType}: {item.resourceId}</td>
                    <td className="px-3 py-2 text-slate-500">{new Date(item.scheduledFor).toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-slate-500">{item.executedAt ? new Date(item.executedAt).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {items.length === 0 && (
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-8 text-center">
          <CalendarClock className="w-8 h-8 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400">No scheduled actions yet.</p>
        </div>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="max-w-lg bg-slate-900 text-slate-100 border border-slate-700">
          <DialogHeader><DialogTitle>{editing?._new ? 'Schedule Action' : 'Edit Scheduled Action'}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-slate-400">Resource Type</label>
                  <Select value={editing.resourceType} onValueChange={(v) => setEditing({ ...editing, resourceType: v })}>
                    <SelectTrigger className="bg-slate-800 border-slate-700"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="page">Page</SelectItem>
                      <SelectItem value="content">Site Content</SelectItem>
                      <SelectItem value="bet">Bet Pick</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-slate-400">Action</label>
                  <Select value={editing.action} onValueChange={(v) => setEditing({ ...editing, action: v })}>
                    <SelectTrigger className="bg-slate-800 border-slate-700"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="publish">Publish</SelectItem>
                      <SelectItem value="unpublish">Unpublish</SelectItem>
                      <SelectItem value="archive">Archive</SelectItem>
                      <SelectItem value="send">Send</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-slate-400">Resource ID</label>
                <Input value={editing.resourceId} onChange={(e) => setEditing({ ...editing, resourceId: e.target.value })} className="bg-slate-800 border-slate-700" placeholder="e.g. page-123" />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-slate-400">Scheduled For</label>
                <Input type="datetime-local" value={editing.scheduledFor ? editing.scheduledFor.slice(0, 16) : ''} onChange={(e) => setEditing({ ...editing, scheduledFor: new Date(e.target.value).toISOString() })} className="bg-slate-800 border-slate-700" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" className="border-slate-700" onClick={() => setEditing(null)}>Cancel</Button>
                <Button className="bg-emerald-500 hover:bg-emerald-600" onClick={() => {
                  const payload = { resourceType: editing.resourceType, resourceId: editing.resourceId, action: editing.action, scheduledFor: editing.scheduledFor };
                  if (editing._new) createMutation.mutate(payload);
                  else updateMutation.mutate({ id: editing.id, data: payload });
                }}>Save</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
