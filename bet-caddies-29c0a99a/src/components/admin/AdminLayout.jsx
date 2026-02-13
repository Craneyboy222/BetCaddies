import React from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  Target,
  Trophy,
  Eye,
  Building2,
  AlertTriangle,
  FileText,
  LayoutTemplate,
  Image,
  Users,
  Clock,
  CreditCard,
  Star,
  Shield,
  Tag,
  Megaphone,
  Settings,
  Activity,
  Mail,
  CalendarClock,
  Share2,
  Webhook,
  HeartPulse,
  Bell,
  ChevronRight
} from 'lucide-react';

const NAV_GROUPS = [
  {
    label: 'Dashboard',
    items: [
      { key: 'analytics', label: 'Analytics', icon: BarChart3 },
    ]
  },
  {
    label: 'Betting',
    items: [
      { key: 'runs', label: 'Pipeline Runs', icon: Clock },
      { key: 'bets', label: 'Bet Picks', icon: Target },
      { key: 'tour', label: 'Tour Events', icon: Trophy },
      { key: 'odds', label: 'Odds Data', icon: Eye },
      { key: 'providers', label: 'Providers', icon: Building2 },
      { key: 'hio', label: 'HIO Challenge', icon: Star },
    ]
  },
  {
    label: 'Commerce',
    items: [
      { key: 'memberships', label: 'Packages', icon: CreditCard },
      { key: 'subscriptions', label: 'Subscriptions', icon: Users },
      { key: 'payments', label: 'Payment Config', icon: Settings },
      { key: 'coupons', label: 'Coupons & Offers', icon: Tag },
      { key: 'referrals', label: 'Referrals', icon: Share2 },
    ]
  },
  {
    label: 'Content',
    items: [
      { key: 'pages', label: 'Pages', icon: LayoutTemplate },
      { key: 'content', label: 'Site Content', icon: FileText },
      { key: 'media', label: 'Media Library', icon: Image },
      { key: 'scheduled', label: 'Scheduled', icon: CalendarClock },
    ]
  },
  {
    label: 'Users & Access',
    items: [
      { key: 'users', label: 'Users', icon: Users },
      { key: 'access', label: 'Access Rules', icon: Shield },
    ]
  },
  {
    label: 'System',
    items: [
      { key: 'issues', label: 'Data Issues', icon: AlertTriangle },
      { key: 'audit', label: 'Audit Log', icon: Activity },
      { key: 'push', label: 'Push Notifications', icon: Bell },
      { key: 'emails', label: 'Email', icon: Mail },
      { key: 'webhooks', label: 'Webhooks', icon: Webhook },
      { key: 'health', label: 'System Health', icon: HeartPulse },
    ]
  }
];

export default function AdminLayout({ activeTab, setActiveTab, quickStats, children }) {
  return (
    <div className="flex min-h-screen bg-slate-950">
      {/* Sidebar */}
      <aside className="w-60 bg-slate-900/80 border-r border-slate-800 flex flex-col shrink-0 sticky top-0 h-screen overflow-y-auto">
        {/* Logo / Title */}
        <div className="px-4 py-5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Settings className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">BetCaddies</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Admin</div>
            </div>
          </div>
        </div>

        {/* Nav Groups */}
        <nav className="flex-1 px-2 py-3 space-y-4">
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              <div className="px-3 mb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => setActiveTab(item.key)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                        isActive
                          ? 'bg-emerald-500/15 text-emerald-400 font-medium'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                      {isActive && <ChevronRight className="w-3 h-3 ml-auto text-emerald-500/50" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Quick Stats Footer */}
        {quickStats && (
          <div className="px-3 py-3 border-t border-slate-800 space-y-1">
            {quickStats.map((stat, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-slate-500">{stat.label}</span>
                <span className={stat.color || 'text-white'}>{stat.value}</span>
              </div>
            ))}
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.15 }}
          className="p-6 max-w-[1400px]"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
