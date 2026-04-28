import type { SupabaseClient } from '../../lib/supabase-client.ts';
import type { AccountConfig } from '../../types/account-config.ts';

function mapRow(
  row: Record<string, unknown>,
  statusRow: Record<string, unknown> | undefined,
): AccountConfig {
  return {
    id: row.id as string,
    clientName: row.client_name as string,
    platform: row.platform as AccountConfig['platform'],
    accountId: row.account_id as string,
    refreshDays: row.refresh_days as number,
    sheetId: (row.sheet_id as string) ?? '',
    sheetRowKey: (row.sheet_tab as string) ?? '',
    isActive: true,
    lastRequestTime: (statusRow?.last_request_at as string | null) ?? null,
    lastSuccessTime: (statusRow?.last_success_at as string | null) ?? null,
    currentJobId: (statusRow?.current_job_id as string | null) ?? null,
    refreshStatus: (statusRow?.refresh_status as AccountConfig['refreshStatus']) ?? 'idle',
    systemMessage: (statusRow?.system_message as string) ?? '',
    updatedAt:
      (statusRow?.updated_at as string) ??
      (row.updated_at as string) ??
      (row.created_at as string) ??
      '',
  };
}

export class SupabaseAccountConfigRepository {
  private readonly client: SupabaseClient;
  private readonly userId: string;

  constructor(client: SupabaseClient, userId: string) {
    this.client = client;
    this.userId = userId;
  }

  async listAll(): Promise<AccountConfig[]> {
    const { data, error } = await this.client
      .from('account_configs')
      .select('*')
      .eq('user_id', this.userId);
    if (error) throw error;

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    if (rows.length === 0) {
      return [];
    }

    const accountIds = rows.map((row) => row.id as string);
    const { data: snapshots, error: snapshotError } = await this.client
      .from('sheet_snapshots')
      .select('*')
      .eq('user_id', this.userId)
      .in('account_config_id', accountIds);
    if (snapshotError) throw snapshotError;

    const snapshotsByAccountId = new Map(
      ((snapshots ?? []) as Array<Record<string, unknown>>).map((snapshot) => [
        snapshot.account_config_id as string,
        snapshot,
      ]),
    );

    return rows.map((row) => mapRow(row, snapshotsByAccountId.get(row.id as string)));
  }

  async listActive(): Promise<AccountConfig[]> {
    return this.listAll();
  }

  async replaceAll(records: AccountConfig[]): Promise<AccountConfig[]> {
    if (records.length === 0) {
      const { error } = await this.client.from('account_configs').delete().eq('user_id', this.userId);
      if (error) throw error;
      return [];
    }

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

    // upsert-first：先寫入新資料，確保成功後再刪除孤立記錄（避免刪後寫入失敗導致資料遺失）
    const { error: upsertErr } = await this.client
      .from('account_configs')
      .upsert(rows, { onConflict: 'id' });
    if (upsertErr) throw upsertErr;

    const keptIds = records.map((r) => r.id).filter(Boolean).join(',');
    const { error: delErr } = await this.client
      .from('account_configs')
      .delete()
      .eq('user_id', this.userId)
      .not('id', 'in', `(${keptIds})`);
    if (delErr) throw delErr;

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
    if (!data) {
      return undefined;
    }

    const { data: snapshot, error: snapshotError } = await this.client
      .from('sheet_snapshots')
      .select('*')
      .eq('user_id', this.userId)
      .eq('account_config_id', (data as Record<string, unknown>).id as string)
      .maybeSingle();
    if (snapshotError) throw snapshotError;

    return mapRow(
      data as Record<string, unknown>,
      snapshot as Record<string, unknown> | undefined,
    );
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
