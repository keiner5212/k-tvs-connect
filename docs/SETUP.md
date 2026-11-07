# Setup

## Requirements

- Node 20.19.4 or newer, npm only, never pnpm or yarn
- JDK 17 or newer for the Android build
- A physical Android phone over usb, Android 12 or newer for the bluetooth
  permissions, or an emulator with a bluetooth capable image

## Install

```sh
npm install
```

## Run on a development client

The app does not run in Expo Go. It needs a development build because it uses
bluetooth and the native map.

```sh
npm run android        # build and install on the connected device
npm start              # start the dev server only, then open the dev client
```

After changing the plugins in `app.json`, run `npx expo prebuild --clean` before
the next native build.

## Build the apk in Docker, no EAS

```sh
tools/build-apk.sh
```

It builds `docker/Dockerfile` on top of the community android image, pins the sdk
components that React Native 0.81 expects (platform 36, build tools 36.0.0, ndk
27.1.12297006, cmake 3.30.5) and leaves the apk in `build/app-debug.apk`.

```sh
adb install -r build/app-debug.apk
tools/verify-bundle.sh build/app-debug.apk
```

The verify step fails the build if a TVS host or the vendor credentials reappear in
the bundle.

## Local routing service

```sh
docker compose -f docker/docker-compose.valhalla.yml up -d
```

Then set the routing url in Settings to `http://127.0.0.1:8002`. See
[FREE_SERVICES.md](FREE_SERVICES.md).

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
