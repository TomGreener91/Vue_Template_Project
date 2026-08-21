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

If you are building for iOS or Android, run the unified patch script immediately after adding your platforms. This dynamically configures your Xcode `.pbxproj`, `Info.plist`, and Android `build.gradle` to pull their App ID, Version, and App Name directly from your `package.json`.

```bash
npm run cap:patch
```

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

## Local Debug APK (no Android Studio needed)

To sync and build an installable debug APK from the command line — the same process the CI pipeline uses — run:

```bash
npm run cap:build:android-debug
```

This produces an unsigned debug build (using the auto-generated debug keystore) at `android/app/build/outputs/apk/debug/*.apk`. On Windows, run this via Git Bash (not PowerShell/cmd), since it calls the `gradlew` wrapper script directly.

## CI/CD

If configured, GitHub Actions workflows under `.github/workflows/` (`android-build.yml` / `ios-build.yml`) build a debug APK/app on every push and upload it as a workflow artifact. For these to work, the `android/` and/or `ios/` native platform folders must be committed to the repository — run `npx cap add android` / `npx cap add ios`, then `npm run cap:patch`, then commit the resulting folders before pushing.
