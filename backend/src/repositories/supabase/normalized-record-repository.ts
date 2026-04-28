import type { SupabaseClient } from '../../lib/supabase-client.ts';
import type { NormalizedRecord } from '../../types/record.ts';

function mapRow(row: Record<string, unknown>): NormalizedRecord {
  return {
    id: row.id as string,
    jobId: (row.job_id as string) ?? '',
    accountKey: `${row.platform}:${row.account_id}`,
    platform: row.platform as NormalizedRecord['platform'],
    accountId: row.account_id as string,
    contentId: row.post_id as string,
    contentType: (row.media_type as string) ?? 'UNKNOWN',
    publishedAt: (row.post_timestamp as string) ?? new Date().toISOString(),
    caption: (row.caption as string) ?? '',
    url: '',
    views: (row.view_count as number) ?? 0,
    likes: (row.like_count as number) ?? 0,
    comments: (row.comment_count as number) ?? 0,
    shares: (row.share_count as number) ?? 0,
    fetchTime: (row.created_at as string) ?? new Date().toISOString(),
    dataStatus: 'fresh',
  };
}

export class SupabaseNormalizedRecordRepository {
  private readonly client: SupabaseClient;
  private readonly userId: string;

  constructor(client: SupabaseClient, userId: string) {
    this.client = client;
    this.userId = userId;
  }

  async listAll(): Promise<NormalizedRecord[]> {
    const { data, error } = await this.client
      .from('normalized_records')
      .select('*')
      .eq('user_id', this.userId);
    if (error) throw error;
    return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  }

  async replaceForAccount(accountKey: string, nextRecords: NormalizedRecord[]): Promise<NormalizedRecord[]> {
    const [platform, accountId] = accountKey.split(':');

    if (nextRecords.length === 0) {
      const { error } = await this.client
        .from('normalized_records')
        .delete()
        .eq('user_id', this.userId)
        .eq('platform', platform)
        .eq('account_id', accountId);
      if (error) throw error;
      return [];
    }

    const rows = nextRecords.map((r) => ({
      id: r.id,
      user_id: this.userId,
      job_id: r.jobId || null,
      platform: r.platform,
      account_id: r.accountId,
      post_id: r.contentId,
      post_timestamp: r.publishedAt,
      caption: r.caption,
      media_type: r.contentType,
      like_count: r.likes,
      comment_count: r.comments,
      view_count: r.views,
      share_count: r.shares,
    }));

    // upsert-first：先寫入確保成功，再刪孤立舊資料
    const { error: upsertErr } = await this.client
      .from('normalized_records')
      .upsert(rows, { onConflict: 'user_id,platform,account_id,post_id' });
    if (upsertErr) throw upsertErr;

    const keptContentIds = nextRecords.map((r) => r.contentId).join(',');
    const { error: delErr } = await this.client
      .from('normalized_records')
      .delete()
      .eq('user_id', this.userId)
      .eq('platform', platform)
      .eq('account_id', accountId)
      .not('post_id', 'in', `(${keptContentIds})`);
    if (delErr) throw delErr;

    return this.listAll();
  }
}
