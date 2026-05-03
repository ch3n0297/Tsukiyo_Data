import type { SupabaseClient } from '../../lib/supabase-client.ts';
import type { Job, JobStatus, TriggerType } from '../../types/job.ts';
import { listActiveOwnerIds } from './active-owner-ids.ts';

function mapRow(row: Record<string, unknown>): Job {
  return {
    id: row.id as string,
    ownerUserId: row.user_id as string,
    accountKey: (row.account_key as string) ?? '',
    platform: (row.platform as Job['platform']) ?? 'instagram',
    accountId: (row.account_id as string) ?? '',
    triggerType: (row.trigger_source as TriggerType) ?? 'manual',
    requestSource: (row.request_source as Job['requestSource']) ?? 'manual-refresh',
    refreshDays: (row.refresh_days as number) ?? 30,
    status: row.status as JobStatus,
    systemMessage: (row.system_message as string) ?? '',
    queuedAt: (row.queued_at as string) ?? '',
    startedAt: (row.started_at as string | null) ?? null,
    finishedAt: (row.completed_at as string | null) ?? null,
    errorCode: (row.error_code as string | null) ?? null,
    resultSummary: (row.result_summary as unknown | null) ?? null,
  };
}

export class SupabaseSystemJobRepository {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async listJobsByStatusesAcrossOwners(statuses: JobStatus[]): Promise<Job[]> {
    const [activeOwnerIds, { data, error }] = await Promise.all([
      listActiveOwnerIds(this.client),
      this.client
        .from('jobs')
        .select('*')
        .in('status', statuses),
    ]);
    if (error) throw error;
    return (data ?? [])
      .filter((row) => activeOwnerIds.has((row as Record<string, unknown>).user_id as string))
      .map((row) => mapRow(row as Record<string, unknown>));
  }
}

export class SupabaseJobRepository {
  private readonly client: SupabaseClient;
  private readonly userId: string;
  private readonly defaultAccountConfigId: string | undefined;

  constructor(client: SupabaseClient, userId: string, defaultAccountConfigId?: string) {
    this.client = client;
    this.userId = userId;
    this.defaultAccountConfigId = defaultAccountConfigId;
  }

  async listAll(): Promise<Job[]> {
    const { data, error } = await this.client
      .from('jobs')
      .select('*')
      .eq('user_id', this.userId)
      .order('queued_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  }

  async create(job: Job): Promise<Job[]> {
    // 嘗試由 accountKey 查找 account_config_id
    let accountConfigId = this.defaultAccountConfigId;

    if (!accountConfigId && job.accountKey) {
      const [platform, accountId] = job.accountKey.split(':');
      const { data: cfg } = await this.client
        .from('account_configs')
        .select('id')
        .eq('user_id', this.userId)
        .eq('platform', platform)
        .eq('account_id', accountId)
        .maybeSingle();
      accountConfigId = (cfg as { id: string } | null)?.id;
    }

    // 若找不到 account_config，建立 placeholder record
    if (!accountConfigId) {
      const [platform, accountId] = job.accountKey.split(':');
      const { data: newCfg, error: cfgErr } = await this.client
        .from('account_configs')
        .insert({
          user_id: this.userId,
          client_name: accountId,
          platform,
          account_id: accountId,
          refresh_days: job.refreshDays,
        })
        .select('id')
        .single();
      if (cfgErr) throw cfgErr;
      accountConfigId = (newCfg as { id: string }).id;
    }

    const { data, error } = await this.client.from('jobs').insert({
      id: job.id,
      user_id: this.userId,
      account_config_id: accountConfigId,
      account_key: job.accountKey,
      platform: job.platform,
      account_id: job.accountId,
      trigger_source: job.triggerType,
      request_source: job.requestSource,
      refresh_days: job.refreshDays,
      status: job.status,
      system_message: job.systemMessage || null,
      queued_at: job.queuedAt,
      started_at: job.startedAt,
      completed_at: job.finishedAt,
    }).select('*').single();
    if (error) throw error;

    return [mapRow(data as Record<string, unknown>)];
  }

  async findById(jobId: string): Promise<Job | undefined> {
    const { data, error } = await this.client
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', this.userId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapRow(data as Record<string, unknown>) : undefined;
  }

  async updateById(jobId: string, patch: Partial<Job>): Promise<Job | null> {
    const dbPatch: Record<string, unknown> = {};
    if (patch.status !== undefined) dbPatch.status = patch.status;
    if (patch.systemMessage !== undefined) dbPatch.system_message = patch.systemMessage || null;
    if (patch.startedAt !== undefined) dbPatch.started_at = patch.startedAt;
    if (patch.finishedAt !== undefined) dbPatch.completed_at = patch.finishedAt;
    if (patch.errorCode !== undefined) dbPatch.error_code = patch.errorCode;
    if (patch.resultSummary !== undefined) dbPatch.result_summary = patch.resultSummary;

    if (Object.keys(dbPatch).length > 0) {
      const { error } = await this.client
        .from('jobs')
        .update(dbPatch)
        .eq('id', jobId)
        .eq('user_id', this.userId);
      if (error) throw error;
    }

    const found = await this.findById(jobId);
    return found ?? null;
  }

  async findActiveByAccountKey(accountKey: string): Promise<Job | undefined> {
    const { data, error } = await this.client
      .from('jobs')
      .select('*')
      .eq('user_id', this.userId)
      .eq('account_key', accountKey)
      .in('status', ['queued', 'running'])
      .maybeSingle();
    if (error) throw error;
    return data ? mapRow(data as Record<string, unknown>) : undefined;
  }

  async listByStatuses(statuses: JobStatus[]): Promise<Job[]> {
    const { data, error } = await this.client
      .from('jobs')
      .select('*')
      .eq('user_id', this.userId)
      .in('status', statuses);
    if (error) throw error;
    return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  }

  async listRecentBySource(requestSource: string, sinceIso: string): Promise<Job[]> {
    const { data, error } = await this.client
      .from('jobs')
      .select('*')
      .eq('user_id', this.userId)
      .eq('request_source', requestSource)
      .gte('queued_at', sinceIso);
    if (error) throw error;
    return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  }

  async findLatestAcceptedJob(accountKey: string, triggerType: TriggerType): Promise<Job | null> {
    const { data, error } = await this.client
      .from('jobs')
      .select('*')
      .eq('user_id', this.userId)
      .eq('account_key', accountKey)
      .eq('trigger_source', triggerType)
      .in('status', ['queued', 'running', 'success'])
      .order('queued_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? mapRow(data as Record<string, unknown>) : null;
  }
}
