import type { SupabaseClient } from '../../lib/supabase-client.ts';
import type { AccountConfig } from '../../types/account-config.ts';

// 從 Supabase DB row 轉換為 AccountConfig，status 欄位填入預設值
// （status 欄位實際由 sheet_snapshots 管理，Phase 3+ 後合併）
function mapRow(row: Record<string, unknown>): AccountConfig {
  return {
    id: row.id as string,
    clientName: row.client_name as string,
    platform: row.platform as AccountConfig['platform'],
    accountId: row.account_id as string,
    refreshDays: row.refresh_days as number,
    sheetId: (row.sheet_id as string) ?? '',
    sheetRowKey: (row.sheet_tab as string) ?? '',
    isActive: true,
    lastRequestTime: null,
    lastSuccessTime: null,
    currentJobId: null,
    refreshStatus: 'idle',
    systemMessage: '',
    updatedAt: (row.created_at as string) ?? new Date().toISOString(),
  };
}

export class SupabaseAccountConfigRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly userId: string,
  ) {}

  async listAll(): Promise<AccountConfig[]> {
    const { data, error } = await this.client
      .from('account_configs')
      .select('*')
      .eq('user_id', this.userId);
    if (error) throw error;
    return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  }

  async listActive(): Promise<AccountConfig[]> {
    return this.listAll();
  }

  async replaceAll(records: AccountConfig[]): Promise<AccountConfig[]> {
    const { error: delErr } = await this.client
      .from('account_configs')
      .delete()
      .eq('user_id', this.userId);
    if (delErr) throw delErr;

    if (records.length === 0) return [];

    const rows = records.map((r) => ({
      id: r.id,
      user_id: this.userId,
      client_name: r.clientName,
      platform: r.platform,
      account_id: r.accountId,
      refresh_days: r.refreshDays,
      sheet_id: r.sheetId || null,
      sheet_tab: r.sheetRowKey || null,
    }));

    const { error } = await this.client.from('account_configs').insert(rows);
    if (error) throw error;

    return this.listAll();
  }

  async findByPlatformAndAccountId(
    platform: string,
    accountId: string,
  ): Promise<AccountConfig | undefined> {
    const { data, error } = await this.client
      .from('account_configs')
      .select('*')
      .eq('user_id', this.userId)
      .eq('platform', platform)
      .eq('account_id', accountId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapRow(data as Record<string, unknown>) : undefined;
  }

  async updateByAccountKey(
    accountKey: string,
    patch: Partial<AccountConfig>,
  ): Promise<AccountConfig[]> {
    const [platform, accountId] = accountKey.split(':');

    const dbPatch: Record<string, unknown> = {};
    if (patch.clientName !== undefined) dbPatch.client_name = patch.clientName;
    if (patch.refreshDays !== undefined) dbPatch.refresh_days = patch.refreshDays;
    if (patch.sheetId !== undefined) dbPatch.sheet_id = patch.sheetId || null;
    if (patch.sheetRowKey !== undefined) dbPatch.sheet_tab = patch.sheetRowKey || null;

    if (Object.keys(dbPatch).length > 0) {
      const { error } = await this.client
        .from('account_configs')
        .update(dbPatch)
        .eq('user_id', this.userId)
        .eq('platform', platform)
        .eq('account_id', accountId);
      if (error) throw error;
    }

    return this.listAll();
  }
}
