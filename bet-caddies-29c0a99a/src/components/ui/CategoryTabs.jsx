import React from 'react';
import { motion } from 'framer-motion';

const categories = [
  { id: 'par', label: 'Par Bets', odds: '5/1 & Under', color: 'emerald' },
  { id: 'birdie', label: 'Birdie Bets', odds: '6/1 - 10/1', color: 'amber' },
  { id: 'eagle', label: 'Eagle Bets', odds: '11/1+', color: 'violet' }
];

const colorClasses = {
  emerald: {
    bg: 'from-emerald-500/30 to-emerald-600/20',
    border: 'border-emerald-500/50',
    text: 'text-emerald-400',
    glow: 'shadow-emerald-500/20'
  },
  amber: {
    bg: 'from-amber-500/30 to-amber-600/20',
    border: 'border-amber-500/50',
    text: 'text-amber-400',
    glow: 'shadow-amber-500/20'
  },
  violet: {
    bg: 'from-violet-500/30 to-violet-600/20',
    border: 'border-violet-500/50',
    text: 'text-violet-400',
    glow: 'shadow-violet-500/20'
  }
};

export default function CategoryTabs({ selected, onChange, counts = {} }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {categories.map((cat) => {
        const isSelected = selected === cat.id;
        const colors = colorClasses[cat.color];
        
        return (
          <button
            key={cat.id}
            onClick={() => onChange(cat.id)}
            className={`relative rounded-xl p-4 text-left transition-all ${
              isSelected 
                ? `bg-gradient-to-br ${colors.bg} border ${colors.border} shadow-lg ${colors.glow}`
                : 'bg-slate-800/30 border border-slate-700/50 hover:border-slate-600'
            }`}
          >
            <div className={`font-semibold ${isSelected ? colors.text : 'text-white'}`}>
              {cat.label}
            </div>
            <div className="text-xs text-slate-500 mt-1">{cat.odds}</div>
            {counts[cat.id] !== undefined && (
              <div className={`absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                isSelected ? `${colors.bg} ${colors.text}` : 'bg-slate-700 text-slate-300'
              }`}>
                {counts[cat.id]}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}