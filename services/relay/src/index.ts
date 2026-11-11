import { type Env, HttpError, secure } from "./config";
import { route } from "./router";
import { purgeExpired } from "./lib/object-store";
export { RateLimiter } from "./durable-objects/RateLimiter";
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return secure(await route(request, env));
    } catch (e) {
      const known = e instanceof HttpError;
      return secure(
        Response.json(
          { error: known ? e.message : "Relay operation failed. Retry later." },
          {
            status: known ? e.status : 503,
            headers: known && e.status === 429 ? { "Retry-After": "3600" } : {},
          },
        ),
      );
    }
  },
  async scheduled(_event: ScheduledEvent, env: Env, context: ExecutionContext) {
    context.waitUntil(purgeExpired(env));
  },
};