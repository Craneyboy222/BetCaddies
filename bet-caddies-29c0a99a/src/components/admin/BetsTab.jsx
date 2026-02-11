import { useState } from 'react';
import { api } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Target, Edit2, Trash2, Archive, Star, ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { toast } from '@/components/ui/use-toast';

const TIER_CONFIG = [
  { key: 'par', label: 'PAR', description: 'Conservative picks', color: 'emerald', icon: '🟢' },
  { key: 'birdie', label: 'BIRDIE', description: 'Moderate value', color: 'blue', icon: '🔵' },
  { key: 'eagle', label: 'EAGLE', description: 'High value picks', color: 'violet', icon: '🟣' },
  { key: 'long_shots', label: 'LONGSHOTS', description: 'High risk / high reward', color: 'amber', icon: '🟡' },
  { key: 'uncategorized', label: 'UNCATEGORIZED', description: 'No tier assigned', color: 'slate', icon: '⚪' }
];

const colorMap = {
  emerald: { border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', text: 'text-emerald-400', headerBg: 'bg-emerald-500/20' },
  blue: { border: 'border-blue-500/30', bg: 'bg-blue-500/10', text: 'text-blue-400', headerBg: 'bg-blue-500/20' },
  violet: { border: 'border-violet-500/30', bg: 'bg-violet-500/10', text: 'text-violet-400', headerBg: 'bg-violet-500/20' },
  amber: { border: 'border-amber-500/30', bg: 'bg-amber-500/10', text: 'text-amber-400', headerBg: 'bg-amber-500/20' },
  slate: { border: 'border-slate-600/50', bg: 'bg-slate-700/10', text: 'text-slate-400', headerBg: 'bg-slate-700/30' }
};

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

export default function BetsTab() {
  const queryClient = useQueryClient();
  const [editingBet, setEditingBet] = useState(null);
  const [betShowArchived, setBetShowArchived] = useState(false);
  const [collapsedTiers, setCollapsedTiers] = useState({});

  // Query
  const { data: bets = [], isLoading: betsLoading } = useQuery({
    queryKey: ['allBets'],
    queryFn: () => api.entities.GolfBet.list('-created_date', 100)
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

  const archiveOldBetsMutation = useMutation({
    mutationFn: () => api.entities.GolfBet.archiveOldBets(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['allBets'] });
      toast({
        title: 'Old Bets Archived',
        description: data.message || `Archived ${data.archivedCount} bets from ${data.oldRunCount} old runs`
      });
    },
    onError: (error) => {
      toast({
        title: 'Archive Failed',
        description: error.message || 'Failed to archive old bets',
        variant: 'destructive'
      });
    }
  });

  const toggleFeaturedMutation = useMutation({
    mutationFn: ({ id, featured }) => api.entities.GolfBet.toggleFeatured(id, featured),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allBets'] });
    },
    onError: (error) => {
      toast({
        title: 'Toggle Failed',
        description: error.message || 'Failed to update featured status',
        variant: 'destructive'
      });
    }
  });

  const toggleListedMutation = useMutation({
    mutationFn: ({ id, listed }) => api.entities.GolfBet.toggleListed(id, listed),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allBets'] });
    },
    onError: (error) => {
      toast({
        title: 'Toggle Failed',
        description: error.message || 'Failed to update listed status',
        variant: 'destructive'
      });
    }
  });

  const filteredBets = betShowArchived ? bets : bets.filter(b => b.listed);

  const groupedBets = TIER_CONFIG.reduce((acc, tier) => {
    const tierBets = filteredBets.filter(b => {
      const betTier = (b.category || '').toLowerCase().replace(/[\s-]/g, '_');
      if (tier.key === 'uncategorized') {
        return !betTier || !['par', 'birdie', 'eagle', 'long_shots', 'longshots'].includes(betTier);
      }
      return betTier === tier.key || (tier.key === 'long_shots' && betTier === 'longshots');
    });
    acc[tier.key] = tierBets;
    return acc;
  }, {});

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-xl font-bold text-white">Manage Bets ({bets.length})</h2>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
              <Switch
                checked={betShowArchived}
                onCheckedChange={setBetShowArchived}
              />
              Show Unlisted
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => archiveOldBetsMutation.mutate()}
              disabled={archiveOldBetsMutation.isPending}
              className="bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30"
            >
              <Archive className="w-4 h-4 mr-2" />
              {archiveOldBetsMutation.isPending ? 'Archiving...' : 'Archive Old Bets'}
            </Button>
          </div>
        </div>

        {/* Summary stats */}
        {!betsLoading && (() => {
          const listedCount = bets.filter(b => b.listed).length;
          const featuredCount = bets.filter(b => b.featured).length;
          const unlistedCount = bets.filter(b => !b.listed).length;
          return (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-slate-800/30 rounded-lg border border-slate-700/50 p-3 text-center">
                <div className="text-2xl font-bold text-white">{bets.length}</div>
                <div className="text-xs text-slate-400">Total</div>
              </div>
              <div className="bg-emerald-500/10 rounded-lg border border-emerald-500/30 p-3 text-center">
                <div className="text-2xl font-bold text-emerald-400">{listedCount}</div>
                <div className="text-xs text-emerald-400/70">Listed (Tier Pages)</div>
              </div>
              <div className="bg-amber-500/10 rounded-lg border border-amber-500/30 p-3 text-center">
                <div className="text-2xl font-bold text-amber-400">{featuredCount}</div>
                <div className="text-xs text-amber-400/70">Featured (Homepage)</div>
              </div>
              <div className="bg-slate-500/10 rounded-lg border border-slate-500/30 p-3 text-center">
                <div className="text-2xl font-bold text-slate-400">{unlistedCount}</div>
                <div className="text-xs text-slate-400/70">Unlisted</div>
              </div>
              <div className="bg-blue-500/10 rounded-lg border border-blue-500/30 p-3 text-center">
                <div className="text-2xl font-bold text-blue-400">
                  {[...new Set(bets.filter(b => b.listed).map(b => b.tour).filter(Boolean))].length}
                </div>
                <div className="text-xs text-blue-400/70">Tours Active</div>
              </div>
            </div>
          );
        })()}

        {betsLoading ? (
          <LoadingSpinner />
        ) : (
          <div className="space-y-4">
            {TIER_CONFIG.map(tier => {
              const tierBets = groupedBets[tier.key] || [];
              if (tierBets.length === 0) return null;
              const isCollapsed = collapsedTiers[tier.key];
              const colors = colorMap[tier.color];
              const featuredInTier = tierBets.filter(b => b.featured).length;
              const listedInTier = tierBets.filter(b => b.listed).length;

              return (
                <div key={tier.key} className={`rounded-xl border ${colors.border} overflow-hidden`}>
                  {/* Tier header */}
                  <button
                    onClick={() => setCollapsedTiers(prev => ({ ...prev, [tier.key]: !prev[tier.key] }))}
                    className={`w-full flex items-center justify-between px-4 py-3 ${colors.headerBg} hover:opacity-90 transition-opacity`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{tier.icon}</span>
                      <div className="text-left">
                        <span className={`font-bold ${colors.text}`}>{tier.label}</span>
                        <span className="text-xs text-slate-400 ml-2">{tier.description}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={`${colors.bg} ${colors.text} ${colors.border}`}>
                        {tierBets.length} bets
                      </Badge>
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                        <Eye className="w-3 h-3 mr-1" />
                        {listedInTier} listed
                      </Badge>
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30">
                        <Star className="w-3 h-3 mr-1" />
                        {featuredInTier} featured
                      </Badge>
                      {isCollapsed ? (
                        <ChevronRight className={`w-5 h-5 ${colors.text}`} />
                      ) : (
                        <ChevronDown className={`w-5 h-5 ${colors.text}`} />
                      )}
                    </div>
                  </button>

                  {/* Tier bets */}
                  {!isCollapsed && (
                    <div className="divide-y divide-slate-700/30">
                      {tierBets.map(bet => (
                        <div
                          key={bet.id}
                          className={`px-4 py-3 flex items-center gap-4 ${
                            !bet.listed ? 'opacity-50 bg-slate-900/30' : 'bg-slate-800/20'
                          } hover:bg-slate-700/20 transition-colors`}
                        >
                          {/* Listed toggle (shown on tier pages + results) */}
                          <button
                            onClick={() => toggleListedMutation.mutate({ id: bet.id, listed: !bet.listed })}
                            disabled={toggleListedMutation.isPending}
                            title={bet.listed ? 'Remove from tier page' : 'Add to tier page'}
                            className={`flex-shrink-0 p-1.5 rounded-lg transition-colors ${
                              bet.listed
                                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                                : 'bg-slate-700/30 text-slate-500 hover:bg-slate-700/50 hover:text-slate-300'
                            }`}
                          >
                            {bet.listed ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </button>

                          {/* Featured toggle (shown on homepage) */}
                          <button
                            onClick={() => toggleFeaturedMutation.mutate({ id: bet.id, featured: !bet.featured })}
                            disabled={toggleFeaturedMutation.isPending}
                            title={bet.featured ? 'Remove from homepage' : 'Add to homepage'}
                            className={`flex-shrink-0 p-1.5 rounded-lg transition-colors ${
                              bet.featured
                                ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                                : 'bg-slate-700/30 text-slate-500 hover:bg-slate-700/50 hover:text-slate-300'
                            }`}
                          >
                            <Star className={`w-4 h-4 ${bet.featured ? 'fill-amber-400' : ''}`} />
                          </button>

                          {/* Bet info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-semibold text-white text-sm truncate">{bet.selection_name}</span>
                              {bet.listed && (
                                <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0">
                                  <Eye className="w-2.5 h-2.5 mr-0.5" />
                                  Listed
                                </Badge>
                              )}
                              {bet.featured && (
                                <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] px-1.5 py-0">
                                  <Star className="w-2.5 h-2.5 mr-0.5" />
                                  Featured
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 truncate">
                              {bet.bet_title} • {bet.tournament_name}
                            </div>
                          </div>

                          {/* Tour badge */}
                          {bet.tour && (
                            <Badge variant="outline" className="bg-slate-700/40 text-slate-300 border-slate-600 text-[10px] flex-shrink-0">
                              {bet.tour}
                            </Badge>
                          )}

                          {/* Market type */}
                          {bet.market_key && (
                            <span className="text-[10px] text-slate-500 flex-shrink-0 font-mono">
                              {bet.market_key}
                            </span>
                          )}

                          {/* Confidence */}
                          <div className="flex-shrink-0 text-xs text-slate-400 w-8 text-center" title="Confidence">
                            {bet.confidence_rating}/5
                          </div>

                          {/* Odds */}
                          <div className="flex-shrink-0 text-xs text-white font-mono w-12 text-right">
                            {bet.odds_display_best || '—'}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingBet(bet)}
                              className="text-slate-400 hover:text-white h-7 w-7"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteBetMutation.mutate(bet.id)}
                              className="text-slate-400 hover:text-red-400 h-7 w-7"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

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
    </>
  );
}
