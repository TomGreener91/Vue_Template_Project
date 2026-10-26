import type { Plugin } from 'vite';

export default function {{CAMEL_PLUGIN_NAME}}(): Plugin {
  return {
    name: '{{PLUGIN_NAME}}',
    configureServer() {
      console.log('Hello from {{PLUGIN_NAME}}!');
    },
  };
}
