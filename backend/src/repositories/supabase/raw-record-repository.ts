import type { SupabaseClient } from '../../lib/supabase-client.ts';
import type { RawRecord } from '../../types/record.ts';

type RawRecordRow = {
  id: string;
  jobId?: string | null;
  platform: string;
  accountId: string;
  fetchedAt?: string;
  payload?: unknown;
  [key: string]: unknown;
};

export class SupabaseRawRecordRepository {
  private readonly client: SupabaseClient;
  private readonly userId: string;

  constructor(client: SupabaseClient, userId: string) {
    this.client = client;
    this.userId = userId;
  }

  async listAll(): Promise<RawRecord[]> {
    const { data, error } = await this.client
      .from('raw_records')
      .select('*')
      .eq('user_id', this.userId);
    if (error) throw error;
    // 將 raw_data JSONB 還原成原始 record 結構
    return (data ?? []).map((row) => row.raw_data as RawRecord);
  }

  async appendMany(recordsToAdd: RawRecord[]): Promise<RawRecord[]> {
    if (recordsToAdd.length === 0) return this.listAll();

    const rows = recordsToAdd.map((record) => {
      const r = record as RawRecordRow;
      // post_id 優先取 payload.id，回退到 record.id
      const payload = r.payload as Record<string, unknown> | undefined;
      const postId = (payload?.id as string) ?? (r.id as string) ?? crypto.randomUUID();

      return {
        id: r.id as string ?? crypto.randomUUID(),
        user_id: this.userId,
        job_id: (r.jobId as string | null) ?? null,
        platform: r.platform as string,
        account_id: r.accountId as string,
        post_id: postId,
        raw_data: record,
        fetched_at: (r.fetchedAt as string) ?? new Date().toISOString(),
      };
    });

    const { error } = await this.client
      .from('raw_records')
      .upsert(rows, { onConflict: 'user_id,platform,account_id,post_id' });
    if (error) throw error;

    return this.listAll();
  }
}
