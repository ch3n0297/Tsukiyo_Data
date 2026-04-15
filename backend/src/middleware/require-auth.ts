import type { FastifyRequest, FastifyReply } from 'fastify';
import { HttpError } from '../lib/errors.ts';
import type { SupabaseClient } from '../lib/supabase-client.ts';

export interface AuthUser {
  id: string;
  email: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
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

    req.user = { id: user.id, email: user.email ?? '' };
  };
}
