# durabcast

## 0.2.3

### Patch Changes

- faea9cc: Migrate to Wrangler v4 with custom worker configuration types

  - Upgrade wrangler from v3.67.1 to v4.35.0 for latest Cloudflare Workers support
  - Replace @cloudflare/workers-types with custom worker-configuration.d.ts for better type safety
  - Add comprehensive test configuration for Cloudflare Workers testing with vitest-pool-workers
  - Update Biome configuration to ignore generated type files
  - Fix changeset configuration access setting to match public package publishing

## 0.2.2

### Patch Changes

- 6344d5f: upgrade pacakges

## 0.2.1

### Patch Changes

- a6ef72c: sideeffect false

## 0.2.0

### Minor Changes

- e5bc04f: add client helper function(pingWebSocket) to send ping message to server

## 0.1.2

### Patch Changes

- 746d866: refactor testing

## 0.1.1

### Patch Changes

- 8260a24: add typesVersion
- 8260a24: fix package.json field

## 0.1.0

### Minor Changes

- 420d9c3: durabcast first release
