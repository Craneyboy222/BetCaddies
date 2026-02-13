import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Bell, Send, TestTube, Users, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PushNotificationsAdmin() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('/');
  const [lastResult, setLastResult] = useState(null);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['pushStats'],
    queryFn: () => api.push.stats(),
    refetchInterval: 30000,
  });

  const broadcastMutation = useMutation({
    mutationFn: (payload) => api.push.broadcast(payload),
    onSuccess: (result) => {
      setLastResult(result);
      queryClient.invalidateQueries({ queryKey: ['pushStats'] });
    },
  });

  const testMutation = useMutation({
    mutationFn: () => api.push.test({ title: 'Test from BetCaddies', body: 'This is a test push notification.' }),
    onSuccess: (result) => setLastResult(result),
  });

  const handleBroadcast = (e) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    broadcastMutation.mutate({ title: title.trim(), body: body.trim(), url: url.trim() || '/' });
  };

  // Predefined notification templates
  const templates = [
    {
      label: 'New Picks Live',
      title: 'New Picks Are Live!',
      body: 'This week\'s golf betting picks are now available. Check them out!',
      url: '/ParBets',
    },
    {
      label: 'Results Settled',
      title: 'Results Are In!',
      body: 'This week\'s results have been settled. See how your picks performed.',
      url: '/Results',
    },
    {
      label: 'Live Tracking',
      title: 'Tournament In Progress',
      body: 'Live tracking is active — follow your picks in real time.',
      url: '/LiveBetTracking',
    },
  ];

  const applyTemplate = (tpl) => {
    setTitle(tpl.title);
    setBody(tpl.body);
    setUrl(tpl.url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Bell className="w-6 h-6 text-emerald-400" />
          Push Notifications
        </h1>
        <p className="text-slate-400 mt-1">Send push notifications to subscribed users</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Smartphone className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-400">Total Subscribers</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {statsLoading ? '...' : stats?.total ?? 0}
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-400">Logged-In Users</span>
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            {statsLoading ? '...' : stats?.withUser ?? 0}
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-400">Anonymous</span>
          </div>
          <div className="text-2xl font-bold text-slate-300">
            {statsLoading ? '...' : stats?.anonymous ?? 0}
          </div>
        </div>
      </div>

      {/* Quick Templates */}
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
        <h2 className="text-sm font-semibold text-white mb-3">Quick Templates</h2>
        <div className="flex flex-wrap gap-2">
          {templates.map((tpl) => (
            <button
              key={tpl.label}
              onClick={() => applyTemplate(tpl)}
              className="px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition-colors"
            >
              {tpl.label}
            </button>
          ))}
        </div>
      </div>

      {/* Compose */}
      <form onSubmit={handleBroadcast} className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white">Compose Notification</h2>

        <div>
          <label className="block text-sm text-slate-400 mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. New Picks Are Live!"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">Body</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Notification message..."
            rows={3}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            required
          />
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">Link URL (optional)</label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="/"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex gap-3">
          <Button
            type="submit"
            disabled={broadcastMutation.isPending || !title.trim() || !body.trim()}
            className="bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            <Send className="w-4 h-4 mr-2" />
            {broadcastMutation.isPending ? 'Sending...' : 'Send to All'}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => testMutation.mutate()}
            disabled={testMutation.isPending}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            <TestTube className="w-4 h-4 mr-2" />
            {testMutation.isPending ? 'Sending...' : 'Send Test'}
          </Button>
        </div>
      </form>

      {/* Last Result */}
      {lastResult && (
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
          <h3 className="text-sm font-semibold text-white mb-2">Last Send Result</h3>
          <div className="flex gap-4 text-sm">
            <span className="text-emerald-400">Sent: {lastResult.sent}</span>
            <span className="text-red-400">Failed: {lastResult.failed}</span>
            <span className="text-slate-400">Total: {lastResult.total}</span>
          </div>
        </div>
      )}
    </div>
  );
}
