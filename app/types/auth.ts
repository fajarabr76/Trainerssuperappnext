import { User } from '@supabase/supabase-js';

export type UserRole = 'trainer' | 'trainers' | 'leader' | 'agent' | 'admin';

export type ProfileStatus = 'pending' | 'approved' | 'rejected';

export interface Profile {
  id: string;
  email: string | null;
  role: UserRole | string;
  status: ProfileStatus;
  is_deleted: boolean;
  full_name?: string | null;
  created_at?: string;
}

export interface AuthState {
  user: User | null;
  profile: Profile | null;
  role: string;
  loading: boolean;
}
