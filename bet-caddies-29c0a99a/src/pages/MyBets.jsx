import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { api } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { 
  List, 
  Check, 
  X, 
  Clock, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Trash2,
  Edit2,
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import EmptyState from '@/components/ui/EmptyState';

const statusConfig = {
  added: { label: 'Added', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', icon: Clock },
  placed: { label: 'Placed', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Check },
  won: { label: 'Won', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: TrendingUp },
  lost: { label: 'Lost', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: TrendingDown },
  void: { label: 'Void', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: X },
  push: { label: 'Push', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: Clock }
};

export default function MyBets() {
  const [user, setUser] = useState(null);
  const [editingBet, setEditingBet] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [filterStatus, setFilterStatus] = useState('all');
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await api.auth.me();
        setUser(userData);
      } catch (e) {
        api.auth.redirectToLogin();
      }
    };
    loadUser();
  }, []);

  const { data: userBets = [], isLoading: betsLoading } = useQuery({
    queryKey: ['userBets', user?.email],
    queryFn: () => base44.entities.UserBet.filter({ created_by: user.email }, '-created_date', 200),
    enabled: !!user
  });

  const { data: golfBets = [] } = useQuery({
    queryKey: ['allGolfBets'],
    queryFn: () => base44.entities.GolfBet.list('-created_date', 200),
    enabled: !!user
  });

  const updateBetMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.UserBet.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userBets'] });
      setEditingBet(null);
    }
  });

  const deleteBetMutation = useMutation({
    mutationFn: (id) => base44.entities.UserBet.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['userBets'] })
  });

  const golfBetsMap = new Map(golfBets.map(gb => [gb.id, gb]));

  const enrichedBets = userBets.map(ub => ({
    ...ub,
    golfBet: golfBetsMap.get(ub.golf_bet_id)
  })).filter(ub => ub.golfBet);

  const filteredBets = filterStatus === 'all' 
    ? enrichedBets 
    : enrichedBets.filter(b => b.status === filterStatus);

  // Stats
  const stats = {
    total: enrichedBets.length,
    placed: enrichedBets.filter(b => b.status === 'placed').length,
    won: enrichedBets.filter(b => b.status === 'won').length,
    lost: enrichedBets.filter(b => b.status === 'lost').length,
    totalStaked: enrichedBets.filter(b => b.stake).reduce((sum, b) => sum + (b.stake || 0), 0),
    totalReturn: enrichedBets.filter(b => b.actual_return).reduce((sum, b) => sum + (b.actual_return || 0), 0)
  };

  const openEditDialog = (bet) => {
    setEditingBet(bet);
    setEditForm({
      status: bet.status,
      stake: bet.stake || '',
      odds_taken: bet.odds_taken || '',
      notes: bet.notes || ''
    });
  };

  const handleSaveEdit = () => {
    const potentialReturn = editForm.stake && editForm.odds_taken 
      ? editForm.stake * editForm.odds_taken 
      : null;

    updateBetMutation.mutate({
      id: editingBet.id,
      data: {
        ...editForm,
        stake: editForm.stake ? parseFloat(editForm.stake) : null,
        odds_taken: editForm.odds_taken ? parseFloat(editForm.odds_taken) : null,
        potential_return: potentialReturn,
        placed_at: editForm.status === 'placed' ? new Date().toISOString() : editingBet.placed_at
      }
    });
  };

  if (!user) {
    return <LoadingSpinner text="Loading..." />;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/30 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center">
            <List className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">My Bets</h1>
            <p className="text-slate-400">Track your selections and results</p>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
          <div className="text-2xl font-bold text-white">{stats.total}</div>
          <div className="text-sm text-slate-400">Total Bets</div>
        </div>
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
          <div className="text-2xl font-bold text-blue-400">{stats.placed}</div>
          <div className="text-sm text-slate-400">Placed</div>
        </div>
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
          <div className="text-2xl font-bold text-emerald-400">{stats.won}</div>
          <div className="text-sm text-slate-400">Won</div>
        </div>
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
          <div className="text-2xl font-bold text-red-400">{stats.lost}</div>
          <div className="text-sm text-slate-400">Lost</div>
        </div>
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
          <div className={`text-2xl font-bold ${stats.totalReturn - stats.totalStaked >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            ${(stats.totalReturn - stats.totalStaked).toFixed(2)}
          </div>
          <div className="text-sm text-slate-400">P/L</div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4 mb-6">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 bg-slate-800/50 border-slate-700 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="added">Added</SelectItem>
            <SelectItem value="placed">Placed</SelectItem>
            <SelectItem value="won">Won</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
            <SelectItem value="void">Void</SelectItem>
            <SelectItem value="push">Push</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bets List */}
      {betsLoading ? (
        <LoadingSpinner text="Loading your bets..." />
      ) : filteredBets.length === 0 ? (
        <EmptyState
          icon={List}
          title="No Bets Yet"
          description="Start adding bets from our picks to track them here."
          action={
            <Link to={createPageUrl('Home')}>
              <Button className="bg-emerald-500 hover:bg-emerald-600">
                <Plus className="w-4 h-4 mr-2" />
                Browse Picks
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredBets.map((bet, idx) => {
            const StatusIcon = statusConfig[bet.status]?.icon || Clock;
            const gb = bet.golfBet;

            return (
              <motion.div
                key={bet.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className={statusConfig[bet.status]?.color}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {statusConfig[bet.status]?.label}
                      </Badge>
                      <Badge variant="outline" className="bg-slate-700/50 text-slate-300 border-slate-600">
                        {gb?.tour}
                      </Badge>
                      <Badge variant="outline" className="bg-slate-700/50 text-slate-300 border-slate-600 capitalize">
                        {gb?.category}
                      </Badge>
                    </div>
                    <h3 className="text-lg font-semibold text-white truncate">
                      {gb?.selection_name}
                    </h3>
                    <p className="text-sm text-slate-400 truncate">
                      {gb?.bet_title} • {gb?.tournament_name}
                    </p>
                    
                    {(bet.stake || bet.odds_taken) && (
                      <div className="flex items-center gap-4 mt-3 text-sm">
                        {bet.stake && (
                          <div className="flex items-center gap-1 text-slate-300">
                            <DollarSign className="w-4 h-4 text-slate-500" />
                            <span>Stake: ${bet.stake}</span>
                          </div>
                        )}
                        {bet.odds_taken && (
                          <div className="text-slate-300">
                            Odds: {bet.odds_taken}
                          </div>
                        )}
                        {bet.potential_return && (
                          <div className="text-emerald-400">
                            Return: ${bet.potential_return.toFixed(2)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-right mr-4">
                      <div className="text-xl font-bold text-emerald-400">
                        {gb?.odds_display_best}
                      </div>
                      <div className="text-xs text-slate-500">Best odds</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(bet)}
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
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingBet} onOpenChange={() => setEditingBet(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Edit Bet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Status</label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm({...editForm, status: v})}>
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="added">Added</SelectItem>
                  <SelectItem value="placed">Placed</SelectItem>
                  <SelectItem value="won">Won</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                  <SelectItem value="void">Void</SelectItem>
                  <SelectItem value="push">Push</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Stake ($)</label>
              <Input
                type="number"
                value={editForm.stake}
                onChange={(e) => setEditForm({...editForm, stake: e.target.value})}
                className="bg-slate-800 border-slate-700"
                placeholder="Enter stake amount"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Odds Taken (decimal)</label>
              <Input
                type="number"
                step="0.01"
                value={editForm.odds_taken}
                onChange={(e) => setEditForm({...editForm, odds_taken: e.target.value})}
                className="bg-slate-800 border-slate-700"
                placeholder="e.g., 4.50"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Notes</label>
              <Input
                value={editForm.notes}
                onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
                className="bg-slate-800 border-slate-700"
                placeholder="Optional notes"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setEditingBet(null)} className="border-slate-600">
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} className="bg-emerald-500 hover:bg-emerald-600">
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}