import { createClient } from '@supabase/supabase-js';

// 使用 NULL_UUID 作為 delete().neq() 的佔位值（不存在於任何真實資料）
const NULL_UUID = '00000000-0000-0000-0000-000000000000';

function getSupabaseConfig(): { url: string; serviceRoleKey: string } {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('SUPABASE_URL 環境變數未設定（測試用）');
  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY 環境變數未設定（測試用）。'
    );
  }
  return { url, serviceRoleKey };
}

export function createTestSupabaseClient() {
  const { url, serviceRoleKey } = getSupabaseConfig();
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

export async function truncateTables(tables: string[]): Promise<void> {
  const client = createTestSupabaseClient();
  // 依照 FK 反向順序刪除（child 先刪）
  const orderedTables = [...tables].reverse();
  for (const table of orderedTables) {
    const { error } = await client.from(table).delete().neq('id', NULL_UUID);
    if (error) throw new Error(`truncateTables: 刪除 ${table} 失敗 — ${error.message}`);
  }
}
