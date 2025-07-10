import React, { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { db, subscriptions } from '../lib/supabase.js';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  Ticket,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Users,
} from 'lucide-react';

const DashboardPage = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // Helper function to determine if user should see filtered data
  const shouldFilterByBase = profile?.role === 'User';
  const userBase = profile?.base;

  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = useQuery({
    queryKey: ['ticketStats', shouldFilterByBase ? userBase : 'all'],
    queryFn: () => shouldFilterByBase 
      ? db.getTicketStats({ base: userBase })
      : db.getTicketStats(),
    refetchInterval: 60000,
    enabled: !!profile, // Only run when profile is loaded
  });

  const {
    data: recentTickets = [],
    isLoading: ticketsLoading,
    error: ticketsError,
  } = useQuery({
    queryKey: ['recentTickets', shouldFilterByBase ? userBase : 'all'],
    queryFn: () => shouldFilterByBase 
      ? db.getTickets({ base: userBase })
      : db.getTickets(),
    refetchInterval: 300000,
    enabled: !!profile, // Only run when profile is loaded
  });

  useEffect(() => {
    if (!profile) return;

    const channel = subscriptions.tickets(() => {
      queryClient.invalidateQueries(['ticketStats', shouldFilterByBase ? userBase : 'all']);
      queryClient.invalidateQueries(['recentTickets', shouldFilterByBase ? userBase : 'all']);
    });
    return () => channel.unsubscribe();
  }, [queryClient, profile, shouldFilterByBase, userBase]);

  // Show loading while profile is being fetched
  if (!profile) {
    return (
      <div className="flex justify-center items-center h-full">
        <LoadingSpinner />
      </div>
    );
  }

  if (statsError || ticketsError) {
    return (
      <div className="text-red-600">
        Error loading dashboard: {statsError?.message || ticketsError?.message}
      </div>
    );
  }

  if (statsLoading || ticketsLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <LoadingSpinner />
      </div>
    );
  }

  const {
    total = 0,
    open = 0,
    in_progress: inProgress = 0,
    resolved = 0,
    avg_resolution_time: avgResolutionTime = 'N/A',
    avg_resolution_time_current: avgCurrent = 0,
    avg_resolution_time_prev: avgPrev = 0,
  } = stats || {};

  const resolutionTrend = avgPrev > 0
    ? `${Math.abs(((avgCurrent - avgPrev) / avgPrev) * 100).toFixed(1)}% ${
        avgCurrent < avgPrev ? 'faster' : 'slower'
      } than last month`
    : 'No previous data';
  const resolutionTrendUp = avgCurrent < avgPrev;

  const recent = recentTickets.slice(0, 5);

  const getStatusBadge = (status) => ({
    Open: 'badge-error',
    'In Progress': 'badge-warning',
    Resolved: 'badge-success',
  }[status] || 'badge-secondary');

  const getPriorityBadge = (priority) => ({
    High: 'badge-error',
    Medium: 'badge-warning',
    Low: 'badge-success',
  }[priority] || 'badge-secondary');

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-lg shadow-lg text-white p-6">
        <h1 className="text-2xl font-bold mb-2">Welcome back, {profile?.full_name}!</h1>
        <p className="text-primary-100">
          Here's what's happening with {shouldFilterByBase ? `${userBase} base` : 'all'} tickets today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Tickets" value={total} icon={Ticket} color="text-blue-600" bgColor="bg-blue-50" />
        <StatCard title="Open Tickets" value={open} icon={AlertCircle} color="text-red-600" bgColor="bg-red-50" />
        <StatCard title="In Progress" value={inProgress} icon={Clock} color="text-yellow-600" bgColor="bg-yellow-50" />
        <StatCard title="Resolved" value={resolved} icon={CheckCircle} color="text-green-600" bgColor="bg-green-50" />
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MetricCard
          title="Avg Resolution Time"
          value={avgResolutionTime}
          icon={TrendingUp}
          trend={resolutionTrend}
          trendUp={resolutionTrendUp}
        />
        <MetricCard
          title="Tickets Resolved This Month"
          value={resolved}
          icon={Users}
          trend={`${resolved} resolved`}
          trendUp={true}
        />
      </div>

      {/* Recent Tickets */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">
            Recent Tickets {shouldFilterByBase && `(${userBase} Base)`}
          </h3>
        </div>
        <div className="card-body p-0">
          <div className="overflow-hidden">
            <table className="table">
              <thead>
                <tr>
                  <th className="table-header">Ticket</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Priority</th>
                  <th className="table-header">Base</th>
                  <th className="table-header">Created</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recent.map(ticket => (
                  <tr key={ticket.id} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <div className="text-sm font-medium text-gray-900">#{ticket.id}</div>
                      <div className="text-sm text-gray-500">{ticket.title}</div>
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${getStatusBadge(ticket.status)}`}>{ticket.status}</span>
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${getPriorityBadge(ticket.priority)}`}>{ticket.priority}</span>
                    </td>
                    <td className="table-cell text-sm text-gray-500">{ticket.base}</td>
                    <td className="table-cell text-sm text-gray-500">{new Date(ticket.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, color, bgColor }) => (
  <div className="card">
    <div className="card-body">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <div className={`h-12 w-12 rounded-md ${bgColor} flex items-center justify-center`}>
            <Icon className={`h-6 w-6 ${color}`} />
          </div>
        </div>
        <div className="ml-4">
          <div className="text-2xl font-bold text-gray-900">{value}</div>
          <div className="text-sm text-gray-500">{title}</div>
        </div>
      </div>
    </div>
  </div>
);

const MetricCard = ({ title, value, icon: Icon, trend, trendUp }) => (
  <div className="card">
    <div className="card-body">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-gray-500">{title}</div>
          <div className="text-2xl font-bold text-gray-900">{value}</div>
        </div>
        <Icon className="h-8 w-8 text-gray-400" />
      </div>
      <div className="mt-2">
        <span className={`text-sm ${trendUp ? 'text-green-600' : 'text-red-600'}`}>{trend}</span>
      </div>
    </div>
  </div>
);

export default DashboardPage;