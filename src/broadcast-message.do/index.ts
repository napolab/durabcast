import { DurableObject } from 'cloudflare:workers';
import { createApp } from './app';

import type { Env } from 'hono';

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Record<string, unknown> ? DeepPartial<T[K]> : T[K];
};

export type BroadcastMessageOptions = DeepPartial<{
  autoClose: boolean;
  interval: number;
  timeout: number;
  requestResponsePair: {
    request: string;
    response: string;
  };
}>;

export type WebSocketAttachment = {
  roomId: string;
  uid: string;
  connectedAt: Date;
};
type BroadcastOptions = {
  uid?: string[];
  excludes?: WebSocket[];
};

export class BroadcastMessage<E extends Env = Env> extends DurableObject<E['Bindings']> {
  protected options: BroadcastMessageOptions = {
    autoClose: true,
    interval: 30 * 1000,
    timeout: 60 * 1000,
    requestResponsePair: {
      request: 'ping',
      response: 'pong',
    },
  };
  protected get AUTO_CLOSE() {
    return this.options.autoClose ?? true;
  }
  protected get INTERVAL() {
    return this.options.interval ?? 30 * 1000;
  }
  protected get TIMEOUT() {
    return this.options.timeout ?? 60 * 1000;
  }
  protected get REQUEST_RESPONSE_PAIR() {
    return new WebSocketRequestResponsePair(
      this.options.requestResponsePair?.request ?? 'ping',
      this.options.requestResponsePair?.response ?? 'pong',
    );
  }

  protected sessions = new Set<WebSocket>();
  private app = createApp({
    createRoom: this.createRoom.bind(this),
  });

  constructor(
    public ctx: DurableObjectState,
    public env: E['Bindings'],
  ) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(this.onStart.bind(this));
  }

  protected async onStart() {
    this.ctx.setWebSocketAutoResponse(this.REQUEST_RESPONSE_PAIR);
    for (const ws of this.ctx.getWebSockets()) {
      this.sessions.add(ws);
    }
  }

  protected async createRoom(roomId: string, uid: string) {
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    this.ctx.acceptWebSocket(server);
    this.sessions.add(server);
    server.serializeAttachment({
      roomId,
      uid,
      connectedAt: new Date(),
    } satisfies WebSocketAttachment);

    if (this.AUTO_CLOSE) {
      const alarm = await this.ctx.storage.getAlarm();
      if (alarm === null) {
        await this.ctx.storage.setAlarm(Date.now() + this.INTERVAL);
      }
    }

    return client;
  }

  broadcast(message: string | ArrayBuffer, options: BroadcastOptions = {}) {
    const { excludes = [], uid = [] } = options;

    for (const ws of this.ctx.getWebSockets()) {
      const state: WebSocketAttachment = ws.deserializeAttachment();
      if (excludes.includes(ws)) continue;
      if (uid.length > 0 && !uid.includes(state.uid)) continue;

      ws.send(message);
    }
  }

  isAliveSocket(ws: WebSocket) {
    const state: WebSocketAttachment = ws.deserializeAttachment();
    const pingAt = this.ctx.getWebSocketAutoResponseTimestamp(ws);
    const responseAt = pingAt ?? state.connectedAt;

    return Date.now() - responseAt.getTime() < this.TIMEOUT;
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    this.broadcast(message);
  }

  webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): void {
    this.sessions.delete(ws);
  }

  fetch(request: Request) {
    return this.app.request(request, undefined, this.env);
  }

  async alarm(): Promise<void> {
    if (this.AUTO_CLOSE) {
      for (const ws of this.sessions) {
        if (!this.isAliveSocket(ws)) {
          ws.close();
          this.sessions.delete(ws);
        }
      }

      const alarm = await this.ctx.storage.getAlarm();
      if (this.sessions.size > 0 && alarm === null) {
        await this.ctx.storage.setAlarm(Date.now() + this.INTERVAL);
      }
    }
  }
}

export type BroadcastMessageAppType = ReturnType<typeof createApp>;
