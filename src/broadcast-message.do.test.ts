import { env, listDurableObjectIds, runInDurableObject } from 'cloudflare:test';
import { vi } from 'vitest';
import { BroadcastMessage, type BroadcastMessageOptions } from './broadcast-message.do';
import type { InternalBroadcastMessage } from './broadcast-message.do/internal';

describe('BroadcastMessage Durable Object', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  describe('Initialization', () => {
    it('initializes and starts correctly', async () => {
      const id = env.BROADCAST_MESSAGE.newUniqueId();
      const stub = env.BROADCAST_MESSAGE.get(id);

      await runInDurableObject(stub, async (instance: InternalBroadcastMessage, state) => {
        expect(instance).toBeInstanceOf(BroadcastMessage);
        expect(state.getWebSocketAutoResponse()).toEqual(instance.REQUEST_RESPONSE_PAIR);
        expect(instance.sessions.size).toBe(0);
      });
    });
  });

  describe('Room Creation', () => {
    it('creates a room', async () => {
      const date = new Date();
      vi.setSystemTime(date);

      const id = env.BROADCAST_MESSAGE.newUniqueId();
      const stub = env.BROADCAST_MESSAGE.get(id);

      await runInDurableObject(stub, async (instance: InternalBroadcastMessage, state) => {
        const roomId = 'room1';
        const uid = 'user1';

        const ws = await instance.createRoom(roomId, uid);
        expect(ws).toBeInstanceOf(WebSocket);

        const alarm = await state.storage.getAlarm();
        expect(alarm).toBe(date.getTime() + instance.INTERVAL);
        expect(instance.sessions.size).toBe(1);
      });
    });

    it('creates a webSocket from a request', async () => {
      const date = new Date();
      vi.setSystemTime(date);

      const id = env.BROADCAST_MESSAGE.newUniqueId();
      const stub = env.BROADCAST_MESSAGE.get(id);

      await runInDurableObject(stub, async (instance: InternalBroadcastMessage, state) => {
        const roomId = 'room1';
        const uid = 'user1';

        const request = new Request(`http://localhost/rooms/${roomId}?uid=${uid}`, {
          headers: { Upgrade: 'websocket' },
        });
        const res = await instance.fetch(request);

        expect(res.webSocket).toBeInstanceOf(WebSocket);
        const alarm = await state.storage.getAlarm();
        expect(alarm).toBe(date.getTime() + instance.INTERVAL);
        expect(instance.sessions.size).toBe(1);
      });
    });
  });

  describe('AUTO_CLOSE Handling', () => {
    it('sets alarm when AUTO_CLOSE is true', async () => {
      const date = new Date();
      vi.setSystemTime(date);

      const id = env.BROADCAST_MESSAGE.newUniqueId();
      const stub = env.BROADCAST_MESSAGE.get(id);

      await runInDurableObject(stub, async (instance: InternalBroadcastMessage, state) => {
        vi.spyOn(state.storage, 'setAlarm');
        instance.options.autoClose = true;

        const roomId = 'room1';
        const uid = 'user1';
        await instance.createRoom(roomId, uid);

        expect(state.storage.setAlarm).toHaveBeenCalled();
        expect(state.storage.setAlarm).toHaveBeenCalledWith(date.getTime() + instance.INTERVAL);
      });
    });

    it('does not set alarm when AUTO_CLOSE is false', async () => {
      const date = new Date();
      vi.setSystemTime(date);

      const id = env.BROADCAST_MESSAGE.newUniqueId();
      const stub = env.BROADCAST_MESSAGE.get(id);

      await runInDurableObject(stub, async (instance: InternalBroadcastMessage, state) => {
        vi.spyOn(state.storage, 'setAlarm');
        instance.options.autoClose = false;

        const roomId = 'room1';
        const uid = 'user1';
        await instance.createRoom(roomId, uid);

        expect(state.storage.setAlarm).not.toHaveBeenCalled();
      });
    });
  });

  describe('WebSocket State Serialization', () => {
    it('serializes WebSocket state correctly', async () => {
      const id = env.BROADCAST_MESSAGE.newUniqueId();
      const stub = env.BROADCAST_MESSAGE.get(id);
      const date = new Date();
      vi.setSystemTime(date);

      await runInDurableObject(stub, async (instance: InternalBroadcastMessage) => {
        const roomId = 'room1';
        const uid = 'user1';
        await instance.createRoom(roomId, uid);
        const ws = Array.from(instance.sessions.values()).at(0)!;

        const state = ws.deserializeAttachment();
        expect(state).toEqual({
          roomId,
          uid,
          connectedAt: date,
        });
      });
    });
  });

  describe('Broadcast Messages', () => {
    it.each([
      { excludes: true, uid: [], message: 'test message', calledTimes: 0 },
      { excludes: false, uid: ['user2'], message: 'test message', calledTimes: 0 },
      { excludes: false, uid: ['user1'], message: 'test message', calledTimes: 1 },
      { excludes: false, uid: [], message: 'test message', calledTimes: 1 },
    ])('broadcasts messages correctly', async ({ excludes, uid, message, calledTimes }) => {
      const id = env.BROADCAST_MESSAGE.newUniqueId();
      const stub = env.BROADCAST_MESSAGE.get(id);

      await runInDurableObject(stub, async (instance: InternalBroadcastMessage) => {
        await instance.createRoom('room1', 'user1');
        const server = Array.from(instance.sessions.values()).at(0)!;
        vi.spyOn(server, 'send');

        if (excludes) {
          instance.broadcast(message, { excludes: [server] });
        } else {
          instance.broadcast(message, { uid });
        }
        expect(server.send).toHaveBeenCalledTimes(calledTimes);
      });
    });
  });

  describe('WebSocket Aliveness Check', () => {
    it.each([
      { description: 'checks if a WebSocket is alive', offset: () => 0, expected: true },
      { description: 'detects expired WebSocket', offset: (timeout: number) => timeout + 1, expected: false },
    ])('$description', async ({ offset, expected }) => {
      const date = new Date();
      vi.setSystemTime(date);

      const id = env.BROADCAST_MESSAGE.newUniqueId();
      const stub = env.BROADCAST_MESSAGE.get(id);

      await runInDurableObject(stub, async (instance: InternalBroadcastMessage, state) => {
        await instance.createRoom('room1', 'user1');
        const ws = Array.from(instance.sessions.values()).at(0)!;

        const offsetTime = offset(instance.TIMEOUT);
        vi.setSystemTime(new Date(date.getTime() + offsetTime));

        expect(instance.isAliveSocket(ws)).toBe(expected);
      });
    });

    it.each([
      { description: 'checks WebSocket aliveness with ping', offset: () => 0, expected: true },
      {
        description: 'detects expired WebSocket with ping',
        offset: (timeout: number) => -timeout - 1,
        expected: false,
      },
    ])('$description', async ({ offset, expected }) => {
      const date = new Date();
      vi.setSystemTime(date);

      const id = env.BROADCAST_MESSAGE.newUniqueId();
      const stub = env.BROADCAST_MESSAGE.get(id);

      await runInDurableObject(stub, async (instance: InternalBroadcastMessage, state) => {
        await instance.createRoom('room1', 'user1');
        const ws = Array.from(instance.sessions.values()).at(0)!;

        const offsetTime = offset(instance.TIMEOUT);
        vi.spyOn(state, 'getWebSocketAutoResponseTimestamp').mockReturnValue(new Date(date.getTime() + offsetTime));

        expect(instance.isAliveSocket(ws)).toBe(expected);
      });
    });
  });

  describe('WebSocket Message Handling', () => {
    it('handles WebSocket messages correctly', async () => {
      const id = env.BROADCAST_MESSAGE.newUniqueId();
      const stub = env.BROADCAST_MESSAGE.get(id);

      await runInDurableObject(stub, async (instance: InternalBroadcastMessage) => {
        await instance.createRoom('room1', 'user1');
        const server = Array.from(instance.sessions.values()).at(0)!;
        vi.spyOn(instance, 'broadcast');

        await instance.webSocketMessage?.(server, 'message');
        expect(instance.broadcast).toHaveBeenCalledWith('message');
      });
    });
  });

  describe('Alarm Handling', () => {
    it('resets alarm correctly', async () => {
      const id = env.BROADCAST_MESSAGE.newUniqueId();
      const stub = env.BROADCAST_MESSAGE.get(id);

      await runInDurableObject(stub, async (instance: InternalBroadcastMessage, state) => {
        vi.spyOn(state.storage, 'setAlarm');

        await instance.createRoom('room1', 'user1');
        await instance.alarm?.();
        expect(state.storage.setAlarm).toHaveBeenCalled();
        expect(state.storage.setAlarm).toHaveBeenCalledWith(Date.now() + instance.INTERVAL);
      });
    });
  });

  describe('Durable Object IDs', () => {
    it('lists durable object IDs', async () => {
      let ids = await listDurableObjectIds(env.BROADCAST_MESSAGE);
      expect(ids.length).toBe(0);

      const id = await env.BROADCAST_MESSAGE.newUniqueId();
      const stub = env.BROADCAST_MESSAGE.get(id);
      const req = new Request('http://localhost/rooms/room1?uid=user1', {
        headers: {
          Upgrade: 'websocket',
        },
      });
      await stub.fetch(req);

      ids = await listDurableObjectIds(env.BROADCAST_MESSAGE);
      expect(ids.length).toBe(1);
    });
  });
});


