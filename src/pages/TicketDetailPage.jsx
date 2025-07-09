import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../lib/supabase.js";
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
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  // Event handlers
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
    const updatedHistory = await db.getTicketHistory(ticket.id);
    setHistory(updatedHistory);
    
    // Send notification
    try {
      await db.sendNotification('ticket_comment', ticket.id, newComment);
    } catch (notificationError) {
      console.error('Failed to send notification:', notificationError);
      // Don't fail the whole operation if notification fails
    }
    
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
    
    // Send notification
    try {
      await db.sendNotification('ticket_updated', ticket.id, `Status changed from ${ticket.status} to ${newStatus}`);
    } catch (notificationError) {
      console.error('Failed to send notification:', notificationError);
    }
    
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

  const handleAssignment = () => {
    setShowAssignmentModal(true);
  };

  const handleAssignToUser = async (selectedUserId, selectedUserName) => {
  // Check if ticket is already assigned to selected user
  if (ticket.assigned_to === selectedUserId) {
    toast.error(`Ticket is already assigned to ${selectedUserName}!`);
    return;
  }

  try {
    await db.updateTicket(ticket.id, {
      assigned_to: selectedUserId,
    });

    await db.addTicketComment({
      ticket_id: ticket.id,
      user_id: profile.id,
      comment_type: "assignment",
      old_value: ticket?.assignee_profile?.full_name || "Unassigned",
      new_value: selectedUserName,
      comment: `Assigned to ${selectedUserName}`,
    });

    // Send notification to assigned user
    try {
      await db.sendNotification('ticket_assigned', ticket.id, `Ticket assigned to ${selectedUserName}`, selectedUserId);
    } catch (notificationError) {
      console.error('Failed to send notification:', notificationError);
    }

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
          <button className="btn-secondary">
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

  const renderAssignmentModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Assign Ticket</h2>
        <p className="text-gray-600 mb-6">
          Choose who to assign this ticket to:
        </p>
        <div className="space-y-3 mb-6">
          <button
            className="w-full px-4 py-2 text-left bg-gray-50 hover:bg-gray-100 rounded border"
            onClick={() => handleAssignToUser(profile.id, profile.full_name)}
          >
            <div className="flex items-center justify-between">
              <span>{profile.full_name} (Me)</span>
              {ticket.assigned_to === profile.id && (
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  Currently Assigned
                </span>
              )}
            </div>
          </button>
          
          {/* Add more users here if you have a users list */}
          <div className="text-sm text-gray-500 text-center py-2">
            More assignment options can be added here
          </div>
        </div>
        
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

      {showAssignmentModal && renderAssignmentModal()}
    </div>
  );
};

export default TicketDetailPage;