import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { db, supabase } from "../lib/supabase.js";
import { toast } from "react-hot-toast";
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  UserPlus,
  X,
  AlertTriangle,
} from "lucide-react";

const TicketsPage = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [baseFilter, setBaseFilter] = useState("all");
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    priority: "",
    base: "",
    status: ""
  });
  const [editLoading, setEditLoading] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // Notification helper functions (same as TicketDetailPage)
  const buildNotificationPayload = (ticket, type, message, additionalData = {}) => ({
    type,
    ticket_id: ticket.id,
    ticket_title: ticket.title,
    ticket_base: ticket.base,
    message,
    actor_name: profile?.full_name || profile?.email || 'Unknown User',
    actor_role: profile?.role,
    actor_id: profile?.id, // Add this to help with server-side filtering
    created_by: ticket.creator_profile?.id || ticket.created_by,
    assigned_to: ticket.assigned_to,
    // Debug info
    debug_info: {
      should_notify_creator: ticket.creator_profile?.id !== profile?.id,
      should_notify_assignee: ticket.assigned_to !== profile?.id,
      creator_id: ticket.creator_profile?.id || ticket.created_by,
      assignee_id: ticket.assigned_to,
      actor_id: profile?.id
    },
    ...additionalData
  });

  const sendOptimizedNotification = async (ticket, type, message, additionalData = {}) => {
    try {
      const payload = buildNotificationPayload(ticket, type, message, additionalData);
      
      console.log('Attempting to send notification:', {
        type,
        ticket_id: ticket.id,
        message,
        created_by: ticket.creator_profile?.id || ticket.created_by,
        assigned_to: ticket.assigned_to,
        actor: profile?.full_name || profile?.email
      });
      
      // Use optimized notification if available
      if (typeof db.sendOptimizedNotification === 'function') {
        console.log('Using optimized notification system...');
        const result = await db.sendOptimizedNotification(payload);
        console.log('Optimized notification result:', result);
        return result;
      } else {
        console.log('Using fallback notification system...');
        // Fallback to the regular notification system
        const result = await db.sendNotification(type, ticket.id, message);
        console.log('Fallback notification sent for ticket:', ticket.id);
        return result;
      }
    } catch (error) {
      console.error('Failed to send notification:', error);
      // Don't throw error to avoid breaking the main operation
      return { success: false, error: error.message };
    }
  };

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        setLoading(true);
        const filters = {};
        if (profile?.role === "User") filters.created_by = profile.id;
        if (profile?.role === "HIS") filters.base = profile.base;
        if (baseFilter !== "all") filters.base = baseFilter;
        if (statusFilter !== "all") filters.status = statusFilter;
        const result = await db.getTickets(filters);
        setTickets(result);
      } catch (error) {
        console.error("Failed to fetch tickets:", error.message);
      } finally {
        setLoading(false);
      }
    };
    if (profile?.id) fetchTickets();
  }, [profile, baseFilter, statusFilter]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOpenDropdownId(null);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const filteredTickets = tickets.filter(
    (ticket) =>
      ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ticket.ticket_number && ticket.ticket_number.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getStatusBadge = (status) =>
    ({
      Open: "badge-error",
      "In Progress": "badge-warning",
      Resolved: "badge-success",
      Closed: "badge-secondary",
    }[status] || "badge-secondary");

  const getPriorityBadge = (priority) =>
    ({
      High: "badge-error",
      Medium: "badge-warning",
      Low: "badge-success",
    }[priority] || "badge-secondary");

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const toggleDropdown = (e, ticketId) => {
    e.stopPropagation();
    setOpenDropdownId(openDropdownId === ticketId ? null : ticketId);
  };

  const handleEdit = (ticket) => {
    setSelectedTicket(ticket);
    setEditForm({
      title: ticket.title,
      description: ticket.description,
      priority: ticket.priority,
      base: ticket.base,
      status: ticket.status
    });
    setShowEditModal(true);
    setOpenDropdownId(null);
  };

  const handleAssign = async (ticket) => {
  // Only Admin and HIS can assign tickets
  if (!profile?.role || !['Admin', 'HIS'].includes(profile.role)) {
    toast.error('Access denied: Only Admin and HIS users can assign tickets.')
    return
  }

  // Add null check for ticket
  if (!ticket) {
    toast.error('Ticket data not available. Please try again.')
    return
  }

  setSelectedTicket(ticket);
  setShowAssignmentModal(true);
  setOpenDropdownId(null);

  try {
    setUsersLoading(true);
    let data, error;

    if (profile?.role === "Admin") {
      // Admin can assign across all bases
      const result = await supabase.rpc('get_admin_assignable_users_secure');
      data = result.data;
      error = result.error;
    } else if (profile?.role === "HIS") {
      // HIS can assign within their base - use the secure function
      const result = await supabase.rpc('get_assignable_users_secure', {
        base_id: ticket.base_id
      });
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error('RPC function error:', error);
      throw error;
    }

    const processedUsers = (data || []).map(user => ({
      ...user,
      display_name: user.full_name || user.email || 'Unknown User'
    }));

    setAvailableUsers(processedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    toast.error('Failed to load available users.');
    setAvailableUsers([]);
  } finally {
    setUsersLoading(false);
  }
};

  const handleDelete = (ticket) => {
    setSelectedTicket(ticket);
    setShowDeleteModal(true);
    setOpenDropdownId(null);
  };

  const handleAssignToUser = async (selectedUserId, selectedUserName) => {
  if (!selectedTicket) return;
  
  // Check if ticket is already assigned to selected user
  if (selectedTicket.assigned_to === selectedUserId) {
    toast.error(`Ticket is already assigned to ${selectedUserName}!`);
    return;
  }

  try {
    setActionLoading(true);
    
    // Get current assignee name safely
    const oldAssigneeName = selectedTicket?.assignee_profile?.full_name || 
                           selectedTicket?.assignee_profile?.email || 
                           "Unassigned";
    
    // Update ticket assignment - use ticket.id (should be UUID)
    await db.updateTicket(selectedTicket.id, {
      assigned_to: selectedUserId,
    });

    // Add comment for the assignment change - use ticket.id (UUID)
    await db.addTicketComment({
      ticket_id: selectedTicket.id,
      user_id: profile.id,
      comment_type: "assignment",
      old_value: oldAssigneeName,
      new_value: selectedUserName || "Unassigned",
      comment: selectedUserId ? `Assigned to ${selectedUserName}` : "Unassigned",
    });

    // Send optimized notification
    await sendOptimizedNotification(
      selectedTicket,
      'ticket_assignment',
      selectedUserId ? `Ticket assigned to ${selectedUserName}` : 'Ticket unassigned',
      {
        old_assignee: selectedTicket.assigned_to,
        new_assignee: selectedUserId,
        old_assignee_name: oldAssigneeName,
        new_assignee_name: selectedUserName || "Unassigned"
      }
    );

    // Update local state
    setTickets(prevTickets =>
      prevTickets.map(ticket =>
        ticket.id === selectedTicket.id
          ? { 
              ...ticket, 
              assigned_to: selectedUserId, 
              assignee_profile: selectedUserId ? { full_name: selectedUserName } : null 
            }
          : ticket
      )
    );
    
    setShowAssignmentModal(false);
    setSelectedTicket(null);
    toast.success(selectedUserId ? `Ticket assigned to ${selectedUserName}!` : 'Ticket unassigned!');
  } catch (error) {
    console.error("Failed to assign ticket:", error);
    toast.error("Failed to assign ticket. Please try again.");
  } finally {
    setActionLoading(false);
  }
};

  const handleDeleteConfirm = async () => {
    if (!selectedTicket) return;
    
    try {
      setActionLoading(true);
      
      // Use the deleteTicket method from your db
      await db.deleteTicket(selectedTicket.id);
      
      // Update local state
      setTickets(prevTickets =>
        prevTickets.filter(ticket => ticket.id !== selectedTicket.id)
      );
      
      setShowDeleteModal(false);
      setSelectedTicket(null);
      toast.success("Ticket deleted successfully!");
    } catch (error) {
      console.error("Failed to delete ticket:", error.message);
      toast.error("Failed to delete ticket. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedTicket) return;
    
    try {
      setEditLoading(true);
      
      // Check what fields have changed
      const changes = {};
      const changeDetails = [];
      
      if (editForm.title !== selectedTicket.title) {
        changes.title = editForm.title;
        changeDetails.push({
          field: 'title',
          old_value: selectedTicket.title,
          new_value: editForm.title
        });
      }
      if (editForm.description !== selectedTicket.description) {
        changes.description = editForm.description;
        changeDetails.push({
          field: 'description',
          old_value: selectedTicket.description,
          new_value: editForm.description
        });
      }
      if (editForm.priority !== selectedTicket.priority) {
        changes.priority = editForm.priority;
        changeDetails.push({
          field: 'priority',
          old_value: selectedTicket.priority,
          new_value: editForm.priority
        });
      }
      if (editForm.base !== selectedTicket.base) {
        changes.base = editForm.base;
        changeDetails.push({
          field: 'base',
          old_value: selectedTicket.base,
          new_value: editForm.base
        });
      }
      if (editForm.status !== selectedTicket.status) {
        changes.status = editForm.status;
        changeDetails.push({
          field: 'status',
          old_value: selectedTicket.status,
          new_value: editForm.status
        });
      }

      // If no changes, just close modal
      if (Object.keys(changes).length === 0) {
        setShowEditModal(false);
        setSelectedTicket(null);
        return;
      }

      // Update ticket
      await db.updateTicket(selectedTicket.id, changes);

      // Add comment for each change
      for (const change of changeDetails) {
        await db.addTicketComment({
          ticket_id: selectedTicket.id,
          user_id: profile.id,
          comment_type: "comment",
          comment: `${change.field.charAt(0).toUpperCase() + change.field.slice(1)} changed from "${change.old_value}" to "${change.new_value}"`,
        });
      }

      // Send optimized notification for all changes (same as TicketDetailPage)
      const changedFields = changeDetails.map(c => c.field).join(', ');
      await sendOptimizedNotification(
        selectedTicket,
        'ticket_updated',
        `Ticket updated: ${changedFields} changed`,
        {
          changes: changeDetails,
          old_base: selectedTicket.base,
          new_base: editForm.base
        }
      );

      // Update local state
      setTickets(prevTickets =>
        prevTickets.map(ticket =>
          ticket.id === selectedTicket.id
            ? { ...ticket, ...changes }
            : ticket
        )
      );
      
      setShowEditModal(false);
      setSelectedTicket(null);
      toast.success("Ticket updated successfully!");
    } catch (error) {
      console.error("Error updating ticket:", error.message);
      toast.error("Failed to update ticket. Please try again.");
    } finally {
      setEditLoading(false);
    }
  };

  const closeModals = () => {
    setShowAssignmentModal(false);
    setShowDeleteModal(false);
    setShowEditModal(false);
    setSelectedTicket(null);
  };

  const renderEditModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl max-h-screen overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Edit Ticket</h2>
          <button
            onClick={closeModals}
            className="text-gray-400 hover:text-gray-600"
            disabled={editLoading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="space-y-6">
          <div>
            <label className="form-label">Title</label>
            <input
              type="text"
              className="form-input"
              value={editForm.title}
              onChange={(e) => setEditForm({...editForm, title: e.target.value})}
              disabled={editLoading}
            />
          </div>

          <div>
            <label className="form-label">Description</label>
            <textarea
              rows={4}
              className="form-input"
              value={editForm.description}
              onChange={(e) => setEditForm({...editForm, description: e.target.value})}
              disabled={editLoading}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="form-label">Priority</label>
              <select
                className="form-input"
                value={editForm.priority}
                onChange={(e) => setEditForm({...editForm, priority: e.target.value})}
                disabled={editLoading}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>

            <div>
              <label className="form-label">Base</label>
              <select
                className="form-input"
                value={editForm.base}
                onChange={(e) => setEditForm({...editForm, base: e.target.value})}
                disabled={editLoading}
              >
                <option value="South">South</option>
                <option value="BML">BML</option>
                <option value="North">North</option>
              </select>
            </div>

            <div>
              <label className="form-label">Status</label>
              <select
                className="form-input"
                value={editForm.status}
                onChange={(e) => setEditForm({...editForm, status: e.target.value})}
                disabled={editLoading}
              >
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-8">
          <button
            onClick={closeModals}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded transition-colors"
            disabled={editLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleSaveEdit}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            disabled={editLoading}
          >
            {editLoading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );

  const renderAssignmentModal = () => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
    <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md max-h-96 overflow-y-auto">
      <h2 className="text-xl font-semibold mb-4">Assign Ticket</h2>
      <p className="text-gray-600 mb-6">
        Choose who to assign this ticket to:
      </p>
      
      {usersLoading ? (
        <div className="text-center py-4">
          <div className="loading-spinner h-6 w-6 mx-auto mb-2"></div>
          <div className="text-gray-500">Loading users...</div>
        </div>
      ) : (
        <div className="space-y-3 mb-6">
          {/* Current user option - only show if user can be assigned tickets (Admin/HIS) */}
          {['Admin', 'HIS'].includes(profile?.role) && (
            <button
              className="w-full px-4 py-2 text-left bg-gray-50 hover:bg-gray-100 rounded border transition-colors"
              onClick={() => handleAssignToUser(profile.id, profile.full_name || profile.email)}
              disabled={actionLoading}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{profile.full_name || profile.email} (Me)</span>
                  <span className="text-sm text-gray-500 ml-2">({profile.role})</span>
                </div>
                {selectedTicket?.assigned_to === profile.id && (
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    Currently Assigned
                  </span>
                )}
              </div>
            </button>
          )}
          
          {/* Other available users - only HIS and Admin users */}
          {availableUsers
            .filter(user => user.id !== profile.id)
            .map((user) => (
              <button
                key={user.id}
                className="w-full px-4 py-2 text-left bg-gray-50 hover:bg-gray-100 rounded border transition-colors"
                onClick={() => handleAssignToUser(user.id, user.display_name)}
                disabled={actionLoading}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">{user.display_name}</span>
                    <span className="text-sm text-gray-500 ml-2">({user.role})</span>
                    {user.base && (
                      <span className="text-xs text-gray-400 ml-1">- {user.base}</span>
                    )}
                  </div>
                  {selectedTicket?.assigned_to === user.id && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      Currently Assigned
                    </span>
                  )}
                </div>
              </button>
            ))
          }
          
          {/* Unassign option */}
          {selectedTicket?.assigned_to && (
            <button
              className="w-full px-4 py-2 text-left bg-red-50 hover:bg-red-100 rounded border border-red-200 transition-colors"
              onClick={() => handleAssignToUser(null, "Unassigned")}
              disabled={actionLoading}
            >
              <span className="text-red-600 font-medium">Unassign Ticket</span>
            </button>
          )}
          
          {availableUsers.length === 0 && !usersLoading && (
            <div className="text-sm text-gray-500 text-center py-4">
              No other users available for assignment
            </div>
          )}
        </div>
      )}
      
      <div className="flex justify-end space-x-3">
        <button
          className="btn-secondary"
          onClick={closeModals}
          disabled={actionLoading}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
);
  const canEditTicket = (ticket) => {
    return (
      profile?.role === "Admin" ||
      ticket.created_by === profile?.id ||
      ticket.assigned_to === profile?.id
    );
  };

  const canDeleteTicket = (ticket) => {
    return (
      profile?.role === "Admin" ||
      ticket.created_by === profile?.id
    );
  };

  const canAssignTicket = () => {
  return profile?.role === "Admin" || profile?.role === "HIS";
};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tickets</h1>
          <p className="text-sm text-gray-600">
            Manage and track support tickets
          </p>
        </div>
        {(profile?.role === "User" ||
          profile?.role === "HIS" ||
          profile?.role === "Admin") && (
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
            {profile?.role === "Admin" && (
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
            <div className="text-center py-8 text-gray-500">
              Loading tickets...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th className="table-header">Ticket</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Priority</th>
                    {profile?.role === "Admin" && (
                      <th className="table-header">Base</th>
                    )}
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
                            #{ticket.ticket_number} - {ticket.title}
                          </div>
                          <div className="text-sm text-gray-500 truncate max-w-xs">
                            {ticket.description}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            By: {ticket.creator_profile?.full_name || "Unknown"}
                          </div>
                        </td>
                        <td className="table-cell">
                          <span
                            className={`badge ${getStatusBadge(ticket.status)}`}
                          >
                            {ticket.status}
                          </span>
                        </td>
                        <td className="table-cell">
                          <span
                            className={`badge ${getPriorityBadge(
                              ticket.priority
                            )}`}
                          >
                            {ticket.priority}
                          </span>
                        </td>
                        {profile?.role === "Admin" && (
                          <td className="table-cell text-sm text-gray-500">
                            {ticket.base}
                          </td>
                        )}
                        <td className="table-cell text-sm text-gray-500">
                          {ticket.assignee_profile?.full_name || "Unassigned"}
                        </td>
                        <td className="table-cell text-sm text-gray-500">
                          {formatDate(ticket.created_at)}
                        </td>
                        <td className="table-cell relative">
                          <div className="flex items-center space-x-2">
                            <Link
                              to={`/tickets/${ticket.id}`}
                              className="text-primary-600 hover:text-primary-700"
                              title="View ticket"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                            <button
                              className="text-gray-600 hover:text-gray-700"
                              onClick={(e) => toggleDropdown(e, ticket.id)}
                              title="More actions"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </div>
                          {openDropdownId === ticket.id && (
                            <div className="absolute right-0 z-10 mt-2 w-40 bg-white rounded-md shadow-lg border">
                              <ul className="text-sm text-gray-700 py-1">
                                {canEditTicket(ticket) && (
                                  <li>
                                    <button
                                      onClick={() => handleEdit(ticket)}
                                      className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2"
                                    >
                                      <Edit className="h-4 w-4" /> Edit
                                    </button>
                                  </li>
                                )}
                                {canAssignTicket() && (
                                  <li>
                                    <button
                                      onClick={() => handleAssign(ticket)}
                                      className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2"
                                    >
                                      <UserPlus className="h-4 w-4" /> Assign
                                    </button>
                                  </li>
                                )}
                                {canDeleteTicket(ticket) && (
                                  <li>
                                    <button
                                      onClick={() => handleDelete(ticket)}
                                      className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2"
                                    >
                                      <Trash2 className="h-4 w-4" /> Delete
                                    </button>
                                  </li>
                                )}
                              </ul>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="table-cell text-center py-12">
                        <div className="text-gray-500">
                          <Filter className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                          <p className="text-lg font-medium">
                            No tickets found
                          </p>
                          <p className="text-sm">
                            Try adjusting your search or filter criteria
                          </p>
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

      {!loading && filteredTickets.length > 0 && (
        <div className="text-sm text-gray-500 text-center">
          Showing {filteredTickets.length} of {tickets.length} tickets
        </div>
      )}

      {/* Modals */}
      {showEditModal && renderEditModal()}
      {showAssignmentModal && renderAssignmentModal()}
      {showDeleteModal && renderDeleteModal()}
    </div>
  );
};

export default TicketsPage;