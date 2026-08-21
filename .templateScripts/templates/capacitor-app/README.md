# Capacitor App

This is a Vue 3 project configured for Capacitor iOS and Android builds.

## Setup

First, ensure you have run the setup and installed all dependencies:

```bash
npm install
```

## Running the Web App

To run the standard Vue web application locally:

```bash
npm run dev
```

## Capacitor Build Process

To build the Vue web assets and sync them to the native projects in one step, run:

```bash
npm run cap:sync
```

## Native Development

To add the native platforms, run:

```bash
npx cap add android
npx cap add ios
```

### Native Project Automation

The patch script configures your Xcode `.pbxproj`/`Info.plist` and Android `build.gradle` to pull their App ID, Version, and App Name from your `package.json`/`capacitor.config.ts`:

```bash
npm run cap:patch
```

Run it once immediately after adding your platforms, so the native projects are correctly configured before you first open them. You don't need to remember to run it again after that — every `cap:sync` and `cap:build:*` script below runs it automatically, so App ID, version, and app name always stay in sync with `package.json` on every build, for both Android and iOS alike.

Once patched, open the native IDEs (Android Studio or Xcode) to build and run on simulators/devices:

```bash
npm run cap:open:android
npm run cap:open:ios
```

## Production Builds

Use Capacitor to build the native apps (release builds — these require your own signing/keystore configuration):

```bash
npm run cap:build:android
npm run cap:build:ios
```

## Local Debug Builds (no Android Studio / Xcode needed)

To build, sync, and produce an installable debug build from the command line — the same process the CI pipeline uses — run:

```bash
npm run cap:build:android-debug
npm run cap:build:ios-debug
```

`cap:build:android-debug` produces an unsigned debug APK (using the auto-generated debug keystore) at `android/app/build/outputs/apk/debug/*.apk`. On Windows, run this via Git Bash (not PowerShell/cmd), since it calls the `gradlew` wrapper script directly.

`cap:build:ios-debug` produces a simulator build at `ios/App/build/Build/Products/Debug-iphonesimulator/*.app`. This requires Xcode and the iOS Simulator, so it only runs on macOS — there is no Windows/Linux equivalent for iOS.

## CI/CD

If configured, GitHub Actions workflows under `.github/workflows/` (`android-build.yml` / `ios-build.yml`) build a debug APK/app on every push and upload it as a workflow artifact. Each workflow syncs Capacitor and then runs `npm run cap:patch` before building, so the App ID/version baked into the artifact always matches the `package.json` at the commit being built, even if the native project files were committed at an older version.

For these workflows to work, the `android/` and/or `ios/` native platform folders must be committed to the repository — run `npx cap add android` / `npx cap add ios`, then `npm run cap:patch`, then commit the resulting folders before pushing.
