# Ticket Hub

This project uses environment variables for connecting to Supabase and Telegram.

1. Copy `.env.example` to `.env.local`.
2. Replace the placeholder values with your actual credentials for `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `TELEGRAM_BOT_TOKEN`.
3. The `.env.local` file is ignored by git so your secrets stay local.

## Edge Functions Environment

The edge functions located under `supabase/functions` also require additional variables when running or deploying:

```
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>
SUPABASE_URL=<your-supabase-url>
TELEGRAM_BOT_TOKEN=<your-telegram-bot-token>
```

These variables must be present in the environment (or in a file passed to the Supabase CLI with `--env-file`) so the functions can access Supabase and Telegram during execution.
