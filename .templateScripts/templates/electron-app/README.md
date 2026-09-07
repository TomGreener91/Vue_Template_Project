# Electron Application

This template sets up the project to be a hardened Electron desktop application configured according to the [official Electron Security Recommendations](https://www.electronjs.org/docs/latest/tutorial/security).

## Development

- `npm run electron:start`: Start the Electron application in development mode.
- `npm run electron:package`: Package the application for the current platform.
- `npm run electron:make`: Create distributable installers for the application.

## Security Architecture & Defaults

This template is configured with defense-in-depth defaults aligning with Electron security recommendations:

- **Context Isolation & Sandboxing**: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, and `webSecurity: true` are enforced on renderer windows.
- **Permissions Lockdown**: Session permission requests are denied by default (`setPermissionRequestHandler`).
- **Navigation & Window Controls**: Uncontrolled in-window navigation is intercepted. Window popups and `<webview>` tags are disabled; safe external web links (`https://`) are opened in the OS browser via `shell.openExternal`.
- **Preload API Isolation**: Renderer communication uses `contextBridge.exposeInMainWorld` without exposing raw Electron internals.
- **Electron Fuses**: Package-time binary hardening is enabled in `forge.config.cjs` via `@electron-forge/plugin-fuses` (disabling `ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS`, and CLI inspect arguments in production packages).

## Build and Release

The `.github/workflows/release-electron.yml` workflow (if present) handles building and releasing the Electron application.
