import crypto from "node:crypto";
import { HttpError } from "../lib/errors.js";
import { normalizeEmailAddress } from "./user-auth-validation-service.js";

function requireObject(payload, message) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new HttpError(400, "VALIDATION_ERROR", message);
  }

  return payload;
}

function requireTenantKey(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, "VALIDATION_ERROR", `欄位 ${fieldName} 為必填。`);
  }

  return value.trim();
}

function sortTenantKeys(left, right) {
  return left.localeCompare(right);
}

function sortRules(left, right) {
  return left.email.localeCompare(right.email) || left.tenantKey.localeCompare(right.tenantKey);
}

export class GoogleLoginSettingsService {
  constructor({ accountRepository, clock = () => new Date(), googleLoginSettingsRepository }) {
    this.accountRepository = accountRepository;
    this.clock = clock;
    this.googleLoginSettingsRepository = googleLoginSettingsRepository;
  }

  async getSettingsSnapshot() {
    const [settings, tenantOptions] = await Promise.all([
      this.googleLoginSettingsRepository.getSettings(),
      this.#listTenantOptions(),
    ]);

    return {
      settings: {
        defaultTenantKey: settings.defaultTenantKey,
        rules: [...settings.rules].sort(sortRules),
      },
      tenantOptions,
    };
  }

  async updateSettings(payload) {
    const body = requireObject(payload, "請求內容必須是 JSON 物件。");
    const tenantOptions = await this.#listTenantOptions();
    const tenantOptionSet = new Set(tenantOptions);
    const defaultTenantKey = requireTenantKey(body.defaultTenantKey, "defaultTenantKey");

    if (!tenantOptionSet.has(defaultTenantKey)) {
      throw new HttpError(400, "VALIDATION_ERROR", "defaultTenantKey 必須對應既有 tenant。");
    }

    const rawRules = Array.isArray(body.rules) ? body.rules : [];
    const seenEmails = new Set();
    const rules = rawRules.map((rule, index) => {
      const item = requireObject(rule, `rules[${index}] 必須是物件。`);
      const email = normalizeEmailAddress(item.email);
      const tenantKey = requireTenantKey(item.tenantKey, `rules[${index}].tenantKey`);

      if (!tenantOptionSet.has(tenantKey)) {
        throw new HttpError(400, "VALIDATION_ERROR", `rules[${index}].tenantKey 必須對應既有 tenant。`);
      }

      if (seenEmails.has(email)) {
        throw new HttpError(409, "GOOGLE_LOGIN_RULE_DUPLICATE", "Google 登入 email 規則不可重複。");
      }

      seenEmails.add(email);

      return {
        id: typeof item.id === "string" && item.id.trim() !== "" ? item.id.trim() : crypto.randomUUID(),
        email,
        tenantKey,
      };
    });

    const saved = await this.googleLoginSettingsRepository.saveSettings({
      defaultTenantKey,
      id: "google-login-settings",
      rules: rules.sort(sortRules),
      updatedAt: this.clock().toISOString(),
    });

    return {
      settings: {
        defaultTenantKey: saved.defaultTenantKey,
        rules: saved.rules,
      },
      tenantOptions,
    };
  }

  async resolveTenantKeyForEmail(email) {
    const normalizedEmail = normalizeEmailAddress(email);
    const { settings, tenantOptions } = await this.getSettingsSnapshot();
    const tenantOptionSet = new Set(tenantOptions);
    const matchedRule = settings.rules.find((rule) => rule.email === normalizedEmail);
    const tenantKey = matchedRule?.tenantKey ?? settings.defaultTenantKey;

    if (!tenantKey) {
      throw new HttpError(
        409,
        "GOOGLE_LOGIN_SETTINGS_REQUIRED",
        "尚未完成 Google 登入租戶設定，請先由管理員設定預設 tenant。",
      );
    }

    if (!tenantOptionSet.has(tenantKey)) {
      throw new HttpError(
        409,
        "GOOGLE_LOGIN_TENANT_UNAVAILABLE",
        "Google 登入對應的 tenant 已不存在，請聯絡管理員更新設定。",
      );
    }

    return tenantKey;
  }

  async #listTenantOptions() {
    const accounts = await this.accountRepository.listAll();
    return [...new Set(
      accounts
        .map((account) => (typeof account.tenantKey === "string" ? account.tenantKey.trim() : ""))
        .filter(Boolean),
    )].sort(sortTenantKeys);
  }
}
