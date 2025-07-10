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
      ticket.description.toLowerCase().includes(searchTerm.toLowerCase())
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
    setSelectedTicket(ticket);
    setShowAssignmentModal(true);
    setOpenDropdownId(null);
    
    // Fetch available users for assignment using RPC function
    try {
      setUsersLoading(true);
      
      // Use the database function to get assignable users
      const { data, error } = await supabase.rpc('get_assignable_users');
      
      if (error) {
        console.error('RPC function error:', error);
        throw error;
      }
      
      console.log('Users from get_assignable_users function:', data);
      
      // Process users to ensure they have displayable names
      const processedUsers = (data || []).map(user => ({
        ...user,
        display_name: user.full_name || user.email || 'Unknown User'
      }));
      
      setAvailableUsers(processedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load available users. Please check permissions.');
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
      await db.updateTicket(selectedTicket.id, {
        assigned_to: selectedUserId,
      });

      await db.addTicketComment({
        ticket_id: selectedTicket.id,
        user_id: profile.id,
        comment_type: "assignment",
        old_value: selectedTicket?.assignee_profile?.full_name || "Unassigned",
        new_value: selectedUserName,
        comment: `Assigned to ${selectedUserName}`,
      });

      // Send notification to assigned user
      try {
        await db.sendNotification('ticket_assigned', selectedTicket.id, `Ticket assigned to ${selectedUserName}`, selectedUserId);
      } catch (notificationError) {
        console.error('Failed to send notification:', notificationError);
      }

      // Update local state
      setTickets(prevTickets =>
        prevTickets.map(ticket =>
          ticket.id === selectedTicket.id
            ? { ...ticket, assigned_to: selectedUserId, assignee_profile: { full_name: selectedUserName } }
            : ticket
        )
      );
      
      setShowAssignmentModal(false);
      setSelectedTicket(null);
      toast.success(`Ticket assigned to ${selectedUserName}!`);
    } catch (error) {
      console.error("Failed to assign ticket:", error.message);
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
      const oldValues = {};
      const newValues = {};
      
      if (editForm.title !== selectedTicket.title) {
        changes.title = editForm.title;
        oldValues.title = selectedTicket.title;
        newValues.title = editForm.title;
      }
      if (editForm.description !== selectedTicket.description) {
        changes.description = editForm.description;
        oldValues.description = selectedTicket.description;
        newValues.description = editForm.description;
      }
      if (editForm.priority !== selectedTicket.priority) {
        changes.priority = editForm.priority;
        oldValues.priority = selectedTicket.priority;
        newValues.priority = editForm.priority;
      }
      if (editForm.base !== selectedTicket.base) {
        changes.base = editForm.base;
        oldValues.base = selectedTicket.base;
        newValues.base = editForm.base;
      }
      if (editForm.status !== selectedTicket.status) {
        changes.status = editForm.status;
        oldValues.status = selectedTicket.status;
        newValues.status = editForm.status;
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
      for (const [field, newValue] of Object.entries(newValues)) {
        await db.addTicketComment({
          ticket_id: selectedTicket.id,
          user_id: profile.id,
          comment_type: "comment",
          comment: `${field.charAt(0).toUpperCase() + field.slice(1)} changed from "${oldValues[field]}" to "${newValue}"`,
        });
      }

      // Send notification
      try {
        const changedFields = Object.keys(changes).join(', ');
        await db.sendNotification('ticket_updated', selectedTicket.id, `Ticket updated: ${changedFields} changed`);
      } catch (notificationError) {
        console.error('Failed to send notification:', notificationError);
      }

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
            <div className="text-gray-500">Loading users...</div>
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            {/* Current user option */}
            <button
              className="w-full px-4 py-2 text-left bg-gray-50 hover:bg-gray-100 rounded border"
              onClick={() => handleAssignToUser(profile.id, profile.full_name)}
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
            
            {/* Other available users */}
            {availableUsers
              .filter(user => user.id !== profile.id)
              .map((user) => (
                <button
                  key={user.id}
                  className="w-full px-4 py-2 text-left bg-gray-50 hover:bg-gray-100 rounded border"
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
                className="w-full px-4 py-2 text-left bg-red-50 hover:bg-red-100 rounded border border-red-200"
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
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
            onClick={closeModals}
            disabled={actionLoading}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  const renderDeleteModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <AlertTriangle className="h-6 w-6 text-red-500 mr-2" />
            <h2 className="text-xl font-semibold">Delete Ticket</h2>
          </div>
          <button
            onClick={closeModals}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <p className="text-gray-600 mb-6">
          Are you sure you want to delete ticket #{selectedTicket?.id.slice(0, 6)}? 
          This action cannot be undone.
        </p>
        
        <div className="bg-red-50 border border-red-200 rounded p-3 mb-6">
          <p className="text-sm text-red-800">
            <strong>Warning:</strong> This will permanently delete the ticket and all its comments.
          </p>
        </div>
        
        <div className="flex justify-end space-x-3">
          <button
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded transition-colors"
            onClick={closeModals}
            disabled={actionLoading}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
            onClick={handleDeleteConfirm}
            disabled={actionLoading}
          >
            {actionLoading ? "Deleting..." : "Delete"}
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
                            #{ticket.id.slice(0, 6)} - {ticket.title}
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