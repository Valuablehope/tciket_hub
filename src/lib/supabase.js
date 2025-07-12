import { createClient } from '@supabase/supabase-js';


// Load environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('🔧 Supabase URL:', supabaseUrl);
console.log('🔧 Supabase ANON KEY:', supabaseAnonKey?.slice(0, 8) + '…');

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});

// Database helper functions
export const db = {
  // Profiles
  async getProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data;
  },

  async updateProfile(userId, updates) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // User Settings
  async getUserSettings(userId) {
    try {
      // First, try to get existing settings
      let { data: settings, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      // If no settings exist, create default ones
      if (error && error.code === 'PGRST116') {
        const { data: newSettings, error: insertError } = await supabase
          .from('user_settings')
          .insert([{ user_id: userId }])
          .select()
          .single();

        if (insertError) throw insertError;
        settings = newSettings;
      } else if (error) {
        throw error;
      }

      if (!settings) {
        throw new Error('Failed to retrieve user settings');
      }

      // Transform flat structure to match component's expected format
      return {
        notifications: {
          email_notifications: settings.email_notifications,
          telegram_notifications: settings.telegram_notifications,
          ticket_updates: settings.ticket_updates,
          assignment_notifications: settings.assignment_notifications,
          weekly_reports: settings.weekly_reports
        },
        security: {
          password_last_changed: settings.password_last_changed,
          password_change_required: settings.password_change_required
        },
        telegram: {
          username: settings.telegram_username,
          chat_id: settings.telegram_chat_id,
          is_connected: settings.telegram_is_connected,
          connected_at: settings.telegram_connected_at
        }
      };
    } catch (error) {
      console.error('Error getting user settings:', error);
      throw error;
    }
  },

  async updateUserSettings(userId, updates) {
    try {
      // Ensure settings exist first
      await this.getUserSettings(userId);

      // Flatten the updates object to match database columns
      const flatUpdates = {};
      
      if (updates.notifications) {
        if (updates.notifications.email_notifications !== undefined) {
          flatUpdates.email_notifications = updates.notifications.email_notifications;
        }
        if (updates.notifications.telegram_notifications !== undefined) {
          flatUpdates.telegram_notifications = updates.notifications.telegram_notifications;
        }
        if (updates.notifications.ticket_updates !== undefined) {
          flatUpdates.ticket_updates = updates.notifications.ticket_updates;
        }
        if (updates.notifications.assignment_notifications !== undefined) {
          flatUpdates.assignment_notifications = updates.notifications.assignment_notifications;
        }
        if (updates.notifications.weekly_reports !== undefined) {
          flatUpdates.weekly_reports = updates.notifications.weekly_reports;
        }
      }
      
      if (updates.security) {
        if (updates.security.password_last_changed !== undefined) {
          flatUpdates.password_last_changed = updates.security.password_last_changed;
        }
        if (updates.security.password_change_required !== undefined) {
          flatUpdates.password_change_required = updates.security.password_change_required;
        }
      }
      
      if (updates.telegram) {
        if (updates.telegram.username !== undefined) {
          flatUpdates.telegram_username = updates.telegram.username;
        }
        if (updates.telegram.chat_id !== undefined) {
          flatUpdates.telegram_chat_id = updates.telegram.chat_id;
        }
        if (updates.telegram.is_connected !== undefined) {
          flatUpdates.telegram_is_connected = updates.telegram.is_connected;
        }
        if (updates.telegram.connected_at !== undefined) {
          flatUpdates.telegram_connected_at = updates.telegram.connected_at;
        }
      }

      // Only proceed if there are updates to make
      if (Object.keys(flatUpdates).length === 0) {
        return this.getUserSettings(userId);
      }

      const { data, error } = await supabase
        .from('user_settings')
        .update(flatUpdates)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      
      if (!data) {
        throw new Error('Failed to update user settings');
      }

      // Transform back to expected format
      return {
        notifications: {
          email_notifications: data.email_notifications,
          telegram_notifications: data.telegram_notifications,
          ticket_updates: data.ticket_updates,
          assignment_notifications: data.assignment_notifications,
          weekly_reports: data.weekly_reports
        },
        security: {
          password_last_changed: data.password_last_changed,
          password_change_required: data.password_change_required
        },
        telegram: {
          username: data.telegram_username,
          chat_id: data.telegram_chat_id,
          is_connected: data.telegram_is_connected,
          connected_at: data.telegram_connected_at
        }
      };
    } catch (error) {
      console.error('Error updating user settings:', error);
      throw error;
    }
  },

  // Telegram functions
  async connectTelegram(userId, username) {
  try {
    const cleanUsername = username.startsWith('@') ? username : `@${username}`;
    
    const { data, error } = await supabase
      .from('user_settings')
      .update({
        telegram_username: cleanUsername,
        telegram_chat_id: null, // Will be set during verification
        telegram_is_connected: false, // Will be set to true after verification
        telegram_connected_at: null // Will be set after verification
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    
    return {
      username: cleanUsername,
      pending: true
    };
  } catch (error) {
    console.error('Error saving Telegram username:', error);
    throw error;
  }
},

// Add new verification function
async verifyTelegramConnection(userId, chatId) {
  try {
    const { data, error } = await supabase
      .from('user_settings')
      .update({
        telegram_chat_id: chatId,
        telegram_is_connected: true,
        telegram_connected_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error verifying Telegram connection:', error);
    throw error;
  }
},

  async disconnectTelegram(userId) {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .update({
          telegram_username: null,
          telegram_chat_id: null,
          telegram_is_connected: false,
          telegram_connected_at: null
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error disconnecting Telegram:', error);
      throw error;
    }
  },

  async verifyTelegramConnection(userId, chatId) {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .update({
          telegram_chat_id: chatId,
          telegram_is_connected: true
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error verifying Telegram connection:', error);
      throw error;
    }
  },

  async changePassword(currentPassword, newPassword) {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error changing password:', error);
      throw error;
    }
  },

  // Notification helpers
  async getUserNotificationSettings(userId) {
    try {
      console.log(`🔍 Fetching notification settings for user: "${userId}"`);
      
      const { data, error } = await supabase
        .from('user_settings')
        .select('telegram_notifications, telegram_chat_id, telegram_is_connected, telegram_username')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error(`❌ Database error for user ${userId}:`, error);
        return null;
      }
      
      console.log(`📊 Query result for user ${userId}:`, data);
      return data;
    } catch (error) {
      console.error('Error getting notification settings:', error);
      return null;
    }
  },

  async getUsersWithNotificationEnabled(notificationType) {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('user_id, telegram_chat_id, telegram_is_connected')
        .eq(notificationType, true);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting users with notification enabled:', error);
      throw error;
    }
  },

  // Helper method to get admin users
  async getAdminUsers() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('role', 'Admin');
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching admin users:', error);
      return [];
    }
  },

  // Helper method to get display ticket ID
  getDisplayTicketId(ticket_id) {
    if (typeof ticket_id === 'string') {
      if (ticket_id.startsWith('TK-')) {
        return ticket_id.slice(3, 9); // Remove TK- prefix and limit length
      }
      return ticket_id.slice(0, 6); // Limit UUID display
    }
    return ticket_id.toString().slice(0, 6);
  },

  // Helper method to format Telegram messages
  formatTelegramMessage(type, { ticket_id, ticket_title, ticket_base, message }) {
    const typeEmojis = {
      'ticket_created': '🆕',
      'ticket_assignment': '👤',
      'ticket_updated': '✏️',
      'ticket_status_change': '🔄',
      'ticket_comment': '💬'
    };
    
    const typeLabels = {
      'ticket_created': 'New Ticket Created',
      'ticket_assignment': 'Ticket Assigned',
      'ticket_updated': 'Ticket Updated',
      'ticket_status_change': 'Status Changed',
      'ticket_comment': 'New Comment'
    };
    
    const emoji = typeEmojis[type] || '🔔';
    const label = typeLabels[type] || 'Ticket Update';
    
    let formattedMessage = `${emoji} *${label}*\n\n`;
    formattedMessage += `🎫 *Ticket #${ticket_id}*: ${ticket_title}\n`;
    
    if (ticket_base) {
      formattedMessage += `📍 *Base*: ${ticket_base}\n`;
    }
    
    formattedMessage += `\n${message}`;
    
    return formattedMessage;
  },

  // Helper function to get ticket UUID from ticket_number
  async getTicketIdFromNumber(ticketNumber) {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select('id')
        .eq('ticket_number', ticketNumber)
        .single();
      
      if (error) throw error;
      return data?.id;
    } catch (error) {
      console.error('Error getting ticket ID from number:', error);
      throw error;
    }
  },

  // Tickets - FIXED to handle ticket_number vs id properly
  async getTickets(filters = {}) {
    try {
      console.log('🎫 Fetching tickets with filters:', filters);
      
      let query = supabase
        .from('tickets')
        .select(`
          *,
          bases!tickets_base_id_fkey(id, name),
          creator_profile:profiles!tickets_created_by_fkey(id, full_name, email),
          assignee_profile:profiles!tickets_assigned_to_fkey(id, full_name, email)
        `)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.base) {
        // Filter by base name - need to join with bases table
        const { data: baseData } = await supabase
          .from('bases')
          .select('id')
          .eq('name', filters.base)
          .single();
        
        if (baseData) {
          query = query.eq('base_id', baseData.id);
        }
      }
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.created_by) query = query.eq('created_by', filters.created_by);
      if (filters.assigned_to) query = query.eq('assigned_to', filters.assigned_to);

      const { data, error } = await query;
      if (error) throw error;

      // Transform data to include base_name
      const transformedData = (data || []).map(ticket => ({
        ...ticket,
        base_name: ticket.bases?.name || 'Unknown Base'
      }));

      console.log('✅ Tickets fetched successfully:', transformedData.length);
      return transformedData;
    } catch (error) {
      console.error('❌ Error fetching tickets:', error);
      throw error;
    }
  },

  async getAllTickets() {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          bases!tickets_base_id_fkey(id, name),
          creator_profile:profiles!tickets_created_by_fkey(id, full_name, email),
          assignee_profile:profiles!tickets_assigned_to_fkey(id, full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform data to include base_name
      const transformedData = (data || []).map(ticket => ({
        ...ticket,
        base_name: ticket.bases?.name || 'Unknown Base'
      }));

      return transformedData;
    } catch (error) {
      console.error('Error fetching all tickets:', error);
      throw error;
    }
  },

  // FIXED: getTicket now accepts ticket_number and queries by ticket_number
  async getTicket(id) {
    try {
      console.log('🎫 Fetching ticket with ID:', id);
      
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          assignee_profile:profiles!tickets_assigned_to_fkey(id, full_name, email),
          creator_profile:profiles!tickets_created_by_fkey(id, full_name, email),
          bases!tickets_base_id_fkey(id, name)
        `)
        .eq('id', id)  // CORRECTED: Use 'id' since URL contains UUID
        .single();
      
      if (error) {
        console.error('❌ Error fetching ticket:', error);
        throw error;
      }

      console.log('✅ Ticket fetched successfully:', data);
      
      // Transform the data to match expected structure
      const transformedData = {
        ...data,
        base_name: data.bases?.name || 'Unknown Base'
      };

      console.log('✅ Transformed ticket data:', transformedData);
      return transformedData;
    } catch (error) {
      console.error('❌ Error in getTicket:', error);
      throw error;
    }
  },

  async createTicket(ticketData) {
    try {
      console.log('🎫 Creating ticket:', ticketData);
      
      const { data, error } = await supabase
        .from('tickets')
        .insert([ticketData])
        .select(`
          *,
          bases!tickets_base_id_fkey(id, name),
          creator_profile:profiles!tickets_created_by_fkey(id, full_name, email)
        `)
        .single();
        
      if (error) throw error;
      
      console.log('✅ Ticket created successfully:', data);
      return data;
    } catch (error) {
      console.error('❌ Error creating ticket:', error);
      throw error;
    }
  },

  // FIXED: updateTicket now accepts ticket_number and queries by ticket_number
  async updateTicket(ticketId, updates) {
    try {
      console.log('🎫 Updating ticket:', ticketId, updates);
      
      const { data, error } = await supabase
        .from('tickets')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId)  // CORRECTED: Use 'id' since we're passing UUID
        .select(`
          *,
          bases!tickets_base_id_fkey(id, name),
          creator_profile:profiles!tickets_created_by_fkey(id, full_name, email),
          assignee_profile:profiles!tickets_assigned_to_fkey(id, full_name, email)
        `)
        .single();
      
      if (error) {
        console.error('❌ Direct update failed:', error);
        throw error;
      }
      
      console.log('✅ Ticket updated successfully:', data);
      return data;
    } catch (error) {
      console.error('❌ Error updating ticket:', error);
      throw error;
    }
  },

  // FIXED: deleteTicket now accepts ticket_number
  async deleteTicket(ticketId) {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .delete()
        .eq('id', ticketId);  // CORRECTED: Use 'id' for UUID
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error deleting ticket:', error);
      throw error;
    }
  },

  // FIXED: getTicketHistory - First get UUID from ticket_number, then query comments
  async getTicketHistory(ticketId) {
    try {
      console.log('📜 Fetching ticket history for ticket ID:', ticketId);
      
      const { data, error } = await supabase
        .from('ticket_comments')
        .select(`
          *,
          user:profiles!ticket_comments_user_id_fkey(id, full_name, email)
        `)
        .eq('ticket_id', ticketId)  // Use the UUID directly for comments
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('❌ Error fetching history:', error);
        throw error;
      }
      
      console.log('✅ History fetched successfully:', data);
      return data || [];
    } catch (error) {
      console.error('❌ Error getting ticket history:', error);
      throw error;
    }
  },

  // FIXED: addTicketComment - Convert ticket_number to UUID if needed
  async addTicketComment(commentData) {
    try {
      // The ticket_id in commentData should be the UUID from the current system
      const { data, error } = await supabase
        .from('ticket_comments')
        .insert([commentData])
        .select(`
          *,
          user:profiles!ticket_comments_user_id_fkey(id, full_name, email)
        `)
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding ticket comment:', error);
      throw error;
    }
  },

  // Stats
  async getTicketStats() {
    try {
      // Simple stats calculation without RPC
      const { data: allTickets, error } = await supabase
        .from('tickets')
        .select('status, priority, created_at');

      if (error) throw error;

      const stats = {
        total: allTickets.length,
        open: allTickets.filter(t => t.status === 'Open').length,
        in_progress: allTickets.filter(t => t.status === 'In Progress').length,
        resolved: allTickets.filter(t => t.status === 'Resolved').length,
        closed: allTickets.filter(t => t.status === 'Closed').length,
        by_status: {},
        by_priority: {}
      };

      // Calculate by_status
      allTickets.forEach(ticket => {
        stats.by_status[ticket.status] = (stats.by_status[ticket.status] || 0) + 1;
      });

      // Calculate by_priority
      allTickets.forEach(ticket => {
        stats.by_priority[ticket.priority] = (stats.by_priority[ticket.priority] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('Error getting ticket stats:', error);
      throw error;
    }
  },

  // Enhanced notification system with proper targeting
  async sendOptimizedNotification(payload) {
    try {
      console.log('🔔 Processing optimized notification:', payload);
      
      const { 
        type, 
        ticket_id, 
        message, 
        actor_id, 
        created_by, 
        assigned_to,
        ticket_title,
        ticket_base,
        base_id
      } = payload;

      const recipients = new Set();
      
      // Define notification targeting logic based on type
      switch (type) {
        case 'ticket_created':
          // Notify all admins when a new ticket is created
          const admins = await this.getAdminUsers();
          admins.forEach(admin => {
            if (admin.id !== actor_id) {
              recipients.add(admin.id);
            }
          });
          break;
          
        case 'ticket_assignment':
          // Notify the person being assigned (if not the actor)
          if (assigned_to && assigned_to !== actor_id) {
            recipients.add(assigned_to);
          }
          // Notify the creator (if not the actor)
          if (created_by && created_by !== actor_id) {
            recipients.add(created_by);
          }
          break;
          
        case 'ticket_updated':
        case 'ticket_status_change':
        case 'ticket_comment':
          // Notify creator (if not the actor)
          if (created_by && created_by !== actor_id) {
            recipients.add(created_by);
          }
          // Notify assignee (if not the actor)
          if (assigned_to && assigned_to !== actor_id) {
            recipients.add(assigned_to);
          }
          break;
          
        default:
          // Default behavior: notify creator and assignee (if not the actor)
          if (created_by && created_by !== actor_id) {
            recipients.add(created_by);
          }
          if (assigned_to && assigned_to !== actor_id) {
            recipients.add(assigned_to);
          }
      }
      
      console.log(`📊 Calculated ${recipients.size} recipients for ${type}:`, Array.from(recipients));
      
      if (recipients.size === 0) {
        console.log('ℹ️ No recipients calculated for notification');
        return { 
          success: true, 
          recipients: 0, 
          message: 'No valid recipients (actor excluded or no relevant parties)',
          type,
          actor_id
        };
      }
      
      const validChatIds = [];
      const recipientDetails = [];
      
      // Get notification settings for each recipient
      for (const userId of recipients) {
        try {
          const settings = await this.getUserNotificationSettings(userId);
          console.log(`📱 Settings for user ${userId}:`, {
            telegram_notifications: settings?.telegram_notifications,
            telegram_is_connected: settings?.telegram_is_connected,
            has_chat_id: !!settings?.telegram_chat_id
          });
          
          if (settings?.telegram_is_connected && 
              settings?.telegram_notifications && 
              settings?.telegram_chat_id) {
            validChatIds.push(settings.telegram_chat_id);
            recipientDetails.push({
              user_id: userId,
              chat_id: settings.telegram_chat_id,
              username: settings.telegram_username
            });
          } else {
            console.log(`⚠️ User ${userId} not eligible: ${JSON.stringify({
              connected: settings?.telegram_is_connected,
              notifications_enabled: settings?.telegram_notifications,
              has_chat_id: !!settings?.telegram_chat_id
            })}`);
          }
        } catch (error) {
          console.error(`❌ Error getting settings for user ${userId}:`, error);
        }
      }
      
      console.log(`✅ Found ${validChatIds.length} valid Telegram recipients out of ${recipients.size} calculated recipients`);
      
      if (validChatIds.length === 0) {
        return { 
          success: true, 
          recipients: 0, 
          message: 'No users have Telegram properly configured',
          calculated_recipients: recipients.size,
          details: recipientDetails
        };
      }
      
      // Format the message for Telegram
      const displayTicketId = this.getDisplayTicketId(ticket_id);
      const formattedMessage = this.formatTelegramMessage(type, {
        ticket_id: displayTicketId,
        ticket_title,
        ticket_base,
        message
      });
      
      console.log(`📤 Sending notification to ${validChatIds.length} recipients`);
      
      try {
        const { data, error } = await supabase.functions.invoke(
          'send-telegram-notification',
          { 
            body: { 
              type, 
              ticket_id, 
              message: formattedMessage, 
              chat_ids: validChatIds,
              base_id,
              metadata: {
                actor_id,
                calculated_recipients: recipients.size,
                sent_to: validChatIds.length
              }
            } 
          }
        );
        
        if (error) throw error;
        
        console.log('✅ Telegram notification sent successfully:', data);
        return { 
          success: true, 
          recipients: validChatIds.length,
          calculated_recipients: recipients.size,
          data,
          details: recipientDetails
        };
      } catch (edgeError) {
        console.warn('⚠️ Edge function not available:', edgeError.message);
        return {
          success: false,
          recipients: 0,
          error: 'Telegram bot not configured or edge function unavailable',
          details: recipientDetails
        };
      }
    } catch (error) {
      console.error('❌ Error sending optimized notification:', error);
      return { 
        success: false, 
        error: error.message, 
        recipients: 0 
      };
    }
  },

  // Enhanced method for ticket creation notifications
  async sendTicketCreatedNotification(ticket, actor_id) {
    const payload = {
      type: 'ticket_created',
      ticket_id: ticket.id,
      ticket_title: ticket.title,
      ticket_base: ticket.base_name || ticket.base,
      message: `New support ticket has been created and requires attention.`,
      actor_id,
      created_by: ticket.created_by,
      assigned_to: ticket.assigned_to,
      base_id: ticket.base_id
    };
    
    return await this.sendOptimizedNotification(payload);
  },

  // Enhanced method for assignment notifications
  async sendAssignmentNotification(ticket, old_assignee_id, new_assignee_id, new_assignee_name, actor_id) {
    const message = new_assignee_id 
      ? `Ticket has been assigned to ${new_assignee_name}`
      : 'Ticket has been unassigned';
      
    const payload = {
      type: 'ticket_assignment',
      ticket_id: ticket.id,
      ticket_title: ticket.title,
      ticket_base: ticket.base_name || ticket.base,
      message,
      actor_id,
      created_by: ticket.created_by,
      assigned_to: new_assignee_id,
      old_assignee: old_assignee_id,
      base_id: ticket.base_id
    };
    
    return await this.sendOptimizedNotification(payload);
  },

  // Legacy notification functions for backward compatibility
  async sendTelegramNotification(type, ticketId, message, targetUserId = null) {
    try {
      let chat_ids = [];
      let recipientInfo = [];
      
      if (targetUserId) {
        const settings = await this.getUserNotificationSettings(targetUserId);
        console.log(`Notification settings for user ${targetUserId}:`, settings);
        
        if (settings?.telegram_is_connected && settings?.telegram_notifications && settings?.telegram_chat_id) {
          chat_ids = [settings.telegram_chat_id];
          recipientInfo.push(`User ${targetUserId} (connected)`);
        }
      } else {
        const users = await this.getUsersWithNotificationEnabled('telegram_notifications');
        console.log('All users with notifications enabled:', users);
        
        const validUsers = users.filter(user => user.telegram_is_connected && user.telegram_chat_id);
        chat_ids = validUsers.map(user => user.telegram_chat_id);
        recipientInfo = validUsers.map(user => `User ${user.user_id}`);
      }

      if (chat_ids.length === 0) {
        const reason = targetUserId ? 
          'Target user does not have Telegram configured' : 
          'No users have Telegram properly configured';
        console.log(`No recipients found for Telegram notification: ${reason}`);
        return { 
          success: true, 
          recipients: 0, 
          message: reason,
          details: recipientInfo
        };
      }

      console.log(`Sending Telegram notification to ${chat_ids.length} recipients:`, chat_ids);

      // Call Edge Function (if available)
      try {
        const { data, error } = await supabase.functions.invoke(
          'send-telegram-notification',
          { 
            body: { 
              type, 
              ticket_id: ticketId, 
              message, 
              chat_ids 
            } 
          }
        );
        
        if (error) throw error;
        
        console.log('Telegram notification sent successfully:', data);
        return { 
          success: true, 
          recipients: chat_ids.length, 
          data,
          details: recipientInfo
        };
      } catch (edgeError) {
        console.warn('Edge function not available:', edgeError);
        return {
          success: true,
          recipients: 0,
          message: 'Telegram bot not configured',
          details: recipientInfo
        };
      }
    } catch (error) {
      console.error('Error sending Telegram notification:', error);
      return { 
        success: false, 
        error: error.message, 
        recipients: 0 
      };
    }
  },

  async sendNotification(type, ticketId, message, targetUserId = null) {
    try {
      return await this.sendTelegramNotification(type, ticketId, message, targetUserId);
    } catch (error) {
      console.error('Error sending notification:', error);
      return { success: false, error: error.message, recipients: 0 };
    }
  },

  // Base management
  async getAllBases() {
    try {
      const { data, error } = await supabase
        .from('bases')
        .select('id, name')
        .order('id');
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching bases:', error);
      throw error;
    }
  },

  // Simplified user management
  async getAssignableUsers() {
    try {
      console.log('👥 Fetching assignable users...');
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .or('role.eq.Admin,role.eq.HIS')
        .order('full_name', { nullsFirst: false });
      
      if (error) throw error;
      
      console.log('✅ Assignable users fetched:', data);
      return data || [];
    } catch (error) {
      console.error('❌ Error fetching assignable users:', error);
      throw error;
    }
  },

  async getAllProfiles() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          role,
          user_bases(
            base_id,
            bases(id, name)
          )
        `);
      if (error) throw error;
      
      return (data || []).map(user => ({
        ...user,
        bases: (user.user_bases || []).map(ub => ub.bases).filter(Boolean)
      }));
    } catch (error) {
      console.error('Error fetching all profiles:', error);
      throw error;
    }
  },

  async getUserBases(userId) {
    try {
      const { data, error } = await supabase
        .from('user_bases')
        .select('base_id, bases(id, name)')
        .eq('user_id', userId);
      if (error) throw error;
      return (data || []).map(ub => ub.bases).filter(Boolean);
    } catch (error) {
      console.error('Error fetching user bases:', error);
      throw error;
    }
  },

  async addUserBase(userId, baseId) {
    try {
      const { data, error } = await supabase
        .from('user_bases')
        .insert([{ user_id: userId, base_id: baseId }]);
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding user base:', error);
      throw error;
    }
  },

  async removeUserBase(userId, baseId) {
    try {
      const { data, error } = await supabase
        .from('user_bases')
        .delete()
        .eq('user_id', userId)
        .eq('base_id', baseId);
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error removing user base:', error);
      throw error;
    }
  }
};

