import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/broadcast-message.do/index.ts'],
  external: ['hono', /cloudflare:/],
  format: ['cjs', 'esm'],
  clean: true,
  sourcemap: true,
  dts: {
    banner: "/// <reference types='@cloudflare/workers-types' />",
  },
});
