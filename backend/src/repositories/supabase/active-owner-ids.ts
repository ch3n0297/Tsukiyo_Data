import type { SupabaseClient } from "../../lib/supabase-client.ts";

function isActiveOwner(user: { app_metadata?: Record<string, unknown> }): boolean {
  return user.app_metadata?.status === "active";
}

export async function listActiveOwnerIds(client: SupabaseClient): Promise<Set<string>> {
  const activeOwnerIds = new Set<string>();
  const perPage = 1000;

  for (let page = 1; ; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }

    for (const user of data.users) {
      if (isActiveOwner(user)) {
        activeOwnerIds.add(user.id);
      }
    }

    if (data.users.length < perPage) {
      return activeOwnerIds;
    }
  }
}
