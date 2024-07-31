import { defineWorkersProject } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersProject({
  esbuild: {
    // Required for `using` support
    target: 'ES2022',
  },
  test: {
    globals: true,
    poolOptions: {
      workers: {
        singleWorker: true,
        miniflare: {
          compatibilityFlags: ['nodejs_compat', 'service_binding_extra_handlers'],
        },
        wrangler: {
          configPath: './wrangler.toml',
        },
      },
    },
  },
});
