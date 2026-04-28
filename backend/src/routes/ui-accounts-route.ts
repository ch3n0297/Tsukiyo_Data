import { toErrorResponse } from "../lib/errors.ts";
import { sendJson } from "../lib/http.ts";
import { createSupabaseClient } from "../lib/supabase-client.ts";
import { SupabaseAccountConfigRepository } from "../repositories/supabase/account-config-repository.ts";
import { SupabaseSheetSnapshotRepository } from "../repositories/supabase/sheet-snapshot-repository.ts";
import { UiDashboardService } from "../services/ui-dashboard-service.ts";
import { refreshLegacySessionCookie, requireRouteUser } from "./route-auth.ts";
import type { PublicUser } from "../types/user.ts";
import type { RouteContext, RouteContextWithParams } from "../types/route.ts";

function createRequestUiDashboardService({ services, config }: RouteContext, user: PublicUser) {
  if (!config.useSupabaseStorage) {
    return services.uiDashboardService;
  }

  const supabaseClient = createSupabaseClient(config.supabaseUrl, config.supabaseServiceRoleKey);
  return new UiDashboardService({
    accountRepository: new SupabaseAccountConfigRepository(supabaseClient, user.id),
    sheetSnapshotRepository: new SupabaseSheetSnapshotRepository(supabaseClient, user.id),
    clock: config.clock,
  });
}

export async function handleUiAccountsRoute(routeContext: RouteContext): Promise<void> {
  const { req, res, services } = routeContext;
  try {
    const context = await requireRouteUser(req, services);
    refreshLegacySessionCookie(res, services, context);
    const uiDashboardService = createRequestUiDashboardService(routeContext, context.user);
    const payload = await uiDashboardService.listAccounts();
    sendJson(res, 200, payload);
  } catch (error) {
    const response = toErrorResponse(error);
    sendJson(res, response.statusCode, response.body);
  }
}

export async function handleUiAccountDetailRoute(routeContext: RouteContextWithParams): Promise<void> {
  const { req, res, services, params } = routeContext;
  try {
    const context = await requireRouteUser(req, services);
    refreshLegacySessionCookie(res, services, context);
    const uiDashboardService = createRequestUiDashboardService(routeContext, context.user);
    const payload = await uiDashboardService.getAccountDetail({
      platform: params.platform,
      accountId: params.accountId,
    });
    sendJson(res, 200, payload);
  } catch (error) {
    const response = toErrorResponse(error);
    sendJson(res, response.statusCode, response.body);
  }
}