// Real-time subscriptions
export const subscriptions = {
  tickets: (callback) =>
    supabase
      .channel('tickets')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tickets' },
        callback
      )
      .subscribe(),

  // FIXED: ticketComments subscription should use UUID, not ticket_number
  ticketComments: (ticketNumber, callback) => {
    // Convert ticket_number to UUID for subscription
    return db.getTicketIdFromNumber(ticketNumber).then(ticketId => {
      if (!ticketId) {
        console.error('Cannot subscribe to comments: ticket not found');
        return null;
      }
      
      return supabase
        .channel(`ticket_comments:${ticketId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'ticket_comments',
            filter: `ticket_id=eq.${ticketId}`,
          },
          callback
        )
        .subscribe();
    }).catch(error => {
      console.error('Error setting up ticket comments subscription:', error);
      return null;
    });
  },

  userSettings: (userId, callback) =>
    supabase
      .channel(`user_settings:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_settings',
          filter: `user_id=eq.${userId}`,
        },
        callback
      )
      .subscribe(),
};

// Testing and debugging helpers (optional - for development)
export const notificationTesting = {
  
  // Test notification targeting logic without sending actual notifications
  async testNotificationTargeting(type, ticket, actorId) {
    console.log(`🧪 Testing notification targeting for ${type}`);
    console.log('Ticket data:', {
      id: ticket.id,
      created_by: ticket.created_by,
      assigned_to: ticket.assigned_to,
      base_id: ticket.base_id
    });
    console.log('Actor ID:', actorId);
    
    const recipients = new Set();
    
    switch (type) {
      case 'ticket_created':
        const admins = await db.getAdminUsers();
        console.log('Available admins:', admins);
        admins.forEach(admin => {
          if (admin.id !== actorId) {
            recipients.add(admin.id);
          }
        });
        break;
        
      case 'ticket_assignment':
        if (ticket.assigned_to && ticket.assigned_to !== actorId) {
          recipients.add(ticket.assigned_to);
        }
        if (ticket.created_by && ticket.created_by !== actorId) {
          recipients.add(ticket.created_by);
        }
        break;
        
      case 'ticket_updated':
      case 'ticket_status_change':
      case 'ticket_comment':
        if (ticket.created_by && ticket.created_by !== actorId) {
          recipients.add(ticket.created_by);
        }
        if (ticket.assigned_to && ticket.assigned_to !== actorId) {
          recipients.add(ticket.assigned_to);
        }
        break;
    }
    
    console.log(`🎯 Would notify ${recipients.size} users:`, Array.from(recipients));
    
    // Test notification settings for each recipient
    for (const userId of recipients) {
      const settings = await db.getUserNotificationSettings(userId);
      console.log(`📱 User ${userId} notification readiness:`, {
        has_settings: !!settings,
        telegram_connected: settings?.telegram_is_connected,
        notifications_enabled: settings?.telegram_notifications,
        has_chat_id: !!settings?.telegram_chat_id
      });
    }
    
    return {
      type,
      calculated_recipients: recipients.size,
      recipients: Array.from(recipients),
      actor_excluded: actorId
    };
  },

  // Test admin user fetching
  async testAdminFetching() {
    console.log('🧪 Testing admin user fetching...');
    try {
      const admins = await db.getAdminUsers();
      console.log(`Found ${admins.length} admin users:`, admins);
      return admins;
    } catch (error) {
      console.error('❌ Error fetching admins:', error);
      return [];
    }
  },

  // Test notification settings for a specific user
  async testUserNotificationSettings(userId) {
    console.log(`🧪 Testing notification settings for user: ${userId}`);
    try {
      const settings = await db.getUserNotificationSettings(userId);
      console.log('Settings result:', settings);
      
      const isReady = settings?.telegram_is_connected && 
                     settings?.telegram_notifications && 
                     settings?.telegram_chat_id;
      
      console.log(`User ${userId} notification readiness: ${isReady ? '✅ Ready' : '❌ Not ready'}`);
      return { settings, isReady };
    } catch (error) {
      console.error('❌ Error testing settings:', error);
      return { settings: null, isReady: false };
    }
  }
};