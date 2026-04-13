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
        platform: (cfg.platform as SheetStatusSnapshot['platform']),
        accountId: (cfg.account_id as string) ?? '',
        refreshStatus: (r.refresh_status as SheetStatusSnapshot['refreshStatus']) ?? 'idle',
        systemMessage: (r.system_message as string) ?? '',
        lastRequestTime: null,
        lastSuccessTime: (r.last_success_at as string | null) ?? null,
        currentJobId: (r.current_job_id as string | null) ?? null,
        updatedAt: (r.updated_at as string) ?? new Date().toISOString(),
      };
    });
  }

  async listOutputs(): Promise<SheetOutputSnapshot[]> {
    // Phase 2 stub — Phase 4 補完
    return [];
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
    if (!cfg) return this.listStatuses(); // 找不到對應 config，跳過

    const { error } = await this.client.from('sheet_snapshots').upsert(
      {
        user_id: this.userId,
        account_config_id: (cfg as { id: string }).id,
        refresh_status: snapshot.refreshStatus,
        system_message: snapshot.systemMessage,
        last_success_at: snapshot.lastSuccessTime,
        current_job_id: snapshot.currentJobId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,account_config_id' },
    );
    if (error) throw error;

    return this.listStatuses();
  }

  async upsertOutput(_snapshot: SheetOutputSnapshot): Promise<SheetOutputSnapshot[]> {
    // Phase 2 stub — Phase 4 補完
    return [];
  }
}
