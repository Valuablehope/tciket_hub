import React, { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { db } from '../lib/supabase.js'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts'

const ReportsPage = () => {
  const { profile } = useAuth()
  const [tickets, setTickets] = useState([])

  useEffect(() => {
    const fetchTickets = async () => {
      const data = await db.getAllTickets()
      setTickets(data)
    }
    fetchTickets()
  }, [])

  const groupBy = (array, key) => {
    return array.reduce((acc, obj) => {
      const value = obj[key] || 'Unknown'
      acc[value] = (acc[value] || 0) + 1
      return acc
    }, {})
  }

  const ticketsByStatusData = Object.entries(groupBy(tickets, 'status')).map(([status, count]) => ({
    status,
    count,
    color: status === 'Open' ? '#EF4444' : status === 'In Progress' ? '#F59E0B' : status === 'Resolved' ? '#22C55E' : '#6B7280'
  }))

  const ticketsByBaseData = Object.entries(groupBy(tickets, 'base_name')).map(([base, count]) => ({ base, count }))

  const ticketsByPriorityData = Object.entries(groupBy(tickets, 'priority')).map(([priority, count]) => ({
    priority,
    count,
    color:
      priority === 'Critical' ? '#DC2626' :
      priority === 'High' ? '#EF4444' :
      priority === 'Medium' ? '#F59E0B' :
      '#22C55E'
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
        <p className="text-sm text-gray-600">Insights and metrics for ticket management</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard
          title="Total Tickets"
          value={tickets.length}
          change=""
          changeType="increase"
        />
        <MetricCard
          title="Avg Resolution Time"
          value="-"
          change=""
          changeType="decrease"
        />
        <MetricCard
          title="Team Satisfaction"
          value="-"
          change=""
          changeType="increase"
        />
        <MetricCard
          title="Response Rate"
          value="-"
          change=""
          changeType="increase"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Tickets by Status</h3>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={ticketsByStatusData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="count"
                  label={({ status, count }) => `${status}: ${count}`}
                >
                  {ticketsByStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Tickets by Priority</h3>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={ticketsByPriorityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="priority" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count">
                  {ticketsByPriorityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {profile?.role === 'Admin' && (
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">Tickets by Base</h3>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={ticketsByBaseData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="base" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#10B981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const MetricCard = ({ title, value, change, changeType }) => {
  const isIncrease = changeType === 'increase'
  const changeColor = isIncrease ? 'text-green-600' : 'text-red-600'
  const bgColor = isIncrease ? 'bg-green-50' : 'bg-red-50'

  return (
    <div className="card">
      <div className="card-body">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
          <div className={`px-2 py-1 rounded-full ${bgColor}`}>
            <span className={`text-sm font-medium ${changeColor}`}>{change}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReportsPage
