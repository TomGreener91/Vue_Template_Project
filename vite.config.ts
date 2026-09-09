import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import checker from 'vite-plugin-checker';
import path from 'path';
import vueDevTools from 'vite-plugin-vue-devtools';
import csp from '@greener-games/vite-csp';
import deterministicPort from '@greener-games/vite-deterministic-port';
import screenSize from '@greener-games/vite-screen-size';

export default defineConfig(({ command }) => {
  const isDev = command === 'serve';

  return {
    plugins: [
      vue(),
      tailwindcss(),
      csp({
        policy: {
          'default-src': ["'self'"],
          'script-src': isDev
            ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"]
            : ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", "data:", "blob:"],
          'font-src': ["'self'", "data:"],
          'connect-src': isDev
            ? ["'self'", "ws:", "wss:", "http://localhost:*", "http://127.0.0.1:*"]
            : ["'self'"],
        },
      }),
      checker({
        enableBuild: false,
        typescript: true,
        vueTsc: true,
        eslint: {
          useFlatConfig: true,
          lintCommand: 'eslint src'
        },
        stylelint: { lintCommand: 'stylelint "./**/*.{css,vue}"' },
      }),
      vueDevTools(),
      deterministicPort(),
      screenSize(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      extensions: [".mjs", ".js", ".ts", ".jsx", ".tsx", ".json"],
    },
  };
});
