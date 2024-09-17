import { vi } from 'vitest';
import { pingWebSocket } from '.';

describe('pingWebSocket', () => {
  let ws: WebSocket;
  beforeEach(() => {
    // @ts-expect-error
    ws = { send: vi.fn() };
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should send "ping" message at default interval when no options are provided', () => {
    const subscription = pingWebSocket(ws);

    vi.advanceTimersByTime(10000);

    expect(ws.send).toHaveBeenCalledWith('ping');
    expect(ws.send).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(10000);

    expect(ws.send).toHaveBeenCalledTimes(2);

    subscription();
  });

  it('should send custom ping message at custom interval', () => {
    const options = { interval: 5000, ping: 'hello' };
    const subscription = pingWebSocket(ws, options);

    vi.advanceTimersByTime(5000);

    expect(ws.send).toHaveBeenCalledWith('hello');
    expect(ws.send).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5000);

    expect(ws.send).toHaveBeenCalledTimes(2);

    subscription();
  });

  it('should stop sending messages after subscription is called', () => {
    const subscription = pingWebSocket(ws);

    vi.advanceTimersByTime(10000);
    expect(ws.send).toHaveBeenCalledTimes(1);

    subscription();

    vi.advanceTimersByTime(10000);

    expect(ws.send).toHaveBeenCalledTimes(1);
  });
});
