import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase)
}));

let mockSupabase;
let db;

function setupSupabaseMocks() {
  const invoke = vi.fn();
  mockSupabase = {
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: {}, error: null }))
          }))
        }))
      }))
    })),
    functions: { invoke }
  };
  return { invoke };
}

beforeEach(async () => {
  vi.resetModules();
  process.env.VITE_SUPABASE_URL = 'https://hpncjwegxpkzjwpdwrgi.supabase.co';
  process.env.VITE_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwbmNqd2VneHBremp3cGR3cmdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE4ODY4MzQsImV4cCI6MjA2NzQ2MjgzNH0.2UHHKiG9qnmfnXIMzVCyKODImdkQttdQW9Tw43JSOoI';
  setupSupabaseMocks();
  ({ db } = await import('../src/lib/supabase.js'));
});

describe('sendTelegramNotification', () => {
  it('sends notification to specific user', async () => {
    const chatId = '111';
    mockSupabase.functions.invoke.mockResolvedValue({ data: { ok: true }, error: null });
    db.getUserNotificationSettings = vi.fn().mockResolvedValue({ telegram_is_connected: true, telegram_notifications: true, telegram_chat_id: chatId });

    const result = await db.sendTelegramNotification('ticket_created', 1, 'msg', 'user1');

    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('send-telegram-notification', { body: { type: 'ticket_created', ticket_id: 1, message: 'msg', chat_ids: [chatId] } });
    expect(result.success).toBe(true);
    expect(result.recipients).toBe(1);
  });

  it('returns early when no recipients', async () => {
    db.getUsersWithNotificationEnabled = vi.fn().mockResolvedValue([]);

    const result = await db.sendTelegramNotification('ticket_created', 1, 'msg');

    expect(mockSupabase.functions.invoke).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true, recipients: 0 });
  });
});

describe('connectTelegram', () => {
  it('invokes edge function and updates settings', async () => {
    mockSupabase.functions.invoke.mockResolvedValue({ data: { success: true, chat_id: '123' }, error: null });

    const res = await db.connectTelegram('u1', 'john');

    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('telegram-connect', { body: { user_id: 'u1', username: '@john' } });
    expect(mockSupabase.from).toHaveBeenCalledWith('user_settings');
    expect(res.chat_id).toBe('123');
    expect(res.username).toBe('@john');
  });
});
