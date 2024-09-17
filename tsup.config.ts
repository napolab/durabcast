import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/broadcast-message.do/index.ts',
    'helpers/upgrade': 'src/middleware/upgrade/index.ts',
    'helpers/client': 'src/client/index.ts',
  },
  external: ['hono', /cloudflare:/],
  format: ['cjs', 'esm'],
  clean: true,
  sourcemap: true,
  dts: {
    banner: "/// <reference types='@cloudflare/workers-types' />",
  },
});
