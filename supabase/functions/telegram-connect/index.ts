import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';

const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

console.log('🚀 Telegram connect function started');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  try {
    const { user_id, username } = await req.json();

    if (!user_id || !username) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing 'user_id' or 'username'" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!telegramBotToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Telegram bot token not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanUsername = username.startsWith('@') ? username.slice(1) : username;

    const res = await fetch(`https://api.telegram.org/bot${telegramBotToken}/getUpdates`);
    if (!res.ok) {
      const errText = await res.text();
      console.error('Telegram API error:', errText);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to contact Telegram API' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await res.json();
    const updates = Array.isArray(data.result) ? data.result : [];

    let chatId: string | null = null;
    for (const update of updates) {
      const from = update?.message?.from;
      if (from && from.username && from.username.toLowerCase() === cleanUsername.toLowerCase()) {
        chatId = update.message.chat.id.toString();
      }
    }

    if (!chatId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Telegram user not verified. Message the bot with /start.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, chat_id: chatId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Unexpected error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
