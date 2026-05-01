import type { SupabaseClient } from "../../lib/supabase-client.ts";
import type { PublicUser, User, UserRole, UserStatus } from "../../types/user.ts";
import type { SignupSyncInput, UserProfileRepository } from "../user-repository.ts";

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function readNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function mapProfile(
  row: Record<string, unknown>,
  {
    fallbackTimestamp,
    role = "member",
    status = "pending",
  }: { fallbackTimestamp: string; role?: UserRole; status?: UserStatus },
): User {
  const createdAt = readString(row.created_at, fallbackTimestamp);
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

export class SupabaseUserProfileRepository implements UserProfileRepository {
  readonly #client: SupabaseClient;
  readonly #clock: () => Date;

  constructor(client: SupabaseClient, { clock = () => new Date() }: { clock?: () => Date } = {}) {
    this.#client = client;
    this.#clock = clock;
  }

  #fallbackTimestamp(): string {
    return this.#clock().toISOString();
  }

  async findById(userId: string): Promise<User | null> {
    const { data, error } = await this.#client
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapProfile(data as Record<string, unknown>, {
      fallbackTimestamp: this.#fallbackTimestamp(),
    }) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const { data, error } = await this.#client
      .from("profiles")
      .select("*")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();
    if (error) throw error;
    return data ? mapProfile(data as Record<string, unknown>, {
      fallbackTimestamp: this.#fallbackTimestamp(),
    }) : null;
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
    return mapProfile(data as Record<string, unknown>, {
      fallbackTimestamp: input.createdAt,
    });
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
    return mapProfile(data as Record<string, unknown>, {
      fallbackTimestamp: approvedAt,
      status: "active",
    });
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
    return mapProfile(data as Record<string, unknown>, {
      fallbackTimestamp: rejectedAt,
      status: "rejected",
    });
  }
}
