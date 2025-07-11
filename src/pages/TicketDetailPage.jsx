import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { db, supabase } from "../lib/supabase.js";
import { toast } from "react-hot-toast";
import {
  ArrowLeft,
  Clock,
  User,
  MessageSquare,
  Edit,
  UserCheck,
} from "lucide-react";

const TicketDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();

  // State management
  const [ticket, setTicket] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
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

  // Notification helper functions (same as TicketsPage)
  const buildNotificationPayload = (ticket, type, message, additionalData = {}) => ({
    type,
    ticket_id: ticket.id,
    ticket_title: ticket.title,
    ticket_base: ticket.base,
    message,
    actor_name: profile?.full_name || profile?.email || 'Unknown User',
    actor_role: profile?.role,
    actor_id: profile?.id,
    created_by: ticket.creator_profile?.id || ticket.created_by,
    assigned_to: ticket.assigned_to,
    // Debug info
    debug_info: {
      should_notify_creator: (ticket.creator_profile?.id || ticket.created_by) !== profile?.id,
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

  // Utility functions
  const formatDate = (dateString) =>
    new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const getStatusBadge = (status) => {
    const styles = {
      Open: "badge-error",
      "In Progress": "badge-warning",
      Resolved: "badge-success",
      Closed: "badge-secondary",
    };
    return styles[status] || "badge-secondary";
  };

  const getPriorityBadge = (priority) => {
    const styles = {
      Low: "badge-success",
      Medium: "badge-warning",
      High: "badge-error",
      Critical: "badge-error",
    };
    return styles[priority] || "badge-secondary";
  };

  const canManageTicket = () => {
    return (
      profile?.role === "Admin" ||
      profile?.role === "HIS" ||
      (profile?.role === "User" &&
        ticket?.creator_profile?.full_name === profile?.full_name)
    );
  };

  // Data fetching
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const ticketData = await db.getTicket(id);
        const historyData = await db.getTicketHistory(id);
        setTicket(ticketData);
        setHistory(historyData);
      } catch (err) {
        console.error("Error loading ticket:", err.message);
        toast.error("Failed to load ticket details.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  // Event handlers
  const handleEdit = () => {
    setEditForm({
      title: ticket.title,
      description: ticket.description,
      priority: ticket.priority,
      base: ticket.base,
      status: ticket.status
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    try {
      setEditLoading(true);
      
      // Check what fields have changed
      const changes = {};
      const changeDetails = [];
      
      if (editForm.title !== ticket.title) {
        changes.title = editForm.title;
        changeDetails.push({
          field: 'title',
          old_value: ticket.title,
          new_value: editForm.title
        });
      }
      if (editForm.description !== ticket.description) {
        changes.description = editForm.description;
        changeDetails.push({
          field: 'description',
          old_value: ticket.description,
          new_value: editForm.description
        });
      }
      if (editForm.priority !== ticket.priority) {
        changes.priority = editForm.priority;
        changeDetails.push({
          field: 'priority',
          old_value: ticket.priority,
          new_value: editForm.priority
        });
      }
      if (editForm.base !== ticket.base) {
        changes.base = editForm.base;
        changeDetails.push({
          field: 'base',
          old_value: ticket.base,
          new_value: editForm.base
        });
      }
      if (editForm.status !== ticket.status) {
        changes.status = editForm.status;
        changeDetails.push({
          field: 'status',
          old_value: ticket.status,
          new_value: editForm.status
        });
      }

      // If no changes, just close modal
      if (Object.keys(changes).length === 0) {
        setShowEditModal(false);
        return;
      }

      // Update ticket
      await db.updateTicket(ticket.id, changes);

      // Add comment for each change
      for (const change of changeDetails) {
        await db.addTicketComment({
          ticket_id: ticket.id,
          user_id: profile.id,
          comment_type: "comment",
          comment: `${change.field.charAt(0).toUpperCase() + change.field.slice(1)} changed from "${change.old_value}" to "${change.new_value}"`,
        });
      }

      // Send optimized notification for all changes (same as TicketsPage)
      const changedFields = changeDetails.map(c => c.field).join(', ');
      await sendOptimizedNotification(
        ticket,
        'ticket_updated',
        `Ticket updated: ${changedFields} changed`,
        {
          changes: changeDetails,
          old_base: ticket.base,
          new_base: editForm.base
        }
      );

      // Refresh data
      const updatedTicket = await db.getTicket(ticket.id);
      const updatedHistory = await db.getTicketHistory(ticket.id);
      setTicket(updatedTicket);
      setHistory(updatedHistory);
      
      setShowEditModal(false);
      toast.success("Ticket updated successfully!");
    } catch (error) {
      console.error("Error updating ticket:", error.message);
      toast.error("Failed to update ticket. Please try again.");
    } finally {
      setEditLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      const comment = {
        ticket_id: ticket.id,
        user_id: profile.id,
        comment: newComment,
        comment_type: "comment",
      };
      await db.addTicketComment(comment);
      setNewComment("");
      
      // Send optimized notification
      await sendOptimizedNotification(
        ticket,
        'ticket_comment',
        `New comment: ${newComment.substring(0, 100)}${newComment.length > 100 ? '...' : ''}`
      );
      
      const updatedHistory = await db.getTicketHistory(ticket.id);
      setHistory(updatedHistory);
      
      toast.success("Comment added successfully!");
    } catch (err) {
      console.error("Error adding comment:", err.message);
      toast.error("Failed to add comment.");
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (newStatus === ticket.status) return;
    try {
      await db.updateTicket(ticket.id, { status: newStatus });
      await db.addTicketComment({
        ticket_id: ticket.id,
        user_id: profile.id,
        comment: `Status changed from ${ticket.status} to ${newStatus}`,
        comment_type: "status_change",
        old_value: ticket.status,
        new_value: newStatus,
      });
      
      // Send optimized notification
      await sendOptimizedNotification(
        ticket,
        'ticket_status_change',
        `Status changed from ${ticket.status} to ${newStatus}`,
        {
          old_status: ticket.status,
          new_status: newStatus
        }
      );
      
      const updatedTicket = await db.getTicket(ticket.id);
      const updatedHistory = await db.getTicketHistory(ticket.id);
      setTicket(updatedTicket);
      setHistory(updatedHistory);
      toast.success(`Status changed to ${newStatus}`);
    } catch (err) {
      console.error("Error changing status:", err.message);
      toast.error("Failed to change status.");
    }
  };

  const handleAssignment = async () => {
    setShowAssignmentModal(true);
    
    // Fetch available users for assignment
    try {
      setUsersLoading(true);
      
      // Try using RPC function first, fallback to direct query
      let data, error;
      
      try {
        // Try using a database function that bypasses RLS
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_assignable_users');
        if (rpcError) throw rpcError;
        data = rpcData;
        console.log('Users from RPC function:', data);
      } catch (rpcError) {
        console.log('RPC function not available, trying direct query...');
        
        // Fallback to direct query
        const response = await supabase
          .from('profiles')
          .select('id, email, full_name, role, base')
          .or('role.eq.Admin,role.eq.HIS')
          .order('full_name', { nullsFirst: false });
        
        data = response.data;
        error = response.error;
        console.log('Users from direct query:', data);
      }
      
      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
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

  const handleAssignToUser = async (selectedUserId, selectedUserName) => {
    // Check if ticket is already assigned to selected user
    if (ticket.assigned_to === selectedUserId) {
      toast.error(`Ticket is already assigned to ${selectedUserName}!`);
      return;
    }

    try {
      const oldAssigneeName = ticket?.assignee_profile?.full_name || "Unassigned";
      
      await db.updateTicket(ticket.id, {
        assigned_to: selectedUserId,
      });

      await db.addTicketComment({
        ticket_id: ticket.id,
        user_id: profile.id,
        comment_type: "assignment",
        old_value: oldAssigneeName,
        new_value: selectedUserName,
        comment: `Assigned to ${selectedUserName}`,
      });

      // Send optimized notification (same as TicketsPage)
      await sendOptimizedNotification(
        ticket,
        'ticket_assignment',
        `Ticket assigned to ${selectedUserName}`,
        {
          old_assignee: ticket.assigned_to,
          new_assignee: selectedUserId,
          old_assignee_name: oldAssigneeName,
          new_assignee_name: selectedUserName
        }
      );

      const updatedTicket = await db.getTicket(ticket.id);
      setTicket(updatedTicket);
      const updatedHistory = await db.getTicketHistory(ticket.id);
      setHistory(updatedHistory);

      toast.success(`Ticket assigned to ${selectedUserName}!`);
    } catch (err) {
      console.error("Assignment error:", err.message);
      toast.error("Failed to assign ticket.");
    } finally {
      setShowAssignmentModal(false);
    }
  };

  // Loading state
  if (loading || !ticket) {
    return (
      <div className="p-6 text-center text-gray-500">
        Loading ticket details...
      </div>
    );
  }

  // Render components
  const renderHeader = () => (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate("/tickets")}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-md"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Ticket #{ticket.id.slice(0, 6)}
          </h1>
          <p className="text-sm text-gray-600">
            Created {formatDate(ticket.created_at)}
          </p>
        </div>
      </div>
      {canManageTicket() && (
        <div className="flex space-x-2">
          <button onClick={handleEdit} className="btn-secondary">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </button>
          {(profile?.role === "Admin" || profile?.role === "HIS") && (
            <button onClick={handleAssignment} className="btn-secondary">
              <UserCheck className="h-4 w-4 mr-2" />
              Assign
            </button>
          )}
        </div>
      )}
    </div>
  );

  const renderTicketDescription = () => (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-medium text-gray-900">{ticket.title}</h3>
      </div>
      <div className="card-body">
        <p className="text-gray-700 whitespace-pre-line">
          {ticket.description}
        </p>
      </div>
    </div>
  );

  const renderActivityHistory = () => (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-medium text-gray-900 flex items-center">
          <MessageSquare className="h-5 w-5 mr-2" />
          Activity History
        </h3>
      </div>
      <div className="card-body p-0">
        <div className="space-y-4 p-6">
          {history.map((entry) => (
            <div key={entry.id} className="flex space-x-3">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                  <User className="h-4 w-4 text-gray-600" />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-900">
                    {entry.user?.full_name || "Unknown"}
                  </span>
                  <span className="text-sm text-gray-500">
                    {entry.comment_type === "status_change"
                      ? `changed status from ${entry.old_value} to ${entry.new_value}`
                      : entry.comment_type === "assignment"
                      ? `assigned ticket to ${entry.new_value}`
                      : "commented"}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatDate(entry.created_at)}
                  </span>
                </div>
                {entry.comment && (
                  <p className="text-sm text-gray-700 mt-1">{entry.comment}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderAddComment = () => (
    <div className="card">
      <div className="card-body">
        <label htmlFor="comment" className="form-label">
          Add Comment
        </label>
        <textarea
          id="comment"
          rows={3}
          className="form-input"
          placeholder="Add a comment or update..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
        />
        <div className="mt-3 flex justify-end">
          <button
            onClick={handleAddComment}
            disabled={!newComment.trim()}
            className="btn-primary"
          >
            Add Comment
          </button>
        </div>
      </div>
    </div>
  );

  const renderTicketDetails = () => (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-medium text-gray-900">Details</h3>
      </div>
      <div className="card-body space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-500">Status</label>
          <div className="mt-1 flex items-center justify-between">
            <span className={`badge ${getStatusBadge(ticket.status)}`}>
              {ticket.status}
            </span>
            {(profile?.role === "Admin" || profile?.role === "HIS") && (
              <select
                className="text-xs border border-gray-300 rounded px-2 py-1"
                value={ticket.status}
                onChange={(e) => handleStatusChange(e.target.value)}
              >
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
              </select>
            )}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-500">Priority</label>
          <span className={`badge ${getPriorityBadge(ticket.priority)} mt-1`}>
            {ticket.priority}
          </span>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-500">Base</label>
          <p className="mt-1 text-sm text-gray-900">{ticket.base}</p>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-500">
            Submitted By
          </label>
          <p className="mt-1 text-sm text-gray-900">
            {ticket.creator_profile?.full_name || "Unknown"}
          </p>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-500">
            Assigned To
          </label>
          <div className="mt-1 flex items-center justify-between">
            <p className="text-sm text-gray-900">
              {ticket.assignee_profile?.full_name || "Unassigned"}
            </p>
            {(profile?.role === "Admin" || profile?.role === "HIS") && (
              <button
                onClick={handleAssignment}
                className="text-xs text-primary-600 hover:text-primary-700"
              >
                Change
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderTimeline = () => (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-medium text-gray-900 flex items-center">
          <Clock className="h-5 w-5 mr-2" />
          Timeline
        </h3>
      </div>
      <div className="card-body space-y-3">
        <div className="flex items-center text-sm">
          <span className="text-gray-500">Created:</span>
          <span className="ml-2 text-gray-900">
            {formatDate(ticket.created_at)}
          </span>
        </div>
        <div className="flex items-center text-sm">
          <span className="text-gray-500">Last Updated:</span>
          <span className="ml-2 text-gray-900">
            {formatDate(ticket.updated_at)}
          </span>
        </div>
      </div>
    </div>
  );

  const renderEditModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl max-h-screen overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Edit Ticket</h2>
          <button
            onClick={() => setShowEditModal(false)}
            className="text-gray-400 hover:text-gray-600"
            disabled={editLoading}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
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
            onClick={() => setShowEditModal(false)}
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
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{profile.full_name || profile.email} (Me)</span>
                  <span className="text-sm text-gray-500 ml-2">({profile.role})</span>
                </div>
                {ticket.assigned_to === profile.id && (
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
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{user.display_name}</span>
                      <span className="text-sm text-gray-500 ml-2">({user.role})</span>
                      {user.base && (
                        <span className="text-xs text-gray-400 ml-1">- {user.base}</span>
                      )}
                    </div>
                    {ticket.assigned_to === user.id && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        Currently Assigned
                      </span>
                    )}
                  </div>
                </button>
              ))
            }
            
            {/* Unassign option */}
            {ticket.assigned_to && (
              <button
                className="w-full px-4 py-2 text-left bg-red-50 hover:bg-red-100 rounded border border-red-200"
                onClick={() => handleAssignToUser(null, "Unassigned")}
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
            onClick={() => setShowAssignmentModal(false)}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {renderHeader()}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {renderTicketDescription()}
          {renderActivityHistory()}
          {renderAddComment()}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {renderTicketDetails()}
          {renderTimeline()}
        </div>
      </div>

      {showEditModal && renderEditModal()}
      {showAssignmentModal && renderAssignmentModal()}
    </div>
  );
};

export default TicketDetailPage;