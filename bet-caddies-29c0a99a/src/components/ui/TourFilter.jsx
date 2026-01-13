import React from 'react';
import { motion } from 'framer-motion';

const tours = [
  { id: 'all', label: 'All Tours' },
  { id: 'PGA', label: 'PGA Tour' },
  { id: 'DPWT', label: 'DP World' },
  { id: 'LPGA', label: 'LPGA' },
  { id: 'LIV', label: 'LIV Golf' },
  { id: 'KFT', label: 'Korn Ferry' }
];

export default function TourFilter({ selected, onChange }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {tours.map((tour) => (
        <button
          key={tour.id}
          onClick={() => onChange(tour.id)}
          className={`relative px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
            selected === tour.id
              ? 'text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          {selected === tour.id && (
            <motion.div
              layoutId="tourPill"
              className="absolute inset-0 bg-gradient-to-r from-emerald-500/30 to-teal-500/30 border border-emerald-500/50 rounded-full"
              transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
            />
          )}
          <span className="relative z-10">{tour.label}</span>
        </button>
      ))}
    </div>
  );
}