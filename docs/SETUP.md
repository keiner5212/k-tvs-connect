# Setup

## Requirements

- Node 20 or newer (the workspace runs Node 24)
- npm only, never pnpm or yarn
- Android Studio or a physical device with USB debugging for the Android build
- JDK 21 for the Android Gradle build (the RE toolchain pins the same JDK)

## Install

```sh
npm install
```

## Run on a development client

The app does not run in Expo Go. It needs a development build.

```sh
npm run android        # build and run on a connected device or emulator
npm start              # start the dev server only, then open the dev client
```

## Build with EAS

```sh
npm run build-dev:android   # development build, internal distribution
npm run build:android       # production build
```

## Checks

```sh
npm run lint
npm run typecheck
npm test
```

## Reverse engineering toolchain

The scripts under `tools/` need the toolchain described in the root `README.md`.
Load it into the shell before using them:

```sh
. tools/env.sh
```
