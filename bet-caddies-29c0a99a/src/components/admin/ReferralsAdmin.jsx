import React, { useState } from 'react';
import { api } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Share2, Plus, Edit2, Copy, Check, Users, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function ReferralsAdmin() {
  const [editing, setEditing] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const queryClient = useQueryClient();

  const { data: referrals = [], isLoading } = useQuery({
    queryKey: ['adminReferrals'],
    queryFn: async () => {
      const res = await api.client.get('/api/admin/referrals');
      return res.data || res;
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => api.entities.User.list('-created_date', 200),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const res = await api.client.post('/api/admin/referrals', data);
      return res.data || res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminReferrals'] });
      setEditing(null);
      toast({ title: 'Referral created' });
    },
    onError: (e) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await api.client.put(`/api/admin/referrals/${id}`, data);
      return res.data || res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminReferrals'] });
      setEditing(null);
      toast({ title: 'Referral updated' });
    },
  });

  const copyCode = (code, id) => {
    navigator.clipboard.writeText(`${window.location.origin}/?ref=${code}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isLoading) return <LoadingSpinner text="Loading referrals..." />;

  const totalClicks = referrals.reduce((s, r) => s + (r.totalReferrals || 0), 0);
  const totalConversions = referrals.reduce((s, r) => s + (r.totalConversions || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Referral Program</h2>
          <p className="text-sm text-slate-400 mt-1">Manage referral codes and track conversions</p>
        </div>
        <Button
          onClick={() => setEditing({ _new: true, referrerUserId: '', commissionRate: 10, enabled: true })}
          className="bg-emerald-500 hover:bg-emerald-600"
        >
          <Plus className="w-4 h-4 mr-2" /> Create Referral
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-4">
          <div className="text-2xl font-bold text-white">{referrals.length}</div>
          <div className="text-xs text-slate-400">Referral Links</div>
        </div>
        <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-4">
          <div className="text-2xl font-bold text-blue-400">{totalClicks}</div>
          <div className="text-xs text-slate-400">Total Clicks</div>
        </div>
        <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-4">
          <div className="text-2xl font-bold text-emerald-400">{totalConversions}</div>
          <div className="text-xs text-slate-400">Conversions</div>
        </div>
      </div>

      {referrals.length === 0 ? (
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-8 text-center">
          <Share2 className="w-8 h-8 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400">No referral links yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {referrals.map(ref => (
            <div key={ref.id} className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <code className="text-sm font-bold text-blue-400 bg-blue-500/10 px-3 py-1 rounded-lg">
                    {ref.referralCode}
                  </code>
                  <Button variant="ghost" size="icon" onClick={() => copyCode(ref.referralCode, ref.id)} className="h-7 w-7 text-slate-400">
                    {copiedId === ref.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </Button>
                  <div>
                    <div className="text-sm text-white">User: {ref.referrerUserId}</div>
                    <div className="text-xs text-slate-500">
                      {ref.totalReferrals} clicks · {ref.totalConversions} conversions · {ref.commissionRate}% commission
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={ref.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/50 text-slate-400'}>
                    {ref.enabled ? 'Active' : 'Disabled'}
                  </Badge>
                  <Button variant="ghost" size="icon" onClick={() => setEditing(ref)} className="text-slate-400 hover:text-white">
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={Boolean(editing)} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="max-w-md bg-slate-900 text-slate-100 border border-slate-700">
          <DialogHeader>
            <DialogTitle>{editing?._new ? 'Create Referral' : 'Edit Referral'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              {editing._new && (
                <div className="space-y-2">
                  <label className="text-xs text-slate-400">User ID</label>
                  <Input
                    value={editing.referrerUserId}
                    onChange={(e) => setEditing({ ...editing, referrerUserId: e.target.value })}
                    placeholder="User ID"
                    className="bg-slate-800 border-slate-700"
                  />
                  {users.length > 0 && (
                    <div className="text-xs text-slate-500">
                      Available: {users.slice(0, 5).map(u => `${u.email} (${u.id})`).join(', ')}
                    </div>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <label className="text-xs text-slate-400">Commission Rate (%)</label>
                <Input
                  type="number"
                  value={editing.commissionRate}
                  onChange={(e) => setEditing({ ...editing, commissionRate: parseFloat(e.target.value) || 0 })}
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                <span className="text-sm text-white">Enabled</span>
                <Switch checked={editing.enabled} onCheckedChange={(v) => setEditing({ ...editing, enabled: v })} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" className="border-slate-700" onClick={() => setEditing(null)}>Cancel</Button>
                <Button
                  className="bg-emerald-500 hover:bg-emerald-600"
                  onClick={() => {
                    if (editing._new) {
                      createMutation.mutate({ referrerUserId: editing.referrerUserId, commissionRate: editing.commissionRate, enabled: editing.enabled });
                    } else {
                      updateMutation.mutate({ id: editing.id, data: { commissionRate: editing.commissionRate, enabled: editing.enabled } });
                    }
                  }}
                >
                  Save
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
