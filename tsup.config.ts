import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/broadcast-message.do/index.ts',
    'helpers/upgrade': 'src/middleware/upgrade/index.ts',
    'helpers/client': 'src/client/index.ts',
  },
  dts: {
    banner: "/// <reference types='@cloudflare/workers-types' />",
  },
  external: ['hono', /cloudflare:/],
  format: ['cjs', 'esm'],
  clean: true,
  sourcemap: true,
  minify: 'terser',
  treeshake: true,
  terserOptions: {
    toplevel: true,
    ecma: 2020,
    compress: {
      passes: 3,
      drop_console: true,
      drop_debugger: true,
      pure_getters: true,
      unsafe: true,
      keep_fargs: true,
      keep_fnames: true,
      unused: true,
      dead_code: true,
    },
    module: true,
    keep_classnames: true,
    keep_fnames: true,
  },
});
