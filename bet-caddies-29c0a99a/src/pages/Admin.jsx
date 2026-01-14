import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  Settings, 
  Play, 
  Target, 
  Users, 
  FileText,
  AlertTriangle,
  RefreshCw,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  ChevronDown,
  BarChart3,
  Building2,
  Clock,
  Eye,
  CreditCard,
  Trophy
} from 'lucide-react';
import SubscriptionCRM from '@/components/admin/SubscriptionCRM';
import HIOChallengeAdmin from '@/components/admin/HIOChallengeAdmin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function Admin() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('runs');
  const [editingBet, setEditingBet] = useState(null);
  const [editingProvider, setEditingProvider] = useState(null);
  const [editingMembership, setEditingMembership] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await api.auth.me();
        if (userData.role !== 'admin') {
          window.location.href = '/';
          return;
        }
        setUser(userData);
      } catch (e) {
        api.auth.redirectToLogin();
      }
    };
    loadUser();
  }, []);

  // Queries
  const { data: runs = [], isLoading: runsLoading } = useQuery({
    queryKey: ['researchRuns'],
    queryFn: () => api.entities.ResearchRun.list('-created_date', 20)
  });

  const { data: bets = [], isLoading: betsLoading } = useQuery({
    queryKey: ['allBets'],
    queryFn: () => api.entities.GolfBet.list('-created_date', 100)
  });

  const { data: providers = [] } = useQuery({
    queryKey: ['allProviders'],
    queryFn: () => api.entities.BettingProvider.list('priority', 50)
  });

  const { data: issues = [] } = useQuery({
    queryKey: ['dataQualityIssues'],
    queryFn: () => api.entities.DataQualityIssue.filter({ resolved: false }, '-created_date', 50)
  });

  const { data: users = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => api.entities.User.list('-created_date', 100)
  });

  const { data: memberships = [] } = useQuery({
    queryKey: ['memberships'],
    queryFn: () => api.entities.MembershipPackage.list('price', 50)
  });

  // Mutations
  const updateBetMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.GolfBet.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allBets'] });
      setEditingBet(null);
    }
  });

  const deleteBetMutation = useMutation({
    mutationFn: (id) => api.entities.GolfBet.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['allBets'] })
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

  const resolveIssueMutation = useMutation({
    mutationFn: (id) => api.entities.DataQualityIssue.update(id, { resolved: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dataQualityIssues'] })
  });

  const triggerRunMutation = useMutation({
    mutationFn: async () => {
      const response = await api.functions.invoke('weeklyResearchPipeline', { dryRun: false });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['researchRuns'] });
      queryClient.invalidateQueries({ queryKey: ['allBets'] });
    }
  });

  const updateMembershipMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.MembershipPackage.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memberships'] });
      setEditingMembership(null);
    }
  });

  const createMembershipMutation = useMutation({
    mutationFn: (data) => api.entities.MembershipPackage.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memberships'] });
      setEditingMembership(null);
    }
  });

  const deleteMembershipMutation = useMutation({
    mutationFn: (id) => api.entities.MembershipPackage.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['memberships'] })
  });

  if (!user) return <LoadingSpinner text="Loading admin..." />;

  // Stats
  const activeBets = bets.filter(b => b.status === 'active').length;
  const latestRun = runs[0];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/30 to-purple-500/20 border border-violet-500/30 flex items-center justify-center">
            <Settings className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-slate-400">Manage bets, providers, and system</p>
          </div>
        </div>
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
          <div className="text-2xl font-bold text-emerald-400">{activeBets}</div>
          <div className="text-sm text-slate-400">Active Bets</div>
        </div>
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
          <div className="text-2xl font-bold text-white">{providers.length}</div>
          <div className="text-sm text-slate-400">Providers</div>
        </div>
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
          <div className="text-2xl font-bold text-white">{users.length}</div>
          <div className="text-sm text-slate-400">Users</div>
        </div>
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
          <div className="text-2xl font-bold text-amber-400">{issues.length}</div>
          <div className="text-sm text-slate-400">Open Issues</div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-800/50 border border-slate-700/50 p-1 mb-6">
          <TabsTrigger value="runs" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
            <Clock className="w-4 h-4 mr-2" />
            Runs
          </TabsTrigger>
          <TabsTrigger value="bets" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
            <Target className="w-4 h-4 mr-2" />
            Bets
          </TabsTrigger>
          <TabsTrigger value="providers" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
            <Building2 className="w-4 h-4 mr-2" />
            Providers
          </TabsTrigger>
          <TabsTrigger value="issues" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Issues
          </TabsTrigger>
          <TabsTrigger value="users" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
            <Users className="w-4 h-4 mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger value="memberships" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
            <BarChart3 className="w-4 h-4 mr-2" />
            Packages
          </TabsTrigger>
          <TabsTrigger value="subscriptions" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
            <CreditCard className="w-4 h-4 mr-2" />
            Subscriptions
          </TabsTrigger>
          <TabsTrigger value="hio" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
            <Trophy className="w-4 h-4 mr-2" />
            HIO Challenge
          </TabsTrigger>
        </TabsList>

        {/* Runs Tab */}
        <TabsContent value="runs">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Research Runs</h2>
              <Button 
                onClick={() => triggerRunMutation.mutate()}
                disabled={triggerRunMutation.isPending}
                className="bg-emerald-500 hover:bg-emerald-600"
              >
                {triggerRunMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Trigger Run
                  </>
                )}
              </Button>
            </div>
            
            {runsLoading ? (
              <LoadingSpinner />
            ) : runs.length === 0 ? (
              <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-8 text-center">
                <p className="text-slate-400">No runs yet. Trigger a run to generate picks.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {runs.map(run => (
                  <div
                    key={run.id}
                    className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-white">{run.run_id}</div>
                        <div className="text-sm text-slate-400">
                          {run.week_start} to {run.week_end}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={
                          run.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                          run.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                          run.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-slate-500/20 text-slate-400'
                        }>
                          {run.status}
                        </Badge>
                        <div className="text-sm text-slate-400">
                          {run.total_bets_published || 0} bets
                        </div>
                      </div>
                    </div>
                    {run.error_summary && (
                      <div className="mt-3 p-3 bg-red-500/10 rounded-lg text-sm text-red-400">
                        {run.error_summary}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Bets Tab */}
        <TabsContent value="bets">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Manage Bets ({bets.length})</h2>
            </div>

            {betsLoading ? (
              <LoadingSpinner />
            ) : (
              <div className="space-y-3">
                {bets.map(bet => (
                  <div
                    key={bet.id}
                    className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className={
                            bet.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                            'bg-slate-500/20 text-slate-400 border-slate-500/30'
                          }>
                            {bet.status}
                          </Badge>
                          <Badge variant="outline" className="bg-slate-700/50 text-slate-300 border-slate-600">
                            {bet.tour}
                          </Badge>
                          <Badge variant="outline" className="bg-slate-700/50 text-slate-300 border-slate-600 capitalize">
                            {bet.category}
                          </Badge>
                        </div>
                        <div className="font-semibold text-white">{bet.selection_name}</div>
                        <div className="text-sm text-slate-400">
                          {bet.bet_title} • {bet.tournament_name}
                        </div>
                        <div className="text-sm text-slate-500 mt-1">
                          Confidence: {bet.confidence_rating}/5 • Odds: {bet.odds_display_best}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingBet(bet)}
                          className="text-slate-400 hover:text-white"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteBetMutation.mutate(bet.id)}
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
          </div>
        </TabsContent>

        {/* Providers Tab */}
        <TabsContent value="providers">
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
        </TabsContent>

        {/* Issues Tab */}
        <TabsContent value="issues">
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">Data Quality Issues</h2>
            
            {issues.length === 0 ? (
              <div className="bg-emerald-500/10 rounded-xl border border-emerald-500/30 p-8 text-center">
                <Check className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                <p className="text-emerald-400">No open issues</p>
              </div>
            ) : (
              <div className="space-y-3">
                {issues.map(issue => (
                  <div
                    key={issue.id}
                    className={`rounded-xl border p-4 ${
                      issue.severity === 'critical' ? 'bg-red-500/10 border-red-500/30' :
                      issue.severity === 'error' ? 'bg-orange-500/10 border-orange-500/30' :
                      issue.severity === 'warning' ? 'bg-amber-500/10 border-amber-500/30' :
                      'bg-slate-800/30 border-slate-700/50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={
                            issue.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                            issue.severity === 'error' ? 'bg-orange-500/20 text-orange-400' :
                            issue.severity === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-slate-500/20 text-slate-400'
                          }>
                            {issue.severity}
                          </Badge>
                          {issue.tour && <Badge variant="outline">{issue.tour}</Badge>}
                          <span className="text-xs text-slate-500">{issue.step}</span>
                        </div>
                        <div className="text-white">{issue.issue}</div>
                        {issue.evidence && (
                          <div className="text-sm text-slate-400 mt-2">{issue.evidence}</div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => resolveIssueMutation.mutate(issue.id)}
                        className="text-slate-400 hover:text-emerald-400"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users">
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">Users ({users.length})</h2>
            
            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">User</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Role</th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Bets</th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">HIO Points</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Joined</th>
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
                        <Badge variant="outline" className={
                          u.role === 'admin' ? 'bg-violet-500/20 text-violet-400 border-violet-500/30' :
                          'bg-slate-500/20 text-slate-400 border-slate-500/30'
                        }>
                          {u.role || 'user'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center text-white">{u.total_bets_placed || 0}</td>
                      <td className="px-4 py-3 text-center text-amber-400">{u.hio_total_points || 0}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {u.created_date ? new Date(u.created_date).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Packages Tab */}
        <TabsContent value="memberships">
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
                        £{pkg.price}
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
        </TabsContent>

        {/* Subscriptions CRM Tab */}
        <TabsContent value="subscriptions">
          <SubscriptionCRM />
        </TabsContent>

        {/* HIO Challenge Admin Tab */}
        <TabsContent value="hio">
          <HIOChallengeAdmin />
        </TabsContent>
      </Tabs>

      {/* Edit Bet Dialog */}
      <Dialog open={!!editingBet} onOpenChange={() => setEditingBet(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Bet</DialogTitle>
          </DialogHeader>
          {editingBet && (
            <BetEditForm
              bet={editingBet}
              onSave={(data) => updateBetMutation.mutate({ id: editingBet.id, data })}
              onCancel={() => setEditingBet(null)}
            />
          )}
        </DialogContent>
      </Dialog>

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
    </div>
  );
}

function BetEditForm({ bet, onSave, onCancel }) {
  const [form, setForm] = useState({
    selection_name: bet.selection_name || '',
    bet_title: bet.bet_title || '',
    confidence_rating: bet.confidence_rating || 3,
    ai_analysis_paragraph: bet.ai_analysis_paragraph || '',
    affiliate_link_override: bet.affiliate_link_override || '',
    status: bet.status || 'active',
    course_fit_score: bet.course_fit_score || 5,
    form_label: bet.form_label || '',
    weather_label: bet.weather_label || ''
  });

  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-slate-400 mb-2 block">Selection Name</label>
          <Input
            value={form.selection_name}
            onChange={(e) => setForm({...form, selection_name: e.target.value})}
            className="bg-slate-800 border-slate-700"
          />
        </div>
        <div>
          <label className="text-sm text-slate-400 mb-2 block">Bet Title</label>
          <Input
            value={form.bet_title}
            onChange={(e) => setForm({...form, bet_title: e.target.value})}
            className="bg-slate-800 border-slate-700"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-sm text-slate-400 mb-2 block">Confidence (1-5)</label>
          <Select
            value={String(form.confidence_rating)}
            onValueChange={(v) => setForm({...form, confidence_rating: parseInt(v)})}
          >
            <SelectTrigger className="bg-slate-800 border-slate-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1,2,3,4,5].map(n => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm text-slate-400 mb-2 block">Course Fit (0-10)</label>
          <Input
            type="number"
            min="0"
            max="10"
            value={form.course_fit_score}
            onChange={(e) => setForm({...form, course_fit_score: parseInt(e.target.value)})}
            className="bg-slate-800 border-slate-700"
          />
        </div>
        <div>
          <label className="text-sm text-slate-400 mb-2 block">Status</label>
          <Select
            value={form.status}
            onValueChange={(v) => setForm({...form, status: v})}
          >
            <SelectTrigger className="bg-slate-800 border-slate-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
              <SelectItem value="settled_won">Won</SelectItem>
              <SelectItem value="settled_lost">Lost</SelectItem>
              <SelectItem value="settled_void">Void</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-slate-400 mb-2 block">Form Label</label>
          <Input
            value={form.form_label}
            onChange={(e) => setForm({...form, form_label: e.target.value})}
            className="bg-slate-800 border-slate-700"
            placeholder="Hot, Solid, Cold..."
          />
        </div>
        <div>
          <label className="text-sm text-slate-400 mb-2 block">Weather Label</label>
          <Input
            value={form.weather_label}
            onChange={(e) => setForm({...form, weather_label: e.target.value})}
            className="bg-slate-800 border-slate-700"
            placeholder="Calm, Windy..."
          />
        </div>
      </div>

      <div>
        <label className="text-sm text-slate-400 mb-2 block">AI Analysis</label>
        <Textarea
          value={form.ai_analysis_paragraph}
          onChange={(e) => setForm({...form, ai_analysis_paragraph: e.target.value})}
          className="bg-slate-800 border-slate-700 h-32"
        />
      </div>

      <div>
        <label className="text-sm text-slate-400 mb-2 block">Affiliate Link Override</label>
        <Input
          value={form.affiliate_link_override}
          onChange={(e) => setForm({...form, affiliate_link_override: e.target.value})}
          className="bg-slate-800 border-slate-700"
          placeholder="https://..."
        />
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button variant="outline" onClick={onCancel} className="border-slate-600">
          Cancel
        </Button>
        <Button onClick={() => onSave(form)} className="bg-emerald-500 hover:bg-emerald-600">
          Save Changes
        </Button>
      </div>
    </div>
  );
}

function ProviderEditForm({ provider, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: provider.name || '',
    slug: provider.slug || '',
    logo_url: provider.logo_url || '',
    affiliate_base_url: provider.affiliate_base_url || '',
    priority: provider.priority || 10,
    enabled: provider.enabled !== false
  });

  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-slate-400 mb-2 block">Name</label>
          <Input
            value={form.name}
            onChange={(e) => setForm({...form, name: e.target.value})}
            className="bg-slate-800 border-slate-700"
          />
        </div>
        <div>
          <label className="text-sm text-slate-400 mb-2 block">Slug</label>
          <Input
            value={form.slug}
            onChange={(e) => setForm({...form, slug: e.target.value})}
            className="bg-slate-800 border-slate-700"
          />
        </div>
      </div>

      <div>
        <label className="text-sm text-slate-400 mb-2 block">Logo URL</label>
        <Input
          value={form.logo_url}
          onChange={(e) => setForm({...form, logo_url: e.target.value})}
          className="bg-slate-800 border-slate-700"
        />
      </div>

      <div>
        <label className="text-sm text-slate-400 mb-2 block">Affiliate Base URL</label>
        <Input
          value={form.affiliate_base_url}
          onChange={(e) => setForm({...form, affiliate_base_url: e.target.value})}
          className="bg-slate-800 border-slate-700"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-slate-400 mb-2 block">Priority</label>
          <Input
            type="number"
            value={form.priority}
            onChange={(e) => setForm({...form, priority: parseInt(e.target.value)})}
            className="bg-slate-800 border-slate-700"
          />
        </div>
        <div className="flex items-center justify-between pt-6">
          <span className="text-sm text-slate-400">Enabled</span>
          <Switch
            checked={form.enabled}
            onCheckedChange={(v) => setForm({...form, enabled: v})}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button variant="outline" onClick={onCancel} className="border-slate-600">
          Cancel
        </Button>
        <Button onClick={() => onSave(form)} className="bg-emerald-500 hover:bg-emerald-600">
          {provider.id ? 'Save Changes' : 'Create Provider'}
        </Button>
      </div>
    </div>
  );
}

function MembershipEditForm({ membership, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: membership.name || '',
    description: membership.description || '',
    price: membership.price || 0,
    billing_period: membership.billing_period || 'monthly',
    features: membership.features || [],
    badges: membership.badges || [],
    enabled: membership.enabled !== false
  });

  const [newFeature, setNewFeature] = useState('');
  const [generatingDescription, setGeneratingDescription] = useState(false);

  const PREDEFINED_FEATURES = [
    'Unlimited bet tracking',
    'Premium AI analysis',
    'Early access to picks',
    'Exclusive tournament insights',
    'Real-time odds monitoring',
    'Advanced statistics',
    'Priority support',
    'HIO Challenge bonus entries',
    'Custom betting alerts',
    'Historical data access',
    'Expert commentary',
    'Mobile app access',
    'Ad-free experience',
    'Weekly strategy reports',
    'Live chat support'
  ];

  const BADGE_COLORS = [
    { value: 'emerald', label: 'Green', class: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    { value: 'blue', label: 'Blue', class: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    { value: 'purple', label: 'Purple', class: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    { value: 'amber', label: 'Amber', class: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    { value: 'rose', label: 'Rose', class: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
    { value: 'cyan', label: 'Cyan', class: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' }
  ];

  const generateDescription = async () => {
    setGeneratingDescription(true);
    try {
      const response = await api.integrations.Core.InvokeLLM({
        prompt: `Write a compelling 1-2 sentence description for a golf betting membership package called "${form.name}" that costs £${form.price}/${form.billing_period}. 
        
Features included: ${form.features.join(', ')}

Make it persuasive and professional. Focus on value and benefits.`,
        add_context_from_internet: false
      });
      
      setForm({...form, description: response.output || response});
    } catch (error) {
      console.error('Failed to generate description:', error);
    }
    setGeneratingDescription(false);
  };

  const addFeature = () => {
    if (newFeature.trim()) {
      setForm({...form, features: [...form.features, newFeature.trim()]});
      setNewFeature('');
    }
  };

  const addPredefinedFeature = (feature) => {
    if (!form.features.includes(feature)) {
      setForm({...form, features: [...form.features, feature]});
    }
  };

  const removeFeature = (idx) => {
    setForm({...form, features: form.features.filter((_, i) => i !== idx)});
  };

  const addBadge = () => {
    setForm({...form, badges: [...form.badges, { text: '', color: 'emerald' }]});
  };

  const updateBadge = (idx, field, value) => {
    const newBadges = [...form.badges];
    newBadges[idx][field] = value;
    setForm({...form, badges: newBadges});
  };

  const removeBadge = (idx) => {
    setForm({...form, badges: form.badges.filter((_, i) => i !== idx)});
  };

  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-slate-400 mb-2 block">Package Name</label>
          <Input
            value={form.name}
            onChange={(e) => setForm({...form, name: e.target.value})}
            className="bg-slate-800 border-slate-700"
            placeholder="Premium"
          />
        </div>
        <div>
          <label className="text-sm text-slate-400 mb-2 block">Billing Period</label>
          <Select
            value={form.billing_period}
            onValueChange={(v) => setForm({...form, billing_period: v})}
          >
            <SelectTrigger className="bg-slate-800 border-slate-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
              <SelectItem value="lifetime">Lifetime</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className="text-sm text-slate-400 mb-2 block">Price (£)</label>
        <Input
          type="number"
          step="0.01"
          value={form.price}
          onChange={(e) => setForm({...form, price: parseFloat(e.target.value)})}
          className="bg-slate-800 border-slate-700"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm text-slate-400">Description</label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={generateDescription}
            disabled={generatingDescription || !form.name || form.features.length === 0}
            className="text-xs border-slate-600"
          >
            {generatingDescription ? (
              <>
                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <RefreshCw className="w-3 h-3 mr-1" />
                Auto Generate
              </>
            )}
          </Button>
        </div>
        <Textarea
          value={form.description}
          onChange={(e) => setForm({...form, description: e.target.value})}
          className="bg-slate-800 border-slate-700 h-20"
          placeholder="Perfect for serious bettors"
        />
      </div>

      <div>
        <label className="text-sm text-slate-400 mb-2 block">Features</label>
        
        {/* Pre-defined features dropdown */}
        <div className="mb-3">
          <Select onValueChange={addPredefinedFeature}>
            <SelectTrigger className="bg-slate-800 border-slate-700">
              <SelectValue placeholder="Add from pre-defined features..." />
            </SelectTrigger>
            <SelectContent>
              {PREDEFINED_FEATURES.filter(f => !form.features.includes(f)).map(feature => (
                <SelectItem key={feature} value={feature}>{feature}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Selected features */}
        <div className="space-y-2 mb-3">
          {form.features.map((feature, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-slate-800/50 rounded-lg p-2">
              <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span className="text-sm text-white flex-1">{feature}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeFeature(idx)}
                className="text-slate-400 hover:text-red-400 h-6 w-6 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* Custom feature input */}
        <div className="flex gap-2">
          <Input
            value={newFeature}
            onChange={(e) => setNewFeature(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addFeature()}
            className="bg-slate-800 border-slate-700"
            placeholder="Or add custom feature..."
          />
          <Button
            onClick={addFeature}
            variant="outline"
            className="border-slate-600"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm text-slate-400">Badges</label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addBadge}
            className="text-xs border-slate-600"
          >
            <Plus className="w-3 h-3 mr-1" />
            Add Badge
          </Button>
        </div>
        
        <div className="space-y-2">
          {form.badges.map((badge, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-slate-800/50 rounded-lg p-2">
              <Input
                value={badge.text}
                onChange={(e) => updateBadge(idx, 'text', e.target.value)}
                placeholder="Badge text..."
                className="bg-slate-700 border-slate-600 text-sm"
              />
              <Select
                value={badge.color}
                onValueChange={(v) => updateBadge(idx, 'color', v)}
              >
                <SelectTrigger className="bg-slate-700 border-slate-600 w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BADGE_COLORS.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeBadge(idx)}
                className="text-slate-400 hover:text-red-400 h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <span className="text-sm text-slate-400">Enabled</span>
        <Switch
          checked={form.enabled}
          onCheckedChange={(v) => setForm({...form, enabled: v})}
        />
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button variant="outline" onClick={onCancel} className="border-slate-600">
          Cancel
        </Button>
        <Button onClick={() => onSave(form)} className="bg-emerald-500 hover:bg-emerald-600">
          {membership.id ? 'Save Changes' : 'Create Package'}
        </Button>
      </div>
    </div>
  );
}