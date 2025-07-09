import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';

const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

console.log('🚀 Telegram connect function started');

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
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

    // Fetch updates from Telegram
    const telegramResponse = await fetch(`https://api.telegram.org/bot${telegramBotToken}/getUpdates`);

    if (!telegramResponse.ok) {
      const errorText = await telegramResponse.text();
      console.error('❌ Telegram API error:', errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch updates from Telegram API' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const responseData = await telegramResponse.json();
    const updates = Array.isArray(responseData.result) ? responseData.result : [];

    let chatId: string | null = null;

    for (const update of updates) {
      const fromUser = update?.message?.from;
      if (
        fromUser &&
        fromUser.username &&
        fromUser.username.toLowerCase() === cleanUsername.toLowerCase()
      ) {
        chatId = update.message.chat.id.toString();
        break;
      }
    }

    if (!chatId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Telegram user not found. Please message the bot with /start first.",
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, chat_id: chatId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('❌ Internal Server Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
