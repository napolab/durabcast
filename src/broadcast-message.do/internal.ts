import type { BroadcastMessageAppType, BroadcastMessageOptions, BroadcastOptions } from '.';

export interface InternalBroadcastMessage extends DurableObject {
  // constants
  readonly AUTO_CLOSE: boolean;
  readonly INTERVAL: number;
  readonly TIMEOUT: number;
  readonly REQUEST_RESPONSE_PAIR: WebSocketRequestResponsePair;

  // user custom options
  options: BroadcastMessageOptions;

  // internal state
  sessions: Set<WebSocket>;
  app: BroadcastMessageAppType;

  // internal methods
  onStart(): Promise<void>;
  createRoom(roomId: string, uid: string): Promise<WebSocket>;

  // public methods
  broadcast(message: string, options?: BroadcastOptions): void;
  isAliveSocket(ws: WebSocket): boolean;
}
