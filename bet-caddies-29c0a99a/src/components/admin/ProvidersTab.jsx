import React, { useState } from 'react';
import { api } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit2, Trash2, Plus, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function ProviderEditForm({ provider, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: provider.name || '',
    slug: provider.slug || '',
    enabled: provider.enabled !== false,
    priority: provider.priority || 0,
    logo_url: provider.logo_url || '',
    affiliate_url: provider.affiliate_url || '',
    signup_bonus: provider.signup_bonus || ''
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
          <label className="text-sm text-slate-400 mb-2 block">Slug</label>
          <Input
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            className="bg-slate-800 border-slate-700"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-slate-400 mb-2 block">Priority</label>
          <Input
            type="number"
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
            className="bg-slate-800 border-slate-700"
          />
        </div>
        <div>
          <label className="text-sm text-slate-400 mb-2 block">Logo URL</label>
          <Input
            value={form.logo_url}
            onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
            className="bg-slate-800 border-slate-700"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-slate-400 mb-2 block">Affiliate URL</label>
          <Input
            value={form.affiliate_url}
            onChange={(e) => setForm({ ...form, affiliate_url: e.target.value })}
            className="bg-slate-800 border-slate-700"
          />
        </div>
        <div>
          <label className="text-sm text-slate-400 mb-2 block">Signup Bonus</label>
          <Input
            value={form.signup_bonus}
            onChange={(e) => setForm({ ...form, signup_bonus: e.target.value })}
            className="bg-slate-800 border-slate-700"
          />
        </div>
      </div>
      <div className="flex items-center justify-between bg-slate-800/40 border border-slate-700/50 rounded-lg px-3 py-2">
        <span className="text-sm text-slate-300">Enabled</span>
        <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={onCancel} className="border-slate-600">
          Cancel
        </Button>
        <Button onClick={() => onSave(form)} className="bg-emerald-500 hover:bg-emerald-600">
          Save
        </Button>
      </div>
    </div>
  );
}

export default function ProvidersTab() {
  const [editingProvider, setEditingProvider] = useState(null);
  const queryClient = useQueryClient();

  const { data: providers = [] } = useQuery({
    queryKey: ['allProviders'],
    queryFn: () => api.entities.BettingProvider.list('priority', 50)
  });

  const updateProviderMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.BettingProvider.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allProviders'] });
      setEditingProvider(null);
    }
  });

  const createProviderMutation = useMutation({
    mutationFn: (data) => api.entities.BettingProvider.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allProviders'] });
      setEditingProvider(null);
    }
  });

  const deleteProviderMutation = useMutation({
    mutationFn: (id) => api.entities.BettingProvider.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['allProviders'] })
  });

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Betting Providers</h2>
          <Button
            onClick={() => setEditingProvider({ name: '', slug: '', enabled: true })}
            className="bg-emerald-500 hover:bg-emerald-600"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Provider
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {providers.map(provider => (
            <div
              key={provider.id}
              className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  {provider.logo_url ? (
                    <img src={provider.logo_url} alt={provider.name} className="h-8 w-auto rounded" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-slate-400" />
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-white">{provider.name}</div>
                    <div className="text-sm text-slate-400">{provider.slug}</div>
                  </div>
                </div>
                <Switch
                  checked={provider.enabled !== false}
                  onCheckedChange={(v) => updateProviderMutation.mutate({ id: provider.id, data: { enabled: v }})}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  Priority: {provider.priority || '-'}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingProvider(provider)}
                    className="text-slate-400 hover:text-white"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteProviderMutation.mutate(provider.id)}
                    className="text-slate-400 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Provider Dialog */}
      <Dialog open={!!editingProvider} onOpenChange={() => setEditingProvider(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>{editingProvider?.id ? 'Edit Provider' : 'Add Provider'}</DialogTitle>
          </DialogHeader>
          {editingProvider && (
            <ProviderEditForm
              provider={editingProvider}
              onSave={(data) => {
                if (editingProvider.id) {
                  updateProviderMutation.mutate({ id: editingProvider.id, data });
                } else {
                  createProviderMutation.mutate(data);
                }
              }}
              onCancel={() => setEditingProvider(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
