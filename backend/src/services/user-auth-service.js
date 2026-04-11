import crypto from "node:crypto";
import { promisify } from "node:util";
import { HttpError } from "../lib/errors.js";
import { readCookies, serializeCookie } from "../lib/http.js";
import { normalizeEmailAddress } from "./user-auth-validation-service.js";

const scryptAsync = promisify(crypto.scrypt);
const AUTH_METHODS = Object.freeze(["password", "google"]);

function createRandomToken(byteLength = 32) {
  return crypto.randomBytes(byteLength).toString("base64url");
}

function hashOpaqueToken(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readTrimmedString(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function normalizeAuthMethods(user) {
  const methods = new Set(
    Array.isArray(user?.authMethods)
      ? user.authMethods.filter((value) => AUTH_METHODS.includes(value))
      : [],
  );

  if (typeof user?.passwordHash === "string" && user.passwordHash !== "") {
    methods.add("password");
  }

  if (readTrimmedString(user?.googleSub)) {
    methods.add("google");
  }

  return AUTH_METHODS.filter((value) => methods.has(value));
}

function mergeAuthMethods(user, nextMethods = []) {
  const methods = new Set(normalizeAuthMethods(user));

  for (const method of nextMethods) {
    if (AUTH_METHODS.includes(method)) {
      methods.add(method);
    }
  }

  return AUTH_METHODS.filter((value) => methods.has(value));
}

function toPublicUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    tenantKey: user.tenantKey ?? null,
    approvedAt: user.approvedAt ?? null,
    approvedBy: user.approvedBy ?? null,
    lastLoginAt: user.lastLoginAt ?? null,
    authMethods: normalizeAuthMethods(user),
    googleLinkedAt: user.googleLinkedAt ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derivedKey = await scryptAsync(password, salt, 64);

  return `scrypt$${salt.toString("hex")}$${Buffer.from(derivedKey).toString("hex")}`;
}

export async function verifyPassword(password, passwordHash) {
  if (typeof passwordHash !== "string") {
    return false;
  }

  const [algorithm, saltHex, derivedKeyHex] = passwordHash.split("$");

  if (algorithm !== "scrypt" || !saltHex || !derivedKeyHex) {
    return false;
  }

  const salt = Buffer.from(saltHex, "hex");
  const derivedKey = Buffer.from(derivedKeyHex, "hex");
  const candidateKey = Buffer.from(await scryptAsync(password, salt, derivedKey.length));

  if (candidateKey.length !== derivedKey.length) {
    return false;
  }

  return crypto.timingSafeEqual(candidateKey, derivedKey);
}

export class UserAuthService {
  constructor({
    userRepository,
    sessionRepository,
    clock,
    config,
  }) {
    this.userRepository = userRepository;
    this.sessionRepository = sessionRepository;
    this.clock = clock;
    this.config = config;
    this.sessionRefreshThresholdMs =
      config.sessionRefreshThresholdMs ?? Math.floor(config.sessionTtlMs / 2);
  }

  async register({ displayName, email, password }) {
    const normalizedEmail = normalizeEmailAddress(email);
    const existingUser = await this.userRepository.findByEmail(normalizedEmail);

    if (existingUser) {
      if (existingUser.status === "pending") {
        throw new HttpError(409, "USER_ALREADY_PENDING", "此 email 已送出註冊申請，請等待管理員核准。");
      }

      throw new HttpError(409, "USER_ALREADY_EXISTS", "此 email 已被使用，請直接登入或重設密碼。");
    }

    const now = this.clock().toISOString();
    const user = {
      id: crypto.randomUUID(),
      email: normalizedEmail,
      displayName,
      passwordHash: await hashPassword(password),
      authMethods: ["password"],
      googleSub: null,
      googleLinkedAt: null,
      role: "member",
      status: "pending",
      approvedAt: null,
      approvedBy: null,
      rejectedAt: null,
      rejectedBy: null,
      tenantKey: null,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await this.userRepository.create(user);

    return toPublicUser(user);
  }

  async login({ email, password }) {
    const normalizedEmail = normalizeEmailAddress(email);
    const user = await this.userRepository.findByEmail(normalizedEmail);

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new HttpError(401, "LOGIN_FAILED", "登入失敗，請確認 email 與密碼是否正確。");
    }

    this.#assertUserStatusAllowsLogin(user);

    if (user.role !== "admin") {
      throw new HttpError(403, "GOOGLE_LOGIN_REQUIRED", "一般使用者請改用 Google 登入。");
    }

    return this.createAuthenticatedSession(user.id);
  }

  async loginWithGoogleIdentity({ displayName, email, googleSub, tenantKey }) {
    const normalizedEmail = normalizeEmailAddress(email);
    const normalizedGoogleSub = readTrimmedString(googleSub);
    const normalizedDisplayName = readTrimmedString(displayName) ?? normalizedEmail;

    if (!normalizedGoogleSub) {
      throw new HttpError(400, "GOOGLE_SUB_REQUIRED", "Google identity 缺少必要的使用者識別。");
    }

    const existingByGoogleSub = await this.userRepository.findByGoogleSub(normalizedGoogleSub);
    const existingByEmail = await this.userRepository.findByEmail(normalizedEmail);

    if (
      existingByGoogleSub &&
      existingByEmail &&
      existingByGoogleSub.id !== existingByEmail.id
    ) {
      throw new HttpError(
        409,
        "GOOGLE_IDENTITY_CONFLICT",
        "此 Google 帳號與既有使用者資料衝突，請聯絡管理員處理。",
      );
    }

    const targetUser = existingByGoogleSub ?? existingByEmail;
    const now = this.clock().toISOString();

    if (!targetUser) {
      if (!readTrimmedString(tenantKey)) {
        throw new HttpError(
          409,
          "GOOGLE_LOGIN_TENANT_REQUIRED",
          "系統尚未為此 Google 帳號指派租戶，請先由管理員完成設定。",
        );
      }

      const user = {
        id: crypto.randomUUID(),
        email: normalizedEmail,
        displayName: normalizedDisplayName,
        passwordHash: null,
        authMethods: ["google"],
        googleSub: normalizedGoogleSub,
        googleLinkedAt: now,
        role: "member",
        status: "active",
        approvedAt: now,
        approvedBy: "google-login",
        rejectedAt: null,
        rejectedBy: null,
        tenantKey,
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
      };

      await this.userRepository.create(user);
      return this.createAuthenticatedSession(user.id);
    }

    if (readTrimmedString(targetUser.googleSub) && targetUser.googleSub !== normalizedGoogleSub) {
      throw new HttpError(
        409,
        "GOOGLE_IDENTITY_CONFLICT",
        "此 Google 帳號與既有使用者資料衝突，請聯絡管理員處理。",
      );
    }

    await this.userRepository.updateById(targetUser.id, {
      authMethods: mergeAuthMethods(targetUser, ["google"]),
      displayName: readTrimmedString(targetUser.displayName) ?? normalizedDisplayName,
      email: normalizedEmail,
      googleLinkedAt: targetUser.googleLinkedAt ?? now,
      googleSub: normalizedGoogleSub,
      updatedAt: now,
    });

    const nextUser = await this.userRepository.findById(targetUser.id);
    this.#assertUserStatusAllowsLogin(nextUser ?? targetUser);
    return this.createAuthenticatedSession(targetUser.id);
  }

  async createAuthenticatedSession(userId) {
    const session = await this.#createSession(userId);
    const now = this.clock().toISOString();

    await this.userRepository.updateById(userId, {
      lastLoginAt: now,
      updatedAt: now,
    });

    const nextUser = await this.userRepository.findById(userId);

    return {
      session,
      user: toPublicUser(nextUser),
    };
  }

  async logoutByRequest(req) {
    const sessionId = this.readSessionId(req);

    if (!sessionId) {
      return;
    }

    await this.sessionRepository.deleteById(sessionId);
  }

  async getAuthenticatedContext(req) {
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
        user: toPublicUser(user),
      };
    }

    return {
      session,
      user: toPublicUser(user),
    };
  }

  async requireAuthenticatedUser(req) {
    const context = await this.getAuthenticatedContext(req);

    if (!context) {
      throw new HttpError(401, "AUTH_REQUIRED", "請先登入後再存取此功能。");
    }

    return context;
  }

  async requireAdminUser(req) {
    const context = await this.requireAuthenticatedUser(req);

    if (context.user.role !== "admin") {
      throw new HttpError(403, "ADMIN_REQUIRED", "此功能需要管理員權限。");
    }

    return context;
  }

  readSessionId(req) {
    const cookies = readCookies(req);
    const sessionId = cookies[this.config.sessionCookieName];

    return typeof sessionId === "string" && sessionId !== "" ? sessionId : null;
  }

  createSessionCookie(sessionId) {
    return serializeCookie(this.config.sessionCookieName, sessionId, {
      httpOnly: true,
      maxAge: Math.floor(this.config.sessionTtlMs / 1000),
      path: "/",
      sameSite: this.config.sessionCookieSameSite,
      secure: this.config.sessionCookieSecure,
    });
  }

  createClearedSessionCookie() {
    return serializeCookie(this.config.sessionCookieName, "", {
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: this.config.sessionCookieSameSite,
      secure: this.config.sessionCookieSecure,
    });
  }

  async seedBootstrapAdmin() {
    if (!this.config.bootstrapAdminEmail || !this.config.bootstrapAdminPassword) {
      return null;
    }

    const normalizedEmail = normalizeEmailAddress(this.config.bootstrapAdminEmail);
    const existingUser = await this.userRepository.findByEmail(normalizedEmail);
    const passwordHash = await hashPassword(this.config.bootstrapAdminPassword);
    const now = this.clock().toISOString();

    if (existingUser) {
      await this.userRepository.updateById(existingUser.id, {
        authMethods: mergeAuthMethods(existingUser, ["password"]),
        displayName: this.config.bootstrapAdminName,
        email: normalizedEmail,
        googleLinkedAt: existingUser.googleLinkedAt ?? null,
        passwordHash,
        role: "admin",
        status: "active",
        tenantKey: existingUser.tenantKey ?? "system",
        approvedAt: existingUser.approvedAt ?? now,
        approvedBy: existingUser.approvedBy ?? "bootstrap-admin",
        updatedAt: now,
      });

      return this.userRepository.findById(existingUser.id);
    }

    const user = {
      id: crypto.randomUUID(),
      email: normalizedEmail,
      displayName: this.config.bootstrapAdminName,
      passwordHash,
      authMethods: ["password"],
      googleSub: null,
      googleLinkedAt: null,
      role: "admin",
      status: "active",
      tenantKey: "system",
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

  async #createSession(userId) {
    const now = this.clock();
    const session = {
      id: createRandomToken(24),
      userId,
      createdAt: now.toISOString(),
      lastSeenAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.config.sessionTtlMs).toISOString(),
    };

    await this.sessionRepository.create(session);
    return session;
  }

  #assertUserStatusAllowsLogin(user) {
    if (user.status === "pending") {
      throw new HttpError(403, "USER_PENDING", "帳號尚待管理員核准，暫時無法登入。");
    }

    if (user.status === "rejected") {
      throw new HttpError(403, "USER_REJECTED", "此帳號註冊申請已被拒絕，請聯絡管理員。");
    }

    if (user.status !== "active") {
      throw new HttpError(403, "USER_DISABLED", "此帳號目前已停用，請聯絡管理員。");
    }
  }
}

export function hashPasswordResetToken(token) {
  return hashOpaqueToken(token);
}

export function sanitizeUser(user) {
  return toPublicUser(user);
}
