import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import checker from 'vite-plugin-checker';
import path from 'path';
import { cspPolicy } from './csp.config';
import vueDevTools from 'vite-plugin-vue-devtools';
import csp from '@greener-games/vite-csp';

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    csp({ policy: cspPolicy }),
    checker({
      enableBuild: false,
      typescript: true,
      vueTsc: true,
      eslint: {
        useFlatConfig: true,
        lintCommand: 'eslint --ext .ts,.tsx,.vue src'
      },
      stylelint: { lintCommand: 'stylelint "./**/*.{css,vue}"' },
    }),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    extensions: [".mjs", ".js", ".ts", ".jsx", ".tsx", ".json"],
  },
});
