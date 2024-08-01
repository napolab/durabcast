# DurabCast

`DurabCast` is a library for easily handling WebSockets with Cloudflare Durable Objects. It simplifies the setup and management of WebSocket connections by implementing complex configurations out of the box.

## Features

- **Connection Monitoring and Auto-Close**

  - Monitor and close idle connections automatically.
  - `interval` and `timeout` can be configured through options.
  - Opt-out of auto-closing by setting `autoClose` to `false`.

- **Message Broadcasting**

  - Broadcast messages to other connected clients.
  - Override `webSocketMessage` to customize message handling.

- **Connection Alive Check**
  - Use `isAliveSocket` to check if a connection is still alive.

## Installation

```sh
npm install durabcast
```

## Basic Usage

Here is a simple example to get started with `DurabCast`.

### wrangler.toml

```toml
name = "sample"
main = "src/index.ts"
compatibility_date = "2024-07-18"

[[durable_objects.bindings]]
class_name = "BroadcastMessage"
name = "BROADCAST_MESSAGE"

[[migrations]]
tag = "v1"
new_classes = ["BroadcastMessage"]
```

### index.ts

```ts
import { BroadcastMessage, type BroadcastMessageAppType } from "durabcast";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { hc } from "hono/client";
import { z } from "zod";
import { upgrade } from "durabcast/helpers/upgrade";

type Env = {
  Bindings: {
    BROADCAST_MESSAGE: DurableObjectNamespace<BroadcastMessage>;
  };
};

const app = new Hono<Env>();

const route = app
  .get(
    "/rooms/:roomId",
    upgrade(),
    zValidator("query", z.object({ uid: z.string() })),
    async (c) => {
      const roomId = c.req.param("roomId");
      const uid = c.req.valid("query").uid;
      const id = c.env.BROADCAST_MESSAGE.idFromName(roomId);
      const stub = c.env.BROADCAST_MESSAGE.get(id);

      const client = hc<BroadcastMessageAppType>(c.req.url, {
        fetch: stub.fetch.bind(stub),
      });

      const res = await client.rooms[":roomId"].$get(
        { query: { uid }, param: { roomId } },
        { init: { headers: c.req.raw.headers } },
      );

      return new Response(null, {
        webSocket: res.webSocket,
        status: res.status,
        headers: res.headers,
        statusText: res.statusText,
      });
    },
  )
  .post(
    "/rooms/:roomId/broadcast",
    zValidator("json", z.object({ message: z.string() })),
    async (c) => {
      const roomId = c.req.param("roomId");
      const id = c.env.BROADCAST_MESSAGE.idFromName(roomId);
      const stub = c.env.BROADCAST_MESSAGE.get(id);

      await stub.broadcast(c.req.valid("json").message);
      return c.json(null, 200);
    },
  );

export { BroadcastMessage };
```

## Advanced Usage

### Extending the BroadcastMessage Class

You can extend the `BroadcastMessage` class to customize the behavior of your WebSocket connections.

```ts
import { BroadcastMessage, type BroadcastMessageOptions } from "durabcast";

class CustomBroadcastMessage extends BroadcastMessage {
  protected options: BroadcastMessageOptions = {
    autoClose: false,
  };

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    for (const session of this.sessions) {
      if (!this.isAliveSocket(session)) {
        session.close();
        this.sessions.delete(session);
      }
    }
    this.broadcast(message, {
      excludes: [ws],
    });
  }
}

// Use CustomBroadcastMessage in your Durable Object binding
```

## API

### Connection Monitoring and Auto-Close

The library monitors connections and can automatically close idle ones based on the configured `interval` and `timeout`. This behavior can be turned off by setting `autoClose` to `false` in the options.

#### Example

```ts
import { BroadcastMessage, type BroadcastMessageOptions } from "durabcast";

class CustomBroadcastMessage extends BroadcastMessage {
  protected options: BroadcastMessageOptions = {
    interval: 30000, // Check every 30 seconds
    timeout: 60000, // Close connection if idle for 60 seconds
    autoClose: true, // Enable auto-close
    requestResponsePair: {
      request: "ping",
      response: "pong",
    },
  };

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    // Broadcast message to other clients
    this.broadcast(message, {
      excludes: [ws],
    });
  }
}

// In your Durable Object binding, use CustomBroadcastMessage
export default {
  async fetch(request: Request, env: Env) {
    const id = env.BROADCAST_MESSAGE.idFromName("my-room");
    const stub = env.BROADCAST_MESSAGE.get(id);
    return stub.fetch(request);
  },
};
```

### Message Broadcasting

Messages can be broadcasted to other connected clients. You can override the `webSocketMessage` method to customize how messages are handled.

```ts
class CustomBroadcastMessage extends BroadcastMessage {
  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    // Custom message handling logic
    this.broadcast(message, {
      excludes: [ws],
    });
  }
}
```

### Connection Alive Check

The `isAliveSocket` method checks if a connection is still alive.

```ts
const isAlive = this.isAliveSocket(ws);
if (!isAlive) {
  ws.close();
}
```

## Extending the BroadcastMessage Class

When extending the `BroadcastMessage` class, you can access and modify the `options` field to customize the behavior of your WebSocket connections.

### `options`

The `options` field allows you to configure the behavior of your WebSocket connections. It is a protected field, meaning it can be accessed and modified within any class that extends `BroadcastMessage`.

#### Fields

- **`interval`**: The interval (in milliseconds) at which to check for idle connections.
- **`timeout`**: The timeout (in milliseconds) after which idle connections are closed.
- **`autoClose`**: A boolean indicating whether to automatically close idle connections. Set to `false` to opt-out of this behavior.
- **`requestResponsePair`**: An object containing `request` and `response` strings used for ping-pong style connection checks.

### Protected Methods and Fields

These protected methods and fields are available within any class that extends `BroadcastMessage`:

- **`AUTO_CLOSE`**: Returns the value of `options.autoClose`, defaulting to `true` if not set.
- **`INTERVAL`**: Returns the value of `options.interval`, defaulting to `30 * 1000` (30 seconds) if not set.
- **`TIMEOUT`**: Returns the value of `options.timeout`, defaulting to `60 * 1000` (60 seconds) if not set.
- **`REQUEST_RESPONSE_PAIR`**: Returns a `WebSocketRequestResponsePair` object using the `options.requestResponsePair` values, defaulting to `'ping'` and `'pong'` if not set.
- **`sessions`**: A set of active WebSocket sessions.

### Example

```ts
class CustomBroadcastMessage extends BroadcastMessage {
  protected options: BroadcastMessageOptions = {
    interval: 30000, // Check every 30 seconds
    timeout: 60000, // Close connection if idle for 60 seconds
    autoClose: true, // Enable auto-close
    requestResponsePair: {
      request: "ping",
      response: "pong",
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
      this.options.requestResponsePair?.request ?? "ping",
      this.options.requestResponsePair?.response ?? "pong",
    );
  }

  protected sessions = new Set<WebSocket>();

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    // Custom message handling logic
    this.broadcast(message, {
      excludes: [ws],
    });
  }
}
```

## License

MIT License. See [LICENSE](./LICENSE) for more information.
