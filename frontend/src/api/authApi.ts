import { requestJson } from "./httpClient";
import type { RequestJsonOptions } from "./httpClient";
import { supabase } from "../lib/supabase-client";
import type { PublicUser } from "../types/api";

// === Supabase Auth 函數 ===

function mapSupabaseUser(user: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}): PublicUser {
  const meta = user.user_metadata ?? {};
  // app_metadata 由 server/service-role 管理，優先於 user_metadata（使用者不可篡改）
  const appMeta = user.app_metadata ?? {};
  return {
    id: user.id,
    email: user.email ?? '',
    displayName: (meta.name as string) ?? (user.email ?? ''),
    role: (appMeta.role as PublicUser['role']) ?? 'member',
    status: (appMeta.status as PublicUser['status']) ?? 'pending',
    approvedAt: null,
    approvedBy: null,
    lastLoginAt: null,
    createdAt: '',
    updatedAt: '',
  };
}

function requireSupabase() {
  if (!supabase) throw new Error('Supabase 未設定，請確認 VITE_SUPABASE_URL 環境變數。');
  return supabase;
}

export async function signInWithSupabase(email: string, password: string): Promise<PublicUser> {
  const { data, error } = await requireSupabase().auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Supabase 未回傳使用者資料。');

  try {
    const payload = await getCurrentUser() as { user?: PublicUser };
    return payload.user ?? mapSupabaseUser(data.user);
  } catch (serverError) {
    await signOutWithSupabase().catch(() => undefined);
    throw serverError;
  }
}

export async function signOutWithSupabase(): Promise<void> {
  const { error } = await requireSupabase().auth.signOut();
  if (error) throw new Error(error.message);
}

export async function signUpWithSupabase(
  email: string,
  password: string,
  displayName: string,
): Promise<{ status: string }> {
  const { data, error } = await requireSupabase().auth.signUp({
    email,
    password,
    // role/status 不放 user_metadata（用戶可自行更新），由後端/service-role 設定 app_metadata
    options: { data: { name: displayName } },
  });
  if (error) throw new Error(error.message);

  if (!data.user?.id) {
    throw new Error('Supabase 未回傳使用者識別碼。');
  }

  try {
    await registerUser({
      display_name: displayName,
    });
  } catch (serverError) {
    await signOutWithSupabase().catch(() => undefined);
    throw serverError;
  }
  await signOutWithSupabase();
  return { status: 'pending' };
}

export async function resetPasswordWithSupabase(newPassword: string): Promise<void> {
  const { error } = await requireSupabase().auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}

export async function requestPasswordResetWithSupabase(email: string): Promise<void> {
  const { error } = await requireSupabase().auth.resetPasswordForEmail(email);
  if (error) throw new Error(error.message);
}

export async function getSupabaseCurrentUser(): Promise<PublicUser | null> {
  const client = requireSupabase();
  const {
    data: { session },
    error: sessionError,
  } = await client.auth.getSession();
  if (sessionError) throw new Error(sessionError.message);
  if (!session) return null;

  try {
    const payload = await getCurrentUser() as { user?: PublicUser };
    return payload.user ?? null;
  } catch (serverError) {
    await signOutWithSupabase().catch(() => undefined);
    throw serverError;
  }
}

// === Backend API helpers used by the Supabase Auth runtime flow ===

export function getCurrentUser(options?: RequestJsonOptions) {
  return requestJson("/api/v1/auth/me", options);
}

export function registerUser(body: unknown, options?: RequestJsonOptions) {
  return requestJson("/api/v1/auth/register", {
    ...options,
    body,
    method: "POST",
  });
}

export function listPendingUsers(options?: RequestJsonOptions) {
  return requestJson("/api/v1/admin/pending-users", options);
}

export function approvePendingUser(userId: string, options?: RequestJsonOptions) {
  return requestJson(`/api/v1/admin/pending-users/${encodeURIComponent(userId)}/approve`, {
    ...options,
    method: "POST",
  });
}

export function rejectPendingUser(userId: string, options?: RequestJsonOptions) {
  return requestJson(`/api/v1/admin/pending-users/${encodeURIComponent(userId)}/reject`, {
    ...options,
    method: "POST",
  });
}
