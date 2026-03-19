import crypto from "node:crypto";
import { HttpError } from "../lib/errors.js";
import { hashPassword, hashPasswordResetToken } from "./user-auth-service.js";
import { normalizeEmailAddress } from "./user-auth-validation-service.js";

function createRawToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function buildOutboxMessage({ clock, to, type, subject, body }) {
  return {
    id: crypto.randomUUID(),
    type,
    to,
    subject,
    body,
    createdAt: clock().toISOString(),
  };
}

export class PasswordResetService {
  constructor({
    userRepository,
    sessionRepository,
    passwordResetTokenRepository,
    outboxMessageRepository,
    clock,
    config,
  }) {
    this.userRepository = userRepository;
    this.sessionRepository = sessionRepository;
    this.passwordResetTokenRepository = passwordResetTokenRepository;
    this.outboxMessageRepository = outboxMessageRepository;
    this.clock = clock;
    this.config = config;
  }

  async requestReset({ email, origin }) {
    const normalizedEmail = normalizeEmailAddress(email);
    const user = await this.userRepository.findByEmail(normalizedEmail);

    if (!user || user.status !== "active") {
      return;
    }

    const now = this.clock();
    const rawToken = createRawToken();

    await this.passwordResetTokenRepository.deleteByUserId(user.id);
    await this.passwordResetTokenRepository.create({
      id: crypto.randomUUID(),
      userId: user.id,
      tokenHash: hashPasswordResetToken(rawToken),
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.config.passwordResetTtlMs).toISOString(),
      usedAt: null,
    });

    const resolvedOrigin = this.config.publicAppOrigin ?? origin;
    const resetUrl = new URL("/reset-password", resolvedOrigin);
    resetUrl.searchParams.set("token", rawToken);

    await this.outboxMessageRepository.create(
      buildOutboxMessage({
        clock: this.clock,
        to: user.email,
        type: "password-reset",
        subject: "社群資料中台密碼重設",
        body: `請使用以下連結重設密碼：${resetUrl.toString()}`,
      }),
    );
  }

  async resetPassword({ token, password }) {
    const tokenRecord = await this.passwordResetTokenRepository.findByTokenHash(
      hashPasswordResetToken(token),
    );

    if (!tokenRecord || tokenRecord.usedAt) {
      throw new HttpError(400, "RESET_TOKEN_INVALID", "重設密碼連結無效或已使用。");
    }

    if (Date.parse(tokenRecord.expiresAt) <= this.clock().getTime()) {
      throw new HttpError(400, "RESET_TOKEN_EXPIRED", "重設密碼連結已過期。");
    }

    const user = await this.userRepository.findById(tokenRecord.userId);

    if (!user || user.status !== "active") {
      throw new HttpError(400, "RESET_TOKEN_INVALID", "重設密碼連結無效或已使用。");
    }

    const now = this.clock().toISOString();

    await this.userRepository.updateById(user.id, {
      passwordHash: await hashPassword(password),
      updatedAt: now,
    });
    await this.passwordResetTokenRepository.updateById(tokenRecord.id, {
      usedAt: now,
    });
    await this.sessionRepository.deleteByUserId(user.id);
  }
}
