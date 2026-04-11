import crypto from "node:crypto";
import { HttpError } from "../lib/errors.js";
import { encryptSecret, decryptSecret } from "../lib/secret-box.js";
import { makeAccountKey } from "../repositories/account-config-repository.js";

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";

function readTrimmedString(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function generateCodeVerifier() {
  return crypto.randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier) {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

export class GoogleOauthService {
  constructor({
    accountRepository,
    auditLogRepository,
    config,
    googleConnectionRepository,
    logger,
    oauthStateRepository,
    clock = () => new Date(),
    fetchImpl = globalThis.fetch,
  }) {
    this.accountRepository = accountRepository;
    this.auditLogRepository = auditLogRepository;
    this.config = config;
    this.googleConnectionRepository = googleConnectionRepository;
    this.logger = logger;
    this.oauthStateRepository = oauthStateRepository;
    this.clock = clock;
    this.fetchImpl = fetchImpl;
  }

  // ---------------------------------------------------------------------------
  // Google Login flow
  // ---------------------------------------------------------------------------

  async createLoginAuthorizationUrl({ redirectTo = "/" }) {
    if (!this.config.googleLoginEnabled) {
      throw new HttpError(503, "GOOGLE_LOGIN_DISABLED", "Google 登入功能尚未啟用。");
    }

    const state = await this.#createOauthState({
      purpose: "login",
      metadata: { redirectTo },
    });

    const url = this.#buildGoogleOAuth2Url({
      scopes: this.config.googleLoginScopes,
      redirectUri: this.config.googleLoginRedirectUri,
      state: state.id,
      codeChallenge: state.codeChallenge,
    });

    return url;
  }

  async completeLoginAuthorization({ code, error, errorDescription, state: stateId }) {
    const state = await this.#consumeOauthState(stateId, "login");

    if (error) {
      throw new HttpError(
        400,
        "GOOGLE_AUTH_DENIED",
        errorDescription || "使用者拒絕 Google 授權或授權發生錯誤。",
      );
    }

    if (!readTrimmedString(code)) {
      throw new HttpError(400, "GOOGLE_AUTH_CODE_MISSING", "缺少 Google 授權碼。");
    }

    const tokens = await this.#exchangeCodeForTokens({
      code,
      redirectUri: this.config.googleLoginRedirectUri,
      codeVerifier: state.codeVerifier,
    });

    const userInfo = await this.#fetchUserInfo(tokens.access_token);

    if (!userInfo.sub || !userInfo.email) {
      throw new HttpError(502, "GOOGLE_USERINFO_INCOMPLETE", "無法取得完整的 Google 使用者資訊。");
    }

    return {
      displayName: userInfo.name ?? userInfo.email,
      email: userInfo.email,
      googleSub: userInfo.sub,
      redirectTo: state.metadata?.redirectTo ?? "/",
    };
  }

  // ---------------------------------------------------------------------------
  // Google Sheets integration flow
  // ---------------------------------------------------------------------------

  async createAuthorizationUrl({ accountConfigId, actorUser, redirectTo = "/" }) {
    if (!this.config.googleSheetsOauthEnabled) {
      throw new HttpError(503, "GOOGLE_SHEETS_OAUTH_DISABLED", "Google Sheets OAuth 功能尚未啟用。");
    }

    const trimmedId = readTrimmedString(accountConfigId);
    if (!trimmedId) {
      throw new HttpError(400, "ACCOUNT_CONFIG_ID_REQUIRED", "缺少帳號設定 ID。");
    }

    const account = await this.accountRepository.findById(trimmedId);
    if (!account) {
      throw new HttpError(404, "ACCOUNT_NOT_FOUND", "找不到指定的帳號設定。");
    }

    const state = await this.#createOauthState({
      purpose: "sheets",
      metadata: { accountConfigId: trimmedId, redirectTo, actorUserId: actorUser.id },
    });

    const url = this.#buildGoogleOAuth2Url({
      scopes: this.config.googleSheetsOauthScopes,
      redirectUri: this.config.googleSheetsRedirectUri,
      state: state.id,
      codeChallenge: state.codeChallenge,
      accessType: "offline",
      prompt: "consent",
    });

    await this.auditLogRepository.append({
      id: crypto.randomUUID(),
      eventType: "google.sheets.authorization_started",
      actorUserId: actorUser.id,
      accountConfigId: trimmedId,
      createdAt: this.clock().toISOString(),
    });

    return url;
  }

  async completeAuthorization({ actorUser, code, error, errorDescription, state: stateId }) {
    const state = await this.#consumeOauthState(stateId, "sheets");
    const { accountConfigId, redirectTo } = state.metadata ?? {};

    if (error) {
      throw new HttpError(
        400,
        "GOOGLE_AUTH_DENIED",
        errorDescription || "使用者拒絕 Google Sheets 授權或授權發生錯誤。",
      );
    }

    if (!readTrimmedString(code)) {
      throw new HttpError(400, "GOOGLE_AUTH_CODE_MISSING", "缺少 Google 授權碼。");
    }

    const tokens = await this.#exchangeCodeForTokens({
      code,
      redirectUri: this.config.googleSheetsRedirectUri,
      codeVerifier: state.codeVerifier,
    });

    const userInfo = await this.#fetchUserInfo(tokens.access_token);
    const now = this.clock().toISOString();
    const encryptionKey = this.config.googleTokenEncryptionKey;

    const connectionRecord = {
      id: crypto.randomUUID(),
      accountConfigId,
      authorizedEmail: userInfo.email,
      authorizedBy: actorUser.id,
      accessTokenEncrypted: encryptSecret(tokens.access_token, encryptionKey),
      refreshTokenEncrypted: tokens.refresh_token
        ? encryptSecret(tokens.refresh_token, encryptionKey)
        : null,
      expiresAt: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        : null,
      tokenRefreshedAt: now,
      createdAt: now,
      updatedAt: now,
      lastError: null,
    };

    const saved = await this.googleConnectionRepository.upsertByAccountConfigId(
      accountConfigId,
      connectionRecord,
    );

    const account = await this.accountRepository.findById(accountConfigId);
    if (account && !account.googleConnectionId) {
      const accountKey = makeAccountKey(account.platform, account.accountId);
      await this.accountRepository.updateByAccountKey(accountKey, {
        googleConnectionId: saved.id,
      });
    }

    await this.auditLogRepository.append({
      id: crypto.randomUUID(),
      eventType: "google.sheets.authorization_completed",
      actorUserId: actorUser.id,
      accountConfigId,
      authorizedEmail: userInfo.email,
      createdAt: now,
    });

    return { accountConfigId, redirectTo };
  }

  buildCallbackRedirectUrl({ accountConfigId, redirectTo, status, systemMessage }) {
    const origin =
      this.config.publicAppOrigin ?? this.config.frontendOrigins?.[0] ?? "http://127.0.0.1:5173";
    const url = new URL(redirectTo || "/", origin);
    url.searchParams.set("integration", "google");
    url.searchParams.set("integration_status", status);
    url.searchParams.set("integration_message", systemMessage);

    if (accountConfigId) {
      url.searchParams.set("account_config_id", accountConfigId);
    }

    return url.toString();
  }

  async getConnectionSummary({ accountConfigId, actorUser }) {
    const trimmedId = readTrimmedString(accountConfigId);
    if (!trimmedId) {
      throw new HttpError(400, "ACCOUNT_CONFIG_ID_REQUIRED", "缺少帳號設定 ID。");
    }

    const connection = await this.googleConnectionRepository.findByAccountConfigId(trimmedId);

    if (!connection) {
      return {
        connection: null,
        accountConfigId: trimmedId,
        oauthEnabled: this.config.googleSheetsOauthEnabled,
      };
    }

    return {
      connection: {
        status: "active",
        authorizedEmail: connection.authorizedEmail,
        createdAt: connection.createdAt,
        tokenRefreshedAt: connection.tokenRefreshedAt,
        lastError: connection.lastError,
      },
      accountConfigId: trimmedId,
      oauthEnabled: this.config.googleSheetsOauthEnabled,
    };
  }

  async disconnectConnection({ accountConfigId, actorUser }) {
    const trimmedId = readTrimmedString(accountConfigId);
    if (!trimmedId) {
      throw new HttpError(400, "ACCOUNT_CONFIG_ID_REQUIRED", "缺少帳號設定 ID。");
    }

    const connection = await this.googleConnectionRepository.findByAccountConfigId(trimmedId);

    if (!connection) {
      throw new HttpError(404, "CONNECTION_NOT_FOUND", "找不到 Google 連線記錄。");
    }

    if (connection.refreshTokenEncrypted) {
      try {
        const refreshToken = decryptSecret(
          connection.refreshTokenEncrypted,
          this.config.googleTokenEncryptionKey,
        );
        await this.#revokeToken(refreshToken);
      } catch (revokeError) {
        this.logger.warn("Failed to revoke Google refresh token during disconnect", {
          accountConfigId: trimmedId,
          error: revokeError,
        });
      }
    }

    await this.googleConnectionRepository.updateById(connection.id, {
      status: "revoked",
      refreshTokenEncrypted: null,
      accessTokenEncrypted: null,
      updatedAt: this.clock().toISOString(),
    });

    const account = await this.accountRepository.findById(trimmedId);
    if (account?.googleConnectionId === connection.id) {
      const accountKey = makeAccountKey(account.platform, account.accountId);
      await this.accountRepository.updateByAccountKey(accountKey, { googleConnectionId: null });
    }

    await this.auditLogRepository.append({
      id: crypto.randomUUID(),
      eventType: "google.sheets.disconnected",
      actorUserId: actorUser.id,
      accountConfigId: trimmedId,
      createdAt: this.clock().toISOString(),
    });
  }

  async getAuthorizedAccountContext(accountConfig) {
    const connection = await this.googleConnectionRepository.findByAccountConfigId(accountConfig.id);

    if (!connection) {
      throw new HttpError(404, "CONNECTION_NOT_FOUND", "此帳號尚未連結 Google Sheets。");
    }

    const encryptionKey = this.config.googleTokenEncryptionKey;
    let accessToken;

    try {
      accessToken = decryptSecret(connection.accessTokenEncrypted, encryptionKey);
    } catch {
      throw new HttpError(500, "TOKEN_DECRYPT_FAILED", "無法解密 Google access token。");
    }

    const isExpired =
      connection.expiresAt && new Date(connection.expiresAt) <= this.clock();

    if (isExpired && connection.refreshTokenEncrypted) {
      const refreshed = await this.#refreshAccessToken(connection);
      accessToken = refreshed.accessToken;
    }

    return {
      accessToken,
      connection,
      spreadsheetId: accountConfig.spreadsheetId,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  #buildGoogleOAuth2Url({
    scopes,
    redirectUri,
    state,
    codeChallenge,
    accessType,
    prompt,
  }) {
    const url = new URL(GOOGLE_AUTH_ENDPOINT);
    url.searchParams.set("client_id", this.config.googleClientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", scopes.join(" "));
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");

    if (accessType) {
      url.searchParams.set("access_type", accessType);
    }

    if (prompt) {
      url.searchParams.set("prompt", prompt);
    }

    return url.toString();
  }

  async #exchangeCodeForTokens({ code, redirectUri, codeVerifier }) {
    const body = new URLSearchParams({
      client_id: this.config.googleClientId,
      client_secret: this.config.googleClientSecret,
      code,
      code_verifier: codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    });

    const response = await this.fetchImpl(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      this.logger.error("Google token exchange failed", {
        status: response.status,
        body: errorBody,
      });
      throw new HttpError(502, "GOOGLE_TOKEN_EXCHANGE_FAILED", "Google 授權碼交換失敗。");
    }

    return response.json();
  }

  async #fetchUserInfo(accessToken) {
    const response = await this.fetchImpl(GOOGLE_USERINFO_ENDPOINT, {
      headers: { authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new HttpError(502, "GOOGLE_USERINFO_FAILED", "無法取得 Google 使用者資訊。");
    }

    return response.json();
  }

  async #revokeToken(token) {
    const response = await this.fetchImpl(GOOGLE_REVOKE_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }).toString(),
    });

    if (!response.ok) {
      this.logger.warn("Google token revocation returned non-OK", { status: response.status });
    }
  }

  async #refreshAccessToken(connection) {
    const encryptionKey = this.config.googleTokenEncryptionKey;
    let refreshToken;

    try {
      refreshToken = decryptSecret(connection.refreshTokenEncrypted, encryptionKey);
    } catch {
      throw new HttpError(500, "TOKEN_DECRYPT_FAILED", "無法解密 Google refresh token。");
    }

    const body = new URLSearchParams({
      client_id: this.config.googleClientId,
      client_secret: this.config.googleClientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });

    const response = await this.fetchImpl(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      this.logger.error("Google token refresh failed", {
        connectionId: connection.id,
        status: response.status,
        body: errorBody,
      });

      await this.googleConnectionRepository.updateById(connection.id, {
        lastError: `token_refresh_failed (HTTP ${response.status})`,
        updatedAt: this.clock().toISOString(),
      });

      throw new HttpError(502, "GOOGLE_TOKEN_REFRESH_FAILED", "Google access token 更新失敗。");
    }

    const tokens = await response.json();
    const now = this.clock().toISOString();

    await this.googleConnectionRepository.updateById(connection.id, {
      accessTokenEncrypted: encryptSecret(tokens.access_token, encryptionKey),
      expiresAt: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        : null,
      tokenRefreshedAt: now,
      lastError: null,
      updatedAt: now,
    });

    return { accessToken: tokens.access_token };
  }

  async #createOauthState({ purpose, metadata }) {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const now = this.clock();

    const stateRecord = {
      id: crypto.randomUUID(),
      purpose,
      codeVerifier,
      codeChallenge,
      metadata,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.config.googleStateTtlMs).toISOString(),
    };

    await this.oauthStateRepository.create(stateRecord);
    return stateRecord;
  }

  async #consumeOauthState(stateId, expectedPurpose) {
    if (!readTrimmedString(stateId)) {
      throw new HttpError(400, "OAUTH_STATE_MISSING", "缺少 OAuth state 參數。");
    }

    const stateRecord = await this.oauthStateRepository.findById(stateId);

    if (!stateRecord) {
      throw new HttpError(400, "OAUTH_STATE_INVALID", "OAuth state 無效或已過期。");
    }

    await this.oauthStateRepository.deleteById(stateId);

    if (stateRecord.expiresAt && new Date(stateRecord.expiresAt) <= this.clock()) {
      throw new HttpError(400, "OAUTH_STATE_EXPIRED", "OAuth state 已過期，請重新操作。");
    }

    if (stateRecord.purpose !== expectedPurpose) {
      throw new HttpError(400, "OAUTH_STATE_PURPOSE_MISMATCH", "OAuth state 用途不符。");
    }

    return stateRecord;
  }
}
