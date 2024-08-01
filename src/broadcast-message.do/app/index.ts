import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

type Service = {
  createRoom(roomId: string, uid: string): Promise<WebSocket>;
};
export const createApp = (service: Service) => {
  const app = new Hono();

  return app.get('/rooms/:roomId', zValidator('query', z.object({ uid: z.string().min(1) })), async (c) => {
    const query = c.req.valid('query');
    const webSocket = await service.createRoom(c.req.param('roomId'), query.uid);

    return new Response(null, { status: 101, webSocket });
  });
};
