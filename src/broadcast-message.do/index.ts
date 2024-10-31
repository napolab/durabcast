import { DurableObject } from 'cloudflare:workers';
import { createApp } from './app';

import type { Env } from 'hono';
import type { BroadcastMessageOptions, BroadcastOptions, WebSocketAttachment } from './types';

const options = {
  autoClose: true,
  interval: 30 * 1000,
  timeout: 60 * 1000,
  requestResponsePair: {
    request: 'ping',
    response: 'pong',
  },
} satisfies BroadcastMessageOptions;

type BroadcastMessageAppType = ReturnType<typeof createApp>;
class BroadcastMessage<E extends Env = Env> extends DurableObject<E['Bindings']> {
  protected options: BroadcastMessageOptions = options;
  protected get AUTO_CLOSE() {
    return this.options.autoClose ?? options.autoClose;
  }
  protected get INTERVAL() {
    return this.options.interval ?? options.interval;
  }
  protected get TIMEOUT() {
    return this.options.timeout ?? options.timeout;
  }
  protected get REQUEST_RESPONSE_PAIR() {
    return new WebSocketRequestResponsePair(
      this.options.requestResponsePair?.request ?? options.requestResponsePair.request,
      this.options.requestResponsePair?.response ?? options.requestResponsePair.response,
    );
  }

  protected sessions = new Set<WebSocket>();
  private app = createApp({
    createRoom: this.createRoom.bind(this),
  });

  constructor(
    public state: DurableObjectState,
    public env: E['Bindings'],
  ) {
    super(state, env);
    state.blockConcurrencyWhile(this.onStart.bind(this));
  }

  protected async onStart(): Promise<void> {
    this.state.setWebSocketAutoResponse(this.REQUEST_RESPONSE_PAIR);
    for (const ws of this.state.getWebSockets()) {
      this.sessions.add(ws);
    }
  }

  protected async createRoom(roomId: string, uid: string): Promise<WebSocket> {
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    this.state.acceptWebSocket(server);
    this.sessions.add(server);
    server.serializeAttachment({
      roomId,
      uid,
      connectedAt: new Date(),
    } satisfies WebSocketAttachment);

    if (this.AUTO_CLOSE) {
      const alarm = await this.state.storage.getAlarm();
      if (alarm === null) {
        await this.state.storage.setAlarm(Date.now() + this.INTERVAL);
      }
    }

    return client;
  }

  broadcast(message: string | ArrayBuffer, options: BroadcastOptions = {}): void {
    const { excludes = [], uid = [] } = options;

    for (const ws of this.state.getWebSockets()) {
      const state: WebSocketAttachment = ws.deserializeAttachment();
      if (excludes.includes(ws)) continue;
      if (uid.length > 0 && !uid.includes(state.uid)) continue;

      ws.send(message);
    }
  }

  isAliveSocket(ws: WebSocket): boolean {
    const state: WebSocketAttachment = ws.deserializeAttachment();
    const pingAt = this.state.getWebSocketAutoResponseTimestamp(ws);
    const responseAt = pingAt ?? state.connectedAt;

    return Date.now() - responseAt.getTime() < this.TIMEOUT;
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    this.broadcast(message);
  }

  webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): void {
    this.sessions.delete(ws);
  }

  fetch(request: Request): Response | Promise<Response> {
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

      const alarm = await this.state.storage.getAlarm();
      if (this.sessions.size > 0 && alarm === null) {
        await this.state.storage.setAlarm(Date.now() + this.INTERVAL);
      }
    }
  }
}

export {
  BroadcastMessage,
  type BroadcastMessageOptions,
  type WebSocketAttachment,
  type BroadcastOptions,
  type BroadcastMessageAppType,
};
