import React, { useState } from 'react';
import { api } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit2, Trash2, Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function MembershipEditForm({ membership, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: membership.name || '',
    description: membership.description || '',
    price: membership.price ?? 0,
    billing_period: membership.billing_period || 'monthly',
    features: Array.isArray(membership.features) ? membership.features.join('\n') : '',
    enabled: membership.enabled !== false,
    badges: membership.badges ? JSON.stringify(membership.badges, null, 2) : '[]',
    stripe_price_id: membership.stripe_price_id || '',
    popular: membership.popular || false
  });

  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-slate-400 mb-2 block">Name</label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="bg-slate-800 border-slate-700"
          />
        </div>
        <div>
          <label className="text-sm text-slate-400 mb-2 block">Stripe Price ID</label>
          <Input
            value={form.stripe_price_id}
            onChange={(e) => setForm({ ...form, stripe_price_id: e.target.value })}
            className="bg-slate-800 border-slate-700"
            placeholder="price_..."
          />
        </div>
      </div>
      <div>
        <label className="text-sm text-slate-400 mb-2 block">Description</label>
        <Textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="bg-slate-800 border-slate-700 min-h-[80px]"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-slate-400 mb-2 block">Price</label>
          <Input
            type="number"
            step="0.01"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
            className="bg-slate-800 border-slate-700"
          />
        </div>
        <div>
          <label className="text-sm text-slate-400 mb-2 block">Billing Period</label>
          <Select value={form.billing_period} onValueChange={(v) => setForm({ ...form, billing_period: v })}>
            <SelectTrigger className="bg-slate-800 border-slate-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
              <SelectItem value="one-time">One-Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <label className="text-sm text-slate-400 mb-2 block">Features (one per line)</label>
        <Textarea
          value={form.features}
          onChange={(e) => setForm({ ...form, features: e.target.value })}
          className="bg-slate-800 border-slate-700 min-h-[100px]"
          placeholder="Feature 1&#10;Feature 2"
        />
      </div>
      <div>
        <label className="text-sm text-slate-400 mb-2 block">Badges (JSON array)</label>
        <Textarea
          value={form.badges}
          onChange={(e) => setForm({ ...form, badges: e.target.value })}
          className="bg-slate-800 border-slate-700 min-h-[80px] font-mono text-xs"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center justify-between bg-slate-800/40 border border-slate-700/50 rounded-lg px-3 py-2">
          <span className="text-sm text-slate-300">Enabled</span>
          <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
        </div>
        <div className="flex items-center justify-between bg-slate-800/40 border border-slate-700/50 rounded-lg px-3 py-2">
          <span className="text-sm text-slate-300">Highlight</span>
          <Switch checked={!!form.popular} onCheckedChange={(v) => setForm({ ...form, popular: v })} />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={onCancel} className="border-slate-600">
          Cancel
        </Button>
        <Button
          onClick={() => {
            let badges = [];
            try { badges = JSON.parse(form.badges || '[]'); } catch { badges = []; }
            onSave({
              name: form.name,
              description: form.description,
              price: form.price,
              billing_period: form.billing_period,
              features: form.features.split('\n').map(s => s.trim()).filter(Boolean),
              enabled: form.enabled,
              badges,
              stripe_price_id: form.stripe_price_id || undefined,
              popular: form.popular
            });
          }}
          className="bg-emerald-500 hover:bg-emerald-600"
        >
          Save
        </Button>
      </div>
    </div>
  );
}

export default function MembershipsTab() {
  const [editingMembership, setEditingMembership] = useState(null);
  const queryClient = useQueryClient();

  const { data: memberships = [] } = useQuery({
    queryKey: ['memberships'],
    queryFn: () => api.entities.MembershipPackage.list('price', 50)
  });

  const updateMembershipMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.MembershipPackage.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memberships'] });
      setEditingMembership(null);
    },
    onError: (error) => {
      console.error('Failed to update membership package', error);
      alert('Failed to update membership package. Check Stripe configuration and try again.');
    }
  });

  const createMembershipMutation = useMutation({
    mutationFn: (data) => api.entities.MembershipPackage.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memberships'] });
      setEditingMembership(null);
    },
    onError: (error) => {
      console.error('Failed to create membership package', error);
      alert('Failed to create membership package. Check Stripe configuration and try again.');
    }
  });

  const deleteMembershipMutation = useMutation({
    mutationFn: (id) => api.entities.MembershipPackage.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['memberships'] })
  });

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Membership Packages</h2>
          <Button
            onClick={() => setEditingMembership({
              name: '',
              price: 0,
              billing_period: 'monthly',
              features: [],
              enabled: true
            })}
            className="bg-emerald-500 hover:bg-emerald-600"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Package
          </Button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {memberships.map(pkg => (
            <div
              key={pkg.id}
              className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <div className="font-semibold text-xl text-white">{pkg.name}</div>
                    {pkg.badges && pkg.badges.map((badge, idx) => {
                      const colorClasses = {
                        emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
                        blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
                        purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
                        amber: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
                        rose: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
                        cyan: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                      };
                      return (
                        <Badge key={idx} className={colorClasses[badge.color] || colorClasses.emerald}>
                          {badge.text}
                        </Badge>
                      );
                    })}
                  </div>
                  <div className="text-2xl font-bold text-emerald-400">
                    \u00a3{pkg.price}
                    <span className="text-sm text-slate-400">/{pkg.billing_period}</span>
                  </div>
                </div>
                <Switch
                  checked={pkg.enabled !== false}
                  onCheckedChange={(v) => updateMembershipMutation.mutate({ id: pkg.id, data: { enabled: v }})}
                />
              </div>

              {pkg.description && (
                <p className="text-sm text-slate-400 mb-4">{pkg.description}</p>
              )}

              {pkg.features && pkg.features.length > 0 && (
                <div className="space-y-2 mb-4">
                  {pkg.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm text-slate-300">
                      <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 pt-4 border-t border-slate-700/50">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingMembership(pkg)}
                  className="text-slate-400 hover:text-white flex-1"
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteMembershipMutation.mutate(pkg.id)}
                  className="text-slate-400 hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Membership Dialog */}
      <Dialog open={!!editingMembership} onOpenChange={() => setEditingMembership(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingMembership?.id ? 'Edit Package' : 'Add Package'}</DialogTitle>
          </DialogHeader>
          {editingMembership && (
            <MembershipEditForm
              membership={editingMembership}
              onSave={(data) => {
                if (editingMembership.id) {
                  updateMembershipMutation.mutate({ id: editingMembership.id, data });
                } else {
                  createMembershipMutation.mutate(data);
                }
              }}
              onCancel={() => setEditingMembership(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
