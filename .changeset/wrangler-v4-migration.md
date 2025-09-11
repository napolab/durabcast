---
"durabcast": patch
---

Migrate to Wrangler v4 with custom worker configuration types

- Upgrade wrangler from v3.67.1 to v4.35.0 for latest Cloudflare Workers support
- Replace @cloudflare/workers-types with custom worker-configuration.d.ts for better type safety
- Add comprehensive test configuration for Cloudflare Workers testing with vitest-pool-workers
- Update Biome configuration to ignore generated type files
- Fix changeset configuration access setting to match public package publishing

