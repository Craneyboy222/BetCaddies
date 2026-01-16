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
  const [editingUser, setEditingUser] = useState(null);
  const [creatingUser, setCreatingUser] = useState(false);
  const [impersonationResult, setImpersonationResult] = useState(null);

  const [editingTourEvent, setEditingTourEvent] = useState(null);
  const [viewingOddsEventId, setViewingOddsEventId] = useState(null);
  const [editingOddsOffer, setEditingOddsOffer] = useState(null);
  const [oddsMarketIdFilter, setOddsMarketIdFilter] = useState('');
  const [oddsOffersLimit, setOddsOffersLimit] = useState(200);

  const [contentKey, setContentKey] = useState('home');
  const [contentDraft, setContentDraft] = useState(null);
  const [viewingAuditLog, setViewingAuditLog] = useState(null);

  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      console.log('Loading admin user...')
      try {
        console.log('Calling api.auth.me()...')
        const userData = await api.auth.me();
        console.log('Auth response:', userData)
        if (userData.role !== 'admin') {
          console.log('User is not admin, redirecting to home')
          window.location.href = '/';
          return;
        }
        console.log('Setting user data:', userData)
        setUser(userData);
      } catch (e) {
        console.error('Auth error:', e)
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

  const { data: siteContentItems = [], isLoading: siteContentLoading } = useQuery({
    queryKey: ['siteContentAdmin'],
    queryFn: () => api.entities.SiteContent.list()
  });

  const { data: auditLogs = [], isLoading: auditLogsLoading } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: () => api.entities.AuditLog.list(200)
  });

  const { data: memberships = [] } = useQuery({
    queryKey: ['memberships'],
    queryFn: () => api.entities.MembershipPackage.list('price', 50)
  });

  const { data: tourEvents = [], isLoading: tourEventsLoading } = useQuery({
    queryKey: ['tourEvents'],
    queryFn: () => api.entities.TourEvent.list('-start_date', 50)
  });

  const { data: oddsEvents = [], isLoading: oddsEventsLoading } = useQuery({
    queryKey: ['oddsEvents'],
    queryFn: () => api.entities.OddsEvent.list('-fetched_at', 50)
  });

  const { data: oddsOffers = [], isLoading: oddsOffersLoading } = useQuery({
    queryKey: ['oddsOffers', oddsMarketIdFilter, oddsOffersLimit],
    queryFn: () => api.entities.OddsOffer.list({
      odds_market_id: oddsMarketIdFilter?.trim() ? oddsMarketIdFilter.trim() : undefined,
      limit: oddsOffersLimit
    })
  });

  const { data: oddsEventDetails, isLoading: oddsEventDetailsLoading } = useQuery({
    queryKey: ['oddsEventDetails', viewingOddsEventId],
    enabled: !!viewingOddsEventId,
    queryFn: () => api.entities.OddsEvent.get(viewingOddsEventId)
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
      return response;
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

  const upsertSiteContentMutation = useMutation({
    mutationFn: ({ key, json }) => api.entities.SiteContent.upsert(key, json),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['siteContentAdmin'] });
    }
  });

  useEffect(() => {
    const defaultsByKey = {
      home: {
        hero: {
          title: 'Your Weekly Golf Picks',
          subtitle: '30 curated bets across 5 tours. Data-driven selections with transparent analysis and real value.'
        },
        features: [
          { title: 'Curated, weekly', body: 'Fresh picks every week across multiple tours.' },
          { title: 'Transparent analysis', body: 'Clear reasoning behind every recommendation.' },
          { title: 'Editorial control', body: 'Pinned picks and tier overrides for curation.' }
        ],
        faqs: [
          { q: 'Are these guaranteed winners?', a: 'No. We provide analysis and information — not guarantees.' },
          { q: 'How often do picks update?', a: 'Weekly (and occasionally mid-week if markets change).' }
        ]
      },
      join: {
        hero: {
          title: 'Welcome to Bet Caddies',
          subtitle: 'Your premium golf betting companion'
        }
      },
      memberships: {
        hero: {
          title: 'Premium Membership',
          subtitle: 'Unlock exclusive features and maximize your betting success'
        }
      }
    };

    const found = siteContentItems.find((i) => i.key === contentKey);
    setContentDraft(found?.json ?? defaultsByKey[contentKey] ?? {});
  }, [contentKey, siteContentItems]);

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

  const updateTourEventMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.TourEvent.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tourEvents'] });
      setEditingTourEvent(null);
    }
  });

  const deleteTourEventMutation = useMutation({
    mutationFn: (id) => api.entities.TourEvent.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tourEvents'] })
  });

  const updateOddsOfferMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.OddsOffer.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oddsOffers'] });
      setEditingOddsOffer(null);
    }
  });

  const deleteOddsOfferMutation = useMutation({
    mutationFn: (id) => api.entities.OddsOffer.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['oddsOffers'] })
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
          <TabsTrigger value="tour" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
            <Trophy className="w-4 h-4 mr-2" />
            Tour Events
          </TabsTrigger>
          <TabsTrigger value="odds" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
            <Eye className="w-4 h-4 mr-2" />
            Odds
          </TabsTrigger>
          <TabsTrigger value="providers" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
            <Building2 className="w-4 h-4 mr-2" />
            Providers
          </TabsTrigger>
          <TabsTrigger value="issues" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Issues
          </TabsTrigger>
          <TabsTrigger value="content" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
            <FileText className="w-4 h-4 mr-2" />
            Content
          </TabsTrigger>
          <TabsTrigger value="users" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
            <Users className="w-4 h-4 mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger value="audit" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
            <Clock className="w-4 h-4 mr-2" />
            Audit
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

        {/* Content Tab */}
        <TabsContent value="content">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-xl font-bold text-white">Site Content</h2>
                <p className="text-sm text-slate-400">Edit marketing copy, feature bullets, and FAQs.</p>
              </div>
              <div className="flex items-center gap-2">
                <Select value={contentKey} onValueChange={setContentKey}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 w-[220px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="home">home</SelectItem>
                    <SelectItem value="join">join</SelectItem>
                    <SelectItem value="memberships">memberships</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => upsertSiteContentMutation.mutate({ key: contentKey, json: contentDraft })}
                  disabled={upsertSiteContentMutation.isPending || !contentDraft}
                  className="bg-emerald-500 hover:bg-emerald-600"
                >
                  {upsertSiteContentMutation.isPending ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>

            {siteContentLoading ? (
              <LoadingSpinner />
            ) : (
              <SiteContentEditor
                contentKey={contentKey}
                value={contentDraft}
                onChange={setContentDraft}
              />
            )}
          </div>
        </TabsContent>

        {/* Tour Events Tab */}
        <TabsContent value="tour">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Tour Events ({tourEvents.length})</h2>
            </div>

            {tourEventsLoading ? (
              <LoadingSpinner />
            ) : tourEvents.length === 0 ? (
              <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-8 text-center">
                <p className="text-slate-400">No tour events found.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tourEvents.map(ev => (
                  <div
                    key={ev.id}
                    className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Badge variant="outline" className="bg-slate-700/50 text-slate-300 border-slate-600">
                            {ev.tour}
                          </Badge>
                          {ev.start_date && (
                            <span className="text-xs text-slate-500">
                              {new Date(ev.start_date).toLocaleDateString()} → {ev.end_date ? new Date(ev.end_date).toLocaleDateString() : '-'}
                            </span>
                          )}
                          {ev.run_id && (
                            <Badge variant="outline" className="bg-slate-700/50 text-slate-400 border-slate-600">
                              Run: {ev.run_id}
                            </Badge>
                          )}
                        </div>
                        <div className="font-semibold text-white">{ev.event_name}</div>
                        <div className="text-sm text-slate-400">
                          {ev.location || '—'}{ev.course_name ? ` • ${ev.course_name}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingTourEvent(ev)}
                          className="text-slate-400 hover:text-white"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteTourEventMutation.mutate(ev.id)}
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

        {/* Odds Tab */}
        <TabsContent value="odds">
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Odds Events ({oddsEvents.length})</h2>
              </div>

              {oddsEventsLoading ? (
                <LoadingSpinner />
              ) : oddsEvents.length === 0 ? (
                <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-8 text-center">
                  <p className="text-slate-400">No odds events found.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {oddsEvents.map(ev => (
                    <div
                      key={ev.id}
                      className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Badge variant="outline" className="bg-slate-700/50 text-slate-300 border-slate-600">
                              {ev.odds_provider}
                            </Badge>
                            <span className="text-xs text-slate-500">Markets: {ev.markets_count || 0}</span>
                            {ev.fetched_at && (
                              <span className="text-xs text-slate-500">Fetched: {new Date(ev.fetched_at).toLocaleString()}</span>
                            )}
                          </div>
                          <div className="font-semibold text-white">{ev.event_name || '—'}</div>
                          <div className="text-sm text-slate-400">
                            {ev.tour || '—'} • External ID: {ev.external_event_id || '—'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setViewingOddsEventId(ev.id)}
                            className="text-slate-400 hover:text-white"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <h2 className="text-xl font-bold text-white">Odds Offers ({oddsOffers.length})</h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <Input
                    value={oddsMarketIdFilter}
                    onChange={(e) => setOddsMarketIdFilter(e.target.value)}
                    placeholder="Filter by odds_market_id (optional)"
                    className="w-80 bg-slate-800/50 border-slate-700 text-white"
                  />
                  <Input
                    value={String(oddsOffersLimit)}
                    onChange={(e) => setOddsOffersLimit(Number(e.target.value || 200))}
                    placeholder="Limit"
                    className="w-24 bg-slate-800/50 border-slate-700 text-white"
                  />
                </div>
              </div>

              {oddsOffersLoading ? (
                <LoadingSpinner />
              ) : oddsOffers.length === 0 ? (
                <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-8 text-center">
                  <p className="text-slate-400">No odds offers found.</p>
                </div>
              ) : (
                <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700/50">
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Selection</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Book</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Odds</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Event</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Fetched</th>
                        <th className="text-right px-4 py-3 text-sm font-medium text-slate-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {oddsOffers.map((offer, idx) => (
                        <tr key={offer.id} className={idx !== oddsOffers.length - 1 ? 'border-b border-slate-700/30' : ''}>
                          <td className="px-4 py-3">
                            <div className="font-medium text-white">{offer.selection_name}</div>
                            <div className="text-xs text-slate-500">{offer.market_key || '—'}</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-300">{offer.bookmaker || '—'}</td>
                          <td className="px-4 py-3 text-sm text-slate-300">
                            {offer.odds_display || offer.odds_decimal || '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-400">
                            {offer.event_name || '—'}
                            <div className="text-xs text-slate-500">{offer.tour || '—'}</div>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {offer.fetched_at ? new Date(offer.fetched_at).toLocaleString() : '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingOddsOffer(offer)}
                                className="text-slate-400 hover:text-white"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteOddsOfferMutation.mutate(offer.id)}
                                className="text-slate-400 hover:text-red-400"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
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
                          {bet.pinned && (
                            <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                              Pinned
                            </Badge>
                          )}
                          {bet.tier_override && (
                            <Badge variant="outline" className="bg-violet-500/20 text-violet-400 border-violet-500/30">
                              Tier: {String(bet.tier_override).toUpperCase()}
                            </Badge>
                          )}
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
        </TabsContent>

        {/* Audit Tab */}
        <TabsContent value="audit">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Audit Logs</h2>
              <Button
                variant="outline"
                className="border-slate-600"
                onClick={() => queryClient.invalidateQueries({ queryKey: ['auditLogs'] })}
              >
                Refresh
              </Button>
            </div>

            {auditLogsLoading ? (
              <LoadingSpinner />
            ) : auditLogs.length === 0 ? (
              <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-8 text-center">
                <p className="text-slate-400">No audit logs yet.</p>
              </div>
            ) : (
              <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700/50">
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Time</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Action</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Actor</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Entity</th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-slate-400">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((l, idx) => (
                      <tr key={l.id} className={idx !== auditLogs.length - 1 ? 'border-b border-slate-700/30' : ''}>
                        <td className="px-4 py-3 text-sm text-slate-400">
                          {l.created_at ? new Date(l.created_at).toLocaleString() : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-white">{l.action}</td>
                        <td className="px-4 py-3 text-sm text-slate-300">
                          {l.actor_email || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-300">
                          {l.entity_type || '—'}{l.entity_id ? ` • ${l.entity_id}` : ''}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-400 hover:text-white"
                            onClick={() => setViewingAuditLog(l)}
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
                Token for: <span className="text-white">{impersonationResult.user?.email || '—'}</span>
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

      {/* View Audit Log Dialog */}
      <Dialog open={!!viewingAuditLog} onOpenChange={() => setViewingAuditLog(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
          </DialogHeader>
          {viewingAuditLog && (
            <AuditLogDetailsView entry={viewingAuditLog} />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Tour Event Dialog */}
      <Dialog open={!!editingTourEvent} onOpenChange={() => setEditingTourEvent(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Tour Event</DialogTitle>
          </DialogHeader>
          {editingTourEvent && (
            <TourEventEditForm
              event={editingTourEvent}
              onSave={(data) => updateTourEventMutation.mutate({ id: editingTourEvent.id, data })}
              onCancel={() => setEditingTourEvent(null)}
              isSaving={updateTourEventMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* View Odds Event Dialog */}
      <Dialog open={!!viewingOddsEventId} onOpenChange={() => setViewingOddsEventId(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Odds Event Details</DialogTitle>
          </DialogHeader>
          {oddsEventDetailsLoading ? (
            <LoadingSpinner />
          ) : oddsEventDetails ? (
            <OddsEventDetailsView oddsEvent={oddsEventDetails} />
          ) : (
            <div className="text-slate-400">No details found.</div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Odds Offer Dialog */}
      <Dialog open={!!editingOddsOffer} onOpenChange={() => setEditingOddsOffer(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Odds Offer</DialogTitle>
          </DialogHeader>
          {editingOddsOffer && (
            <OddsOfferEditForm
              offer={editingOddsOffer}
              onSave={(data) => updateOddsOfferMutation.mutate({ id: editingOddsOffer.id, data })}
              onCancel={() => setEditingOddsOffer(null)}
              isSaving={updateOddsOfferMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TourEventEditForm({ event, onSave, onCancel, isSaving }) {
  const [form, setForm] = useState({
    tour: event.tour || '',
    event_name: event.event_name || '',
    start_date: event.start_date ? new Date(event.start_date).toISOString().slice(0, 16) : '',
    end_date: event.end_date ? new Date(event.end_date).toISOString().slice(0, 16) : '',
    location: event.location || '',
    course_name: event.course_name || '',
    course_lat: event.course_lat ?? '',
    course_lng: event.course_lng ?? '',
    source_urls: Array.isArray(event.source_urls) ? event.source_urls.join('\n') : ''
  });

  const toIsoStringOrUndefined = (value) => {
    if (!value) return undefined
    const dt = new Date(value)
    if (Number.isNaN(dt.getTime())) return undefined
    return dt.toISOString()
  }

  const parseNumberOr = (value, fallback) => {
    if (value === '' || value === undefined || value === null) return fallback
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      tour: form.tour,
      event_name: form.event_name,
      start_date: toIsoStringOrUndefined(form.start_date),
      end_date: toIsoStringOrUndefined(form.end_date),
      location: form.location || undefined,
      course_name: form.course_name || undefined,
      course_lat: form.course_lat === '' ? null : parseNumberOr(form.course_lat, null),
      course_lng: form.course_lng === '' ? null : parseNumberOr(form.course_lng, null),
      source_urls: form.source_urls
        ? form.source_urls.split('\n').map(s => s.trim()).filter(Boolean)
        : []
    }
    onSave(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-slate-300 mb-1">Tour</label>
          <Input
            value={form.tour}
            onChange={(e) => setForm({ ...form, tour: e.target.value })}
            className="bg-slate-800/50 border-slate-700 text-white"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">Event Name</label>
          <Input
            value={form.event_name}
            onChange={(e) => setForm({ ...form, event_name: e.target.value })}
            className="bg-slate-800/50 border-slate-700 text-white"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">Start (local)</label>
          <Input
            type="datetime-local"
            value={form.start_date}
            onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            className="bg-slate-800/50 border-slate-700 text-white"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">End (local)</label>
          <Input
            type="datetime-local"
            value={form.end_date}
            onChange={(e) => setForm({ ...form, end_date: e.target.value })}
            className="bg-slate-800/50 border-slate-700 text-white"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">Location</label>
          <Input
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="bg-slate-800/50 border-slate-700 text-white"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">Course Name</label>
          <Input
            value={form.course_name}
            onChange={(e) => setForm({ ...form, course_name: e.target.value })}
            className="bg-slate-800/50 border-slate-700 text-white"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">Course Lat</label>
          <Input
            value={String(form.course_lat)}
            onChange={(e) => setForm({ ...form, course_lat: e.target.value })}
            className="bg-slate-800/50 border-slate-700 text-white"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">Course Lng</label>
          <Input
            value={String(form.course_lng)}
            onChange={(e) => setForm({ ...form, course_lng: e.target.value })}
            className="bg-slate-800/50 border-slate-700 text-white"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm text-slate-300 mb-1">Source URLs (one per line)</label>
        <Textarea
          value={form.source_urls}
          onChange={(e) => setForm({ ...form, source_urls: e.target.value })}
          className="bg-slate-800/50 border-slate-700 text-white min-h-[120px]"
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} className="text-slate-300 hover:text-white">
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving} className="bg-emerald-500 hover:bg-emerald-600">
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </form>
  );
}

function OddsOfferEditForm({ offer, onSave, onCancel, isSaving }) {
  const [form, setForm] = useState({
    odds_decimal: offer.odds_decimal ?? '',
    odds_display: offer.odds_display ?? '',
    deep_link: offer.deep_link ?? ''
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave({
      odds_decimal: form.odds_decimal === '' ? undefined : Number(form.odds_decimal),
      odds_display: form.odds_display === '' ? undefined : form.odds_display,
      deep_link: form.deep_link === '' ? '' : form.deep_link
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
        <div className="font-medium text-white">{offer.selection_name}</div>
        <div className="text-sm text-slate-400">{offer.bookmaker || '—'} • {offer.market_key || '—'}</div>
        <div className="text-xs text-slate-500">{offer.event_name || '—'}</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-slate-300 mb-1">Odds (decimal)</label>
          <Input
            value={String(form.odds_decimal)}
            onChange={(e) => setForm({ ...form, odds_decimal: e.target.value })}
            className="bg-slate-800/50 border-slate-700 text-white"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">Odds (display)</label>
          <Input
            value={form.odds_display}
            onChange={(e) => setForm({ ...form, odds_display: e.target.value })}
            className="bg-slate-800/50 border-slate-700 text-white"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm text-slate-300 mb-1">Deep Link (optional)</label>
        <Input
          value={form.deep_link}
          onChange={(e) => setForm({ ...form, deep_link: e.target.value })}
          className="bg-slate-800/50 border-slate-700 text-white"
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} className="text-slate-300 hover:text-white">
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving} className="bg-emerald-500 hover:bg-emerald-600">
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </form>
  )
}

function OddsEventDetailsView({ oddsEvent }) {
  const markets = Array.isArray(oddsEvent.markets) ? oddsEvent.markets : []
  return (
    <div className="space-y-4">
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="bg-slate-700/50 text-slate-300 border-slate-600">
            {oddsEvent.odds_provider}
          </Badge>
          <span className="text-xs text-slate-500">Markets: {markets.length}</span>
          {oddsEvent.fetched_at && (
            <span className="text-xs text-slate-500">Fetched: {new Date(oddsEvent.fetched_at).toLocaleString()}</span>
          )}
        </div>
        <div className="mt-2 font-semibold text-white">{oddsEvent.event_name || '—'}</div>
        <div className="text-sm text-slate-400">External ID: {oddsEvent.external_event_id || '—'}</div>
      </div>

      <div className="space-y-3">
        {markets.map((m) => (
          <div key={m.id} className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
            <div className="flex items-center justify-between">
              <div className="font-medium text-white">{m.market_key || 'Market'}</div>
              <div className="text-xs text-slate-500">Offers: {(m.offers || []).length}</div>
            </div>
            {(m.offers || []).length > 0 && (
              <div className="mt-3 space-y-2">
                {(m.offers || []).slice(0, 20).map(o => (
                  <div key={o.id} className="flex items-center justify-between text-sm">
                    <div className="text-slate-300 truncate pr-3">{o.selection_name}</div>
                    <div className="text-slate-400 flex-shrink-0">
                      {o.bookmaker || '—'} • {o.odds_display || o.odds_decimal || '—'}
                    </div>
                  </div>
                ))}
                {(m.offers || []).length > 20 && (
                  <div className="text-xs text-slate-500">Showing first 20 offers…</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {oddsEvent.raw && (
        <div>
          <div className="text-sm text-slate-300 mb-2">Raw JSON</div>
          <Textarea
            readOnly
            value={JSON.stringify(oddsEvent.raw, null, 2)}
            className="bg-slate-800/50 border-slate-700 text-white min-h-[220px]"
          />
        </div>
      )}
    </div>
  )
}

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
          placeholder="PGA, LIV, LPGA"
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
          {isSaving ? 'Creating…' : 'Create'}
        </Button>
      </div>
    </div>
  );
}

function SiteContentEditor({ contentKey, value, onChange }) {
  const [rawJson, setRawJson] = useState('');

  useEffect(() => {
    try {
      setRawJson(JSON.stringify(value ?? {}, null, 2));
    } catch (e) {
      setRawJson('');
    }
  }, [value]);

  const setHeroField = (field, nextValue) => {
    onChange({
      ...(value ?? {}),
      hero: {
        ...((value ?? {}).hero ?? {}),
        [field]: nextValue
      }
    });
  };

  const features = Array.isArray(value?.features) ? value.features : [];
  const faqs = Array.isArray(value?.faqs) ? value.faqs : [];

  return (
    <div className="space-y-6">
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
        <div className="text-sm text-slate-300 font-medium mb-3">Hero</div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-slate-400 mb-2 block">Title</label>
            <Input
              value={value?.hero?.title || ''}
              onChange={(e) => setHeroField('title', e.target.value)}
              className="bg-slate-800 border-slate-700"
            />
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-2 block">Subtitle</label>
            <Input
              value={value?.hero?.subtitle || ''}
              onChange={(e) => setHeroField('subtitle', e.target.value)}
              className="bg-slate-800 border-slate-700"
            />
          </div>
        </div>
      </div>

      {contentKey === 'home' && (
        <>
          <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-slate-300 font-medium">Feature Bullets</div>
              <Button
                variant="outline"
                className="border-slate-600"
                onClick={() => onChange({
                  ...(value ?? {}),
                  features: [...features, { title: '', body: '' }]
                })}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add
              </Button>
            </div>

            <div className="space-y-3">
              {features.length === 0 ? (
                <div className="text-sm text-slate-500">No feature bullets yet.</div>
              ) : (
                features.map((f, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-3 items-start">
                    <div className="col-span-4">
                      <Input
                        value={f?.title || ''}
                        onChange={(e) => {
                          const next = [...features];
                          next[idx] = { ...(next[idx] || {}), title: e.target.value };
                          onChange({ ...(value ?? {}), features: next });
                        }}
                        className="bg-slate-800 border-slate-700"
                        placeholder="Title"
                      />
                    </div>
                    <div className="col-span-7">
                      <Input
                        value={f?.body || ''}
                        onChange={(e) => {
                          const next = [...features];
                          next[idx] = { ...(next[idx] || {}), body: e.target.value };
                          onChange({ ...(value ?? {}), features: next });
                        }}
                        className="bg-slate-800 border-slate-700"
                        placeholder="Description"
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const next = features.filter((_, i) => i !== idx);
                          onChange({ ...(value ?? {}), features: next });
                        }}
                        className="text-slate-400 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-slate-300 font-medium">FAQs</div>
              <Button
                variant="outline"
                className="border-slate-600"
                onClick={() => onChange({
                  ...(value ?? {}),
                  faqs: [...faqs, { q: '', a: '' }]
                })}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add
              </Button>
            </div>

            <div className="space-y-3">
              {faqs.length === 0 ? (
                <div className="text-sm text-slate-500">No FAQs yet.</div>
              ) : (
                faqs.map((f, idx) => (
                  <div key={idx} className="space-y-2 border border-slate-700/50 rounded-lg p-3 bg-slate-900/30">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-slate-500">FAQ #{idx + 1}</div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const next = faqs.filter((_, i) => i !== idx);
                          onChange({ ...(value ?? {}), faqs: next });
                        }}
                        className="text-slate-400 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <Input
                      value={f?.q || ''}
                      onChange={(e) => {
                        const next = [...faqs];
                        next[idx] = { ...(next[idx] || {}), q: e.target.value };
                        onChange({ ...(value ?? {}), faqs: next });
                      }}
                      className="bg-slate-800 border-slate-700"
                      placeholder="Question"
                    />
                    <Textarea
                      value={f?.a || ''}
                      onChange={(e) => {
                        const next = [...faqs];
                        next[idx] = { ...(next[idx] || {}), a: e.target.value };
                        onChange({ ...(value ?? {}), faqs: next });
                      }}
                      className="bg-slate-800 border-slate-700 text-white min-h-[90px]"
                      placeholder="Answer"
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-slate-300 font-medium">Raw JSON</div>
          <Button
            variant="outline"
            className="border-slate-600"
            onClick={() => {
              try {
                const parsed = JSON.parse(rawJson || '{}');
                onChange(parsed);
              } catch (e) {
                alert('Invalid JSON');
              }
            }}
          >
            Apply JSON
          </Button>
        </div>
        <Textarea
          value={rawJson}
          onChange={(e) => setRawJson(e.target.value)}
          className="bg-slate-800/50 border-slate-700 text-white min-h-[220px]"
        />
      </div>
    </div>
  );
}

function AuditLogDetailsView({ entry }) {
  const before = entry.before_json ? JSON.stringify(entry.before_json, null, 2) : '';
  const after = entry.after_json ? JSON.stringify(entry.after_json, null, 2) : '';

  return (
    <div className="space-y-4 pt-2">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-slate-500">Time</div>
          <div className="text-sm text-slate-200">{entry.created_at ? new Date(entry.created_at).toLocaleString() : '—'}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Actor</div>
          <div className="text-sm text-slate-200">{entry.actor_email || '—'}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Action</div>
          <div className="text-sm text-slate-200">{entry.action || '—'}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Entity</div>
          <div className="text-sm text-slate-200">{entry.entity_type || '—'}{entry.entity_id ? ` • ${entry.entity_id}` : ''}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-sm text-slate-300 mb-2">Before</div>
          <Textarea readOnly value={before || '—'} className="bg-slate-800/50 border-slate-700 text-white min-h-[220px]" />
        </div>
        <div>
          <div className="text-sm text-slate-300 mb-2">After</div>
          <Textarea readOnly value={after || '—'} className="bg-slate-800/50 border-slate-700 text-white min-h-[220px]" />
        </div>
      </div>
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
    weather_label: bet.weather_label || '',
    pinned: !!bet.pinned,
    pin_order: bet.pin_order ?? '',
    tier_override: bet.tier_override || 'none'
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

      <div className="grid grid-cols-3 gap-4">
        <div className="flex items-center justify-between bg-slate-800/40 border border-slate-700/50 rounded-lg px-3 py-2">
          <span className="text-sm text-slate-300">Pinned</span>
          <Switch
            checked={!!form.pinned}
            onCheckedChange={(v) => setForm({ ...form, pinned: v })}
          />
        </div>
        <div>
          <label className="text-sm text-slate-400 mb-2 block">Pin Order</label>
          <Input
            type="number"
            min="0"
            value={form.pin_order}
            onChange={(e) => setForm({ ...form, pin_order: e.target.value })}
            className="bg-slate-800 border-slate-700"
            placeholder="(optional)"
          />
        </div>
        <div>
          <label className="text-sm text-slate-400 mb-2 block">Tier Override</label>
          <Select
            value={form.tier_override}
            onValueChange={(v) => setForm({ ...form, tier_override: v })}
          >
            <SelectTrigger className="bg-slate-800 border-slate-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="PAR">PAR</SelectItem>
              <SelectItem value="BIRDIE">BIRDIE</SelectItem>
              <SelectItem value="EAGLE">EAGLE</SelectItem>
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
        <Button
          onClick={() => onSave({
            ...form,
            tier_override: form.tier_override === 'none' ? null : form.tier_override,
            pin_order: form.pin_order === '' ? null : Number(form.pin_order)
          })}
          className="bg-emerald-500 hover:bg-emerald-600"
        >
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