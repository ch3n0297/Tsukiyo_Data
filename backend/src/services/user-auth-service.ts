import crypto from "node:crypto";
import { promisify } from "node:util";
import { HttpError } from "../lib/errors.ts";
import { readCookies, serializeCookie } from "../lib/http.ts";
import { normalizeEmailAddress } from "./user-auth-validation-service.ts";
import type { UserRepository } from "../repositories/user-repository.ts";
import type { SessionRepository } from "../repositories/session-repository.ts";
import type { AppConfig } from "../config.ts";
import type { User } from "../types/user.ts";
import type { PublicUser } from "../types/user.ts";
import type { Session } from "../types/session.ts";
import type { AnyRequest } from "../lib/http.ts";

const scryptAsync = promisify(crypto.scrypt);

function createRandomToken(byteLength = 32): string {
  return crypto.randomBytes(byteLength).toString("base64url");
}

function hashOpaqueToken(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function toPublicUser(user: User | null | undefined): PublicUser | null {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    approvedAt: user.approvedAt ?? null,
    approvedBy: user.approvedBy ?? null,
    lastLoginAt: user.lastLoginAt ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const derivedKey = await scryptAsync(password, salt, 64) as Buffer;

  return `scrypt$${salt.toString("hex")}$${Buffer.from(derivedKey).toString("hex")}`;
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  if (typeof passwordHash !== "string") {
    return false;
  }

  const [algorithm, saltHex, derivedKeyHex] = passwordHash.split("$");

  if (algorithm !== "scrypt" || !saltHex || !derivedKeyHex) {
    return false;
  }

  const salt = Buffer.from(saltHex, "hex");
  const derivedKey = Buffer.from(derivedKeyHex, "hex");
  const candidateKey = Buffer.from(await scryptAsync(password, salt, derivedKey.length) as Buffer);

  if (candidateKey.length !== derivedKey.length) {
    return false;
  }

  return crypto.timingSafeEqual(candidateKey, derivedKey);
}

interface UserAuthServiceOptions {
  userRepository: UserRepository;
  sessionRepository: SessionRepository;
  clock: () => Date;
  config: AppConfig;
}

export interface AuthContext {
  session: Session;
  user: PublicUser;
}

export class UserAuthService {
  private userRepository: UserRepository;
  private sessionRepository: SessionRepository;
  private clock: () => Date;
  private config: AppConfig;
  private sessionRefreshThresholdMs: number;

  constructor({ userRepository, sessionRepository, clock, config }: UserAuthServiceOptions) {
    this.userRepository = userRepository;
    this.sessionRepository = sessionRepository;
    this.clock = clock;
    this.config = config;
    this.sessionRefreshThresholdMs =
      config.sessionRefreshThresholdMs ?? Math.floor(config.sessionTtlMs / 2);
  }

  async register({ displayName, email, password }: { displayName: string; email: string; password: string }): Promise<PublicUser | null> {
    const normalizedEmail = normalizeEmailAddress(email);
    const existingUser = await this.userRepository.findByEmail(normalizedEmail);

    if (existingUser) {
      if (existingUser.status === "pending") {
        throw new HttpError(409, "USER_ALREADY_PENDING", "此 email 已送出註冊申請，請等待管理員核准。");
      }

      throw new HttpError(409, "USER_ALREADY_EXISTS", "此 email 已被使用，請直接登入或重設密碼。");
    }

    const now = this.clock().toISOString();
    const user: User = {
      id: crypto.randomUUID(),
      email: normalizedEmail,
      displayName,
      passwordHash: await hashPassword(password),
      role: "member",
      status: "pending",
      approvedAt: null,
      approvedBy: null,
      rejectedAt: null,
      rejectedBy: null,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await this.userRepository.create(user);

    return toPublicUser(user);
  }

  async login({ email, password }: { email: string; password: string }): Promise<{ session: Session; user: PublicUser | null }> {
    const normalizedEmail = normalizeEmailAddress(email);
    const user = await this.userRepository.findByEmail(normalizedEmail);

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new HttpError(401, "LOGIN_FAILED", "登入失敗，請確認 email 與密碼是否正確。");
    }

    if (user.status === "pending") {
      throw new HttpError(403, "USER_PENDING", "帳號尚待管理員核准，暫時無法登入。");
    }

    if (user.status === "rejected") {
      throw new HttpError(403, "USER_REJECTED", "此帳號註冊申請已被拒絕，請聯絡管理員。");
    }

    if (user.status !== "active") {
      throw new HttpError(403, "USER_DISABLED", "此帳號目前已停用，請聯絡管理員。");
    }

    const session = await this.#createSession(user.id);
    const now = this.clock().toISOString();

    await this.userRepository.updateById(user.id, {
      lastLoginAt: now,
      updatedAt: now,
    });

    const nextUser = await this.userRepository.findById(user.id);

    return {
      session,
      user: toPublicUser(nextUser),
    };
  }

  async logoutByRequest(req: AnyRequest): Promise<void> {
    const sessionId = this.readSessionId(req);

    if (!sessionId) {
      return;
    }

    await this.sessionRepository.deleteById(sessionId);
  }

  async getAuthenticatedContext(req: AnyRequest): Promise<AuthContext | null> {
    const sessionId = this.readSessionId(req);

    if (!sessionId) {
      return null;
    }

    const session = await this.sessionRepository.findById(sessionId);

    if (!session) {
      return null;
    }

    const now = this.clock();

    if (Date.parse(session.expiresAt) <= now.getTime()) {
      await this.sessionRepository.deleteById(session.id);
      return null;
    }

    const user = await this.userRepository.findById(session.userId);

    if (!user || user.status !== "active") {
      await this.sessionRepository.deleteById(session.id);
      return null;
    }

    const timeRemaining = Date.parse(session.expiresAt) - now.getTime();

    if (timeRemaining < this.sessionRefreshThresholdMs) {
      const nextExpiry = new Date(now.getTime() + this.config.sessionTtlMs).toISOString();
      const touchedSession = await this.sessionRepository.updateById(session.id, {
        lastSeenAt: now.toISOString(),
        expiresAt: nextExpiry,
      });

      return {
        session: touchedSession ?? {
          ...session,
          lastSeenAt: now.toISOString(),
          expiresAt: nextExpiry,
        },
        user: toPublicUser(user)!,
      };
    }

    return {
      session,
      user: toPublicUser(user)!,
    };
  }

  async requireAuthenticatedUser(req: AnyRequest): Promise<AuthContext> {
    const context = await this.getAuthenticatedContext(req);

    if (!context) {
      throw new HttpError(401, "AUTH_REQUIRED", "請先登入後再存取此功能。");
    }

    return context;
  }

  async requireAdminUser(req: AnyRequest): Promise<AuthContext> {
    const context = await this.requireAuthenticatedUser(req);

    if (context.user.role !== "admin") {
      throw new HttpError(403, "ADMIN_REQUIRED", "此功能需要管理員權限。");
    }

    return context;
  }

  readSessionId(req: AnyRequest): string | null {
    const cookies = readCookies(req);
    const sessionId = cookies[this.config.sessionCookieName];

    return typeof sessionId === "string" && sessionId !== "" ? sessionId : null;
  }

  createSessionCookie(sessionId: string): string {
    return serializeCookie(this.config.sessionCookieName, sessionId, {
      httpOnly: true,
      maxAge: Math.floor(this.config.sessionTtlMs / 1000),
      path: "/",
      sameSite: this.config.sessionCookieSameSite,
      secure: this.config.sessionCookieSecure,
    });
  }

  createClearedSessionCookie(): string {
    return serializeCookie(this.config.sessionCookieName, "", {
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: this.config.sessionCookieSameSite,
      secure: this.config.sessionCookieSecure,
    });
  }

  async seedBootstrapAdmin(): Promise<User | null> {
    if (!this.config.bootstrapAdminEmail || !this.config.bootstrapAdminPassword) {
      return null;
    }

    const normalizedEmail = normalizeEmailAddress(this.config.bootstrapAdminEmail);
    const existingUser = await this.userRepository.findByEmail(normalizedEmail);
    const passwordHash = await hashPassword(this.config.bootstrapAdminPassword);
    const now = this.clock().toISOString();

    if (existingUser) {
      await this.userRepository.updateById(existingUser.id, {
        displayName: this.config.bootstrapAdminName,
        email: normalizedEmail,
        passwordHash,
        role: "admin",
        status: "active",
        approvedAt: existingUser.approvedAt ?? now,
        approvedBy: existingUser.approvedBy ?? "bootstrap-admin",
        updatedAt: now,
      });

      return this.userRepository.findById(existingUser.id);
    }

    const user: User = {
      id: crypto.randomUUID(),
      email: normalizedEmail,
      displayName: this.config.bootstrapAdminName,
      passwordHash,
      role: "admin",
      status: "active",
      approvedAt: now,
      approvedBy: "bootstrap-admin",
      rejectedAt: null,
      rejectedBy: null,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await this.userRepository.create(user);
    return user;
  }

  async #createSession(userId: string): Promise<Session> {
    const now = this.clock();
    const session: Session = {
      id: createRandomToken(24),
      userId,
      createdAt: now.toISOString(),
      lastSeenAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.config.sessionTtlMs).toISOString(),
    };

    await this.sessionRepository.create(session);
    return session;
  }
}

export function hashPasswordResetToken(token: string): string {
  return hashOpaqueToken(token);
}

export function sanitizeUser(user: User | null | undefined): PublicUser | null {
  return toPublicUser(user);
}

export type SafeUser = PublicUser;
