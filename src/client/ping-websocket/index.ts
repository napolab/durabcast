type Subscription = () => void;
type Options = {
  interval: number;
  ping: string;
};

export const pingWebSocket = (ws: WebSocket, options?: Options): Subscription => {
  const id = setInterval(
    () => {
      ws.send(options?.ping ?? 'ping');
    },
    options?.interval ?? 10 * 1000,
  );

  return () => {
    clearInterval(id);
  };
};