describe('BroadcastMessage Durable Object with Options', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  const createStubWithOptions = async (options: BroadcastMessageOptions) => {
    const id = env.BROADCAST_MESSAGE.newUniqueId();
    const stub = env.BROADCAST_MESSAGE.get(id);
    await runInDurableObject(stub, async (instance: InternalBroadcastMessage) => {
      Object.assign(instance.options, options);
    });
    return stub;
  };

  describe('autoClose Option', () => {
    it('sets alarm when autoClose is true', async () => {
      const date = new Date();
      vi.setSystemTime(date);

      const stub = await createStubWithOptions({ autoClose: true });

      await runInDurableObject(stub, async (instance: InternalBroadcastMessage, state) => {
        vi.spyOn(state.storage, 'setAlarm');

        await instance.createRoom('room1', 'user1');
        expect(state.storage.setAlarm).toHaveBeenCalledWith(date.getTime() + instance.INTERVAL);
      });
    });

    it('does not set alarm when autoClose is false', async () => {
      const date = new Date();
      vi.setSystemTime(date);

      const stub = await createStubWithOptions({ autoClose: false });

      await runInDurableObject(stub, async (instance: InternalBroadcastMessage, state) => {
        vi.spyOn(state.storage, 'setAlarm');

        await instance.createRoom('room1', 'user1');
        expect(state.storage.setAlarm).not.toHaveBeenCalled();
      });
    });
  });

  describe('interval Option', () => {
    it('updates interval and sets alarm accordingly', async () => {
      const date = new Date();
      vi.setSystemTime(date);

      const newInterval = 60000;
      const stub = await createStubWithOptions({ interval: newInterval });

      await runInDurableObject(stub, async (instance: InternalBroadcastMessage, state) => {
        vi.spyOn(state.storage, 'setAlarm');

        await instance.createRoom('room1', 'user1');
        expect(state.storage.setAlarm).toHaveBeenCalledWith(date.getTime() + newInterval);
      });
    });
  });

  describe('timeout Option', () => {
    it('updates timeout and checks WebSocket aliveness accordingly', async () => {
      const date = new Date();
      vi.setSystemTime(date);

      const newTimeout = 120000;
      const stub = await createStubWithOptions({ timeout: newTimeout });

      await runInDurableObject(stub, async (instance: InternalBroadcastMessage, state) => {
        await instance.createRoom('room1', 'user1');
        const ws = Array.from(instance.sessions.values()).at(0)!;

        const offsetTime = newTimeout + 1;
        vi.setSystemTime(new Date(date.getTime() + offsetTime));

        expect(instance.isAliveSocket(ws)).toBe(false);
      });
    });
  });

  describe('requestResponsePair Option', () => {
    it('updates requestResponsePair and checks ping-pong messages', async () => {
      const date = new Date();
      vi.setSystemTime(date);

      const newRequestResponsePair = { request: 'hello', response: 'world' };
      const stub = await createStubWithOptions({ requestResponsePair: newRequestResponsePair });

      await runInDurableObject(stub, async (instance: InternalBroadcastMessage) => {
        expect(instance.REQUEST_RESPONSE_PAIR.request).toBe('hello');
        expect(instance.REQUEST_RESPONSE_PAIR.response).toBe('world');
      });
    });
  });

  describe('Combination of Options', () => {
    it('handles a combination of options correctly', async () => {
      const date = new Date();
      vi.setSystemTime(date);

      const options: BroadcastMessageOptions = {
        autoClose: true,
        interval: 45000,
        timeout: 90000,
        requestResponsePair: { request: 'ping', response: 'pong' },
      };
      const stub = await createStubWithOptions(options);

      await runInDurableObject(stub, async (instance: InternalBroadcastMessage, state) => {
        vi.spyOn(state.storage, 'setAlarm');

        await instance.createRoom('room1', 'user1');
        expect(state.storage.setAlarm).toHaveBeenCalledWith(date.getTime() + options.interval!);

        const ws = Array.from(instance.sessions.values()).at(0)!;
        const offsetTime = options.timeout! + 1;
        vi.setSystemTime(new Date(date.getTime() + offsetTime));
        expect(instance.isAliveSocket(ws)).toBe(false);

        expect(instance.REQUEST_RESPONSE_PAIR.request).toBe('ping');
        expect(instance.REQUEST_RESPONSE_PAIR.response).toBe('pong');
      });
    });
  });
});