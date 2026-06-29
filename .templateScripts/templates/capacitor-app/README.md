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

Before running or syncing the app with Capacitor, you must first build the Vue web assets:

```bash
npm run build
```

Then sync the web assets to the native projects:

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

Use Capacitor to build the native apps:

```bash
npm run cap:build:android
npm run cap:build:ios
```
