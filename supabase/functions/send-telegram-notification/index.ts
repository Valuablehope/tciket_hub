import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN')!;

console.log("🚀 Telegram notification function started");

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
      status: 200
    });
  }

  try {
    const { type, ticket_id, message, chat_ids } = await req.json();

    if (!ticket_id || !message) {
      return new Response(JSON.stringify({ error: "Missing 'ticket_id' or 'message'" }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let targetChatIds = chat_ids;

    // If no specific chat_ids provided, get all users with telegram notifications enabled
    if (!targetChatIds || targetChatIds.length === 0) {
      const { data: users, error } = await supabase
        .from('user_settings')
        .select('telegram_chat_id')
        .eq('telegram_notifications', true)
        .eq('telegram_is_connected', true)
        .not('telegram_chat_id', 'is', null);

      if (error) {
        console.error("Error fetching users:", error);
        return new Response(JSON.stringify({ error: "Failed to fetch users" }), { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      targetChatIds = users.map(user => user.telegram_chat_id);
    }

    if (!targetChatIds || targetChatIds.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No users to notify",
        sent: 0 
      }), { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get ticket details for rich notification
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select(`
        *,
        creator_profile:profiles!tickets_created_by_fkey(full_name),
        assignee_profile:profiles!tickets_assigned_to_fkey(full_name)
      `)
      .eq('id', ticket_id)
      .single();

    if (ticketError) {
      console.error("Error fetching ticket:", ticketError);
    }

    // Format notification message based on type
    let notificationText = message;
    if (ticket) {
      const ticketUrl = `${Deno.env.get('FRONTEND_URL') || 'http://localhost:5173'}/tickets/${ticket.id}`;
      
      switch (type) {
        case 'ticket_created':
          notificationText = `🎫 *New Ticket Created*\n\n` +
            `*Title:* ${ticket.title}\n` +
            `*Status:* ${ticket.status}\n` +
            `*Priority:* ${ticket.priority}\n` +
            `*Base:* ${ticket.base}\n` +
            `*Created by:* ${ticket.creator_profile?.full_name || 'Unknown'}\n\n` +
            `*Description:*\n${ticket.description.substring(0, 200)}${ticket.description.length > 200 ? '...' : ''}\n\n` +
            `[View Ticket](${ticketUrl})`;
          break;
        
        case 'ticket_assigned':
          notificationText = `👤 *Ticket Assigned*\n\n` +
            `*Title:* ${ticket.title}\n` +
            `*Assigned to:* ${ticket.assignee_profile?.full_name || 'Unknown'}\n` +
            `*Priority:* ${ticket.priority}\n` +
            `*Base:* ${ticket.base}\n\n` +
            `[View Ticket](${ticketUrl})`;
          break;
        
        case 'ticket_updated':
          notificationText = `📝 *Ticket Updated*\n\n` +
            `*Title:* ${ticket.title}\n` +
            `*Status:* ${ticket.status}\n` +
            `*Priority:* ${ticket.priority}\n` +
            `*Base:* ${ticket.base}\n\n` +
            `${message}\n\n` +
            `[View Ticket](${ticketUrl})`;
          break;
        
        case 'ticket_comment':
          notificationText = `💬 *New Comment*\n\n` +
            `*Ticket:* ${ticket.title}\n` +
            `*Status:* ${ticket.status}\n\n` +
            `*Comment:*\n${message}\n\n` +
            `[View Ticket](${ticketUrl})`;
          break;
        
        default:
          notificationText = `🔔 *Ticket Notification*\n\n` +
            `*Title:* ${ticket.title}\n` +
            `*Status:* ${ticket.status}\n\n` +
            `${message}\n\n` +
            `[View Ticket](${ticketUrl})`;
      }
    }

    // Send notification to all chat IDs
    const results = await Promise.allSettled(
      targetChatIds.map(async (chatId: string) => {
        const telegramRes = await fetch(
          `https://api.telegram.org/bot${telegramBotToken}/sendMessage`,
          {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              chat_id: chatId, 
              text: notificationText,
              parse_mode: 'Markdown',
              disable_web_page_preview: false
            }),
          }
        );

        if (!telegramRes.ok) {
          const error = await telegramRes.text();
          console.error(`Failed to send to chat ${chatId}:`, error);
          throw new Error(`Failed to send to chat ${chatId}`);
        }

        return await telegramRes.json();
      })
    );

    // Count successful sends
    const successful = results.filter(result => result.status === 'fulfilled').length;
    const failed = results.filter(result => result.status === 'rejected').length;

    console.log(`Telegram notifications sent: ${successful} successful, ${failed} failed`);

    return new Response(JSON.stringify({
      success: true,
      sent: successful,
      failed: failed,
      total: targetChatIds.length,
    }), { 
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error("Unexpected Error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});