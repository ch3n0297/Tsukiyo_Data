import crypto from "node:crypto";
import { HttpError } from "../lib/errors.ts";
import { hashPassword, hashPasswordResetToken } from "./user-auth-service.ts";
import { normalizeEmailAddress } from "./user-auth-validation-service.ts";
import type { UserRepository } from "../repositories/user-repository.ts";
import type { SessionRepository } from "../repositories/session-repository.ts";
import type { PasswordResetTokenRepository } from "../repositories/password-reset-token-repository.ts";
import type { OutboxMessageRepository } from "../repositories/outbox-message-repository.ts";
import type { AppConfig } from "../types/app.ts";
import type { OutboxMessage } from "../types/outbox.ts";

function createRawToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

interface OutboxParams {
  clock: () => Date;
  to: string;
  type: string;
  subject: string;
  body: string;
}

function buildOutboxMessage({ clock, to, type, subject, body }: OutboxParams): OutboxMessage {
  return {
    id: crypto.randomUUID(),
    type: type as OutboxMessage["type"],
    to,
    subject,
    body,
    createdAt: clock().toISOString(),
  };
}

interface PasswordResetServiceOptions {
  userRepository: UserRepository;
  sessionRepository: SessionRepository;
  passwordResetTokenRepository: PasswordResetTokenRepository;
  outboxMessageRepository: OutboxMessageRepository;
  clock: () => Date;
  config: AppConfig;
}

export class PasswordResetService {
  readonly userRepository: UserRepository;
  readonly sessionRepository: SessionRepository;
  readonly passwordResetTokenRepository: PasswordResetTokenRepository;
  readonly outboxMessageRepository: OutboxMessageRepository;
  readonly clock: () => Date;
  readonly config: AppConfig;

  constructor({
    userRepository,
    sessionRepository,
    passwordResetTokenRepository,
    outboxMessageRepository,
    clock,
    config,
  }: PasswordResetServiceOptions) {
    this.userRepository = userRepository;
    this.sessionRepository = sessionRepository;
    this.passwordResetTokenRepository = passwordResetTokenRepository;
    this.outboxMessageRepository = outboxMessageRepository;
    this.clock = clock;
    this.config = config;
  }

  async requestReset({ email, origin }: { email: string; origin: string | undefined }): Promise<void> {
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

  async resetPassword({ token, password }: { token: string; password: string }): Promise<void> {
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
