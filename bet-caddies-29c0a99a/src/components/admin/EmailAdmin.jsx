import React, { useState } from 'react';
import { api } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, Plus, Edit2, Trash2, Send, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function EmailAdmin() {
  const [editing, setEditing] = useState(null);
  const [testEmail, setTestEmail] = useState('');
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['adminEmailTemplates'],
    queryFn: async () => { const r = await api.client.get('/api/admin/email-templates'); return r.data || r; },
  });

  const { data: sends = [] } = useQuery({
    queryKey: ['adminEmailSends'],
    queryFn: async () => { const r = await api.client.get('/api/admin/email-sends'); return r.data || r; },
  });

  const createMutation = useMutation({
    mutationFn: async (data) => { const r = await api.client.post('/api/admin/email-templates', data); return r.data || r; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['adminEmailTemplates'] }); setEditing(null); toast({ title: 'Template created' }); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => { const r = await api.client.put(`/api/admin/email-templates/${id}`, data); return r.data || r; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['adminEmailTemplates'] }); setEditing(null); toast({ title: 'Template updated' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => { await api.client.delete(`/api/admin/email-templates/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['adminEmailTemplates'] }); toast({ title: 'Template deleted' }); },
  });

  const testSendMutation = useMutation({
    mutationFn: async ({ id, email }) => { const r = await api.client.post(`/api/admin/email-templates/${id}/test-send`, { toEmail: email }); return r.data || r; },
    onSuccess: () => toast({ title: 'Test email queued' }),
    onError: (e) => toast({ title: 'Send failed', description: e.message, variant: 'destructive' }),
  });

  const openCreate = () => setEditing({
    _new: true, slug: '', name: '', subject: '', bodyHtml: '', bodyText: '', enabled: true,
    variables: '["user_name", "user_email"]'
  });

  if (isLoading) return <LoadingSpinner text="Loading email templates..." />;

  const statusIcon = (status) => {
    if (status === 'sent') return <CheckCircle className="w-3 h-3 text-emerald-400" />;
    if (status === 'failed' || status === 'bounced') return <XCircle className="w-3 h-3 text-red-400" />;
    return <Clock className="w-3 h-3 text-slate-400" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Email Notifications</h2>
          <p className="text-sm text-slate-400 mt-1">Manage email templates and view send history</p>
        </div>
        <Button onClick={openCreate} className="bg-emerald-500 hover:bg-emerald-600">
          <Plus className="w-4 h-4 mr-2" /> New Template
        </Button>
      </div>

      {/* Templates */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3">Templates</h3>
        {templates.length === 0 ? (
          <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-8 text-center">
            <Mail className="w-8 h-8 text-slate-500 mx-auto mb-3" />
            <p className="text-slate-400">No email templates yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map(tpl => (
              <div key={tpl.id} className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{tpl.name}</span>
                      <Badge className="bg-slate-700/40 text-slate-300 text-[10px]">{tpl.slug}</Badge>
                      <Badge className={tpl.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/50 text-slate-400'}>
                        {tpl.enabled ? 'Active' : 'Disabled'}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Subject: {tpl.subject}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(tpl)} className="text-slate-400 hover:text-white">
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm('Delete?')) deleteMutation.mutate(tpl.id); }} className="text-slate-400 hover:text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Sends */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3">Recent Sends</h3>
        {sends.length === 0 ? (
          <p className="text-sm text-slate-500">No emails sent yet.</p>
        ) : (
          <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="text-left px-4 py-2 text-slate-500">Status</th>
                  <th className="text-left px-3 py-2 text-slate-500">To</th>
                  <th className="text-left px-3 py-2 text-slate-500">Subject</th>
                  <th className="text-left px-3 py-2 text-slate-500">Template</th>
                  <th className="text-right px-4 py-2 text-slate-500">Date</th>
                </tr>
              </thead>
              <tbody>
                {sends.slice(0, 20).map(s => (
                  <tr key={s.id} className="border-b border-slate-700/20">
                    <td className="px-4 py-2">{statusIcon(s.status)}</td>
                    <td className="px-3 py-2 text-white">{s.toEmail}</td>
                    <td className="px-3 py-2 text-slate-300 truncate max-w-[200px]">{s.subject}</td>
                    <td className="px-3 py-2 text-slate-500">{s.templateSlug || '—'}</td>
                    <td className="px-4 py-2 text-right text-slate-500">{new Date(s.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="max-w-2xl bg-slate-900 text-slate-100 border border-slate-700 max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?._new ? 'Create Template' : 'Edit Template'}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-slate-400">Name</label>
                  <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="bg-slate-800 border-slate-700" placeholder="Welcome Email" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-slate-400">Slug</label>
                  <Input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} className="bg-slate-800 border-slate-700" placeholder="welcome" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-slate-400">Subject</label>
                <Input value={editing.subject} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} className="bg-slate-800 border-slate-700" placeholder="Welcome to BetCaddies!" />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-slate-400">Body (HTML)</label>
                <Textarea value={editing.bodyHtml} onChange={(e) => setEditing({ ...editing, bodyHtml: e.target.value })} className="bg-slate-800 border-slate-700 min-h-[200px] font-mono text-xs" />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-slate-400">Body (Plain Text fallback)</label>
                <Textarea value={editing.bodyText || ''} onChange={(e) => setEditing({ ...editing, bodyText: e.target.value })} className="bg-slate-800 border-slate-700 min-h-[80px] font-mono text-xs" />
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                <span className="text-sm text-white">Enabled</span>
                <Switch checked={editing.enabled} onCheckedChange={(v) => setEditing({ ...editing, enabled: v })} />
              </div>

              {/* Test Send */}
              {!editing._new && (
                <div className="p-3 bg-slate-800/50 rounded-lg space-y-2">
                  <label className="text-xs text-slate-400">Send Test Email</label>
                  <div className="flex gap-2">
                    <Input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="test@example.com" className="bg-slate-800 border-slate-700" />
                    <Button onClick={() => testSendMutation.mutate({ id: editing.id, email: testEmail })} disabled={!testEmail || testSendMutation.isPending} className="bg-blue-500 hover:bg-blue-600">
                      <Send className="w-4 h-4 mr-1" /> Send
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" className="border-slate-700" onClick={() => setEditing(null)}>Cancel</Button>
                <Button className="bg-emerald-500 hover:bg-emerald-600" onClick={() => {
                  const payload = { slug: editing.slug, name: editing.name, subject: editing.subject, bodyHtml: editing.bodyHtml, bodyText: editing.bodyText || null, enabled: editing.enabled };
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
