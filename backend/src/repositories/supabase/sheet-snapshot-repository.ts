import type { SupabaseClient } from '../../lib/supabase-client.ts';
import type { SheetStatusSnapshot, SheetOutputSnapshot } from '../../types/sheet.ts';

export class SupabaseSheetSnapshotRepository {
  private readonly client: SupabaseClient;
  private readonly userId: string;

  constructor(client: SupabaseClient, userId: string) {
    this.client = client;
    this.userId = userId;
  }

  async listStatuses(): Promise<SheetStatusSnapshot[]> {
    const { data, error } = await this.client
      .from('sheet_snapshots')
      .select(`
        *,
        account_configs (
          platform,
          account_id,
          sheet_id,
          sheet_tab
        )
      `)
      .eq('user_id', this.userId);
    if (error) throw error;

    return (data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      const cfg = (r.account_configs ?? {}) as Record<string, unknown>;
      return {
        sheetId: (cfg.sheet_id as string) ?? '',
        sheetRowKey: (cfg.sheet_tab as string) ?? '',
        platform: (cfg.platform as SheetStatusSnapshot['platform']) ?? 'instagram',
        accountId: (cfg.account_id as string) ?? '',
        refreshStatus: (r.refresh_status as SheetStatusSnapshot['refreshStatus']) ?? 'idle',
        systemMessage: (r.system_message as string) ?? '',
        lastRequestTime: (r.last_request_at as string | null) ?? null,
        lastSuccessTime: (r.last_success_at as string | null) ?? null,
        currentJobId: (r.current_job_id as string | null) ?? null,
        updatedAt: (r.updated_at as string) ?? new Date().toISOString(),
      };
    });
  }

  async listOutputs(): Promise<SheetOutputSnapshot[]> {
    const { data, error } = await this.client
      .from('sheet_snapshots')
      .select(`
        output_rows,
        output_synced_at,
        account_configs (
          platform,
          account_id,
          sheet_id,
          sheet_tab
        )
      `)
      .eq('user_id', this.userId)
      .not('output_synced_at', 'is', null);
    if (error) throw error;

    return (data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      const cfg = (r.account_configs ?? {}) as Record<string, unknown>;
      return {
        sheetId: (cfg.sheet_id as string) ?? '',
        sheetRowKey: (cfg.sheet_tab as string) ?? '',
        platform: (cfg.platform as SheetOutputSnapshot['platform']) ?? 'instagram',
        accountId: (cfg.account_id as string) ?? '',
        syncedAt: (r.output_synced_at as string) ?? '',
        rows: Array.isArray(r.output_rows) ? r.output_rows as SheetOutputSnapshot['rows'] : [],
      };
    });
  }

  async upsertStatus(snapshot: SheetStatusSnapshot): Promise<SheetStatusSnapshot[]> {
    // 由 platform + accountId 查找 account_config_id
    const { data: cfg, error: cfgErr } = await this.client
      .from('account_configs')
      .select('id')
      .eq('user_id', this.userId)
      .eq('platform', snapshot.platform)
      .eq('account_id', snapshot.accountId)
      .maybeSingle();
    if (cfgErr) throw cfgErr;
    if (!cfg) {
      console.warn(`[SheetSnapshotRepository] upsertStatus: 找不到 account_config for ${snapshot.platform}:${snapshot.accountId}，跳過`);
      return this.listStatuses();
    }

    const { error } = await this.client.from('sheet_snapshots').upsert(
      {
        user_id: this.userId,
        account_config_id: (cfg as { id: string }).id,
        refresh_status: snapshot.refreshStatus,
        system_message: snapshot.systemMessage,
        last_request_at: snapshot.lastRequestTime,
        last_success_at: snapshot.lastSuccessTime,
        current_job_id: snapshot.currentJobId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,account_config_id' },
    );
    if (error) throw error;

    return this.listStatuses();
  }

  async upsertOutput(snapshot: SheetOutputSnapshot): Promise<SheetOutputSnapshot[]> {
    const { data: cfg, error: cfgErr } = await this.client
      .from('account_configs')
      .select('id')
      .eq('user_id', this.userId)
      .eq('platform', snapshot.platform)
      .eq('account_id', snapshot.accountId)
      .maybeSingle();
    if (cfgErr) throw cfgErr;
    if (!cfg) {
      console.warn(`[SheetSnapshotRepository] upsertOutput: 找不到 account_config for ${snapshot.platform}:${snapshot.accountId}，跳過`);
      return this.listOutputs();
    }

    const { error } = await this.client.from('sheet_snapshots').upsert(
      {
        user_id: this.userId,
        account_config_id: (cfg as { id: string }).id,
        output_rows: snapshot.rows,
        output_synced_at: snapshot.syncedAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,account_config_id' },
    );
    if (error) throw error;

    return this.listOutputs();
  }
}
