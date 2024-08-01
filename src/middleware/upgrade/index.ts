import type { Env } from 'hono';
import { createMiddleware } from 'hono/factory';

export const upgrade = <E extends Env, P extends string>() => {
  return createMiddleware<E, P, { outputFormat: 'ws' }>(async (c, next) => {
    if (c.req.header('Upgrade') !== 'websocket') {
      return c.text('Expected websocket', {
        status: 426,
        statusText: 'Upgrade Required',
      });
    }

    return next();
  });
};
