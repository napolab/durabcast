import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { hc } from 'hono/client';
import { z } from 'zod';
import { upgrade } from './middleware/upgrade';

import type { BroadcastMessage, BroadcastMessageAppType } from './broadcast-message.do';

type Env = {
  Bindings: {
    BROADCAST_MESSAGE: DurableObjectNamespace<BroadcastMessage>;
  };
};

const app = new Hono<Env>();

const route = app
  .get('/', upgrade(), async (c) => {
    const roomId = 'default';
    const id = c.env.BROADCAST_MESSAGE.idFromName(roomId);
    const stub = c.env.BROADCAST_MESSAGE.get(id);

    const client = hc<BroadcastMessageAppType>(c.req.url, {
      fetch: stub.fetch.bind(stub),
    });

    const res = await client.rooms[':roomId'].$get(
      {
        query: { uid: '123' },
        param: { roomId },
      },
      { init: { headers: c.req.raw.headers } },
    );

    return new Response(null, {
      webSocket: res.webSocket,
      status: res.status,
      headers: res.headers,
      statusText: res.statusText,
    });
  })
  .post('/broadcast', zValidator('json', z.object({ message: z.string() })), async (c) => {
    const roomId = 'default';
    const id = c.env.BROADCAST_MESSAGE.idFromName(roomId);
    const stub = c.env.BROADCAST_MESSAGE.get(id);

    await stub.broadcast(c.req.valid('json').message);
    return c.json(null, 200);
  });

export type AppType = typeof route;
export default app;
export * from './broadcast-message.do';
