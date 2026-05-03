import type { PublicUser, User } from "../types/user.ts";

export interface SignupSyncInput {
  userId: string;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfileRepository {
  findById(userId: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  upsertSignupUser(input: SignupSyncInput): Promise<User>;
  recordApproval(params: {
    targetUserId: string;
    adminUser: PublicUser;
    approvedAt: string;
  }): Promise<User>;
  recordRejection(params: {
    targetUserId: string;
    adminUser: PublicUser;
    rejectedAt: string;
  }): Promise<User>;
}
