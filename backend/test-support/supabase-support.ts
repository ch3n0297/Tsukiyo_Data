import { createClient } from '@supabase/supabase-js';

export const MIGRATION_SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? 'https://esokvyxbqikupvfzykbx.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

export function createTestSupabaseClient() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is required for integration tests. ' +
        'Get it from: https://supabase.com/dashboard/project/esokvyxbqikupvfzykbx/settings/api',
    );
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

export async function truncateTables(tables: string[]): Promise<void> {
  const client = createTestSupabaseClient();
  // 依照 FK 反向順序刪除（child 先刪）
  const orderedTables = [...tables].reverse();
  for (const table of orderedTables) {
    await client.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
  }
}
