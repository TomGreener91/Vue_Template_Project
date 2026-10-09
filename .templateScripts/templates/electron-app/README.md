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

This template is configured with defense-in-depth defaults aligning with the [official Electron Security Recommendations](https://www.electronjs.org/docs/latest/tutorial/security). Each setting is documented below to explain its purpose and when you may need to adjust it in future projects:

### 1. Chromium Command-Line Switches (`electron/main.ts`)

Applied before application readiness to restrict Chromium background network chatter and telemetry:

| Switch | Purpose | When to Modify / Remove |
| :--- | :--- | :--- |
| `disable-background-networking` | Disables Chromium background networking activities (e.g., extension updates, policy queries). | Keep enabled unless the app explicitly relies on built-in Chromium extension/network services. |
| `disable-component-update` | Prevents Chromium from fetching dynamic component updates (such as CRLSets or plugin binaries). | Remove if the app requires dynamic runtime modules such as Widevine DRM. |
| `disable-domain-reliability` | Suppresses Google domain reliability monitoring and error reporting probes. | Keep enabled in enterprise and private deployments to stop outbound telemetry. |
| `disable-sync` | Disables Google account data synchronization features built into Chromium. | Keep enabled; desktop applications manage authentication and synchronization independently. |
| `no-default-browser-check` | Suppresses background system checks verifying if Chromium is set as the default web browser. | Always keep enabled for desktop applications. |

### 2. Window Lifecycle & DevTools Gating (`electron/main.ts`)

- **Flicker Mitigation (`show: false` + `ready-to-show`)**: The main browser window is created hidden (`show: false`) and only made visible once the `ready-to-show` event fires. This avoids white startup flashes and ensures the UI is not visible in an incomplete or un-styled state.
- **Production DevTools Guarding (`!app.isPackaged`)**: The DevTools toggle keyboard shortcuts (`F12` and `Ctrl+Shift+I`) and auto-open dev calls are strictly gated behind `!app.isPackaged` / development dev server checks. In packaged production binaries, these shortcuts are omitted to prevent users from inspecting or tampering with application runtime internals.

### 3. Window & Navigation Controls (`electron/main.ts`)

- **Strict URL Validation (`openSafeExternal`)**: External link handling parses URLs using the WHATWG `new URL()` parser wrapped in `try/catch`, strictly allowing only `https:` protocols before handing off to `shell.openExternal`. This prevents protocol injection or malformed URI exploits. If HTTP access is required for local networks, explicitly allow `parsed.protocol === 'http:'`.
- **Window Open Delegation (`setWindowOpenHandler`)**: Popups and `window.open` calls are intercepted globally via `app.on('web-contents-created')`. Any valid HTTPS target is forwarded to the user's default OS browser, and the in-app popup action is rejected (`{ action: 'deny' }`).
- **In-App Navigation Interception (`will-navigate`)**: Top-level renderer navigation away from the application origin is intercepted, preventing attackers or malicious content from hijacking the window viewport. Safe external links are passed to the OS browser.
- **Webview Blocking (`will-attach-webview`)**: Intercepts and denies `<webview>` attachment events, preventing arbitrary web content hosting within the application window.
- **Permission Requests Lockdown (`setPermissionRequestHandler`)**: Denies all HTML5 permission requests (camera, microphone, geolocation, notifications) by default. If your application requires device access, replace the blanket rejection with an allowlist checking `permission` and validating the requesting `webContents.getURL()`.

### 4. Renderer Sandboxing (`electron/main.ts`)

Configured within `webPreferences`:

- **`contextIsolation: true`**: Isolates the preload script's context from the renderer execution context, preventing website scripts from modifying preload prototypes or hijacking IPC channels.
- **`sandbox: true`**: Runs the renderer within the native OS-level Chromium sandbox without direct operating system access.
- **`nodeIntegration: false`**: Blocks Node.js APIs (`require`, `process`, `fs`) in the renderer process.
- **`webSecurity: true`**: Enforces the Same-Origin Policy and blocks loading resources from insecure or cross-origin schemes.

### 5. Content Security Policy (`vite.renderer.config.mjs`)

- Configured using `@greener-games/vite-csp` with `apply: 'build'`.
- Production builds automatically inject a strict `<meta http-equiv="Content-Security-Policy">` into the renderer `index.html`:
  `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self';`
- **When to Modify**: When your application connects to external APIs or downloads remote media, update the `policy` in `vite.renderer.config.mjs` (e.g. adding your API domain to `connect-src` or image hosts to `img-src`).

### 6. Binary Hardening via Electron Fuses (`forge.config.cjs`)

Packaged builds lock down runtime toggles at the executable binary level using `@electron-forge/plugin-fuses`:

- **`RunAsNode: false`**: Disables the `ELECTRON_RUN_AS_NODE` environment variable, preventing the packaged application binary from being executed as an arbitrary Node.js runner.
- **`EnableCookieEncryption: true`**: Encrypts on-disk Chromium cookies using OS-level keychains (DPAPI on Windows, Keychain on macOS).
- **`EnableNodeOptionsEnvironmentVariable: false`**: Disables `NODE_OPTIONS` and related flags to prevent environment variable injection.
- **`EnableNodeCliInspectArguments: false`**: Strips `--inspect` and `--inspect-brk` command-line flags from production executables to prevent debugger attachment.
- **`EnableEmbeddedAsarIntegrityValidation: true`**: Enforces cryptographic checksum validation on `app.asar` to detect tampering.
- **`OnlyLoadAppFromAsar: true`**: Ensures the executable will only execute application code packaged inside the signed ASAR archive.

## Build and Release

The GitHub Actions release workflow handles building and releasing the Electron application installers across Linux, macOS, and Windows.
