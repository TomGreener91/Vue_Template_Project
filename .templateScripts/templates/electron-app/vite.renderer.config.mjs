import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import csp from '@greener-games/vite-csp';
import checker from 'vite-plugin-checker';
import vueDevTools from 'vite-plugin-vue-devtools';
import deterministicPort from '@greener-games/vite-deterministic-port';
import screenSize from '@greener-games/vite-screen-size';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    {
      ...csp({
        policy: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:', 'blob:'],
          'font-src': ["'self'", 'data:'],
          'connect-src': ["'self'"],
        },
      }),
      apply: 'build',
    },
    checker({
      enableBuild: false,
      typescript: true,
      vueTsc: true,
      eslint: {
        useFlatConfig: true,
        lintCommand: 'eslint src',
      },
      stylelint: { lintCommand: 'stylelint "./**/*.{css,vue}"' },
    }),
    vueDevTools(),
    deterministicPort(),
    screenSize(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
  },
});
