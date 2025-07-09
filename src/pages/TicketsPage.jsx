import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/supabase.js'; // ✅ ensure path is correct
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Eye
} from 'lucide-react';

const TicketsPage = () => {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [baseFilter, setBaseFilter] = useState('all');
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        setLoading(true);

        const filters = {};
        if (profile?.role === 'User') {
          filters.created_by = profile.id;
        }
        if (profile?.role === 'HIS') {
          filters.base = profile.base;
        }
        if (baseFilter !== 'all') filters.base = baseFilter;
        if (statusFilter !== 'all') filters.status = statusFilter;

        const result = await db.getTickets(filters);
        setTickets(result);
      } catch (error) {
        console.error('Failed to fetch tickets:', error.message);
      } finally {
        setLoading(false);
      }
    };

    if (profile?.id) fetchTickets();
  }, [profile, baseFilter, statusFilter]);

  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch =
      ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const getStatusBadge = (status) => {
    const styles = {
      'Open': 'badge-error',
      'In Progress': 'badge-warning',
      'Resolved': 'badge-success',
      'Closed': 'badge-secondary'
    };
    return styles[status] || 'badge-secondary';
  };

  const getPriorityBadge = (priority) => {
    const styles = {
      'High': 'badge-error',
      'Medium': 'badge-warning',
      'Low': 'badge-success'
    };
    return styles[priority] || 'badge-secondary';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tickets</h1>
          <p className="text-sm text-gray-600">Manage and track support tickets</p>
        </div>
        {(profile?.role === 'User' || profile?.role === 'HIS' || profile?.role === 'Admin') && (
          <Link to="/tickets/new" className="btn-primary">
            <Plus className="h-4 w-4 mr-2" />
            New Ticket
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search tickets..."
                className="form-input pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div>
              <select
                className="form-input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
              </select>
            </div>

            {profile?.role === 'Admin' && (
              <div>
                <select
                  className="form-input"
                  value={baseFilter}
                  onChange={(e) => setBaseFilter(e.target.value)}
                >
                  <option value="all">All Bases</option>
                  <option value="South">South</option>
                  <option value="BML">BML</option>
                  <option value="North">North</option>
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="card">
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading tickets...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th className="table-header">Ticket</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Priority</th>
                    {profile?.role === 'Admin' && <th className="table-header">Base</th>}
                    <th className="table-header">Assigned To</th>
                    <th className="table-header">Created</th>
                    <th className="table-header">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredTickets.length > 0 ? (
                    filteredTickets.map((ticket) => (
                      <tr key={ticket.id} className="hover:bg-gray-50">
                        <td className="table-cell">
                          <div className="text-sm font-medium text-gray-900">
                            #{ticket.id.slice(0, 6)} - {ticket.title}
                          </div>
                          <div className="text-sm text-gray-500 truncate max-w-xs">
                            {ticket.description}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            By: {ticket.creator_profile?.full_name || 'Unknown'}
                          </div>
                        </td>
                        <td className="table-cell">
                          <span className={`badge ${getStatusBadge(ticket.status)}`}>
                            {ticket.status}
                          </span>
                        </td>
                        <td className="table-cell">
                          <span className={`badge ${getPriorityBadge(ticket.priority)}`}>
                            {ticket.priority}
                          </span>
                        </td>
                        {profile?.role === 'Admin' && (
                          <td className="table-cell text-sm text-gray-500">{ticket.base}</td>
                        )}
                        <td className="table-cell text-sm text-gray-500">
                          {ticket.assignee_profile?.full_name || 'Unassigned'}
                        </td>
                        <td className="table-cell text-sm text-gray-500">
                          {formatDate(ticket.created_at)}
                        </td>
                        <td className="table-cell">
                          <div className="flex items-center space-x-2">
                            <Link
                              to={`/tickets/${ticket.id}`}
                              className="text-primary-600 hover:text-primary-700"
                              title="View ticket"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                            {(profile?.role === 'Admin' || profile?.role === 'HIS' ||
                              (profile?.role === 'User' && ticket.creator_profile?.id === profile.id)) && (
                              <button
                                className="text-gray-600 hover:text-gray-700"
                                title="More actions"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="table-cell text-center py-12">
                        <div className="text-gray-500">
                          <Filter className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                          <p className="text-lg font-medium">No tickets found</p>
                          <p className="text-sm">Try adjusting your search or filter criteria</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Results summary */}
      {!loading && filteredTickets.length > 0 && (
        <div className="text-sm text-gray-500 text-center">
          Showing {filteredTickets.length} of {tickets.length} tickets
        </div>
      )}
    </div>
  );
};

export default TicketsPage;
