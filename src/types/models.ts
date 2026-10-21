/** Account shapes of the API (`app/schemas/user.py`, `app/schemas/auth.py`). */

export interface User {
  id: string;
  email: string;
  full_name: string;
  timezone: string;
  email_verified: boolean;
  /** True after an administrator created the account or reset its password. */
  must_change_password?: boolean;
  created_at: string;
  /** When the profile picture was set; null when the person has none. */
  avatar_updated_at?: string | null;
}

export interface Session {
  id: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  last_used_at: string | null;
  is_current: boolean;
}

/** Response data of POST /auth/login and POST /auth/refresh. */
export interface AuthPayload {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
  user: User;
}
