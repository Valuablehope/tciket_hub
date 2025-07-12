import React, { useEffect, useState, useMemo, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import { db, supabase } from "../lib/supabase.js"
import { toast } from "react-hot-toast"
import {
  ArrowLeft,
  Clock,
  User,
  MessageSquare,
  Edit,
  UserCheck,
  AlertCircle,
  X
} from "lucide-react"

const TicketDetailPage = () => {
  // FIXED: Renamed parameter to reflect it's actually a UUID, not ticket_number
  const { id: ticketId } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()

  // ALL HOOKS MUST BE DECLARED FIRST - NO EARLY RETURNS BEFORE THIS POINT
  // State management
  const [ticket, setTicket] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [newComment, setNewComment] = useState("")
  const [showAssignmentModal, setShowAssignmentModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    priority: "",
    base_id: "",
    status: ""
  })
  const [editLoading, setEditLoading] = useState(false)
  const [availableUsers, setAvailableUsers] = useState([])
  const [availableBases, setAvailableBases] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)

  // Memoized helper functions
  const formatDate = useCallback((dateString) => {
    if (!dateString) return 'Unknown'
    try {
      return new Date(dateString).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return 'Invalid date'
    }
  }, [])

  const getStatusBadge = useCallback((status) => {
    const styles = {
      Open: "badge-error",
      "In Progress": "badge-warning",
      Resolved: "badge-success",
      Closed: "badge-secondary",
    }
    return styles[status] || "badge-secondary"
  }, [])

  const getPriorityBadge = useCallback((priority) => {
    const styles = {
      Low: "badge-success",
      Medium: "badge-warning",
      High: "badge-error",
      Critical: "badge-error",
    }
    return styles[priority] || "badge-secondary"
  }, [])

  // Memoized derived data with null safety
  const ticketDisplayData = useMemo(() => {
    if (!ticket) return null

    console.log('🔍 PROCESSING TICKET DATA:', ticket)

    // Safe access helpers
    const getTicketId = () => ticket?.id || 'unknown'
    const getShortId = () => {
      const ticketId = getTicketId()
      return ticketId && ticketId !== 'unknown' ? ticketId.slice(0, 6) : 'Unknown'
    }

    const getBaseName = () => {
      if (ticket.base_name) return ticket.base_name
      if (ticket.base && typeof ticket.base === 'string') return ticket.base
      if (ticket.base && ticket.base.name) return ticket.base.name
      if (ticket.bases && ticket.bases.name) return ticket.bases.name
      if (ticket.base_id) return `Base ID: ${ticket.base_id}`
      return 'Unknown Base'
    }

    const getCreatorName = () => {
      if (ticket.creator_profile) {
        if (typeof ticket.creator_profile === 'string') return ticket.creator_profile
        if (ticket.creator_profile.full_name) return ticket.creator_profile.full_name
        if (ticket.creator_profile.name) return ticket.creator_profile.name
        if (ticket.creator_profile.email) return ticket.creator_profile.email
      }
      if (ticket.created_by) return `User ID: ${ticket.created_by}`
      return 'Unknown User'
    }

    const getAssigneeName = () => {
      if (!ticket.assigned_to) return 'Unassigned'
      
      if (ticket.assignee_profile) {
        if (typeof ticket.assignee_profile === 'string') return ticket.assignee_profile
        if (ticket.assignee_profile.full_name) return ticket.assignee_profile.full_name
        if (ticket.assignee_profile.name) return ticket.assignee_profile.name
        if (ticket.assignee_profile.email) return ticket.assignee_profile.email
      }
      
      return `User ID: ${ticket.assigned_to}`
    }

    const getFormattedDate = (dateField) => {
      const date = ticket[dateField]
      if (!date) return 'Unknown'
      try {
        return formatDate(date)
      } catch {
        return 'Invalid date'
      }
    }

    const result = {
      shortId: getShortId(),
      baseName: getBaseName(),
      creatorName: getCreatorName(),
      assigneeName: getAssigneeName(),
      createdAt: getFormattedDate('created_at'),
      updatedAt: getFormattedDate('updated_at'),
      title: ticket.title || 'Untitled',
      description: ticket.description || 'No description provided.',
      status: ticket.status || 'Unknown',
      priority: ticket.priority || 'Medium'
    }

    console.log('🔍 PROCESSED DISPLAY DATA:', result)
    return result
  }, [ticket, formatDate])

  const canManageTicket = useMemo(() => {
    if (!profile || !ticket) return false
    
    return (
      profile.role === "Admin" ||
      profile.role === "HIS" ||
      (profile.role === "User" && ticket.created_by === profile.id)
    )
  }, [profile, ticket])

  // Optimized notification function with null safety
  const sendOptimizedNotification = useCallback(async (ticket, type, message, additionalData = {}) => {
    if (!profile?.id || !ticket?.id) {
      console.warn('Cannot send notification: missing profile or ticket data')
      return { success: false, error: 'Missing required data' }
    }

    try {
      const payload = {
        type,
        ticket_id: ticket.id,
        ticket_title: ticket.title || 'Untitled',
        message,
        actor_id: profile.id,
        created_by: ticket.created_by,
        assigned_to: ticket.assigned_to,
        ...additionalData
      }
      
      if (typeof db.sendOptimizedNotification === 'function') {
        return await db.sendOptimizedNotification(payload)
      } else {
        return await db.sendNotification(type, ticket.id, message)
      }
    } catch (error) {
      console.error('Failed to send notification:', error)
      return { success: false, error: error.message }
    }
  }, [profile])

  // Event handlers with null safety
  const handleEdit = useCallback(() => {
    if (!ticket) return
    
    setEditForm({
      title: ticket.title || '',
      description: ticket.description || '',
      priority: ticket.priority || 'Medium',
      base_id: ticket.base_id || '',
      status: ticket.status || 'Open'
    })
    setShowEditModal(true)
  }, [ticket])

  const handleSaveEdit = useCallback(async () => {
  if (!ticket || !profile?.id) return;
  
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
        changes.description = editForm.description
        changeDetails.push({
          field: 'description',
          old_value: ticket.description,
          new_value: editForm.description
        })
      }
      if (editForm.priority !== ticket.priority) {
        changes.priority = editForm.priority
        changeDetails.push({
          field: 'priority',
          old_value: ticket.priority,
          new_value: editForm.priority
        })
      }
      if (parseInt(editForm.base_id) !== ticket.base_id) {
        changes.base_id = parseInt(editForm.base_id)
        const oldBaseName = ticketDisplayData?.baseName || 'Unknown'
        const newBaseName = availableBases.find(b => b.id === parseInt(editForm.base_id))?.name || 'Unknown'
        changeDetails.push({
          field: 'base',
          old_value: oldBaseName,
          new_value: newBaseName
        })
      }
      if (editForm.status !== ticket.status) {
        changes.status = editForm.status
        changeDetails.push({
          field: 'status',
          old_value: ticket.status,
          new_value: editForm.status
        })
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

    // ENHANCED: Send update notification
    const changedFields = changeDetails.map(c => c.field).join(', ');
    await db.sendOptimizedNotification({
      type: 'ticket_updated',
      ticket_id: ticket.id,
      ticket_title: editForm.title || ticket.title,
      ticket_base: ticket.base_name || ticket.base,
      message: `Ticket updated: ${changedFields} changed`,
      actor_id: profile.id,
      created_by: ticket.created_by,
      assigned_to: ticket.assigned_to,
      base_id: ticket.base_id,
      changes: changeDetails
    });

    // Refresh data
    const [updatedTicket, updatedHistory] = await Promise.all([
      db.getTicket(ticketId),
      db.getTicketHistory(ticket.id)
    ]);
    
    setTicket(updatedTicket);
    setHistory(updatedHistory);
    setShowEditModal(false);
    toast.success("Ticket updated successfully!");
  } catch (error) {
    console.error("Error updating ticket:", error);
    toast.error("Failed to update ticket. Please try again.");
  } finally {
    setEditLoading(false);
  }
}, [ticket, editForm, profile, ticketDisplayData, availableBases, ticketId]);

  const handleAddComment = useCallback(async () => {
    if (!newComment.trim() || !ticket || !profile?.id) return;
  
  try {
    const comment = {
      ticket_id: ticket.id,
      user_id: profile.id,
      comment: newComment.trim(),
      comment_type: "comment",
    };
    
    await db.addTicketComment(comment);
    setNewComment("");
    
    // ENHANCED: Send comment notification
    await db.sendOptimizedNotification({
      type: 'ticket_comment',
      ticket_id: ticket.id,
      ticket_title: ticket.title,
      ticket_base: ticket.base_name || ticket.base,
      message: `New comment: ${newComment.substring(0, 100)}${newComment.length > 100 ? '...' : ''}`,
      actor_id: profile.id,
      created_by: ticket.created_by,
      assigned_to: ticket.assigned_to,
      base_id: ticket.base_id
    });
    
    // Refresh history
    const updatedHistory = await db.getTicketHistory(ticket.id);
    setHistory(updatedHistory);
    
    toast.success("Comment added successfully!");
  } catch (err) {
    console.error("Error adding comment:", err);
    toast.error("Failed to add comment.");
  }
}, [newComment, ticket, profile]);

  const handleStatusChange = useCallback(async (newStatus) => {
    if (!ticket || !profile?.id || newStatus === ticket.status) return;
  
  try {
    // Update ticket status
    await db.updateTicket(ticket.id, { status: newStatus });
    
    // Add comment
    await db.addTicketComment({
      ticket_id: ticket.id,
      user_id: profile.id,
      comment: `Status changed from ${ticket.status} to ${newStatus}`,
      comment_type: "status_change",
      old_value: ticket.status,
      new_value: newStatus,
    });
    
    // ENHANCED: Send status change notification
    await db.sendOptimizedNotification({
      type: 'ticket_status_change',
      ticket_id: ticket.id,
      ticket_title: ticket.title,
      ticket_base: ticket.base_name || ticket.base,
      message: `Status changed from ${ticket.status} to ${newStatus}`,
      actor_id: profile.id,
      created_by: ticket.created_by,
      assigned_to: ticket.assigned_to,
      base_id: ticket.base_id
    });
    
    // Refresh data
    const [updatedTicket, updatedHistory] = await Promise.all([
      db.getTicket(ticketId),
      db.getTicketHistory(ticket.id)
    ]);
    
    setTicket(updatedTicket);
    setHistory(updatedHistory);
    toast.success(`Status changed to ${newStatus}`);
  } catch (err) {
    console.error("Error changing status:", err);
    toast.error("Failed to change status.");
  }
}, [ticket, profile, ticketId]);

  const handleAssignment = useCallback(async () => {
  // Add null check for ticket
  if (!ticket) {
    toast.error('Ticket data not loaded yet. Please wait and try again.')
    return
  }

  // Only Admin and HIS can assign tickets
  if (!profile?.role || !['Admin', 'HIS'].includes(profile.role)) {
    toast.error('Access denied: Only Admin and HIS users can assign tickets.')
    return
  }

  setShowAssignmentModal(true)
  try {
    setUsersLoading(true)
    let data, error

    if (profile?.role === "Admin") {
      // Admin can assign across all bases
      const result = await supabase.rpc('get_admin_assignable_users_secure')
      data = result.data
      error = result.error
    } else if (profile?.role === "HIS") {
      // HIS can assign within their base
      const result = await supabase.rpc('get_assignable_users_secure', {
        base_id: ticket.base_id
      })
      data = result.data
      error = result.error
    }

    if (error) {
      console.error('RPC Error:', error)
      throw error
    }

    const processedUsers = (data || []).map(user => ({
      ...user,
      display_name: user.full_name || user.email || 'Unknown User'
    }))
    setAvailableUsers(processedUsers)
  } catch (error) {
    console.error('Error fetching users:', error)
    toast.error('Failed to load available users.')
    setAvailableUsers([])
  } finally {
    setUsersLoading(false)
  }
}, [ticket, profile?.role])

  const handleAssignToUser = useCallback(async (selectedUserId, selectedUserName) => {
    if (!ticket || !profile?.id) return;
  
  if (ticket.assigned_to === selectedUserId) {
    toast.error(`Ticket is already assigned to ${selectedUserName}!`);
    return;
  }

  try {
    const oldAssigneeName = ticketDisplayData?.assigneeName || "Unassigned";
    
    // Update ticket assignment
    await db.updateTicket(ticket.id, {
      assigned_to: selectedUserId,
    });

    // Add comment for the assignment change
    await db.addTicketComment({
      ticket_id: ticket.id,
      user_id: profile.id,
      comment_type: "assignment",
      old_value: oldAssigneeName,
      new_value: selectedUserName || "Unassigned",
      comment: selectedUserId ? `Assigned to ${selectedUserName}` : "Unassigned",
    });

    // ENHANCED: Send assignment notification
    await db.sendAssignmentNotification(
      ticket,
      ticket.assigned_to, // old assignee
      selectedUserId, // new assignee
      selectedUserName || "Unassigned",
      profile.id // actor
    );

    // Refresh data
    const [updatedTicket, updatedHistory] = await Promise.all([
      db.getTicket(ticketId),
      db.getTicketHistory(ticket.id)
    ]);
    
    setTicket(updatedTicket);
    setHistory(updatedHistory);

    toast.success(selectedUserId ? `Ticket assigned to ${selectedUserName}!` : 'Ticket unassigned!');
  } catch (err) {
    console.error("Assignment error:", err);
    toast.error("Failed to assign ticket.");
  } finally {
    setShowAssignmentModal(false);
  }
}, [ticket, profile, ticketDisplayData, ticketId]);

  // Data fetching with proper error handling
  useEffect(() => {
    if (!ticketId) {
      setError('No ticket ID provided')
      setLoading(false)
      return
    }

    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        console.log('🔍 Fetching ticket data for ID:', ticketId)
        
        // FIXED: Use ticketId for both calls, but supabase.js will handle appropriately
        const [ticketData, historyData] = await Promise.all([
          db.getTicket(ticketId), // This is UUID from URL
          db.getTicketHistory(ticketId) // This will be UUID too
        ])
        
        console.log('🔍 RAW TICKET DATA:', ticketData)
        console.log('🔍 RAW HISTORY DATA:', historyData)
        
        if (!ticketData) {
          setError('Ticket not found')
          return
        }
        
        setTicket(ticketData)
        setHistory(historyData || [])
      } catch (err) {
        console.error("Error loading ticket:", err)
        setError(err.message || 'Failed to load ticket details')
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [ticketId])

  // Load bases when edit modal opens
  useEffect(() => {
    if (showEditModal && availableBases.length === 0) {
      const loadBases = async () => {
        try {
          const bases = await db.getAllBases()
          setAvailableBases(bases)
        } catch (error) {
          console.error('Failed to load bases:', error)
        }
      }
      loadBases()
    }
  }, [showEditModal, availableBases.length])

  // CONDITIONAL RENDERING ONLY AFTER ALL HOOKS ARE DECLARED
  
  // Early return if essential data is missing
  if (!profile) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="loading-spinner h-8 w-8"></div>
        <span className="ml-2">Loading user profile...</span>
      </div>
    )
  }

  if (!ticketId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate("/tickets")}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-md"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Error</h1>
            <p className="text-sm text-gray-600">No ticket ID provided</p>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate("/tickets")}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-md"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Error</h1>
            <p className="text-sm text-gray-600">Failed to load ticket</p>
          </div>
        </div>
        <div className="card">
          <div className="card-body text-center py-8">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Unable to Load Ticket</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <div className="space-x-3">
              <button
                onClick={() => window.location.reload()}
                className="btn-primary"
              >
                Try Again
              </button>
              <button
                onClick={() => navigate("/tickets")}
                className="btn-secondary"
              >
                Back to Tickets
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Loading state
  if (loading || !ticket || !ticketDisplayData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate("/tickets")}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-md"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Loading...</h1>
            <p className="text-sm text-gray-600">Please wait</p>
          </div>
        </div>
        <div className="card">
          <div className="card-body text-center py-8">
            <div className="loading-spinner h-8 w-8 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading ticket details...</p>
          </div>
        </div>
      </div>
    )
  }

  // Render components
  const renderHeader = () => (
  <div className="flex items-center justify-between">
    <div className="flex items-center space-x-4">
      <button
        onClick={() => navigate("/tickets")}
        className="p-2 text-gray-400 hover:text-gray-600 rounded-md transition-colors"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      <div>
        {/* Show the ticket_number if available, otherwise show short ID */}
        <h1 className="text-2xl font-bold text-gray-900">
          Ticket #{ticket?.ticket_number || ticketDisplayData?.shortId || 'Unknown'}
        </h1>
        <p className="text-sm text-gray-600">
          Created {ticketDisplayData?.createdAt || 'Unknown'}
        </p>
      </div>
    </div>
    {canManageTicket && (
      <div className="flex space-x-2">
        <button 
          onClick={handleEdit} 
          className="btn-secondary"
          disabled={!ticket} // Disable if ticket not loaded
        >
          <Edit className="h-4 w-4 mr-2" />
          Edit
        </button>
        {(profile?.role === "Admin" || profile?.role === "HIS") && (
          <button 
            onClick={handleAssignment} 
            className="btn-secondary"
            disabled={!ticket} // Disable if ticket not loaded
          >
            <UserCheck className="h-4 w-4 mr-2" />
            Assign
          </button>
        )}
      </div>
    )}
  </div>
)

  const renderTicketDescription = () => (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-medium text-gray-900">{ticketDisplayData?.title || 'Untitled'}</h3>
      </div>
      <div className="card-body">
        <p className="text-gray-700 whitespace-pre-line">
          {ticketDisplayData?.description || 'No description provided.'}
        </p>
      </div>
    </div>
  )

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
          {history.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No activity yet.</p>
          ) : (
            history.map((entry) => (
              <div key={entry.id} className="flex space-x-3">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <User className="h-4 w-4 text-gray-600" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900">
                      {entry.user?.full_name || entry.user_profile?.full_name || entry.user_id || "Unknown"}
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
                    <p className="text-sm text-gray-700 mt-1 break-words">{entry.comment}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )

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
  )

  const renderTicketDetails = () => (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-medium text-gray-900">Details</h3>
      </div>
      <div className="card-body space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-500">Status</label>
          <div className="mt-1 flex items-center justify-between">
            <span className={`badge ${getStatusBadge(ticketDisplayData?.status || 'Unknown')}`}>
              {ticketDisplayData?.status || 'Unknown'}
            </span>
            {(profile?.role === "Admin" || profile?.role === "HIS") && ticket?.status && (
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
          <span className={`badge ${getPriorityBadge(ticketDisplayData?.priority || 'Medium')} mt-1 inline-block`}>
            {ticketDisplayData?.priority || 'Medium'}
          </span>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-500">Base</label>
          <p className="mt-1 text-sm text-gray-900">{ticketDisplayData?.baseName || 'Unknown'}</p>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-500">
            Submitted By
          </label>
          <p className="mt-1 text-sm text-gray-900">{ticketDisplayData?.creatorName || 'Unknown'}</p>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-500">
            Assigned To
          </label>
          <div className="mt-1 flex items-center justify-between">
            <p className="text-sm text-gray-900">{ticketDisplayData?.assigneeName || 'Unassigned'}</p>
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
  )

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
          <span className="ml-2 text-gray-900">{ticketDisplayData?.createdAt || 'Unknown'}</span>
        </div>
        <div className="flex items-center text-sm">
          <span className="text-gray-500">Last Updated:</span>
          <span className="ml-2 text-gray-900">{ticketDisplayData?.updatedAt || 'Unknown'}</span>
        </div>
      </div>
    </div>
  )

  const renderEditModal = () => (
    showEditModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
        <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-screen overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-xl font-semibold">Edit Ticket</h2>
            <button
              onClick={() => setShowEditModal(false)}
              className="text-gray-400 hover:text-gray-600"
              disabled={editLoading}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="p-6 space-y-6">
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
                  value={editForm.base_id}
                  onChange={(e) => setEditForm({...editForm, base_id: e.target.value})}
                  disabled={editLoading}
                >
                  <option value="">Select Base</option>
                  {availableBases.map(base => (
                    <option key={base.id} value={base.id}>{base.name}</option>
                  ))}
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

          <div className="flex justify-end space-x-3 p-6 border-t">
            <button
              onClick={() => setShowEditModal(false)}
              className="btn-secondary"
              disabled={editLoading}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              className="btn-primary"
              disabled={editLoading}
            >
              {editLoading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    )
  )

  const renderAssignmentModal = () => (
    showAssignmentModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
        <div className="bg-white rounded-lg shadow-lg w-full max-w-md max-h-96 overflow-y-auto">
          <div className="p-6">
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
                {/* Current user option */}
                <button
                  className="w-full px-4 py-2 text-left bg-gray-50 hover:bg-gray-100 rounded border transition-colors"
                  onClick={() => handleAssignToUser(profile?.id, profile?.full_name || profile?.email)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{profile?.full_name || profile?.email || 'Me'} (Me)</span>
                      <span className="text-sm text-gray-500 ml-2">({profile?.role || 'User'})</span>
                    </div>
                    {ticket?.assigned_to === profile?.id && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        Currently Assigned
                      </span>
                    )}
                  </div>
                </button>
                
                {/* Other available users */}
                {availableUsers
                  .filter(user => user.id !== profile?.id)
                  .map((user) => (
                    <button
                      key={user.id}
                      className="w-full px-4 py-2 text-left bg-gray-50 hover:bg-gray-100 rounded border transition-colors"
                      onClick={() => handleAssignToUser(user.id, user.display_name)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium">{user.display_name}</span>
                          <span className="text-sm text-gray-500 ml-2">({user.role})</span>
                        </div>
                        {ticket?.assigned_to === user.id && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            Currently Assigned
                          </span>
                        )}
                      </div>
                    </button>
                  ))
                }
                
                {/* Unassign option */}
                {ticket?.assigned_to && (
                  <button
                    className="w-full px-4 py-2 text-left bg-red-50 hover:bg-red-100 rounded border border-red-200 transition-colors"
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
                className="btn-secondary"
                onClick={() => setShowAssignmentModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  )

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

      {renderEditModal()}
      {renderAssignmentModal()}
    </div>
  )
}

export default TicketDetailPage