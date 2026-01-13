import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { motion } from 'framer-motion';
import { 
  User, 
  Settings, 
  Bell, 
  Shield, 
  LogOut, 
  Check,
  ChevronRight,
  Target,
  TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import LoadingSpinner from '@/components/ui/LoadingSpinner';

const tours = [
  { id: 'PGA', name: 'PGA Tour' },
  { id: 'DPWT', name: 'DP World Tour' },
  { id: 'LPGA', name: 'LPGA Tour' },
  { id: 'LIV', name: 'LIV Golf' },
  { id: 'KFT', name: 'Korn Ferry Tour' }
];

export default function Profile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (e) {
        base44.auth.redirectToLogin();
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  const updateMutation = useMutation({
    mutationFn: (data) => base44.auth.updateMe(data),
    onSuccess: (updatedUser) => {
      setUser(prev => ({ ...prev, ...updatedUser }));
    }
  });

  const handleTourToggle = (tourId) => {
    const currentTours = user.favorite_tours || [];
    const newTours = currentTours.includes(tourId)
      ? currentTours.filter(t => t !== tourId)
      : [...currentTours, tourId];
    updateMutation.mutate({ favorite_tours: newTours });
  };

  const handleLogout = () => {
    base44.auth.logout();
  };

  if (loading) {
    return <LoadingSpinner text="Loading profile..." />;
  }

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
            <span className="text-2xl font-bold text-white">
              {user.full_name?.[0] || user.email?.[0] || 'U'}
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {user.full_name || 'User'}
            </h1>
            <p className="text-slate-400">{user.email}</p>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4 text-center">
          <div className="text-2xl font-bold text-white">{user.total_bets_placed || 0}</div>
          <div className="text-sm text-slate-400">Bets Placed</div>
        </div>
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4 text-center">
          <div className="text-2xl font-bold text-emerald-400">{user.total_wins || 0}</div>
          <div className="text-sm text-slate-400">Winners</div>
        </div>
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4 text-center">
          <div className="text-2xl font-bold text-amber-400">{user.hio_total_points || 0}</div>
          <div className="text-sm text-slate-400">HIO Points</div>
        </div>
      </div>

      {/* Settings Sections */}
      <div className="space-y-6">
        {/* Tour Preferences */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-800/30 rounded-2xl border border-slate-700/50 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Favorite Tours</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {tours.map(tour => (
              <button
                key={tour.id}
                onClick={() => handleTourToggle(tour.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  (user.favorite_tours || []).includes(tour.id)
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                    : 'bg-slate-700/50 text-slate-400 border border-slate-600 hover:border-slate-500'
                }`}
              >
                {tour.name}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Risk Appetite */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-slate-800/30 rounded-2xl border border-slate-700/50 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Risk Appetite</h2>
          </div>
          <Select
            value={user.risk_appetite || 'balanced'}
            onValueChange={(v) => updateMutation.mutate({ risk_appetite: v })}
          >
            <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="conservative">Conservative (Par Bets focus)</SelectItem>
              <SelectItem value="balanced">Balanced (All tiers)</SelectItem>
              <SelectItem value="aggressive">Aggressive (Eagle Bets focus)</SelectItem>
            </SelectContent>
          </Select>
        </motion.div>

        {/* Notifications */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-800/30 rounded-2xl border border-slate-700/50 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Notifications</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white">Push Notifications</div>
                <div className="text-sm text-slate-400">Get notified about new picks</div>
              </div>
              <Switch
                checked={user.notifications_enabled !== false}
                onCheckedChange={(v) => updateMutation.mutate({ notifications_enabled: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white">Email Updates</div>
                <div className="text-sm text-slate-400">Weekly digest of picks</div>
              </div>
              <Switch
                checked={user.email_notifications !== false}
                onCheckedChange={(v) => updateMutation.mutate({ email_notifications: v })}
              />
            </div>
          </div>
        </motion.div>

        {/* Admin Link */}
        {user.role === 'admin' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Link
              to={createPageUrl('Admin')}
              className="flex items-center justify-between bg-gradient-to-r from-violet-500/20 to-purple-500/10 rounded-2xl border border-violet-500/30 p-5 hover:border-violet-500/50 transition-all"
            >
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 text-violet-400" />
                <div>
                  <div className="font-medium text-white">Admin Dashboard</div>
                  <div className="text-sm text-slate-400">Manage bets, providers, and content</div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-violet-400" />
            </Link>
          </motion.div>
        )}

        {/* Responsible Gambling */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-slate-800/30 rounded-2xl border border-slate-700/50 p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-white">Responsible Gambling</h2>
          </div>
          <p className="text-slate-400 text-sm mb-4">
            If gambling stops being fun, take a break. For support, visit{' '}
            <a href="https://www.begambleaware.org" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">
              BeGambleAware.org
            </a>
          </p>
        </motion.div>

        {/* Logout */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <Button
            variant="outline"
            onClick={handleLogout}
            className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </motion.div>
      </div>
    </div>
  );
}