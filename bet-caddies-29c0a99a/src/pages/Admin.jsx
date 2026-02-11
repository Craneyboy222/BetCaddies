import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

// Layout
import AdminLayout from '@/components/admin/AdminLayout';

// Tab Components
import AnalyticsDashboard from '@/components/admin/AnalyticsDashboard';
import RunsTab from '@/components/admin/RunsTab';
import BetsTab from '@/components/admin/BetsTab';
import TourEventsTab from '@/components/admin/TourEventsTab';
import OddsTab from '@/components/admin/OddsTab';
import ProvidersTab from '@/components/admin/ProvidersTab';
import IssuesTab from '@/components/admin/IssuesTab';
import ContentTab from '@/components/admin/ContentTab';
import PagesTab from '@/components/admin/PagesTab';
import MediaTab from '@/components/admin/MediaTab';
import UsersTab from '@/components/admin/UsersTab';
import AuditTab from '@/components/admin/AuditTab';
import MembershipsTab from '@/components/admin/MembershipsTab';
import SubscriptionCRM from '@/components/admin/SubscriptionCRM';
import HIOChallengeAdmin from '@/components/admin/HIOChallengeAdmin';
import PaymentSettingsAdmin from '@/components/admin/PaymentSettingsAdmin';
import ContentAccessAdmin from '@/components/admin/ContentAccessAdmin';
import CouponsAdmin from '@/components/admin/CouponsAdmin';
import ReferralsAdmin from '@/components/admin/ReferralsAdmin';
import EmailAdmin from '@/components/admin/EmailAdmin';
import ScheduledPublishAdmin from '@/components/admin/ScheduledPublishAdmin';
import WebhooksAdmin from '@/components/admin/WebhooksAdmin';
import SystemHealthDashboard from '@/components/admin/SystemHealthDashboard';

const TAB_COMPONENTS = {
  analytics: AnalyticsDashboard,
  runs: RunsTab,
  bets: BetsTab,
  tour: TourEventsTab,
  odds: OddsTab,
  providers: ProvidersTab,
  hio: HIOChallengeAdmin,
  memberships: MembershipsTab,
  subscriptions: SubscriptionCRM,
  payments: PaymentSettingsAdmin,
  coupons: CouponsAdmin,
  referrals: ReferralsAdmin,
  pages: PagesTab,
  content: ContentTab,
  media: MediaTab,
  scheduled: ScheduledPublishAdmin,
  users: UsersTab,
  access: ContentAccessAdmin,
  issues: IssuesTab,
  audit: AuditTab,
  emails: EmailAdmin,
  webhooks: WebhooksAdmin,
  health: SystemHealthDashboard,
};

export default function Admin() {
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [activeTab, setActiveTab] = useState('analytics');

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await api.auth.me();
        if (userData.role !== 'admin') {
          window.location.href = '/';
          return;
        }
        setUser(userData);
      } catch (e) {
        setAuthError(e?.message || 'Failed to load admin session');
      }
    };
    loadUser();
  }, []);

  // Quick stats for sidebar footer
  const { data: bets = [] } = useQuery({
    queryKey: ['allBets'],
    enabled: !!user,
    queryFn: () => api.entities.GolfBet.list('-created_date', 100),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['allUsers'],
    enabled: !!user,
    queryFn: () => api.entities.User.list('-created_date', 100),
  });

  const { data: issues = [] } = useQuery({
    queryKey: ['dataQualityIssues'],
    enabled: !!user,
    queryFn: () => api.entities.DataQualityIssue.filter({ resolved: false }, '-created_date', 50),
  });

  if (authError) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6">
          <h1 className="text-xl font-bold text-white">Admin access error</h1>
          <p className="mt-2 text-sm text-slate-300">{authError}</p>
          <div className="mt-5 flex gap-2">
            <Button onClick={() => window.location.reload()} className="bg-emerald-500 hover:bg-emerald-600">
              Retry
            </Button>
            <Button variant="outline" onClick={() => { window.location.href = '/'; }} className="border-slate-700 text-slate-200">
              Go Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return <LoadingSpinner text="Loading admin..." />;

  const activeBets = bets.filter(b => b.status === 'active').length;
  const quickStats = [
    { label: 'Active Bets', value: activeBets, color: 'text-emerald-400' },
    { label: 'Users', value: users.length, color: 'text-white' },
    { label: 'Open Issues', value: issues.length, color: issues.length > 0 ? 'text-amber-400' : 'text-slate-500' },
  ];

  const ActiveComponent = TAB_COMPONENTS[activeTab];

  return (
    <AdminLayout activeTab={activeTab} setActiveTab={setActiveTab} quickStats={quickStats}>
      {ActiveComponent ? <ActiveComponent /> : <div className="text-slate-400">Select a tab</div>}
    </AdminLayout>
  );
}
