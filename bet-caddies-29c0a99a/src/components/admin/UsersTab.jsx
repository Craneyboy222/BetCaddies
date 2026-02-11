import React, { useState } from 'react';
import { api } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit2, Plus } from 'lucide-react';
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

function UserEditForm({ user, onSave, onCancel, isSaving }) {
  const [form, setForm] = useState({
    email: user.email || '',
    full_name: user.full_name || '',
    role: user.role || 'user',
    disabled: !!user.disabled_at,
    disabled_reason: user.disabled_reason || '',
    favorite_tours: Array.isArray(user.favorite_tours) ? user.favorite_tours : [],
    risk_appetite: user.risk_appetite || '',
    notifications_enabled: user.notifications_enabled !== false,
    email_notifications: user.email_notifications !== false,
    onboarding_completed: user.onboarding_completed === true,
    total_bets_placed: user.total_bets_placed ?? 0,
    total_wins: user.total_wins ?? 0,
    hio_total_points: user.hio_total_points ?? 0
  });

  const favoriteToursCsv = (form.favorite_tours || []).join(', ');

  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-slate-400 mb-2 block">Full Name</label>
          <Input
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            className="bg-slate-800 border-slate-700"
          />
        </div>
        <div>
          <label className="text-sm text-slate-400 mb-2 block">Email</label>
          <Input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="bg-slate-800 border-slate-700"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-slate-400 mb-2 block">Role</label>
          <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
            <SelectTrigger className="bg-slate-800 border-slate-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm text-slate-400 mb-2 block">Risk Appetite</label>
          <Input
            value={form.risk_appetite}
            onChange={(e) => setForm({ ...form, risk_appetite: e.target.value })}
            className="bg-slate-800 border-slate-700"
            placeholder="conservative / balanced / aggressive"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center justify-between bg-slate-800/40 border border-slate-700/50 rounded-lg px-3 py-2">
          <span className="text-sm text-slate-300">Disabled</span>
          <Switch
            checked={!!form.disabled}
            onCheckedChange={(v) => setForm({ ...form, disabled: v })}
          />
        </div>
        <div>
          <label className="text-sm text-slate-400 mb-2 block">Disabled Reason</label>
          <Input
            value={form.disabled_reason}
            onChange={(e) => setForm({ ...form, disabled_reason: e.target.value })}
            className="bg-slate-800 border-slate-700"
            placeholder="Optional"
            disabled={!form.disabled}
          />
        </div>
      </div>

      <div>
        <label className="text-sm text-slate-400 mb-2 block">Favorite Tours (comma separated)</label>
        <Input
          value={favoriteToursCsv}
          onChange={(e) =>
            setForm({
              ...form,
              favorite_tours: e.target.value
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
            })
          }
          className="bg-slate-800 border-slate-700"
          placeholder="PGA, LIV, DPWT"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-sm text-slate-400 mb-2 block">Total Bets Placed</label>
          <Input
            type="number"
            min="0"
            value={form.total_bets_placed}
            onChange={(e) => setForm({ ...form, total_bets_placed: e.target.value })}
            className="bg-slate-800 border-slate-700"
          />
        </div>
        <div>
          <label className="text-sm text-slate-400 mb-2 block">Total Wins</label>
          <Input
            type="number"
            min="0"
            value={form.total_wins}
            onChange={(e) => setForm({ ...form, total_wins: e.target.value })}
            className="bg-slate-800 border-slate-700"
          />
        </div>
        <div>
          <label className="text-sm text-slate-400 mb-2 block">HIO Total Points</label>
          <Input
            type="number"
            min="0"
            value={form.hio_total_points}
            onChange={(e) => setForm({ ...form, hio_total_points: e.target.value })}
            className="bg-slate-800 border-slate-700"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 pt-2">
        <div className="flex items-center justify-between bg-slate-800/40 border border-slate-700/50 rounded-lg px-3 py-2">
          <span className="text-sm text-slate-300">Notifications</span>
          <Switch
            checked={!!form.notifications_enabled}
            onCheckedChange={(v) => setForm({ ...form, notifications_enabled: v })}
          />
        </div>
        <div className="flex items-center justify-between bg-slate-800/40 border border-slate-700/50 rounded-lg px-3 py-2">
          <span className="text-sm text-slate-300">Email Notifs</span>
          <Switch
            checked={!!form.email_notifications}
            onCheckedChange={(v) => setForm({ ...form, email_notifications: v })}
          />
        </div>
        <div className="flex items-center justify-between bg-slate-800/40 border border-slate-700/50 rounded-lg px-3 py-2">
          <span className="text-sm text-slate-300">Onboarding</span>
          <Switch
            checked={!!form.onboarding_completed}
            onCheckedChange={(v) => setForm({ ...form, onboarding_completed: v })}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button variant="outline" onClick={onCancel} className="border-slate-600" disabled={isSaving}>
          Cancel
        </Button>
        <Button
          onClick={() => onSave(form)}
          className="bg-emerald-500 hover:bg-emerald-600"
          disabled={isSaving}
        >
          Save Changes
        </Button>
      </div>
    </div>
  );
}

