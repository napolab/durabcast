import { DurableObject } from 'cloudflare:workers';
import { createApp } from './app';

import type { Env } from 'hono';

type BroadcastMessageOptions = {
  tag?: string;
  excludes?: WebSocket[];
};
type WebSocketAttachment = {
  roomId: string;
  uid: string;
  connectedAt: Date;
};

export class BroadcastMessage<E extends Env = Env> extends DurableObject<E['Bindings']> {
  static INTERVAL = 30 * 1000;
  static TIMEOUT = 60 * 1000;

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

  private async onStart() {
    this.state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    await this.state.storage.setAlarm(Date.now() + BroadcastMessage.INTERVAL);

    for (const ws of this.state.getWebSockets()) {
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

    return client;
  }

  broadcast(message: string | ArrayBuffer, options: BroadcastMessageOptions = {}) {
    const { excludes = [], tag = undefined } = options;

    for (const ws of this.state.getWebSockets(tag)) {
      if (excludes.includes(ws)) continue;

      ws.send(message);
    }
  }

  isAliveSocket(ws: WebSocket) {
    const state: WebSocketAttachment = ws.deserializeAttachment();
    const pingAt = this.state.getWebSocketAutoResponseTimestamp(ws);
    const responseAt = pingAt ?? state.connectedAt;

    return Date.now() - responseAt.getTime() < BroadcastMessage.TIMEOUT;
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    this.broadcast(message, { excludes: [ws] });
  }

  webSocketError(ws: WebSocket, error: unknown): void {
    console.error('WebSocket error:', error);
  }

  webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): void {
    this.sessions.delete(ws);
    console.info('WebSocket closed:', { code, reason, wasClean });
  }

  fetch(request: Request) {
    return this.app.request(request, undefined, this.env);
  }

  async alarm(): Promise<void> {
    for (const ws of this.sessions) {
      if (!this.isAliveSocket(ws)) {
        ws.close();
        this.sessions.delete(ws);
      }
    }
    await this.state.storage.setAlarm(Date.now() + BroadcastMessage.INTERVAL);
  }
}

export type BroadcastMessageAppType = ReturnType<typeof createApp>;
