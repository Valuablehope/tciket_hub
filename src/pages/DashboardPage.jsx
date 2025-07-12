import React, { useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { db, subscriptions } from '../lib/supabase.js'
import LoadingSpinner from '../components/LoadingSpinner'
import {
  Ticket,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Users,
} from 'lucide-react'

const DashboardPage = () => {
  const { profile } = useAuth()
  const queryClient = useQueryClient()

  // Memoize user filtering logic
  const userFilterConfig = useMemo(() => {
    const shouldFilterByBase = profile?.role === 'User'
    const userBases = profile?.bases || []
    
    return {
      shouldFilter: shouldFilterByBase,
      bases: userBases,
      baseName: userBases[0]?.name || profile?.base || 'Unknown'
    }
  }, [profile])

  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = useQuery({
    queryKey: ['ticketStats', userFilterConfig.shouldFilter ? userFilterConfig.baseName : 'all'],
    queryFn: () => userFilterConfig.shouldFilter 
      ? db.getTicketStats({ base: userFilterConfig.baseName })
      : db.getTicketStats(),
    refetchInterval: 60000,
    enabled: !!profile,
  })

  const {
    data: recentTickets = [],
    isLoading: ticketsLoading,
    error: ticketsError,
  } = useQuery({
    queryKey: ['recentTickets', userFilterConfig.shouldFilter ? userFilterConfig.baseName : 'all'],
    queryFn: () => userFilterConfig.shouldFilter 
      ? db.getTickets({ base: userFilterConfig.baseName })
      : db.getTickets(),
    refetchInterval: 300000,
    enabled: !!profile,
  })

  useEffect(() => {
    if (!profile) return

    const channel = subscriptions.tickets(() => {
      queryClient.invalidateQueries(['ticketStats'])
      queryClient.invalidateQueries(['recentTickets'])
    })
    return () => channel.unsubscribe()
  }, [queryClient, profile])

  // Memoize processed data
  const processedData = useMemo(() => {
    const {
      total = 0,
      open = 0,
      in_progress: inProgress = 0,
      resolved = 0,
      avg_resolution_time: avgResolutionTime = 'N/A',
      avg_resolution_time_current: avgCurrent = 0,
      avg_resolution_time_prev: avgPrev = 0,
    } = stats || {}

    const resolutionTrend = avgPrev > 0
      ? `${Math.abs(((avgCurrent - avgPrev) / avgPrev) * 100).toFixed(1)}% ${
          avgCurrent < avgPrev ? 'faster' : 'slower'
        } than last month`
      : 'No previous data'
    const resolutionTrendUp = avgCurrent < avgPrev

    // Process recent tickets with safe data access
    const processedTickets = (recentTickets || []).slice(0, 5).map(ticket => ({
      // Replace id with ticket_number everywhere
      id: ticket.ticket_number,
      shortId: ticket.ticket_number?.slice(0, 6) || 'N/A',
      ticketNumber: ticket.ticket_number || 'N/A',
      title: ticket.title || 'Untitled',
      status: ticket.status || 'Unknown',
      priority: ticket.priority || 'Medium',
      baseName: ticket.base_name || ticket.base?.name || 'Unknown',
      createdAt: ticket.created_at
    }))

    return {
      stats: { total, open, inProgress, resolved, avgResolutionTime },
      trends: { resolutionTrend, resolutionTrendUp },
      tickets: processedTickets
    }
  }, [stats, recentTickets])

  // Memoized helper functions
  const getStatusBadge = useMemo(() => ({
    Open: 'badge-error',
    'In Progress': 'badge-warning',
    Resolved: 'badge-success',
    Closed: 'badge-secondary'
  }), [])

  const getPriorityBadge = useMemo(() => ({
    High: 'badge-error',
    Critical: 'badge-error',
    Medium: 'badge-warning',
    Low: 'badge-success'
  }), [])

  // Format date helper
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown'
    try {
      return new Date(dateString).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return 'Invalid date'
    }
  }

  // Show loading while profile is being fetched
  if (!profile) {
    return (
      <div className="flex justify-center items-center h-full">
        <LoadingSpinner />
      </div>
    )
  }

  if (statsError || ticketsError) {
    return (
      <div className="card">
        <div className="card-body text-center py-8">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Dashboard</h3>
          <p className="text-gray-600 mb-4">
            {statsError?.message || ticketsError?.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (statsLoading || ticketsLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <LoadingSpinner />
      </div>
    )
  }

  const { stats: statsData, trends, tickets } = processedData

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-lg shadow-lg text-white p-6">
        <h1 className="text-2xl font-bold mb-2">
          Welcome back, {profile?.full_name || profile?.email}!
        </h1>
        <p className="text-primary-100">
          Here's what's happening with {userFilterConfig.shouldFilter ? `${userFilterConfig.baseName} base` : 'all'} tickets today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Tickets" 
          value={statsData.total} 
          icon={Ticket} 
          color="text-blue-600" 
          bgColor="bg-blue-50" 
        />
        <StatCard 
          title="Open Tickets" 
          value={statsData.open} 
          icon={AlertCircle} 
          color="text-red-600" 
          bgColor="bg-red-50" 
        />
        <StatCard 
          title="In Progress" 
          value={statsData.inProgress} 
          icon={Clock} 
          color="text-yellow-600" 
          bgColor="bg-yellow-50" 
        />
        <StatCard 
          title="Resolved" 
          value={statsData.resolved} 
          icon={CheckCircle} 
          color="text-green-600" 
          bgColor="bg-green-50" 
        />
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MetricCard
          title="Avg Resolution Time"
          value={statsData.avgResolutionTime}
          icon={TrendingUp}
          trend={trends.resolutionTrend}
          trendUp={trends.resolutionTrendUp}
        />
        <MetricCard
          title="Tickets Resolved This Month"
          value={statsData.resolved}
          icon={Users}
          trend={`${statsData.resolved} resolved`}
          trendUp={true}
        />
      </div>

      {/* Recent Tickets */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">
            Recent Tickets {userFilterConfig.shouldFilter && `(${userFilterConfig.baseName} Base)`}
          </h3>
        </div>
        <div className="card-body p-0">
          {tickets.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Ticket className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No tickets found</p>
            </div>
          ) : (
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
                  {tickets.map(ticket => (
                    <tr key={ticket.ticketNumber} className="hover:bg-gray-50 transition-colors">
                      <td className="table-cell">
                        <div className="text-sm font-medium text-gray-900">
                          {/* Show the full ticket_number instead of shortId */}
                          Ticket #{ticket.ticketNumber}
                        </div>
                        <div className="text-sm text-gray-500 truncate max-w-xs">
                          {ticket.title}
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className={`badge ${getStatusBadge[ticket.status] || 'badge-secondary'}`}>
                          {ticket.status}
                        </span>
                      </td>
                      <td className="table-cell">
                        <span className={`badge ${getPriorityBadge[ticket.priority] || 'badge-secondary'}`}>
                          {ticket.priority}
                        </span>
                      </td>
                      <td className="table-cell text-sm text-gray-500">
                        {ticket.baseName}
                      </td>
                      <td className="table-cell text-sm text-gray-500">
                        {formatDate(ticket.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

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
)

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
        <span className={`text-sm ${trendUp ? 'text-green-600' : 'text-red-600'}`}>
          {trend}
        </span>
      </div>
    </div>
  </div>
)

export default DashboardPage