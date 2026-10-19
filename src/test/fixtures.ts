import type { AuthPayload, Session, User } from '@/types/models';

export const testUser: User = {
  id: '0198c1f2-0000-7000-8000-000000000001',
  email: 'ada@example.com',
  full_name: 'Ada Lovelace',
  timezone: 'Europe/London',
  email_verified: true,
  created_at: '2026-10-01T09:00:00Z',
};

export const testAuth: AuthPayload = {
  access_token: 'access-token-1',
  token_type: 'bearer',
  expires_in: 900,
  user: testUser,
};

export const testSession: Session = {
  id: '0198c1f2-0000-7000-8000-00000000000a',
  ip_address: '203.0.113.7',
  user_agent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36',
  created_at: '2026-10-01T09:00:00Z',
  last_used_at: '2026-10-05T09:00:00Z',
  is_current: true,
};