function CreateUserForm({ onSave, onCancel, isSaving }) {
  const [form, setForm] = useState({
    email: '',
    full_name: '',
    role: 'user',
    disabled: false,
    disabled_reason: ''
  });

  return (
    <div className="space-y-4 pt-4">
      <div>
        <label className="text-sm text-slate-400 mb-2 block">Email</label>
        <Input
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="bg-slate-800 border-slate-700"
          placeholder="user@example.com"
        />
      </div>

      <div>
        <label className="text-sm text-slate-400 mb-2 block">Full Name</label>
        <Input
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          className="bg-slate-800 border-slate-700"
          placeholder="Optional"
        />
      </div>

      <div>
        <label className="text-sm text-slate-400 mb-2 block">Role</label>
        <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
          <SelectTrigger className="bg-slate-800 border-slate-700">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center justify-between bg-slate-800/40 border border-slate-700/50 rounded-lg px-3 py-2">
          <span className="text-sm text-slate-300">Disabled</span>
          <Switch checked={!!form.disabled} onCheckedChange={(v) => setForm({ ...form, disabled: v })} />
        </div>
        <div>
          <label className="text-sm text-slate-400 mb-2 block">Disabled Reason</label>
          <Input
            value={form.disabled_reason}
            onChange={(e) => setForm({ ...form, disabled_reason: e.target.value })}
            className="bg-slate-800 border-slate-700"
            placeholder="Optional"
            disabled={!form.disabled}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={onCancel} className="border-slate-600" disabled={isSaving}>
          Cancel
        </Button>
        <Button
          onClick={() => onSave({
            ...form,
            full_name: form.full_name?.trim() ? form.full_name : null,
            disabled_reason: form.disabled_reason?.trim() ? form.disabled_reason : null
          })}
          className="bg-emerald-500 hover:bg-emerald-600"
          disabled={isSaving || !form.email.trim()}
        >
          {isSaving ? 'Creating\u2026' : 'Create'}
        </Button>
      </div>
    </div>
  );
}

export default function UsersTab() {
  const [editingUser, setEditingUser] = useState(null);
  const [creatingUser, setCreatingUser] = useState(false);
  const [impersonationResult, setImpersonationResult] = useState(null);
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => api.entities.User.list('-created_date', 100)
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.User.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
      setEditingUser(null);
    }
  });

  const createUserMutation = useMutation({
    mutationFn: (data) => api.entities.User.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
      setCreatingUser(false);
    }
  });

  const impersonateUserMutation = useMutation({
    mutationFn: (id) => api.entities.User.impersonate(id),
    onSuccess: (result) => {
      setImpersonationResult(result);
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
    }
  });

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-xl font-bold text-white">Users ({users.length})</h2>
          <Button
            onClick={() => setCreatingUser(true)}
            className="bg-emerald-500 hover:bg-emerald-600"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create User
          </Button>
        </div>

        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">User</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Role</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Bets</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">HIO Points</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Joined</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, idx) => (
                <tr key={u.id} className={idx !== users.length - 1 ? 'border-b border-slate-700/30' : ''}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{u.full_name || 'Unknown'}</div>
                    <div className="text-sm text-slate-400">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={
                        u.role === 'admin' ? 'bg-violet-500/20 text-violet-400 border-violet-500/30' :
                        'bg-slate-500/20 text-slate-400 border-slate-500/30'
                      }>
                        {u.role || 'user'}
                      </Badge>
                      {u.disabled_at && (
                        <Badge className="bg-red-500/20 text-red-400 border border-red-500/30">
                          Disabled
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-white">{u.total_bets_placed || 0}</td>
                  <td className="px-4 py-3 text-center text-amber-400">{u.hio_total_points || 0}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">
                    {u.created_date ? new Date(u.created_date).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => impersonateUserMutation.mutate(u.id)}
                        className="text-slate-400 hover:text-white"
                        disabled={impersonateUserMutation.isPending || !!u.disabled_at}
                      >
                        Impersonate
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingUser(u)}
                        className="text-slate-400 hover:text-white"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <UserEditForm
              user={editingUser}
              isSaving={updateUserMutation.isPending}
              onSave={(data) => updateUserMutation.mutate({ id: editingUser.id, data })}
              onCancel={() => setEditingUser(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={!!creatingUser} onOpenChange={() => setCreatingUser(false)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-xl">
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
          </DialogHeader>
          {creatingUser && (
            <CreateUserForm
              isSaving={createUserMutation.isPending}
              onCancel={() => setCreatingUser(false)}
              onSave={(data) => createUserMutation.mutate(data)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Impersonation Token Dialog */}
      <Dialog open={!!impersonationResult} onOpenChange={() => setImpersonationResult(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>Impersonation Token</DialogTitle>
          </DialogHeader>
          {impersonationResult && (
            <div className="space-y-3 pt-2">
              <div className="text-sm text-slate-300">
                Token for: <span className="text-white">{impersonationResult.user?.email || '\u2014'}</span>
              </div>
              <Textarea
                readOnly
                value={impersonationResult.token || ''}
                className="bg-slate-800/50 border-slate-700 text-white min-h-[180px]"
              />
              <div className="text-xs text-slate-500">
                This token is short-lived (1h). Switching your app token to this will replace your admin session.
              </div>
              <div className="flex justify-end">
                <Button variant="outline" className="border-slate-600" onClick={() => setImpersonationResult(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
