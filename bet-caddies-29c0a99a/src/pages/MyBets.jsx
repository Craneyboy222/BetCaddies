import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { List, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/EmptyState';

export default function MyBets() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
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

      <EmptyState
        icon={List}
        title="Coming Soon"
        description="Bet tracking is being upgraded. Browse our picks in the meantime."
        action={
          <Link to={createPageUrl('Home')}>
            <Button className="bg-emerald-500 hover:bg-emerald-600">
              <Plus className="w-4 h-4 mr-2" />
              Browse Picks
            </Button>
          </Link>
        }
      />
    </div>
  );
}