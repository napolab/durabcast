import { defineWorkersProject } from '@cloudflare/vitest-pool-workers/config';
import { defineConfig, defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  defineConfig({
    test: {
      globals: true,
      name: 'unit',
      include: ['**/*.unit.test.ts'],
    },
  }),
  defineWorkersProject({
    esbuild: {
      target: 'ES2022',
    },
    test: {
      globals: true,
      name: 'e2e',
      include: ['**/*.e2e.test.ts'],
      poolOptions: {
        workers: {
          singleWorker: true,
          miniflare: {
            compatibilityFlags: ['nodejs_compat', 'service_binding_extra_handlers'],
          },
          wrangler: {
            configPath: './wrangler.toml',
            environment: 'test',
          },
        },
      },
    },
  }),
]);
