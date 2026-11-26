import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
export default defineConfig({
  resolve: { alias: { '$': fileURLToPath(new URL('./tests/gm.ts', import.meta.url)) } },
  test: { environment: 'jsdom', environmentOptions: { jsdom: { url: 'https://github.com/' } }, setupFiles: ['./tests/setup.ts'], clearMocks: true, restoreMocks: true },
});
