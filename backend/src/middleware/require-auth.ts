import type { FastifyRequest, FastifyReply } from 'fastify';
import { HttpError } from '../lib/errors.ts';
import type { SupabaseClient } from '../lib/supabase-client.ts';
import type { UserRole, UserStatus } from '../types/user.ts';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readRole(value: unknown): UserRole {
  return value === 'admin' || value === 'member' ? value : 'member';
}

function readStatus(value: unknown): UserStatus {
  return value === 'active' || value === 'rejected' || value === 'pending'
    ? value
    : 'pending';
}

export function createRequireAuth(supabase: SupabaseClient) {
  return async function requireAuth(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new HttpError(401, 'MISSING_JWT', '需要 Authorization Bearer token。');
    }

    const jwt = authHeader.slice(7);
    const { data: { user }, error } = await supabase.auth.getUser(jwt);

    if (error || !user) {
      throw new HttpError(401, 'INVALID_JWT', 'JWT 無效或已過期。');
    }

    const userMetadata = readRecord(user.user_metadata);
    const appMetadata = readRecord(user.app_metadata);
    const displayName = typeof userMetadata.name === 'string' && userMetadata.name.trim() !== ''
      ? userMetadata.name
      : user.email ?? '';

    req.user = {
      id: user.id,
      email: user.email ?? '',
      displayName,
      role: readRole(appMetadata.role),
      status: readStatus(appMetadata.status),
      createdAt: user.created_at,
      updatedAt: user.updated_at ?? user.created_at,
    };
  };
}
