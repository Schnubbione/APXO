/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'node:url';

const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(async () => {
  let storybookPlugin: any = null;

  try {
    const mod = await import('@storybook/addon-vitest/vitest-plugin');
    if (mod?.storybookTest) {
      storybookPlugin = mod.storybookTest({
        configDir: path.join(dirname, '.storybook')
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[vite] Optional Storybook vitest plugin not loaded:', message);
    }
  }

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(dirname, './src')
      }
    },
    ...(storybookPlugin ? {
      test: {
        projects: [{
          extends: true,
          plugins: [storybookPlugin],
          test: {
            name: 'storybook',
            browser: {
              enabled: true,
              headless: true,
              provider: 'playwright',
              instances: [{ browser: 'chromium' }]
            },
            setupFiles: ['.storybook/vitest.setup.ts']
          }
        }]
      }
    } : {})
  };
});
