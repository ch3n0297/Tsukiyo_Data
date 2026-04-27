import type { FastifyRequest, FastifyReply } from 'fastify';
import { HttpError } from '../lib/errors.ts';
import type { SupabaseClient } from '../lib/supabase-client.ts';
import type { PublicUser, UserRole, UserStatus } from '../types/user.ts';

export interface AuthUser extends PublicUser {}

interface RequireAuthOptions {
  requireAdmin?: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

function readMetadataValue(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
): string | undefined {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function mapSupabaseUser(user: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}): AuthUser {
  const displayName = readMetadataValue(user.user_metadata, 'name') ?? user.email ?? '';
  const role = (readMetadataValue(user.app_metadata, 'role') ?? 'member') as UserRole;
  const status = (
    readMetadataValue(user.app_metadata, 'status') ??
    readMetadataValue(user.user_metadata, 'status') ??
    'pending'
  ) as UserStatus;

  return {
    id: user.id,
    email: user.email ?? '',
    displayName,
    role,
    status,
    approvedAt: null,
    approvedBy: null,
    lastLoginAt: null,
    createdAt: '',
    updatedAt: '',
  };
}

export function createRequireAuth(
  supabase: SupabaseClient,
  { requireAdmin = false }: RequireAuthOptions = {},
) {
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

    const authUser = mapSupabaseUser(user);
    if (authUser.status !== 'active') {
      throw new HttpError(403, 'USER_PENDING', '帳號尚待管理員核准，暫時無法使用。');
    }
    if (requireAdmin && authUser.role !== 'admin') {
      throw new HttpError(403, 'ADMIN_REQUIRED', '此功能需要管理員權限。');
    }

    req.user = authUser;
  };
}
