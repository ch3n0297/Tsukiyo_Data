import type { FastifyRequest, FastifyReply } from 'fastify';
import type { AppConfig } from './app.ts';
import type { Services } from './app.ts';

export interface RouteContext {
  req: FastifyRequest;
  res: FastifyReply;
  services: Services;
  config: AppConfig;
}

export interface RouteContextWithParams extends RouteContext {
  params: Record<string, string>;
}

export type RouteHandler = (context: RouteContext) => Promise<void>;
export type RouteHandlerWithParams = (context: RouteContextWithParams) => Promise<void>;
