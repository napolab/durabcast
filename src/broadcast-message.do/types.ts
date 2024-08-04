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
export type BroadcastOptions = {
  uid?: string[];
  excludes?: WebSocket[];
};
