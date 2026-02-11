import React, { useState } from 'react';
import { api } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Webhook, Plus, Edit2, Trash2, Send, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

const EVENT_TYPES = [
  'new_signup', 'checkout_complete', 'subscription_cancelled', 'subscription_expired',
  'payment_failed', 'new_picks_published', 'pipeline_completed', 'pipeline_failed',
  'coupon_redeemed', 'referral_conversion'
];

export default function WebhooksAdmin() {
  const [editing, setEditing] = useState(null);
  const [viewingDeliveries, setViewingDeliveries] = useState(null);
  const queryClient = useQueryClient();

  const { data: webhooks = [], isLoading } = useQuery({
    queryKey: ['adminWebhooks'],
    queryFn: async () => { const r = await api.client.get('/api/admin/webhooks'); return r.data || r; },
  });

  const { data: deliveries = [] } = useQuery({
    queryKey: ['webhookDeliveries', viewingDeliveries],
    queryFn: async () => { const r = await api.client.get(`/api/admin/webhooks/${viewingDeliveries}/deliveries`); return r.data || r; },
    enabled: !!viewingDeliveries,
  });

  const createMutation = useMutation({
    mutationFn: async (data) => { const r = await api.client.post('/api/admin/webhooks', data); return r.data || r; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['adminWebhooks'] }); setEditing(null); toast({ title: 'Webhook created' }); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => { const r = await api.client.put(`/api/admin/webhooks/${id}`, data); return r.data || r; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['adminWebhooks'] }); setEditing(null); toast({ title: 'Webhook updated' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => { await api.client.delete(`/api/admin/webhooks/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['adminWebhooks'] }); toast({ title: 'Webhook deleted' }); },
  });

  const testMutation = useMutation({
    mutationFn: async (id) => { const r = await api.client.post(`/api/admin/webhooks/${id}/test`); return r.data || r; },
    onSuccess: (result) => toast({ title: 'Test sent', description: `Status: ${result?.status || 'sent'}` }),
    onError: (e) => toast({ title: 'Test failed', description: e.message, variant: 'destructive' }),
  });

  const openCreate = () => setEditing({ _new: true, name: '', url: '', events: [], enabled: true, secret: '' });

  if (isLoading) return <LoadingSpinner text="Loading webhooks..." />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Webhooks</h2>
          <p className="text-sm text-slate-400 mt-1">Send event notifications to external services (Slack, Zapier, etc.)</p>
        </div>
        <Button onClick={openCreate} className="bg-emerald-500 hover:bg-emerald-600">
          <Plus className="w-4 h-4 mr-2" /> Add Webhook
        </Button>
      </div>

      {webhooks.length === 0 ? (
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-8 text-center">
          <Webhook className="w-8 h-8 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400">No webhooks configured.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map(wh => (
            <div key={wh.id} className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-white">{wh.name}</span>
                    <Badge className={wh.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/50 text-slate-400'}>
                      {wh.enabled ? 'Active' : 'Disabled'}
                    </Badge>
                    {wh.lastStatus && (
                      <Badge className={wh.lastStatus < 300 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}>
                        {wh.lastStatus}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{wh.url}</div>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {(wh.events || []).map(e => (
                      <Badge key={e} className="bg-slate-700/40 text-slate-300 text-[10px] border-slate-600">{e}</Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => testMutation.mutate(wh.id)} className="text-slate-400 hover:text-blue-400" title="Test">
                    <Send className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setViewingDeliveries(wh.id)} className="text-slate-400 hover:text-white" title="Deliveries">
                    <Clock className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setEditing(wh)} className="text-slate-400 hover:text-white">
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm('Delete?')) deleteMutation.mutate(wh.id); }} className="text-slate-400 hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Deliveries Dialog */}
      <Dialog open={!!viewingDeliveries} onOpenChange={(o) => { if (!o) setViewingDeliveries(null); }}>
        <DialogContent className="max-w-2xl bg-slate-900 text-slate-100 border border-slate-700 max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Recent Deliveries</DialogTitle></DialogHeader>
          {deliveries.length === 0 ? (
            <p className="text-slate-400 text-sm">No deliveries yet.</p>
          ) : (
            <div className="space-y-2">
              {deliveries.map(d => (
                <div key={d.id} className="bg-slate-800/40 rounded-lg p-3 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    {d.status === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                    <span className="text-white font-medium">{d.eventType}</span>
                    <Badge className="text-[10px]">{d.responseCode || '—'}</Badge>
                    <span className="text-xs text-slate-500 ml-auto">{new Date(d.createdAt).toLocaleString()}</span>
                  </div>
                  {d.duration && <span className="text-xs text-slate-500">{d.duration}ms</span>}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit/Create Dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="max-w-lg bg-slate-900 text-slate-100 border border-slate-700">
          <DialogHeader><DialogTitle>{editing?._new ? 'Create Webhook' : 'Edit Webhook'}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-slate-400">Name</label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="bg-slate-800 border-slate-700" placeholder="Slack Notifications" />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-slate-400">URL</label>
                <Input value={editing.url} onChange={(e) => setEditing({ ...editing, url: e.target.value })} className="bg-slate-800 border-slate-700" placeholder="https://hooks.slack.com/..." />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-slate-400">Secret (HMAC signing)</label>
                <Input value={editing.secret || ''} onChange={(e) => setEditing({ ...editing, secret: e.target.value })} className="bg-slate-800 border-slate-700" placeholder="Optional" />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-slate-400">Events</label>
                <div className="grid grid-cols-2 gap-1">
                  {EVENT_TYPES.map(evt => (
                    <label key={evt} className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-800/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(editing.events || []).includes(evt)}
                        onChange={(e) => {
                          const events = e.target.checked
                            ? [...(editing.events || []), evt]
                            : (editing.events || []).filter(x => x !== evt);
                          setEditing({ ...editing, events });
                        }}
                        className="rounded"
                      />
                      <span className="text-xs text-slate-300">{evt}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                <span className="text-sm text-white">Enabled</span>
                <Switch checked={editing.enabled} onCheckedChange={(v) => setEditing({ ...editing, enabled: v })} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" className="border-slate-700" onClick={() => setEditing(null)}>Cancel</Button>
                <Button className="bg-emerald-500 hover:bg-emerald-600" onClick={() => {
                  const payload = { name: editing.name, url: editing.url, events: editing.events, enabled: editing.enabled, secret: editing.secret || null };
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
