import React from 'react';
import { motion } from 'framer-motion';

export default function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  action 
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
    >
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-slate-500" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-slate-400 text-sm max-w-sm mb-6">{description}</p>
      {action}
    </motion.div>
  );
}