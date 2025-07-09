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

  // User Settings - Direct table operations (no custom functions needed)
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
        // No updates needed, just return current settings
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

  async connectTelegram(userId, username) {
    try {
      // Clean username format
      const cleanUsername = username.startsWith('@') ? username : `@${username}`;
      
      // Call the Telegram bot to verify user and get chat_id
      const { data, error } = await supabase.functions.invoke(
        'telegram-connect',
        { 
          body: { 
            user_id: userId,
            username: cleanUsername
          } 
        }
      );

      if (error) throw error;
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to connect to Telegram bot');
      }

      // Store the connection info in user settings
      const { data: updateData, error: updateError } = await supabase
        .from('user_settings')
        .update({
          telegram_username: cleanUsername,
          telegram_chat_id: data.chat_id,
          telegram_is_connected: true,
          telegram_connected_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (updateError) throw updateError;
      
      return {
        chat_id: data.chat_id,
        username: cleanUsername,
        connected_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error connecting Telegram:', error);
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

  async changePassword(currentPassword, newPassword) {
    try {
      // Use Supabase Auth to change password
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

  // Helper functions for notifications
  async getUserNotificationSettings(userId) {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('telegram_notifications, ticket_updates, assignment_notifications, telegram_chat_id, telegram_is_connected')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      
      return data;
    } catch (error) {
      console.error('Error getting notification settings:', error);
      throw error;
    }
  },

  async getUsersWithNotificationEnabled(notificationType) {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('user_id, telegram_chat_id, telegram_is_connected')
        .eq(notificationType, true);

      if (error) throw error;
      
      return data;
    } catch (error) {
      console.error('Error getting users with notification enabled:', error);
      throw error;
    }
  },

  // Tickets
  async getTickets(filters = {}) {
    let query = supabase
      .from('tickets')
      .select(`
        *,
        creator_profile:profiles!tickets_created_by_fkey(full_name),
        assignee_profile:profiles!tickets_assigned_to_fkey(full_name)
      `)
      .order('created_at', { ascending: false });

    if (filters.base) query = query.eq('base', filters.base);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.created_by) query = query.eq('created_by', filters.created_by);
    if (filters.assigned_to) query = query.eq('assigned_to', filters.assigned_to);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async getAllTickets() {
    const { data, error } = await supabase
      .from('tickets')
      .select(`
        *,
        creator_profile:profiles!tickets_created_by_fkey(*),
        assignee_profile:profiles!tickets_assigned_to_fkey(*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching all tickets:', error.message);
      throw new Error('Failed to fetch tickets');
    }

    return data;
  },

  async getTicket(id) {
    const { data, error } = await supabase
      .from('tickets')
      .select(`
        *,
        creator_profile:profiles!tickets_created_by_fkey(full_name),
        assignee_profile:profiles!tickets_assigned_to_fkey(full_name)
      `)
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async createTicket(ticketData) {
    const { data, error } = await supabase
      .from('tickets')
      .insert([ticketData])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateTicket(id, updates) {
    const { data, error } = await supabase
      .from('tickets')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Ticket Comments (History)
  async getTicketHistory(ticketId) {
    const { data, error } = await supabase
      .from('ticket_comments')
      .select(`
        *,
        user:profiles!ticket_comments_user_id_fkey(full_name)
      `)
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async addTicketComment(commentData) {
    const { data, error } = await supabase
      .from('ticket_comments')
      .insert([commentData])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Stats
  async getTicketStats() {
    const { data, error } = await supabase.rpc('get_ticket_stats');
    if (error) throw error;
    return data;
  },

  // Enhanced notification function with real Telegram bot integration
  async sendTelegramNotification(type, ticketId, message, targetUserId = null) {
    try {
      let chat_ids = [];
      
      if (targetUserId) {
        // Send to specific user
        const settings = await this.getUserNotificationSettings(targetUserId);
        if (settings?.telegram_is_connected && settings?.telegram_notifications && settings?.telegram_chat_id) {
          chat_ids = [settings.telegram_chat_id];
        }
      } else {
        // Send to all users with telegram notifications enabled
        const users = await this.getUsersWithNotificationEnabled('telegram_notifications');
        chat_ids = users
          .filter(user => user.telegram_is_connected && user.telegram_chat_id)
          .map(user => user.telegram_chat_id);
      }

      if (chat_ids.length === 0) {
        console.log('No recipients found for Telegram notification');
        return { success: true, recipients: 0 };
      }

      // Call your existing Edge Function
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
      
      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }
      
      return { success: true, recipients: chat_ids.length, data };
    } catch (error) {
      console.error('Error sending Telegram notification:', error);
      throw error;
    }
  },

  // Send notification (Telegram only)
  async sendNotification(type, ticketId, message, targetUserId = null) {
    try {
      return await this.sendTelegramNotification(type, ticketId, message, targetUserId);
    } catch (error) {
      console.error('Error sending notification:', error);
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

  ticketComments: (ticketId, callback) =>
    supabase
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
      .subscribe(),

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