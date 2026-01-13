import React from 'react';
import { motion } from 'framer-motion';

export default function LoadingSpinner({ size = 'md', text = 'Loading...' }) {
  const sizes = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16'
  };

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <motion.div
        className={`${sizes[size]} border-2 border-emerald-500/30 border-t-emerald-500 rounded-full`}
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
      {text && (
        <p className="mt-4 text-slate-400 text-sm">{text}</p>
      )}
    </div>
  );
}