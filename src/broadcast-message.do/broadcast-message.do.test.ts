import { env, listDurableObjectIds, runInDurableObject } from 'cloudflare:test';
import { BroadcastMessage } from '.';

describe('BroadcastMessage Durable Object', () => {
  it('initializes and starts correctly', async () => {
    const id = env.BROADCAST_MESSAGE.newUniqueId();
    const stub = env.BROADCAST_MESSAGE.get(id);

    await runInDurableObject(stub, async (instance: BroadcastMessage, state) => {
      expect(instance).toBeInstanceOf(BroadcastMessage);
      expect(state.getWebSocketAutoResponse()).toEqual(new WebSocketRequestResponsePair('ping', 'pong'));
      expect(state.getWebSockets().length).toBe(0);
    });
  });

  it('creates a WebSocket room correctly', async () => {
    const id = env.BROADCAST_MESSAGE.newUniqueId();
    const stub = env.BROADCAST_MESSAGE.get(id);

    await runInDurableObject(stub, async (instance: BroadcastMessage, state) => {
      const roomId = 'room1';
      const uid = 'user1';

      const request = new Request(`http://localhost/rooms/${roomId}?uid=${uid}`, {
        headers: {
          Upgrade: 'websocket',
        },
      });
      const client = await instance.fetch(request);
      expect(client.webSocket).toBeInstanceOf(WebSocket);
      const alarm = await state.storage.getAlarm();
      expect(alarm).not.toBeNull();
    });
  });

  it.skip('broadcasts messages excluding specific WebSockets and UIDs', async () => {
    const id = env.BROADCAST_MESSAGE.newUniqueId();
    const stub = env.BROADCAST_MESSAGE.get(id);

    await runInDurableObject(stub, async (instance: BroadcastMessage) => {
      const wsPair = new WebSocketPair();
      const ws = wsPair[1];
      const message = 'test message';
      vi.spyOn(ws, 'send');

      instance.broadcast(message, { excludes: [ws] });
      expect(ws.send).not.toHaveBeenCalled();

      instance.broadcast(message, { uid: ['user1'] });
      expect(ws.send).not.toHaveBeenCalled();

      instance.broadcast(message);
      expect(ws.send).toHaveBeenCalledWith(message);
    });
  });

  it('checks if a WebSocket is alive', async () => {
    const id = env.BROADCAST_MESSAGE.newUniqueId();
    const stub = env.BROADCAST_MESSAGE.get(id);

    await runInDurableObject(stub, async (instance: BroadcastMessage, state) => {
      const wsPair = new WebSocketPair();
      const ws = wsPair[1];
      vi.spyOn(state, 'getWebSocketAutoResponseTimestamp').mockReturnValue(new Date());

      expect(instance.isAliveSocket(ws)).toBe(true);
    });
  });

  it('handles WebSocket messages', async () => {
    const id = env.BROADCAST_MESSAGE.newUniqueId();
    const stub = env.BROADCAST_MESSAGE.get(id);

    await runInDurableObject(stub, async (instance: BroadcastMessage) => {
      const request = new Request('http://localhost/rooms/room1?uid=user1', {
        headers: {
          Upgrade: 'websocket',
        },
      });
      await instance.fetch(request);
      const pair = new WebSocketPair();
      const server = pair[1];

      vi.spyOn(instance, 'broadcast');

      instance.webSocketMessage(server, 'message');
      expect(instance.broadcast).toHaveBeenCalledWith('message');
    });
  });

  it('resets alarm correctly', async () => {
    const id = env.BROADCAST_MESSAGE.newUniqueId();
    const stub = env.BROADCAST_MESSAGE.get(id);

    await runInDurableObject(stub, async (instance: BroadcastMessage, state) => {
      vi.spyOn(state.storage, 'setAlarm');

      const request = new Request('http://localhost/rooms/room1?uid=user1', {
        headers: {
          Upgrade: 'websocket',
        },
      });
      await instance.fetch(request);
      await instance.alarm();
      expect(state.storage.setAlarm).toHaveBeenCalled();
    });
  });

  it('lists durable object IDs', async () => {
    let ids = await listDurableObjectIds(env.BROADCAST_MESSAGE);
    expect(ids.length).toBe(0);

    const id = await env.BROADCAST_MESSAGE.newUniqueId();
    const stub = env.BROADCAST_MESSAGE.get(id);
    const response = await stub.fetch(
      new Request('http://localhost/rooms/room1?uid=user1', {
        headers: {
          Upgrade: 'websocket',
        },
      }),
    );

    ids = await listDurableObjectIds(env.BROADCAST_MESSAGE);
    expect(ids.length).toBe(1);
  });
});
