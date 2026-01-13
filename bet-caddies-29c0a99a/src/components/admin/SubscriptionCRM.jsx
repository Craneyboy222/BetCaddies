import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import {
  DollarSign,
  TrendingUp,
  Users,
  AlertCircle,
  Search,
  Filter,
  Download,
  Eye,
  X,
  Ban,
  Play,
  Pause,
  RefreshCw,
  Calendar,
  CreditCard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function SubscriptionCRM() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedSubscription, setSelectedSubscription] = useState(null);
  const queryClient = useQueryClient();

  // Fetch all subscriptions
  const { data: allSubscriptions = [], isLoading } = useQuery({
    queryKey: ['allSubscriptions'],
    queryFn: () => base44.entities.MembershipSubscription.list('-created_date', 500)
  });

  const { data: packages = [] } = useQuery({
    queryKey: ['allPackages'],
    queryFn: () => base44.entities.MembershipPackage.list('display_order', 50)
  });

  // Mutations
  const updateSubscriptionMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.MembershipSubscription.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allSubscriptions'] });
      setSelectedSubscription(null);
    }
  });

  // Filter subscriptions
  const filteredSubscriptions = allSubscriptions.filter(sub => {
    const matchesSearch = searchQuery === '' || 
      sub.user_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.package_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || sub.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Calculate metrics
  const activeCount = allSubscriptions.filter(s => s.status === 'active').length;
  const trialingCount = allSubscriptions.filter(s => s.status === 'trialing').length;
  const cancelledCount = allSubscriptions.filter(s => s.status === 'cancelled').length;
  const pastDueCount = allSubscriptions.filter(s => s.status === 'past_due').length;
  
  const mrr = allSubscriptions
    .filter(s => s.status === 'active' && s.billing_period === 'monthly')
    .reduce((sum, s) => sum + (s.price_paid || 0), 0);
  
  const arr = mrr * 12 + allSubscriptions
    .filter(s => s.status === 'active' && s.billing_period === 'yearly')
    .reduce((sum, s) => sum + (s.price_paid || 0), 0);
  
  const totalLTV = allSubscriptions.reduce((sum, s) => sum + (s.lifetime_value || 0), 0);

  const churnRate = allSubscriptions.length > 0 
    ? ((cancelledCount / allSubscriptions.length) * 100).toFixed(1) 
    : 0;

  const handleCancelSubscription = (sub) => {
    updateSubscriptionMutation.mutate({
      id: sub.id,
      data: {
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancel_at_period_end: true
      }
    });
  };

  const handlePauseSubscription = (sub) => {
    updateSubscriptionMutation.mutate({
      id: sub.id,
      data: { status: 'paused' }
    });
  };

  const handleResumeSubscription = (sub) => {
    updateSubscriptionMutation.mutate({
      id: sub.id,
      data: { status: 'active' }
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      trialing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      past_due: 'bg-red-500/20 text-red-400 border-red-500/30',
      cancelled: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
      paused: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      expired: 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    };
    return colors[status] || colors.active;
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Metrics Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-slate-400">MRR</span>
          </div>
          <div className="text-2xl font-bold text-white">£{mrr.toFixed(0)}</div>
          <div className="text-xs text-slate-500">Monthly Recurring</div>
        </div>

        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-slate-400">ARR</span>
          </div>
          <div className="text-2xl font-bold text-white">£{arr.toFixed(0)}</div>
          <div className="text-xs text-slate-500">Annual Recurring</div>
        </div>

        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-slate-400">Active</span>
          </div>
          <div className="text-2xl font-bold text-white">{activeCount}</div>
          <div className="text-xs text-slate-500">{trialingCount} trialing</div>
        </div>

        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-sm text-slate-400">Churn Rate</span>
          </div>
          <div className="text-2xl font-bold text-white">{churnRate}%</div>
          <div className="text-xs text-slate-500">{pastDueCount} past due</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by email or package..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-slate-800 border-slate-700 pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="bg-slate-800 border-slate-700 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="trialing">Trialing</SelectItem>
            <SelectItem value="past_due">Past Due</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" className="border-slate-600">
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Subscriptions Table */}
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Customer</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Package</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Status</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Price</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">LTV</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Next Payment</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSubscriptions.map((sub, idx) => (
              <tr key={sub.id} className={idx !== filteredSubscriptions.length - 1 ? 'border-b border-slate-700/30' : ''}>
                <td className="px-4 py-3">
                  <div className="font-medium text-white">{sub.user_email}</div>
                  <div className="text-xs text-slate-500">
                    Since {new Date(sub.created_date).toLocaleDateString()}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-white">{sub.package_name}</div>
                  <div className="text-xs text-slate-500 capitalize">{sub.billing_period}</div>
                </td>
                <td className="px-4 py-3 text-center">
                  <Badge className={getStatusColor(sub.status)}>
                    {sub.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-center text-white">
                  £{sub.price_paid}
                </td>
                <td className="px-4 py-3 text-center text-emerald-400">
                  £{sub.lifetime_value || 0}
                </td>
                <td className="px-4 py-3 text-sm text-slate-400">
                  {sub.next_payment_date ? new Date(sub.next_payment_date).toLocaleDateString() : '-'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedSubscription(sub)}
                      className="text-slate-400 hover:text-white"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    {sub.status === 'active' && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePauseSubscription(sub)}
                          className="text-slate-400 hover:text-amber-400"
                        >
                          <Pause className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancelSubscription(sub)}
                          className="text-slate-400 hover:text-red-400"
                        >
                          <Ban className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    {sub.status === 'paused' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleResumeSubscription(sub)}
                        className="text-slate-400 hover:text-emerald-400"
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredSubscriptions.length === 0 && (
          <div className="p-8 text-center text-slate-400">
            No subscriptions found
          </div>
        )}
      </div>

      {/* Subscription Detail Dialog */}
      <Dialog open={!!selectedSubscription} onOpenChange={() => setSelectedSubscription(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>Subscription Details</DialogTitle>
          </DialogHeader>
          {selectedSubscription && (
            <div className="space-y-6 pt-4">
              {/* Customer Info */}
              <div>
                <h3 className="text-sm font-medium text-slate-400 mb-3">Customer</h3>
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="text-lg font-semibold text-white mb-1">
                    {selectedSubscription.user_email}
                  </div>
                  <div className="text-sm text-slate-400">
                    Customer since {new Date(selectedSubscription.created_date).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Subscription Info */}
              <div>
                <h3 className="text-sm font-medium text-slate-400 mb-3">Subscription</h3>
                <div className="bg-slate-800/50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Package</span>
                    <span className="text-white font-medium">{selectedSubscription.package_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Status</span>
                    <Badge className={getStatusColor(selectedSubscription.status)}>
                      {selectedSubscription.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Price</span>
                    <span className="text-white">£{selectedSubscription.price_paid}/{selectedSubscription.billing_period}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Lifetime Value</span>
                    <span className="text-emerald-400 font-semibold">£{selectedSubscription.lifetime_value || 0}</span>
                  </div>
                </div>
              </div>

              {/* Billing Info */}
              <div>
                <h3 className="text-sm font-medium text-slate-400 mb-3">Billing</h3>
                <div className="bg-slate-800/50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Current Period</span>
                    <span className="text-white">
                      {selectedSubscription.current_period_start ? new Date(selectedSubscription.current_period_start).toLocaleDateString() : '-'} - 
                      {selectedSubscription.current_period_end ? new Date(selectedSubscription.current_period_end).toLocaleDateString() : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Next Payment</span>
                    <span className="text-white">
                      {selectedSubscription.next_payment_date ? new Date(selectedSubscription.next_payment_date).toLocaleDateString() : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Failed Payments</span>
                    <span className={selectedSubscription.failed_payment_count > 0 ? 'text-red-400' : 'text-white'}>
                      {selectedSubscription.failed_payment_count || 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Admin Notes */}
              {selectedSubscription.notes && (
                <div>
                  <h3 className="text-sm font-medium text-slate-400 mb-3">Admin Notes</h3>
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <p className="text-slate-300">{selectedSubscription.notes}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}