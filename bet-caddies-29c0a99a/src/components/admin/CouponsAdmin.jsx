import React, { useState } from 'react';
import { api } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tag, Plus, Edit2, Trash2, Copy, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

const defaultCoupon = {
  code: '',
  description: '',
  discountType: 'percentage',
  discountAmount: 10,
  maxUses: null,
  validUntil: '',
  enabled: true,
  applicablePackages: null,
};

export default function CouponsAdmin() {
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const queryClient = useQueryClient();

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ['adminCoupons'],
    queryFn: async () => {
      const res = await api.client.get('/api/admin/coupons');
      return res.data || res;
    },
  });

  const { data: packages = [] } = useQuery({
    queryKey: ['membershipPackages'],
    queryFn: () => api.membershipPackages.list(),
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const res = await api.client.post('/api/admin/coupons', data);
      return res.data || res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCoupons'] });
      setCreating(false);
      setDraft(null);
      toast({ title: 'Coupon created' });
    },
    onError: (e) => toast({ title: 'Failed to create coupon', description: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await api.client.put(`/api/admin/coupons/${id}`, data);
      return res.data || res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCoupons'] });
      setEditing(null);
      setDraft(null);
      toast({ title: 'Coupon updated' });
    },
    onError: (e) => toast({ title: 'Failed to update', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await api.client.delete(`/api/admin/coupons/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCoupons'] });
      toast({ title: 'Coupon deleted' });
    },
  });

  const openCreate = () => {
    setCreating(true);
    setEditing(null);
    setDraft({ ...defaultCoupon });
  };

  const openEdit = (coupon) => {
    setCreating(false);
    setEditing(coupon);
    setDraft({
      code: coupon.code,
      description: coupon.description || '',
      discountType: coupon.discountType,
      discountAmount: coupon.discountAmount,
      maxUses: coupon.maxUses,
      validUntil: coupon.validUntil ? new Date(coupon.validUntil).toISOString().split('T')[0] : '',
      enabled: coupon.enabled,
      applicablePackages: coupon.applicablePackages,
    });
  };

  const handleSave = () => {
    const payload = {
      ...draft,
      discountAmount: parseFloat(draft.discountAmount) || 0,
      maxUses: draft.maxUses ? parseInt(draft.maxUses) : null,
      validUntil: draft.validUntil || null,
      applicablePackages: draft.applicablePackages || null,
    };
    if (creating) {
      createMutation.mutate(payload);
    } else if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    }
  };

  const copyCode = (code, id) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isLoading) return <LoadingSpinner text="Loading coupons..." />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Coupons & Offers</h2>
          <p className="text-sm text-slate-400 mt-1">Create discount codes for membership packages</p>
        </div>
        <Button onClick={openCreate} className="bg-emerald-500 hover:bg-emerald-600">
          <Plus className="w-4 h-4 mr-2" />
          Create Coupon
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-4">
          <div className="text-2xl font-bold text-white">{coupons.length}</div>
          <div className="text-xs text-slate-400">Total Coupons</div>
        </div>
        <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-4">
          <div className="text-2xl font-bold text-emerald-400">{coupons.filter(c => c.enabled).length}</div>
          <div className="text-xs text-slate-400">Active</div>
        </div>
        <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-4">
          <div className="text-2xl font-bold text-amber-400">{coupons.reduce((sum, c) => sum + (c.currentUses || 0), 0)}</div>
          <div className="text-xs text-slate-400">Total Redemptions</div>
        </div>
      </div>

      {/* Coupon List */}
      {coupons.length === 0 ? (
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-8 text-center">
          <Tag className="w-8 h-8 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400">No coupons yet. Create your first discount code.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {coupons.map(coupon => (
            <div key={coupon.id} className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="text-lg font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg">
                      {coupon.code}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyCode(coupon.code, coupon.id)}
                      className="h-7 w-7 text-slate-400 hover:text-white"
                    >
                      {copiedId === coupon.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </Button>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm text-white truncate">{coupon.description || 'No description'}</div>
                    <div className="text-xs text-slate-500">
                      {coupon.discountType === 'percentage' ? `${coupon.discountAmount}% off` : `£${coupon.discountAmount} off`}
                      {coupon.maxUses ? ` · ${coupon.currentUses || 0}/${coupon.maxUses} used` : ` · ${coupon.currentUses || 0} used`}
                      {coupon.validUntil ? ` · Expires ${new Date(coupon.validUntil).toLocaleDateString()}` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={coupon.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/50 text-slate-400'}>
                    {coupon.enabled ? 'Active' : 'Disabled'}
                  </Badge>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(coupon)} className="text-slate-400 hover:text-white">
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { if (confirm('Delete this coupon?')) deleteMutation.mutate(coupon.id); }}
                    className="text-slate-400 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={Boolean(draft)} onOpenChange={(open) => { if (!open) { setDraft(null); setEditing(null); setCreating(false); } }}>
        <DialogContent className="max-w-lg bg-slate-900 text-slate-100 border border-slate-700">
          <DialogHeader>
            <DialogTitle>{creating ? 'Create Coupon' : 'Edit Coupon'}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-slate-400">Code (leave blank to auto-generate)</label>
                <Input
                  value={draft.code}
                  onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. WELCOME20"
                  className="bg-slate-800 border-slate-700 uppercase"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-slate-400">Description</label>
                <Input
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder="Welcome discount for new users"
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-slate-400">Discount Type</label>
                  <Select value={draft.discountType} onValueChange={(v) => setDraft({ ...draft, discountType: v })}>
                    <SelectTrigger className="bg-slate-800 border-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                      <SelectItem value="fixed">Fixed Amount (£)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-slate-400">
                    Amount ({draft.discountType === 'percentage' ? '%' : '£'})
                  </label>
                  <Input
                    type="number"
                    value={draft.discountAmount}
                    onChange={(e) => setDraft({ ...draft, discountAmount: e.target.value })}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-slate-400">Max Uses (blank = unlimited)</label>
                  <Input
                    type="number"
                    value={draft.maxUses || ''}
                    onChange={(e) => setDraft({ ...draft, maxUses: e.target.value })}
                    placeholder="Unlimited"
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-slate-400">Expires (blank = never)</label>
                  <Input
                    type="date"
                    value={draft.validUntil || ''}
                    onChange={(e) => setDraft({ ...draft, validUntil: e.target.value })}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                <div>
                  <div className="text-sm text-white">Enabled</div>
                  <div className="text-xs text-slate-500">Coupon can be redeemed</div>
                </div>
                <Switch checked={draft.enabled} onCheckedChange={(v) => setDraft({ ...draft, enabled: v })} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" className="border-slate-700 text-slate-200" onClick={() => { setDraft(null); setEditing(null); setCreating(false); }}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending} className="bg-emerald-500 hover:bg-emerald-600">
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
