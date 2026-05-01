import type { SupabaseClient } from "../../lib/supabase-client.ts";
import type { PublicUser, User, UserRole, UserStatus } from "../../types/user.ts";
import type { SignupSyncInput } from "../user-repository.ts";

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function readNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function mapProfile(
  row: Record<string, unknown>,
  { role = "member", status = "pending" }: { role?: UserRole; status?: UserStatus } = {},
): User {
  const createdAt = readString(row.created_at, new Date().toISOString());
  return {
    id: readString(row.user_id),
    email: readString(row.email),
    displayName: readString(row.display_name, readString(row.email)),
    role,
    status,
    approvedAt: readNullableString(row.approved_at),
    approvedBy: readNullableString(row.approved_by),
    rejectedAt: readNullableString(row.rejected_at),
    rejectedBy: readNullableString(row.rejected_by),
    lastLoginAt: readNullableString(row.last_login_at),
    createdAt,
    updatedAt: readString(row.updated_at, createdAt),
  };
}

export class SupabaseUserRepository {
  readonly #client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.#client = client;
  }

  async findById(userId: string): Promise<User | null> {
    const { data, error } = await this.#client
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapProfile(data as Record<string, unknown>) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const { data, error } = await this.#client
      .from("profiles")
      .select("*")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();
    if (error) throw error;
    return data ? mapProfile(data as Record<string, unknown>) : null;
  }

  async listPendingUsers(): Promise<User[]> {
    const { data, error } = await this.#client
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => mapProfile(row as Record<string, unknown>));
  }

  async upsertSignupUser(input: SignupSyncInput): Promise<User> {
    const row = {
      user_id: input.userId,
      email: input.email.trim().toLowerCase(),
      display_name: input.displayName,
      created_at: input.createdAt,
      updated_at: input.updatedAt,
    };
    const { data, error } = await this.#client
      .from("profiles")
      .upsert(row, { onConflict: "user_id" })
      .select("*")
      .single();
    if (error) throw error;
    return mapProfile(data as Record<string, unknown>);
  }

  async recordApproval({
    targetUserId,
    adminUser,
    approvedAt,
  }: {
    targetUserId: string;
    adminUser: PublicUser;
    approvedAt: string;
  }): Promise<User> {
    const { data, error } = await this.#client
      .from("profiles")
      .update({
        approved_at: approvedAt,
        approved_by: adminUser.id,
        rejected_at: null,
        rejected_by: null,
        updated_at: approvedAt,
      })
      .eq("user_id", targetUserId)
      .select("*")
      .single();
    if (error) throw error;
    return mapProfile(data as Record<string, unknown>, { status: "active" });
  }

  async recordRejection({
    targetUserId,
    adminUser,
    rejectedAt,
  }: {
    targetUserId: string;
    adminUser: PublicUser;
    rejectedAt: string;
  }): Promise<User> {
    const { data, error } = await this.#client
      .from("profiles")
      .update({
        rejected_at: rejectedAt,
        rejected_by: adminUser.id,
        updated_at: rejectedAt,
      })
      .eq("user_id", targetUserId)
      .select("*")
      .single();
    if (error) throw error;
    return mapProfile(data as Record<string, unknown>, { status: "rejected" });
  }
}
