import crypto from "node:crypto";
import { HttpError } from "../lib/errors.js";
import { sanitizeUser } from "./user-auth-service.js";

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

export class UserApprovalService {
  constructor({
    userRepository,
    outboxMessageRepository,
    clock,
  }) {
    this.userRepository = userRepository;
    this.outboxMessageRepository = outboxMessageRepository;
    this.clock = clock;
  }

  async listPendingUsers() {
    const users = await this.userRepository.listByStatus("pending");
    return users.map((user) => sanitizeUser(user));
  }

  async approveUser({ targetUserId, adminUser }) {
    const user = await this.userRepository.findById(targetUserId);

    if (!user) {
      throw new HttpError(404, "USER_NOT_FOUND", "找不到指定的使用者。");
    }

    if (user.status !== "pending") {
      throw new HttpError(409, "USER_STATUS_INVALID", "只有待審核帳號可以被核准。");
    }

    const now = this.clock().toISOString();
    const updatedUser = await this.userRepository.updateById(targetUserId, {
      status: "active",
      approvedAt: now,
      approvedBy: adminUser.id,
      rejectedAt: null,
      rejectedBy: null,
      updatedAt: now,
    });

    await this.outboxMessageRepository.create(
      buildOutboxMessage({
        clock: this.clock,
        to: user.email,
        type: "user-approved",
        subject: "社群資料中台帳號已核准",
        body: "你的帳號已由管理員核准，現在可以登入社群資料中台。",
      }),
    );

    return sanitizeUser(updatedUser);
  }

  async rejectUser({ targetUserId, adminUser }) {
    const user = await this.userRepository.findById(targetUserId);

    if (!user) {
      throw new HttpError(404, "USER_NOT_FOUND", "找不到指定的使用者。");
    }

    if (user.status !== "pending") {
      throw new HttpError(409, "USER_STATUS_INVALID", "只有待審核帳號可以被拒絕。");
    }

    const now = this.clock().toISOString();
    const updatedUser = await this.userRepository.updateById(targetUserId, {
      status: "rejected",
      rejectedAt: now,
      rejectedBy: adminUser.id,
      updatedAt: now,
    });

    await this.outboxMessageRepository.create(
      buildOutboxMessage({
        clock: this.clock,
        to: user.email,
        type: "user-rejected",
        subject: "社群資料中台註冊申請未通過",
        body: "你的註冊申請目前未通過，若需要存取權限請聯絡管理員。",
      }),
    );

    return sanitizeUser(updatedUser);
  }
}
