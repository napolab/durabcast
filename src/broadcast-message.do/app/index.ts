import { zValidator } from '@hono/zod-validator';
import { createFactory } from 'hono/factory';
import { z } from 'zod';

type Service = {
  createRoom(roomId: string, uid: string): Promise<WebSocket>;
};
export const createApp = (service: Service) => {
  const factory = createFactory<{ Variables: Service }>({
    initApp(app) {
      app.use((c, next) => {
        for (const _key in service) {
          const key = _key as keyof Service;
          c.set(key, service[key]);
        }
        return next();
      });
    },
  });

  const app = factory.createApp();
  return app.get('/rooms/:roomId', zValidator('query', z.object({ uid: z.string().min(1) })), async (c) => {
    const query = c.req.valid('query');
    const webSocket = await c.var.createRoom(c.req.param('roomId'), query.uid);

    return new Response(null, { status: 101, webSocket });
  });
};
