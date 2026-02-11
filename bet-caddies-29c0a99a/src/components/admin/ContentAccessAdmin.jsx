import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import {
  Shield, Plus, Trash2, Check, X, Edit2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const PRESET_RULES = [
  { type: 'page', id: 'par-bets', desc: 'Par Bets page' },
  { type: 'page', id: 'birdie-bets', desc: 'Birdie Bets page' },
  { type: 'page', id: 'eagle-bets', desc: 'Eagle Bets page' },
  { type: 'page', id: 'long-shots', desc: 'Long Shots page' },
  { type: 'page', id: 'live-tracking', desc: 'Live Bet Tracking' },
  { type: 'component', id: 'matchup-analysis', desc: 'Matchup Analysis section' },
  { type: 'component', id: 'course-fit-detail', desc: 'Course Fit Detail' }
];

const levelColors = {
  free: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  pro: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  elite: 'bg-amber-500/20 text-amber-400 border-amber-500/30'
};

export default function ContentAccessAdmin() {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [newRule, setNewRule] = useState({
    resource_type: 'page',
    resource_identifier: '',
    minimum_access_level: 'pro',
    description: ''
  });

  const { data: rules = [] } = useQuery({
    queryKey: ['contentAccessRules'],
    queryFn: () => api.entities.ContentAccessRule.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.entities.ContentAccessRule.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contentAccessRules'] });
      setAdding(false);
      setNewRule({ resource_type: 'page', resource_identifier: '', minimum_access_level: 'pro', description: '' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.ContentAccessRule.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contentAccessRules'] })
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.entities.ContentAccessRule.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contentAccessRules'] })
  });

  const existingIds = new Set(rules.map(r => `${r.resourceType}:${r.resourceIdentifier}`));
  const availablePresets = PRESET_RULES.filter(p => !existingIds.has(`${p.type}:${p.id}`));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-semibold text-white">Content Access Rules</h2>
        </div>
        <Button onClick={() => setAdding(!adding)} size="sm" className="bg-emerald-500 hover:bg-emerald-600">
          <Plus className="w-4 h-4 mr-1" /> Add Rule
        </Button>
      </div>

      <p className="text-slate-400 text-sm">
        Control which pages and components require a subscription. Content with no rule is accessible to everyone.
        Changes take effect immediately.
      </p>

      {/* Quick-add presets */}
      {availablePresets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-slate-500 self-center mr-1">Quick add:</span>
          {availablePresets.map(p => (
            <button
              key={`${p.type}:${p.id}`}
              onClick={() => createMutation.mutate({
                resource_type: p.type,
                resource_identifier: p.id,
                minimum_access_level: 'pro',
                description: p.desc
              })}
              className="text-xs px-2 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 hover:border-emerald-500/50 hover:text-emerald-400 transition"
            >
              + {p.desc}
            </button>
          ))}
        </div>
      )}

      {/* Add form */}
      {adding && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Resource Type</label>
              <Select value={newRule.resource_type} onValueChange={v => setNewRule(p => ({ ...p, resource_type: v }))}>
                <SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="page">Page</SelectItem>
                  <SelectItem value="component">Component</SelectItem>
                  <SelectItem value="api_endpoint">API Endpoint</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Resource ID</label>
              <Input
                placeholder="e.g. eagle-bets"
                value={newRule.resource_identifier}
                onChange={e => setNewRule(p => ({ ...p, resource_identifier: e.target.value }))}
                className="bg-slate-900 border-slate-700"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Minimum Access Level</label>
              <Select value={newRule.minimum_access_level} onValueChange={v => setNewRule(p => ({ ...p, minimum_access_level: v }))}>
                <SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="elite">Elite</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Description</label>
              <Input
                placeholder="Optional description"
                value={newRule.description}
                onChange={e => setNewRule(p => ({ ...p, description: e.target.value }))}
                className="bg-slate-900 border-slate-700"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => createMutation.mutate(newRule)} size="sm" className="bg-emerald-500 hover:bg-emerald-600" disabled={!newRule.resource_identifier}>
              <Check className="w-4 h-4 mr-1" /> Create
            </Button>
            <Button onClick={() => setAdding(false)} size="sm" variant="outline" className="border-slate-600">
              <X className="w-4 h-4 mr-1" /> Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Rules list */}
      <div className="space-y-2">
        {rules.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            No content access rules configured. All content is freely accessible.
          </div>
        )}
        {rules.map(rule => (
          <div key={rule.id} className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Switch
                checked={rule.enabled}
                onCheckedChange={(v) => updateMutation.mutate({ id: rule.id, data: { enabled: v } })}
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">{rule.resourceIdentifier}</span>
                  <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                    {rule.resourceType}
                  </Badge>
                </div>
                {rule.description && (
                  <p className="text-slate-500 text-xs">{rule.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={rule.minimumAccessLevel}
                onValueChange={(v) => updateMutation.mutate({ id: rule.id, data: { minimum_access_level: v } })}
              >
                <SelectTrigger className="w-24 h-8 text-xs bg-slate-900 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="elite">Elite</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm('Delete this rule? The content will become freely accessible.')) {
                    deleteMutation.mutate(rule.id);
                  }
                }}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
