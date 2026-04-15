import { createClient } from '@supabase/supabase-js';

export function createSupabaseClient(url: string, serviceRoleKey: string) {
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

export type SupabaseClient = ReturnType<typeof createSupabaseClient>;
