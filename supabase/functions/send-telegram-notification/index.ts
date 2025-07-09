import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const frontendUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:5173';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

console.log("🚀 Telegram notification function started");

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  try {
    const { type, ticket_id, message, chat_ids } = await req.json();

    if (!ticket_id || !message) {
      return new Response(JSON.stringify({ error: "Missing 'ticket_id' or 'message'" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let targetChatIds = chat_ids;
    if (!targetChatIds || targetChatIds.length === 0) {
      const { data: users, error } = await supabase
        .from('user_settings')
        .select('telegram_chat_id')
        .eq('telegram_notifications', true)
        .eq('telegram_is_connected', true)
        .not('telegram_chat_id', 'is', null);

      if (error) {
        console.error("❌ Error fetching user chat IDs:", error);
        return new Response(JSON.stringify({ error: "Failed to fetch user chat IDs" }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      targetChatIds = users.map(user => user.telegram_chat_id);
    }

    if (!targetChatIds || targetChatIds.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: "No recipients found",
        sent: 0,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select(`
        *,
        creator_profile:profiles!tickets_created_by_fkey(full_name),
        assignee_profile:profiles!tickets_assigned_to_fkey(full_name)
      `)
      .eq('id', ticket_id)
      .single();

    if (ticketError || !ticket) {
      console.error("❌ Error fetching ticket details:", ticketError);
      return new Response(JSON.stringify({ error: "Failed to fetch ticket data" }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ticketUrl = `${frontendUrl}/tickets/${ticket.id}`;
    const base = ticket.base || 'N/A';
    const priority = ticket.priority || 'N/A';
    const status = ticket.status || 'N/A';
    const createdBy = ticket.creator_profile?.full_name || 'Unknown';
    const assignedTo = ticket.assignee_profile?.full_name || 'Unassigned';
    const title = ticket.title || 'Untitled';
    const _description = ticket.description ? ticket.description.substring(0, 300) + (ticket.description.length > 300 ? '...' : '') : 'No description provided.';

    let notificationText = `🔔 *Ticket Update Notification*\n\n` +
                           `🎫 *Title:* ${title}\n` +
                           `📌 *Status:* ${status}\n` +
                           `📍 *Base:* ${base}\n` +
                           `🔥 *Priority:* ${priority}\n` +
                           `👤 *Created by:* ${createdBy}\n` +
                           `👥 *Assigned to:* ${assignedTo}\n`;

    if (type === 'ticket_created') {
      notificationText = `🆕 *New Ticket Created!*\n\n` + notificationText;
    } else if (type === 'ticket_assigned') {
      notificationText = `📤 *Ticket Assigned!*\n\n` + notificationText;
    } else if (type === 'ticket_updated') {
      notificationText = `✏️ *Ticket Updated!*\n\n` + notificationText;
    } else if (type === 'ticket_comment') {
      notificationText = `💬 *New Comment on Ticket!*\n\n` + notificationText;
    }

    notificationText += `\n📝 *Details:*\n${message}\n\n🔗 [Open Ticket](${ticketUrl})`;

    const results = await Promise.allSettled(
      targetChatIds.map(async (chatId: string) => {
        const res = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
          method: 'POST',
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: notificationText,
            parse_mode: 'Markdown',
            disable_web_page_preview: false,
          }),
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.error(`❌ Failed to send message to ${chatId}:`, errorText);
          throw new Error(errorText);
        }

        return res.json();
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return new Response(JSON.stringify({
      success: true,
      sent: successful,
      failed: failed,
      total: targetChatIds.length,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error("❌ Internal Error:", err);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
