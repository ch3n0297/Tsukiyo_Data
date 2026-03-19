import { toErrorResponse } from "../lib/errors.js";
import { getRequestOrigin, readJsonRequest, sendJson, setResponseCookie } from "../lib/http.js";
import {
  validateForgotPasswordPayload,
  validateLoginPayload,
  validateRegisterPayload,
  validateResetPasswordPayload,
} from "../services/user-auth-validation-service.js";

export async function handleRegisterRoute({ req, res, services, config }) {
  try {
    const { body } = await readJsonRequest(req, {
      maxBodyBytes: config.maxRequestBodyBytes,
    });
    const payload = validateRegisterPayload(body);
    const user = await services.userAuthService.register(payload);

    sendJson(res, 201, {
      status: "pending",
      system_message: "註冊申請已送出，待管理員核准後即可登入。",
      user,
    });
  } catch (error) {
    const response = toErrorResponse(error);
    sendJson(res, response.statusCode, response.body);
  }
}

export async function handleLoginRoute({ req, res, services, config }) {
  try {
    const { body } = await readJsonRequest(req, {
      maxBodyBytes: config.maxRequestBodyBytes,
    });
    const payload = validateLoginPayload(body);
    const { session, user } = await services.userAuthService.login(payload);

    setResponseCookie(res, services.userAuthService.createSessionCookie(session.id));
    sendJson(res, 200, {
      system_message: "登入成功。",
      user,
    });
  } catch (error) {
    const response = toErrorResponse(error);
    sendJson(res, response.statusCode, response.body);
  }
}

export async function handleLogoutRoute({ req, res, services }) {
  try {
    await services.userAuthService.logoutByRequest(req);
    setResponseCookie(res, services.userAuthService.createClearedSessionCookie());
    sendJson(res, 200, {
      system_message: "已成功登出。",
    });
  } catch (error) {
    const response = toErrorResponse(error);
    sendJson(res, response.statusCode, response.body);
  }
}

export async function handleCurrentUserRoute({ req, res, services }) {
  try {
    const context = await services.userAuthService.requireAuthenticatedUser(req);
    setResponseCookie(res, services.userAuthService.createSessionCookie(context.session.id));
    sendJson(res, 200, {
      user: context.user,
    });
  } catch (error) {
    const response = toErrorResponse(error);
    sendJson(res, response.statusCode, response.body);
  }
}

export async function handleForgotPasswordRoute({ req, res, services, config }) {
  try {
    const { body } = await readJsonRequest(req, {
      maxBodyBytes: config.maxRequestBodyBytes,
    });
    const payload = validateForgotPasswordPayload(body);

    await services.passwordResetService.requestReset({
      email: payload.email,
      origin: getRequestOrigin(req, config.publicAppOrigin ?? "http://127.0.0.1:3000"),
    });

    sendJson(res, 200, {
      system_message: "若帳號存在且可重設，系統已送出重設指示。",
    });
  } catch (error) {
    const response = toErrorResponse(error);
    sendJson(res, response.statusCode, response.body);
  }
}

export async function handleResetPasswordRoute({ req, res, services, config }) {
  try {
    const { body } = await readJsonRequest(req, {
      maxBodyBytes: config.maxRequestBodyBytes,
    });
    const payload = validateResetPasswordPayload(body);

    await services.passwordResetService.resetPassword(payload);
    sendJson(res, 200, {
      system_message: "密碼已重設完成，請使用新密碼重新登入。",
    });
  } catch (error) {
    const response = toErrorResponse(error);
    sendJson(res, response.statusCode, response.body);
  }
}

export async function handlePendingUsersRoute({ req, res, services }) {
  try {
    const context = await services.userAuthService.requireAdminUser(req);
    setResponseCookie(res, services.userAuthService.createSessionCookie(context.session.id));
    const users = await services.userApprovalService.listPendingUsers();
    sendJson(res, 200, {
      users,
    });
  } catch (error) {
    const response = toErrorResponse(error);
    sendJson(res, response.statusCode, response.body);
  }
}

export async function handleApproveUserRoute({ req, res, services, params }) {
  try {
    const context = await services.userAuthService.requireAdminUser(req);
    setResponseCookie(res, services.userAuthService.createSessionCookie(context.session.id));
    const user = await services.userApprovalService.approveUser({
      targetUserId: params.userId,
      adminUser: context.user,
    });

    sendJson(res, 200, {
      system_message: "已核准該使用者。",
      user,
    });
  } catch (error) {
    const response = toErrorResponse(error);
    sendJson(res, response.statusCode, response.body);
  }
}

export async function handleRejectUserRoute({ req, res, services, params }) {
  try {
    const context = await services.userAuthService.requireAdminUser(req);
    setResponseCookie(res, services.userAuthService.createSessionCookie(context.session.id));
    const user = await services.userApprovalService.rejectUser({
      targetUserId: params.userId,
      adminUser: context.user,
    });

    sendJson(res, 200, {
      system_message: "已拒絕該使用者的註冊申請。",
      user,
    });
  } catch (error) {
    const response = toErrorResponse(error);
    sendJson(res, response.statusCode, response.body);
  }
}
