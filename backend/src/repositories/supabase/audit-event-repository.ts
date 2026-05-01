import { HttpError } from "../../lib/errors.ts";
import type { SupabaseClient } from "../../lib/supabase-client.ts";

export interface AuditEventInput {
  userId?: string | null;
  actorUserId?: string | null;
  actorType: "user" | "admin" | "system";
  eventType: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

export class SupabaseAuditEventRepository {
  readonly #client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.#client = client;
  }

  async create(event: AuditEventInput): Promise<void> {
    const { error } = await this.#client.from("audit_events").insert({
      user_id: event.userId ?? null,
      actor_user_id: event.actorUserId ?? null,
      actor_type: event.actorType,
      event_type: event.eventType,
      entity_type: event.entityType ?? null,
      entity_id: event.entityId ?? null,
      metadata: event.metadata ?? {},
    });
    if (error) {
      throw new HttpError(
        500,
        "AUDIT_EVENT_CREATE_FAILED",
        `無法寫入 audit event：${error.message}`,
      );
    }
  }
}
