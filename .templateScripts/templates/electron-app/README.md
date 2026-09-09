# Electron Application

This template sets up the project to be a hardened Electron desktop application configured according to the [official Electron Security Recommendations](https://www.electronjs.org/docs/latest/tutorial/security).

## Architecture & Development (Vite Plugin)

The Electron application uses `@electron-forge/plugin-vite` to orchestrate builds, development servers, and production packaging:

- **Hot Reloading & Process Restart**: `npm run electron:start` boots the Vite dev server with Vue HMR, automatically watches and recompiles `electron/main.ts` and `electron/preload.ts`, and restarts the Electron process or reloads the renderer on changes.
- **Strict TypeScript**: Both `electron/main.ts` and `electron/preload.ts` are written in TypeScript and bundled to `.vite/build/`.
- **Targeted Configurations**:
  - `vite.main.config.mjs`: Bundles the main process and externalizes runtime dependencies (`electron`, `electron-squirrel-startup`).
  - `vite.preload.config.mjs`: Bundles the preload script and externalizes `electron`.
  - `vite.renderer.config.mjs`: Configures the Vue 3 + Tailwind CSS 4 frontend for the Electron renderer window.
- **Automated Packaging Exclusions**: `@electron-forge/plugin-vite` automatically enforces strict packaging ignore rules (`!file.startsWith('/.vite')`), ensuring that source files (`src/`, `public/`), TypeScript configs, documentation, and raw build assets are never leaked into the production `app.asar`.

## Development

- `npm run electron:start`: Start the Electron application with Vite dev server and HMR.
- `npm run electron:package`: Bundle all targets via Vite and package the application.
- `npm run electron:make`: Compile all targets and generate distributable platform installers.

## Security Architecture & Defaults

This template is configured with defense-in-depth defaults aligning with Electron security recommendations:

- **Context Isolation & Sandboxing**: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, and `webSecurity: true` are enforced on renderer windows.
- **Permissions Lockdown**: Session permission requests are denied by default (`setPermissionRequestHandler`).
- **Navigation & Window Controls**: Uncontrolled in-window navigation is intercepted. Window popups and `<webview>` tags are disabled; safe external web links (`https://`) are opened in the OS browser via `shell.openExternal`.
- **Preload API Isolation**: Renderer communication uses `contextBridge.exposeInMainWorld` without exposing raw Electron internals.
- **Electron Fuses**: Package-time binary hardening is enabled in `forge.config.cjs` via `@electron-forge/plugin-fuses` (disabling `ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS`, and CLI inspect arguments in production packages).

## Build and Release

The GitHub Actions release workflow handles building and releasing the Electron application installers across Linux, macOS, and Windows.
